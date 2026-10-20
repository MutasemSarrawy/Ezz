'use strict';

const { createApp } = require('./app');

const app = createApp();
const { port, adminPath, isProd } = app.locals.config;

const server = app.listen(port, () => {
  console.log(`Sarrawy Academy running on http://localhost:${port} (${isProd ? 'production' : 'development'})`);
  console.log(`Admin panel: http://localhost:${port}${adminPath}`);
  const admins = app.locals.db.prepare('SELECT COUNT(*) AS n FROM admins').get().n;
  if (!admins) console.log('No admin account yet — create one with: npm run create-admin');
});

// Slowloris protection and sane connection limits.
server.headersTimeout = 20_000;
server.requestTimeout = 30_000;
server.keepAliveTimeout = 5_000;

function shutdown() {
  server.close(() => {
    app.locals.db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
