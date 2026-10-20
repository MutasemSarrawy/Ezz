'use strict';

const path = require('node:path');
const express = require('express');
const helmet = require('helmet');
const { buildConfig } = require('./config');
const { openDb } = require('./db');
const { csrf, loadAdmin } = require('./lib/middleware');
const { createChatbot } = require('./lib/chatbot');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

function createApp(overrides = {}) {
  const config = buildConfig(overrides);
  const db = openDb(config.dbPath);
  const chatbot = overrides.chatbot || createChatbot(config);
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);
  app.set('view engine', 'ejs');
  app.set('views', path.join(config.root, 'views'));
  if (config.isProd) app.set('view cache', true);

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'none'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        ...(config.isProd ? { upgradeInsecureRequests: [] } : {}),
      },
    },
    strictTransportSecurity: config.isProd ? { maxAge: 63072000, includeSubDomains: true, preload: true } : false,
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }));
  app.use((req, res, next) => {
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()');
    next();
  });

  app.use('/static', express.static(path.join(config.root, 'public'), {
    maxAge: config.isProd ? '7d' : 0,
    index: false,
    dotfiles: 'deny',
  }));

  app.use((req, res, next) => {
    res.locals.path = req.path;
    res.locals.adminPath = config.adminPath;
    res.locals.contactEmail = config.contactEmail;
    res.locals.year = new Date().getFullYear();
    next();
  });

  app.use(express.urlencoded({ extended: false, limit: '20kb', parameterLimit: 50 }));
  app.use(express.json({ limit: '16kb' }));

  app.use(csrf(config));
  app.use(loadAdmin(db, config));

  app.use(config.adminPath, adminRoutes({ db, config }));
  app.use('/', publicRoutes({ db, config, chatbot }));

  app.use((req, res) => {
    res.status(404).render('error', { title: 'Page not found', message: 'The page you are looking for does not exist.' });
  });

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    const message = status === 413 ? 'That submission is too large.'
      : status < 500 ? 'The request could not be processed.'
        : 'Something went wrong on our side. Please try again.';
    if (req.path.startsWith('/api/')) return res.status(status).json({ error: message });
    return res.status(status).render('error', { title: 'Error', message });
  });

  // Hourly housekeeping: drop expired sessions and old chat logs.
  const cleanup = setInterval(() => {
    const t = Date.now();
    db.prepare('DELETE FROM sessions WHERE last_seen < ? OR created_at < ?')
      .run(t - config.sessionIdleMinutes * 60_000, t - config.sessionMaxHours * 3_600_000);
    db.prepare('DELETE FROM chat_logs WHERE created_at < ?').run(t - 90 * 86_400_000);
  }, 3_600_000);
  cleanup.unref();

  app.locals.fmtDate = (ms) => new Date(ms).toLocaleString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
  }) + ' UTC';
  app.locals.db = db;
  app.locals.config = config;
  return app;
}

module.exports = { createApp };
