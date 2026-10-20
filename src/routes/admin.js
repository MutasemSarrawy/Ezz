'use strict';

const express = require('express');
const rateLimit = require('express-rate-limit');
const { validate, toId } = require('../lib/validate');
const {
  verifyPassword, hashPassword, getDummyHash, passwordProblems,
} = require('../lib/security');
const {
  createAdminSession, destroyAdminSession, requireAdmin, audit,
} = require('../lib/middleware');

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const ENROLLMENT_STATUSES = ['new', 'contacted', 'accepted', 'declined'];
const RESOURCE_KINDS = ['Course', 'Video', 'Article', 'Guide', 'Tool', 'Book'];

const RESOURCE_SCHEMA = {
  title: { label: 'Title', required: true, max: 120 },
  description: { label: 'Description', required: true, max: 400, multiline: true },
  url: { label: 'Link', required: true, max: 500, url: true },
  category: { label: 'Category', required: true, max: 40 },
  kind: { label: 'Type', required: true, oneOf: RESOURCE_KINDS },
  position: { label: 'Order', max: 5 },
};

module.exports = function adminRoutes({ db, config }) {
  const router = express.Router();
  const base = config.adminPath;
  const auth = requireAdmin(config);

  router.use((req, res, next) => {
    res.set('X-Robots-Tag', 'noindex, nofollow');
    res.locals.section = req.path.split('/')[1] || 'dashboard';
    next();
  });

  const loginLimiter = config.rateLimits
    ? rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 10,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skipSuccessfulRequests: true,
      handler: (req, res) => res.status(429).render('admin/login', {
        title: 'Sign in', error: 'Too many sign-in attempts. Please wait 15 minutes.', email: '',
      }),
    })
    : (req, res, next) => next();

  // ---------- Authentication ----------

  router.get('/login', (req, res) => {
    if (req.admin) return res.redirect(base);
    res.set('Cache-Control', 'no-store');
    return res.render('admin/login', { title: 'Sign in', error: null, email: '' });
  });

  router.post('/login', loginLimiter, async (req, res, next) => {
    try {
      const email = String(req.body.email || '').trim().slice(0, 200);
      const password = String(req.body.password || '').slice(0, 200);
      const fail = (msg = 'Incorrect email or password.') =>
        res.status(401).render('admin/login', { title: 'Sign in', error: msg, email });

      const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
      // Always run a full password check so response time does not reveal which emails exist.
      const valid = await verifyPassword(password, admin ? admin.password_hash : await getDummyHash());
      const t = Date.now();

      if (!admin) {
        audit(db, req, 'login.failed', `unknown account: ${email}`);
        return fail();
      }
      if (admin.locked_until > t) {
        audit(db, req, 'login.locked', email);
        return fail('This account is temporarily locked after too many failed attempts. Try again later.');
      }
      if (!valid) {
        const failed = admin.failed_logins + 1;
        const lock = failed >= MAX_FAILED_LOGINS ? t + LOCK_MINUTES * 60_000 : 0;
        db.prepare('UPDATE admins SET failed_logins = ?, locked_until = ? WHERE id = ?')
          .run(lock ? 0 : failed, lock, admin.id);
        audit(db, req, lock ? 'login.lockout' : 'login.failed', email);
        return fail();
      }

      db.prepare('UPDATE admins SET failed_logins = 0, locked_until = 0, last_login_at = ? WHERE id = ?').run(t, admin.id);
      // A fresh session token on every login prevents session fixation.
      createAdminSession(db, config, req, res, admin.id);
      req.admin = admin;
      audit(db, req, 'login.success', email);
      return res.redirect(303, base);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/logout', (req, res) => {
    if (req.admin) audit(db, req, 'logout');
    destroyAdminSession(db, config, req, res);
    res.redirect(303, `${base}/login`);
  });

  // Everything below requires a signed-in admin.
  router.use(auth);

  // ---------- Dashboard ----------

  router.get('/', (req, res) => {
    const count = (sql) => db.prepare(sql).get().n;
    const weekAgo = Date.now() - 7 * 86_400_000;
    res.render('admin/dashboard', {
      title: 'Dashboard',
      stats: {
        unread: count('SELECT COUNT(*) AS n FROM messages WHERE is_read = 0'),
        messages: count('SELECT COUNT(*) AS n FROM messages'),
        newEnrollments: count("SELECT COUNT(*) AS n FROM enrollments WHERE status = 'new'"),
        enrollments: count('SELECT COUNT(*) AS n FROM enrollments'),
        resources: count('SELECT COUNT(*) AS n FROM resources WHERE published = 1'),
        chatsWeek: db.prepare('SELECT COUNT(*) AS n FROM chat_logs WHERE created_at > ?').get(weekAgo).n,
      },
      recentMessages: db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 5').all(),
      recentEnrollments: db.prepare('SELECT * FROM enrollments ORDER BY created_at DESC LIMIT 5').all(),
    });
  });

  // ---------- Messages ----------

  router.get('/messages', (req, res) => {
    const messages = db.prepare('SELECT * FROM messages ORDER BY created_at DESC LIMIT 500').all();
    res.render('admin/messages', { title: 'Messages', messages });
  });

  router.get('/messages/:id', (req, res) => {
    const id = toId(req.params.id);
    const message = id && db.prepare('SELECT * FROM messages WHERE id = ?').get(id);
    if (!message) return res.redirect(`${base}/messages`);
    if (!message.is_read) db.prepare('UPDATE messages SET is_read = 1 WHERE id = ?').run(id);
    return res.render('admin/message', { title: message.subject, message });
  });

  router.post('/messages/:id/unread', (req, res) => {
    const id = toId(req.params.id);
    if (id) db.prepare('UPDATE messages SET is_read = 0 WHERE id = ?').run(id);
    res.redirect(303, `${base}/messages`);
  });

  router.post('/messages/:id/delete', (req, res) => {
    const id = toId(req.params.id);
    if (id && db.prepare('DELETE FROM messages WHERE id = ?').run(id).changes) audit(db, req, 'message.delete', `#${id}`);
    res.redirect(303, `${base}/messages`);
  });

  // ---------- Enrollments ----------

  router.get('/enrollments', (req, res) => {
    const enrollments = db.prepare('SELECT * FROM enrollments ORDER BY created_at DESC LIMIT 1000').all();
    res.render('admin/enrollments', { title: 'Enrollments', enrollments, statuses: ENROLLMENT_STATUSES });
  });

  router.get('/enrollments.csv', (req, res) => {
    const rows = db.prepare('SELECT * FROM enrollments ORDER BY created_at DESC').all();
    // Quote every cell and neutralise leading formula characters (CSV injection).
    const cell = (v) => {
      let s = v == null ? '' : String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const header = ['id', 'created_at', 'name', 'email', 'phone', 'level', 'status', 'goals'];
    const lines = rows.map((r) => [r.id, new Date(r.created_at).toISOString(), r.name, r.email, r.phone, r.level, r.status, r.goals].map(cell).join(','));
    audit(db, req, 'enrollments.export', `${rows.length} rows`);
    res.set('Content-Disposition', 'attachment; filename="enrollments.csv"');
    res.type('text/csv').send([header.join(','), ...lines].join('\r\n'));
  });

  router.post('/enrollments/:id/status', (req, res) => {
    const id = toId(req.params.id);
    const status = String(req.body.status || '');
    if (id && ENROLLMENT_STATUSES.includes(status)) {
      db.prepare('UPDATE enrollments SET status = ? WHERE id = ?').run(status, id);
      audit(db, req, 'enrollment.status', `#${id} → ${status}`);
    }
    res.redirect(303, `${base}/enrollments`);
  });

  router.post('/enrollments/:id/delete', (req, res) => {
    const id = toId(req.params.id);
    if (id && db.prepare('DELETE FROM enrollments WHERE id = ?').run(id).changes) audit(db, req, 'enrollment.delete', `#${id}`);
    res.redirect(303, `${base}/enrollments`);
  });

  // ---------- Free resources ----------

  router.get('/resources', (req, res) => {
    const resources = db.prepare('SELECT * FROM resources ORDER BY position, id').all();
    res.render('admin/resources', { title: 'Free sources', resources });
  });

  const renderResourceForm = (res, resource, errors = {}, status = 200) =>
    res.status(status).render('admin/resource-form', { title: resource.id ? 'Edit source' : 'New source', resource, errors, kinds: RESOURCE_KINDS });

  router.get('/resources/new', (req, res) => renderResourceForm(res, { published: 1, kind: 'Course' }));

  router.get('/resources/:id/edit', (req, res) => {
    const id = toId(req.params.id);
    const resource = id && db.prepare('SELECT * FROM resources WHERE id = ?').get(id);
    if (!resource) return res.redirect(`${base}/resources`);
    return renderResourceForm(res, resource);
  });

  function saveResource(req, res, id) {
    const { values, errors, ok } = validate(req.body, RESOURCE_SCHEMA);
    const position = values.position ? Number(values.position) : 0;
    if (!Number.isInteger(position) || position < 0) errors.position = 'Order must be a whole number.';
    const published = req.body.published === '1' ? 1 : 0;
    if (!ok || errors.position) return renderResourceForm(res, { ...values, id, published }, errors, 422);
    if (id) {
      db.prepare('UPDATE resources SET title = ?, description = ?, url = ?, category = ?, kind = ?, published = ?, position = ? WHERE id = ?')
        .run(values.title, values.description, values.url, values.category, values.kind, published, position, id);
      audit(db, req, 'resource.update', `#${id} ${values.title}`);
    } else {
      const r = db.prepare('INSERT INTO resources (title, description, url, category, kind, published, position, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
        .run(values.title, values.description, values.url, values.category, values.kind, published, position, Date.now());
      audit(db, req, 'resource.create', `#${r.lastInsertRowid} ${values.title}`);
    }
    return res.redirect(303, `${base}/resources`);
  }

  router.post('/resources', (req, res) => saveResource(req, res, null));

  router.post('/resources/:id', (req, res) => {
    const id = toId(req.params.id);
    if (!id || !db.prepare('SELECT 1 FROM resources WHERE id = ?').get(id)) return res.redirect(303, `${base}/resources`);
    return saveResource(req, res, id);
  });

  router.post('/resources/:id/delete', (req, res) => {
    const id = toId(req.params.id);
    if (id && db.prepare('DELETE FROM resources WHERE id = ?').run(id).changes) audit(db, req, 'resource.delete', `#${id}`);
    res.redirect(303, `${base}/resources`);
  });

  // ---------- Course ----------

  const renderCourse = (res, extra = {}, status = 200) => res.status(status).render('admin/course', {
    title: 'Course',
    course: db.prepare('SELECT * FROM course WHERE id = 1').get(),
    modules: db.prepare('SELECT * FROM course_modules ORDER BY position, id').all(),
    errors: {},
    saved: false,
    ...extra,
  });

  router.get('/course', (req, res) => renderCourse(res, { saved: req.query.saved === '1' }));

  router.post('/course', (req, res) => {
    const { values, errors, ok } = validate(req.body, {
      title: { label: 'Title', required: true, max: 80 },
      tagline: { label: 'Tagline', required: true, max: 160 },
      summary: { label: 'Summary', required: true, max: 1200, multiline: true },
      duration: { label: 'Duration', required: true, max: 60 },
      format: { label: 'Format', required: true, max: 80 },
      level: { label: 'Level', required: true, max: 60 },
      price_label: { label: 'Price', required: true, max: 80 },
    });
    const open = req.body.enrollment_open === '1' ? 1 : 0;
    if (!ok) return renderCourse(res, { course: { ...values, enrollment_open: open }, errors }, 422);
    db.prepare(`UPDATE course SET title = ?, tagline = ?, summary = ?, duration = ?, format = ?, level = ?,
                price_label = ?, enrollment_open = ?, updated_at = ? WHERE id = 1`)
      .run(values.title, values.tagline, values.summary, values.duration, values.format, values.level, values.price_label, open, Date.now());
    audit(db, req, 'course.update');
    return res.redirect(303, `${base}/course?saved=1`);
  });

  const MODULE_SCHEMA = {
    title: { label: 'Module title', required: true, max: 100 },
    description: { label: 'Module description', required: true, max: 500, multiline: true },
    position: { label: 'Order', max: 3 },
  };

  router.post('/course/modules', (req, res) => {
    const { values, ok } = validate(req.body, MODULE_SCHEMA);
    if (ok) {
      const position = Number(values.position) || (db.prepare('SELECT COALESCE(MAX(position), 0) AS n FROM course_modules').get().n + 1);
      db.prepare('INSERT INTO course_modules (position, title, description) VALUES (?, ?, ?)').run(position, values.title, values.description);
      audit(db, req, 'module.create', values.title);
    }
    res.redirect(303, `${base}/course#modules`);
  });

  router.post('/course/modules/:id', (req, res) => {
    const id = toId(req.params.id);
    const { values, ok } = validate(req.body, MODULE_SCHEMA);
    if (id && ok) {
      db.prepare('UPDATE course_modules SET position = ?, title = ?, description = ? WHERE id = ?')
        .run(Number(values.position) || 0, values.title, values.description, id);
      audit(db, req, 'module.update', `#${id}`);
    }
    res.redirect(303, `${base}/course#modules`);
  });

  router.post('/course/modules/:id/delete', (req, res) => {
    const id = toId(req.params.id);
    if (id && db.prepare('DELETE FROM course_modules WHERE id = ?').run(id).changes) audit(db, req, 'module.delete', `#${id}`);
    res.redirect(303, `${base}/course#modules`);
  });

  // ---------- Chat logs & audit ----------

  router.get('/chats', (req, res) => {
    const chats = db.prepare('SELECT * FROM chat_logs ORDER BY created_at DESC LIMIT 300').all();
    res.render('admin/chats', { title: 'Chat assistant', chats });
  });

  router.get('/security', (req, res) => {
    const events = db.prepare(
      `SELECT l.*, a.email FROM audit_log l LEFT JOIN admins a ON a.id = l.admin_id
        ORDER BY l.created_at DESC LIMIT 300`
    ).all();
    const sessions = db.prepare('SELECT id_hash, created_at, last_seen, ip, user_agent FROM sessions WHERE admin_id = ? ORDER BY last_seen DESC')
      .all(req.admin.id)
      .map((s) => ({ ...s, current: s.id_hash === req.admin.sessionHash }));
    res.render('admin/security', { title: 'Security', events, sessions });
  });

  // ---------- Account ----------

  const renderAccount = (res, extra = {}, status = 200) =>
    res.status(status).render('admin/account', { title: 'Account', errors: [], saved: false, ...extra });

  router.get('/account', (req, res) => renderAccount(res, { saved: req.query.saved === '1' }));

  router.post('/account/password', async (req, res, next) => {
    try {
      const current = String(req.body.current_password || '');
      const next1 = String(req.body.new_password || '');
      const next2 = String(req.body.confirm_password || '');
      const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.admin.id);
      if (!(await verifyPassword(current.slice(0, 200), admin.password_hash))) {
        audit(db, req, 'password.change_failed');
        return renderAccount(res, { errors: ['Your current password is incorrect.'] }, 422);
      }
      const errors = passwordProblems(next1, admin);
      if (next1 !== next2) errors.push('The new passwords do not match.');
      if (next1 === current) errors.push('Choose a password different from the current one.');
      if (errors.length) return renderAccount(res, { errors }, 422);
      db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(await hashPassword(next1), admin.id);
      // Sign out every other session for this admin.
      db.prepare('DELETE FROM sessions WHERE admin_id = ? AND id_hash != ?').run(admin.id, req.admin.sessionHash);
      audit(db, req, 'password.changed');
      return res.redirect(303, `${base}/account?saved=1`);
    } catch (err) {
      return next(err);
    }
  });

  router.post('/account/sessions/revoke-others', (req, res) => {
    const n = db.prepare('DELETE FROM sessions WHERE admin_id = ? AND id_hash != ?').run(req.admin.id, req.admin.sessionHash).changes;
    audit(db, req, 'sessions.revoked', `${n} sessions`);
    res.redirect(303, `${base}/security`);
  });

  return router;
};
