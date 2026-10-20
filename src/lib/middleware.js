'use strict';

const { randomToken, sha256, hmac, safeEqual } = require('./security');

function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    const key = part.slice(0, i).trim();
    if (!key || key in out) continue;
    try {
      out[key] = decodeURIComponent(part.slice(i + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return out;
}

function cookieNames(config) {
  // The __Host- prefix makes browsers refuse the cookie unless it is Secure,
  // host-only and scoped to "/", which blocks subdomain cookie injection.
  const prefix = config.isProd ? '__Host-' : '';
  return { session: `${prefix}sa_admin`, csrf: `${prefix}sa_csrf` };
}

function setCookie(res, config, name, value, { maxAge, sameSite = 'Lax' } = {}) {
  res.cookie(name, value, {
    httpOnly: true,
    secure: config.isProd,
    sameSite,
    path: '/',
    ...(maxAge !== undefined ? { maxAge } : {}),
  });
}

// ---------- CSRF: signed double-submit token bound to an HttpOnly cookie ----------

function csrf(config) {
  const names = cookieNames(config);
  return (req, res, next) => {
    req.cookies = parseCookies(req.headers.cookie);
    let seed = req.cookies[names.csrf];
    if (!seed || !/^[A-Za-z0-9_-]{43}$/.test(seed)) {
      seed = randomToken();
      setCookie(res, config, names.csrf, seed);
    }
    const token = hmac(config.secret, `csrf:${seed}`);
    res.locals.csrfToken = token;
    req.rotateCsrf = () => setCookie(res, config, names.csrf, randomToken());

    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const submitted = (req.body && req.body._csrf) || req.get('x-csrf-token') || '';
    if (!req.cookies[names.csrf] || !safeEqual(submitted, token)) {
      if (req.path.startsWith('/api/')) {
        return res.status(403).json({ error: 'Your session expired. Please refresh the page and try again.' });
      }
      return res.status(403).render('error', {
        title: 'Session expired',
        message: 'Your form expired for security reasons. Please go back, refresh the page and try again.',
      });
    }
    return next();
  };
}

// ---------- Anti-spam: hidden honeypot + signed "form rendered at" timestamp ----------

function formStamp(config) {
  const t = String(Date.now());
  return `${t}.${hmac(config.secret, `form:${t}`)}`;
}

function looksLikeBot(config, body) {
  if (body.website) return true; // honeypot field, invisible to humans
  const [t, sig] = String(body._ts || '').split('.');
  if (!t || !sig || !safeEqual(sig, hmac(config.secret, `form:${t}`))) return true;
  const age = (Date.now() - Number(t)) / 1000;
  return age < config.minFormSeconds || age > 60 * 60 * 24;
}

// ---------- Admin sessions (server-side, token stored only as a hash) ----------

function createAdminSession(db, config, req, res, adminId) {
  const token = randomToken();
  const t = Date.now();
  db.prepare('INSERT INTO sessions (id_hash, admin_id, created_at, last_seen, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?)')
    .run(sha256(token), adminId, t, t, req.ip, String(req.get('user-agent') || '').slice(0, 300));
  setCookie(res, config, cookieNames(config).session, token, { sameSite: 'Strict' });
  req.rotateCsrf();
}

function destroyAdminSession(db, config, req, res) {
  const token = req.cookies[cookieNames(config).session];
  if (token) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(sha256(token));
  res.clearCookie(cookieNames(config).session, { path: '/', httpOnly: true, secure: config.isProd, sameSite: 'Strict' });
  req.rotateCsrf();
}

function loadAdmin(db, config) {
  const idleMs = config.sessionIdleMinutes * 60 * 1000;
  const maxMs = config.sessionMaxHours * 60 * 60 * 1000;
  return (req, res, next) => {
    const token = req.cookies[cookieNames(config).session];
    if (!token) return next();
    const hash = sha256(token);
    const row = db.prepare(
      `SELECT s.created_at, s.last_seen, a.id, a.email, a.name
         FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.id_hash = ?`
    ).get(hash);
    const t = Date.now();
    if (!row || t - row.last_seen > idleMs || t - row.created_at > maxMs) {
      if (row) db.prepare('DELETE FROM sessions WHERE id_hash = ?').run(hash);
      return next();
    }
    db.prepare('UPDATE sessions SET last_seen = ? WHERE id_hash = ?').run(t, hash);
    req.admin = { id: row.id, email: row.email, name: row.name, sessionHash: hash };
    res.locals.admin = req.admin;
    return next();
  };
}

function requireAdmin(config) {
  return (req, res, next) => {
    if (req.admin) {
      res.set('Cache-Control', 'no-store');
      return next();
    }
    if (req.method === 'GET') return res.redirect(`${config.adminPath}/login`);
    return res.status(401).render('error', { title: 'Signed out', message: 'Please sign in again.' });
  };
}

function audit(db, req, action, detail = '') {
  db.prepare('INSERT INTO audit_log (admin_id, action, detail, ip, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(req.admin ? req.admin.id : null, action, String(detail).slice(0, 500), req.ip, Date.now());
}

module.exports = {
  parseCookies, cookieNames, csrf, formStamp, looksLikeBot,
  createAdminSession, destroyAdminSession, loadAdmin, requireAdmin, audit,
};
