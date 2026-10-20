'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');

function loadSecret(dataDir) {
  if (process.env.SESSION_SECRET) {
    if (process.env.SESSION_SECRET.length < 32) {
      throw new Error('SESSION_SECRET must be at least 32 characters long.');
    }
    return process.env.SESSION_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET is required in production.');
  }
  // Development convenience: persist a random secret next to the database.
  const file = path.join(dataDir, '.secret');
  if (fs.existsSync(file)) return fs.readFileSync(file, 'utf8').trim();
  const secret = crypto.randomBytes(48).toString('base64url');
  fs.writeFileSync(file, secret, { mode: 0o600 });
  return secret;
}

function buildConfig(overrides = {}) {
  const env = process.env;
  const isProd = (overrides.env || env.NODE_ENV) === 'production';
  const dataDir = overrides.dataDir || env.DATA_DIR || path.join(ROOT, 'data');
  fs.mkdirSync(dataDir, { recursive: true, mode: 0o700 });

  return {
    root: ROOT,
    isProd,
    port: Number(env.PORT) || 3000,
    dataDir,
    dbPath: overrides.dbPath || env.DB_PATH || path.join(dataDir, 'academy.db'),
    secret: overrides.secret || loadSecret(dataDir),
    // Hop count of trusted reverse proxies (e.g. 1 behind nginx / a load balancer).
    trustProxy: Number(env.TRUST_PROXY) || 0,
    adminPath: (env.ADMIN_PATH || '/admin').replace(/\/+$/, ''),
    contactEmail: env.CONTACT_EMAIL || 'mutasem@sarrawy.com',
    sessionIdleMinutes: Number(env.SESSION_IDLE_MINUTES) || 30,
    sessionMaxHours: Number(env.SESSION_MAX_HOURS) || 8,
    minFormSeconds: overrides.minFormSeconds ?? (Number(env.MIN_FORM_SECONDS) || 3),
    rateLimits: overrides.rateLimits ?? true,
    anthropicApiKey: overrides.anthropicApiKey ?? env.ANTHROPIC_API_KEY ?? '',
    chatbotModel: env.CHATBOT_MODEL || 'claude-opus-5-5',
  };
}

module.exports = { buildConfig };
