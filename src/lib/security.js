'use strict';

const crypto = require('node:crypto');

// ---------- Passwords (scrypt, built into Node — no native dependencies) ----------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

function scrypt(password, salt, params) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, params.keylen, { N: params.N, r: params.r, p: params.p, maxmem: params.maxmem },
      (err, key) => (err ? reject(err) : resolve(key)));
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scrypt(password, Buffer.from(saltB64, 'base64'), {
    N: Number(N), r: Number(r), p: Number(p), keylen: expected.length, maxmem: SCRYPT.maxmem,
  });
  return crypto.timingSafeEqual(key, expected);
}

// A real hash of a random password, used so that logins for unknown emails
// take the same time as logins for known ones (no user enumeration by timing).
let dummyHash;
async function getDummyHash() {
  if (!dummyHash) dummyHash = await hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

function passwordProblems(password, { email = '', name = '' } = {}) {
  const problems = [];
  const pw = String(password || '');
  if (pw.length < 12) problems.push('Use at least 12 characters.');
  if (pw.length > 200) problems.push('Use at most 200 characters.');
  const classes = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((re) => re.test(pw)).length;
  if (classes < 3) problems.push('Mix at least three of: lowercase, uppercase, numbers, symbols.');
  const lower = pw.toLowerCase();
  const local = String(email).split('@')[0].toLowerCase();
  if ((local.length >= 4 && lower.includes(local)) || (name.length >= 4 && lower.includes(name.toLowerCase()))) {
    problems.push('Do not include your name or email in the password.');
  }
  return problems;
}

// ---------- Tokens ----------

function randomToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(secret, value) {
  return crypto.createHmac('sha256', secret).update(value).digest('base64url');
}

function safeEqual(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

module.exports = {
  hashPassword, verifyPassword, getDummyHash, passwordProblems,
  randomToken, sha256, hmac, safeEqual,
};
