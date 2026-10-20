'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate, clean } = require('../lib/validate');
const { formStamp, looksLikeBot } = require('../lib/middleware');

const LEVELS = ['Complete beginner', 'Some experience', 'Already using AI at work', 'Developer'];

function limiter(config, opts) {
  if (!config.rateLimits) return (req, res, next) => next();
  return rateLimit({ standardHeaders: 'draft-7', legacyHeaders: false, ...opts });
}

module.exports = function publicRoutes({ db, config, chatbot }) {
  const router = express.Router();

  const getCourse = () => db.prepare('SELECT * FROM course WHERE id = 1').get();
  const getModules = () => db.prepare('SELECT * FROM course_modules ORDER BY position, id').all();

  const formLimiter = limiter(config, {
    windowMs: 60 * 60 * 1000,
    limit: 8,
    handler: (req, res) => res.status(429).render('error', {
      title: 'Too many submissions',
      message: 'You have sent several forms in a short time. Please wait a while and try again.',
    }),
  });
  const chatLimiter = limiter(config, {
    windowMs: 60 * 1000,
    limit: 15,
    handler: (req, res) => res.status(429).json({ error: 'You are sending messages too quickly. Please wait a moment.' }),
  });

  router.get('/', (req, res) => {
    const resources = db.prepare('SELECT * FROM resources WHERE published = 1 ORDER BY position, id LIMIT 3').all();
    res.render('home', { title: null, course: getCourse(), modules: getModules(), resources });
  });

  router.get('/about', (req, res) => {
    res.render('about', { title: 'About' });
  });

  // ---------- Course ----------

  function renderCourse(res, extra = {}) {
    res.render('course', {
      title: getCourse().title,
      course: getCourse(),
      modules: getModules(),
      levels: LEVELS,
      stamp: formStamp(config),
      values: {},
      errors: {},
      sent: false,
      ...extra,
    });
  }

  router.get('/course', (req, res) => renderCourse(res, { sent: req.query.sent === '1' }));

  router.post('/course/apply', formLimiter, (req, res) => {
    const course = getCourse();
    if (!course.enrollment_open) return res.redirect(303, '/course');
    if (looksLikeBot(config, req.body)) return res.redirect(303, '/course?sent=1#apply');
    const { values, errors, ok } = validate(req.body, {
      name: { label: 'Name', required: true, max: 100 },
      email: { label: 'Email', required: true, max: 200, email: true },
      phone: { label: 'Phone', max: 30 },
      level: { label: 'Experience level', required: true, oneOf: LEVELS },
      goals: { label: 'Goals', max: 2000, multiline: true },
    });
    if (values.phone && !/^[+()0-9\s-]{6,30}$/.test(values.phone)) errors.phone = 'Please enter a valid phone number.';
    if (!ok || errors.phone) return res.status(422).render('course', {
      title: course.title, course, modules: getModules(), levels: LEVELS,
      stamp: formStamp(config), values, errors, sent: false,
    });
    db.prepare('INSERT INTO enrollments (name, email, phone, level, goals, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(values.name, values.email, values.phone || null, values.level, values.goals || null, Date.now());
    return res.redirect(303, '/course?sent=1#apply');
  });

  // ---------- Free sources ----------

  router.get('/resources', (req, res) => {
    const resources = db.prepare('SELECT * FROM resources WHERE published = 1 ORDER BY position, id').all();
    const categories = [...new Set(resources.map((r) => r.category))];
    res.render('resources', { title: 'Free Sources', resources, categories });
  });

  // ---------- Contact ----------

  router.get('/contact', (req, res) => {
    res.render('contact', {
      title: 'Contact us', stamp: formStamp(config), values: {}, errors: {}, sent: req.query.sent === '1',
    });
  });

  router.post('/contact', formLimiter, (req, res) => {
    if (looksLikeBot(config, req.body)) return res.redirect(303, '/contact?sent=1');
    const { values, errors, ok } = validate(req.body, {
      name: { label: 'Name', required: true, max: 100 },
      email: { label: 'Email', required: true, max: 200, email: true },
      subject: { label: 'Subject', required: true, max: 150 },
      message: { label: 'Message', required: true, min: 10, max: 5000, multiline: true },
    });
    if (!ok) {
      return res.status(422).render('contact', { title: 'Contact us', stamp: formStamp(config), values, errors, sent: false });
    }
    db.prepare('INSERT INTO messages (name, email, subject, body, ip, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(values.name, values.email, values.subject, values.message, req.ip, Date.now());
    return res.redirect(303, '/contact?sent=1');
  });

  // ---------- Chat assistant ----------

  router.post('/api/chat', chatLimiter, async (req, res, next) => {
    try {
      const message = clean(req.body && req.body.message, { multiline: true });
      if (!message || message.length > 500) {
        return res.status(400).json({ error: 'Please write a message of up to 500 characters.' });
      }
      // Client-supplied history is untrusted: keep only well-formed, short, alternating turns.
      const raw = Array.isArray(req.body.history) ? req.body.history.slice(-8) : [];
      const history = [];
      for (const turn of raw) {
        const role = turn && (turn.role === 'user' || turn.role === 'assistant') ? turn.role : null;
        const content = clean(turn && turn.content, { multiline: true }).slice(0, 1000);
        const expected = history.length % 2 === 0 ? 'user' : 'assistant';
        if (role === expected && content) history.push({ role, content });
      }
      if (history.length % 2 === 1) history.pop();

      const { answer, source } = await chatbot.reply({ message, history, course: getCourse(), modules: getModules() });
      db.prepare('INSERT INTO chat_logs (question, answer, source, created_at) VALUES (?, ?, ?, ?)')
        .run(message, answer.slice(0, 2000), source, Date.now());
      return res.json({ answer });
    } catch (err) {
      return next(err);
    }
  });

  router.get('/robots.txt', (req, res) => {
    // The admin path is deliberately not listed here; admin pages send X-Robots-Tag: noindex instead.
    res.type('text/plain').send('User-agent: *\nDisallow: /api/\n');
  });

  return router;
};
