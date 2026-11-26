const path = require('path');
const jsonServer = require('json-server');
const { webcrypto } = require('crypto');
const { openDatabase } = require('./database.cjs');
const { API_ROUTES } = require('../.angular/mock-api/domain/core/api-routes');
const { applyLibraryCommand, parseLibrarySnapshot } = require('../.angular/mock-api/domain/core/library-transaction');
const { memberView } = require('../.angular/mock-api/domain/core/member-rules');

const HOST = '127.0.0.1';
const PORT = 3000;
const DATABASE = path.join(__dirname, 'data', 'db.json');

function createServer(database) {
  const app = jsonServer.create();
  app.use('/api', (request, response, next) => {
    response.set('Cache-Control', 'no-store');
    if (!isLocal(request.headers.host) || (request.headers.origin && !isLocalOrigin(request.headers.origin))) {
      return response.status(403).json({ message: 'Use the local BookSphere development server.' });
    }
    next();
  });
  app.use('/api', jsonServer.bodyParser);
  const selectors = {
    snapshot: state => state,
    books: state => state.circulation.books,
    members: state => state.members.records.map(record => memberView(record)),
    loans: state => state.circulation.loans,
    reservations: state => state.circulation.reservations,
    fines: state => state.circulation.fines,
    payments: state => state.circulation.payments,
    settings: state => state.circulation.settings,
    activities: state => [...state.circulation.activity, ...(state.members.registrations ?? [])]
  };
  for (const [resource, select] of Object.entries(selectors)) {
    app.get('/api/' + resource, (_request, response) => {
      const { snapshot } = database.read();
      response.set('ETag', '"' + snapshot.revision + '"').json(select(snapshot));
    });
  }

  for (const [type, route] of Object.entries(API_ROUTES)) {
    app[route.method.toLowerCase()]('/api' + route.path, (request, response) => {
      const id = request.header('Idempotency-Key');
      const revision = request.header('If-Match');
      if (!revision || !/^"\d+"$/.test(revision)) {
        return response.status(428).json({ message: 'Supply the revision in If-Match.' });
      }
      if (typeof id !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(id)) {
        return response.status(400).json({ message: 'Supply a valid Idempotency-Key.' });
      }
      if (route.method !== 'DELETE' && !['settings.restore', 'reservations.settle'].includes(type) &&
          (!request.body || !request.is('application/json') || Array.isArray(request.body))) {
        return response.status(400).json({ message: 'Send a JSON object.' });
      }
      const input = ['settings.restore', 'reservations.settle'].includes(type) ? null :
        { ...(route.method === 'DELETE' ? {} : request.body), ...request.params };
      const fingerprint = JSON.stringify([type, input]);
      const current = database.read();
      const earlier = current.receipts.find(item => item.id === id);
      if (earlier) {
        if (earlier.fingerprint !== fingerprint) {
          return response.status(409).json({ message: 'This request ID was already used for a different change.' });
        }
        return response.json({ snapshot: current.snapshot, result: earlier.result });
      }
      if (revision !== '"' + current.snapshot.revision + '"') {
        return response.status(412).json({ message: 'The library revision is stale.' });
      }
      let snapshot;
      let result;
      try {
        const draft = parseLibrarySnapshot(current.snapshot);
        const applied = applyLibraryCommand(draft, { type, input }, new Date());
        snapshot = parseLibrarySnapshot({ ...applied.snapshot, revision: current.snapshot.revision + 1 });
        result = applied.result ?? null;
      } catch (error) {
        const message = error instanceof TypeError ? 'The request is missing valid fields.' : error.message;
        return response.status(422).json({ message });
      }
      try {
        const receipts = [...current.receipts, { id, fingerprint, result }].slice(-250);
        database.commit({ snapshot, receipts });
      } catch {
        return response.status(500).json({ message: 'The Mock API could not save the change. The previous snapshot was preserved.' });
      }
      response.status(route.method === 'POST' && route.path.match(/^\/(books|members|loans|reservations)$/) ? 201 : 200)
        .json({ snapshot, result });
    });
  }
  app.use('/api', (_request, response) => response.status(404).json({ message: 'Mock API endpoint not found.' }));
  app.use((error, _request, response, _next) => {
    response.status(error.status === 413 ? 413 : 400).json({ message: 'The request body is invalid or too large.' });
  });
  return app;
}

function isLocal(host) {
  return typeof host === 'string' && /^(?:127\.0\.0\.1|localhost)(?::\d+)?$/i.test(host);
}

function isLocalOrigin(origin) {
  try {
    const url = new URL(origin);
    return /^https?:$/.test(url.protocol) && isLocal(url.host);
  } catch {
    return false;
  }
}

if (!globalThis.crypto) {
  globalThis.crypto = webcrypto;
}

if (require.main === module) {
  try {
    createServer(openDatabase(DATABASE)).listen(PORT, HOST, () =>
      console.log('BookSphere Mock API listening at http://' + HOST + ':' + PORT + '/api'));
  } catch (error) {
    console.error('Could not open the Mock API database:', error.message);
    process.exitCode = 1;
  }
}

module.exports = { createServer, HOST };
