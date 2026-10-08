// server.js — PetServe entry point. Wires together db, routes, and HTTP server.
const http = require('node:http');
const path = require('node:path');
const { seedDatabase, makePersist } = require('./src/db');
const { createHandler } = require('./src/routes');

const DEFAULT_DB = path.join(__dirname, 'data', 'db.json');

async function createApp(options = {}) {
  const dbFile = options.dbFile || DEFAULT_DB;
  const db = await seedDatabase(dbFile);
  const sessions = new Map();
  const persist = makePersist(db, dbFile);
  if (
    (options.demoData ?? !options.dbFile) &&
    require('./src/demo-payments').prepareDemoPayments(db)
  )
    persist();
  const uploadsDir = options.uploadsDir || path.join(path.dirname(dbFile), 'uploads');
  const handler = createHandler(db, sessions, persist, uploadsDir);
  const server = http.createServer(handler);
  return { server, dbFile };
}

if (require.main === module) {
  require('./scripts/build.cjs').buildClient();
  createApp()
    .then(({ server }) => {
      const port = Number(process.env.PORT) || 3000;
      server.listen(port, '127.0.0.1', () =>
        console.log(`PetServe running at http://127.0.0.1:${port}`),
      );
    })
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { createApp };
