'use strict';

const { DatabaseSync } = require('node:sqlite');
const { seed } = require('./seed');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name          TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  failed_logins INTEGER NOT NULL DEFAULT 0,
  locked_until  INTEGER NOT NULL DEFAULT 0,
  last_login_at INTEGER,
  created_at    INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id_hash    TEXT PRIMARY KEY,
  admin_id   INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  ip         TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL,
  is_read    INTEGER NOT NULL DEFAULT 0,
  ip         TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  phone      TEXT,
  level      TEXT NOT NULL,
  goals      TEXT,
  status     TEXT NOT NULL DEFAULT 'new',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS resources (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  title       TEXT NOT NULL,
  description TEXT NOT NULL,
  url         TEXT NOT NULL,
  category    TEXT NOT NULL,
  kind        TEXT NOT NULL,
  published   INTEGER NOT NULL DEFAULT 1,
  position    INTEGER NOT NULL DEFAULT 0,
  created_at  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS course (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  title           TEXT NOT NULL,
  tagline         TEXT NOT NULL,
  summary         TEXT NOT NULL,
  duration        TEXT NOT NULL,
  format          TEXT NOT NULL,
  level           TEXT NOT NULL,
  price_label     TEXT NOT NULL,
  enrollment_open INTEGER NOT NULL DEFAULT 1,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS course_modules (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  position    INTEGER NOT NULL,
  title       TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_logs (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  source     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id   INTEGER,
  action     TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_enrollments_created ON enrollments(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at);
`;

function openDb(dbPath) {
  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec('PRAGMA busy_timeout = 5000;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function now() {
  return Date.now();
}

module.exports = { openDb, now };
