'use strict';

// Create or reset an admin account from the command line.
// Usage: npm run create-admin
//    or: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... npm run create-admin

const readline = require('node:readline');
const { buildConfig } = require('../src/config');
const { openDb } = require('../src/db');
const { hashPassword, passwordProblems } = require('../src/lib/security');
const { validate } = require('../src/lib/validate');

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (hidden) {
      const write = rl._writeToOutput;
      rl._writeToOutput = (s) => (s.includes(question) ? write.call(rl, s) : write.call(rl, ''));
      rl.question(question, (answer) => {
        rl._writeToOutput = write;
        process.stdout.write('\n');
        resolve(answer);
      });
    } else {
      rl.question(question, resolve);
    }
  });
}

async function main() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  const email = process.env.ADMIN_EMAIL || (await ask(rl, 'Admin email: '));
  const name = process.env.ADMIN_NAME || (await ask(rl, 'Admin name: '));
  let password = process.env.ADMIN_PASSWORD;
  if (!password) {
    password = await ask(rl, 'Password (min 12 chars): ', { hidden: true });
    const confirm = await ask(rl, 'Confirm password: ', { hidden: true });
    if (password !== confirm) throw new Error('Passwords do not match.');
  }
  rl.close();

  const { values, errors } = validate({ email, name }, {
    email: { label: 'Email', required: true, email: true, max: 200 },
    name: { label: 'Name', required: true, max: 100 },
  });
  const problems = [...Object.values(errors), ...passwordProblems(password, values)];
  if (problems.length) throw new Error(problems.join('\n'));

  const config = buildConfig();
  const db = openDb(config.dbPath);
  const hash = await hashPassword(password);
  const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(values.email);
  if (existing) {
    db.prepare('UPDATE admins SET name = ?, password_hash = ?, failed_logins = 0, locked_until = 0 WHERE id = ?')
      .run(values.name, hash, existing.id);
    db.prepare('DELETE FROM sessions WHERE admin_id = ?').run(existing.id);
    console.log(`Updated admin ${values.email} and signed out its sessions.`);
  } else {
    db.prepare('INSERT INTO admins (email, name, password_hash, created_at) VALUES (?, ?, ?, ?)')
      .run(values.email, values.name, hash, Date.now());
    console.log(`Created admin ${values.email}.`);
  }
  db.close();
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
