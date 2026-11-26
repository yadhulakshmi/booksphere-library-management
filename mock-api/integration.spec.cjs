const assert = require('assert').strict;
const fs = require('fs');
const http = require('http');
const path = require('path');
const { createServer, HOST } = require('./server.cjs');
const { openDatabase } = require('./database.cjs');
const { localDate } = require('../.angular/mock-api/domain/core/member-rules');
const { shiftDay } = require('../.angular/mock-api/domain/core/circulation-dates');

const temporary = path.resolve('.angular/mock-api/tests');
fs.mkdirSync(temporary, { recursive: true });
const file = path.join(fs.mkdtempSync(path.join(temporary, 'db-')), 'db.json');

function request(port, method, endpoint, revision, id, body) {
  return new Promise((resolve, reject) => {
    const headers = {};
    if (revision !== undefined) headers['If-Match'] = '"' + revision + '"';
    if (id) headers['Idempotency-Key'] = id;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const outgoing = http.request({ host: HOST, port, path: '/api' + endpoint, method, headers }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, data: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    outgoing.on('error', reject);
    outgoing.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

async function listen(store) {
  const server = createServer(store).listen(0, HOST);
  await new Promise((resolve, reject) => server.once('listening', resolve).once('error', reject));
  return server;
}
const close = server => new Promise(resolve => server.close(resolve));

async function verify() {
  const database = openDatabase(file);
  let fail = false;
  let server = await listen({
    read: database.read,
    commit: next => {
      if (fail) throw new Error('Test persistence failure');
      database.commit(next);
    }
  });
  const today = localDate();
  let revision = 0;
  const send = (method, route, id, body, version = revision) =>
    request(server.address().port, method, route, version, id, body);
  const read = route => request(server.address().port, 'GET', route);
  async function mutate(method, route, id, body) {
    const response = await send(method, route, id, body);
    assert.ok([200, 201].includes(response.status), JSON.stringify(response));
    assert.equal(response.data.snapshot.revision, revision + 1);
    revision = response.data.snapshot.revision;
    return response.data;
  }
  function member(email) {
    return { firstName: 'Mock', lastName: 'Patron', email, phone: '+1 202-555-0199', address: 'Demo Avenue',
      membershipType: 'General', registrationDate: shiftDay(today, -60), expiryDate: shiftDay(today, 120), notes: '' };
  }
  try {
    const seed = (await read('/snapshot')).data;
    assert.equal(seed.revision, 0);
    assert.equal((await read('/books')).data.length, 40);
    assert.equal((await read('/members')).data.length, 30);
    for (const name of ['loans', 'reservations', 'fines', 'payments', 'activities']) {
      assert.ok(Array.isArray((await read('/' + name)).data));
    }
    assert.equal((await read('/settings')).data.currency, 'INR');
    assert.equal((await send('POST', '/members', undefined, member('first@example.invalid'))).status, 400);
    const firstBody = member('first@example.invalid');
    const first = (await mutate('POST', '/members', 'first-id', firstBody)).result;
    const repeat = await send('POST', '/members', 'first-id', firstBody, 0);
    assert.equal(repeat.status, 200);
    assert.equal(repeat.data.result.id, first.id);
    assert.equal(repeat.data.snapshot.revision, revision);
    assert.equal((await send('POST', '/members', 'first-id', member('changed@example.invalid'))).status, 409);
    assert.equal((await send('POST', '/members', 'stale-id', member('second@example.invalid'), 0)).status, 412);
    const second = (await mutate('POST', '/members', 'second-id', member('second@example.invalid'))).result;
    const third = (await mutate('POST', '/members', 'third-id', member('third@example.invalid'))).result;
    const input = { isbn: '', title: 'Atomic Test Book', author: 'Demo Author', categoryId: 'fiction',
      publisher: 'Demo Press', publicationYear: 2024, edition: 'First', language: 'English',
      description: 'Used only in the mock API test database.', coverImage: '', shelfLocation: 'A1', totalCopies: 1 };
    const book = (await mutate('POST', '/books', 'book-id', input)).result;
    await mutate('PUT', '/books/' + book.id, 'update-book', { book: { ...input, shelfLocation: 'B2' } });
    await mutate('PATCH', '/members/' + second.id + '/status', 'suspend', { state: 'Suspended' });
    assert.equal((await send('POST', '/loans', 'ineligible', { memberId: second.id, bookId: book.id, date: today })).status, 422);
    await mutate('PATCH', '/members/' + second.id + '/status', 'activate', { state: 'Active' });
    const loan = (await mutate('POST', '/loans', 'issue', {
      memberId: first.id, bookId: book.id, date: shiftDay(today, -34) })).result;
    assert.equal((await read('/books')).data.find(record => record.id === book.id).availableCopies, 0);
    assert.equal((await send('PUT', '/books/' + book.id, 'negative-stock', { book: { ...input, totalCopies: 0 } })).status, 422);
    assert.equal((await send('DELETE', '/books/' + book.id, 'blocked-book-delete')).status, 422);
    const hold = (await mutate('POST', '/reservations', 'reserve', { memberId: second.id, bookId: book.id })).result;
    assert.equal(hold.status, 'waiting');
    const nextHold = (await mutate('POST', '/reservations', 'next-hold', { memberId: third.id, bookId: book.id })).result;
    assert.ok(nextHold.sequence > hold.sequence);

    const before = (await read('/snapshot')).data;
    const beforeFile = fs.readFileSync(file, 'utf8');
    fail = true;
    assert.equal((await send('POST', '/loans/' + loan.id + '/return', 'return', { date: today })).status, 500);
    assert.deepEqual((await read('/snapshot')).data, before);
    assert.equal(fs.readFileSync(file, 'utf8'), beforeFile);
    fail = false;

    const returned = await mutate('POST', '/loans/' + loan.id + '/return', 'return', { date: today });
    assert.equal(returned.result.overdueDaysAtReturn, 20);
    assert.equal(returned.snapshot.circulation.reservations.find(item => item.id === hold.id).status, 'ready');
    assert.equal(returned.snapshot.circulation.reservations.find(item => item.id === nextHold.id).status, 'waiting');
    const fine = returned.snapshot.circulation.fines.find(item => item.loanId === loan.id);
    assert.equal(fine.balanceMinor, 10000);
    assert.equal((await send('DELETE', '/members/' + first.id, 'blocked-member-delete')).status, 422);
    assert.equal((await send('POST', '/loans', 'fine-restriction', { memberId: first.id, bookId: seed.circulation.books[0].id, date: today })).status, 422);
    await mutate('POST', '/loans', 'collect', { memberId: second.id, bookId: book.id, date: today, reservationId: hold.id });
    const payment = { requestId: 'internal-payment', amountMinor: 2500, method: 'Cash', paidOn: today, reference: '', notes: '' };
    const paid = await mutate('POST', '/fines/' + fine.id + '/payments', 'payment', { payment });
    assert.equal(paid.snapshot.circulation.fines.find(item => item.id === fine.id).balanceMinor, 7500);
    const settings = (await read('/settings')).data;
    await mutate('PUT', '/settings', 'set-library', { ...settings, name: 'Isolated API Test Library', lendingDays: 21 });

    await close(server);
    server = await listen(openDatabase(file));
    const restarted = (await read('/snapshot')).data;
    assert.equal(restarted.revision, revision);
    assert.equal(restarted.circulation.settings.name, 'Isolated API Test Library');
    assert.equal(restarted.circulation.payments.find(item => item.id === paid.result.id).amountMinor, 2500);
    assert.equal(restarted.circulation.reservations.find(item => item.id === hold.id).status, 'fulfilled');
    assert.equal(restarted.circulation.books.find(item => item.id === book.id).borrowedCopies, 1);
    const retry = await send('POST', '/fines/' + fine.id + '/payments', 'payment', { payment }, 0);
    assert.equal(retry.data.result.id, paid.result.id);
    assert.equal(retry.data.snapshot.revision, revision);
    const collectedLoan = restarted.circulation.loans.find(item => item.bookId === book.id && item.memberId === second.id);
    assert.equal(collectedLoan.terms.lendingDays, 14);
    assert.equal((await send('POST', '/loans/' + collectedLoan.id + '/renewal', 'renew-blocked-by-queue', {})).status, 422);
    const secondReturn = await mutate('POST', '/loans/' + collectedLoan.id + '/return', 'return-collected', { date: today });
    assert.equal(secondReturn.snapshot.circulation.reservations.find(item => item.id === nextHold.id).status, 'ready');
    await mutate('POST', '/reservations/' + nextHold.id + '/cancellation', 'cancel-next', {});
    await mutate('POST', '/fines/' + fine.id + '/payments', 'remaining-payment', {
      payment: { ...payment, requestId: 'internal-final-payment', amountMinor: 7500 } });
    const newLoan = await mutate('POST', '/loans', 'issue-after-payment', { bookId: book.id, memberId: first.id, date: today });
    assert.equal(newLoan.result.dueAt, shiftDay(today, 21));
    const renewed = await mutate('POST', '/loans/' + newLoan.result.id + '/renewal', 'renew-after-payment', {});
    assert.equal(renewed.result.dueAt, shiftDay(newLoan.result.dueAt, 7));
    assert.equal(newLoan.snapshot.circulation.fines.find(item => item.id === fine.id).status, 'Paid');
    await mutate('POST', '/loans/' + newLoan.result.id + '/return', 'final-return', { date: today });
    await mutate('DELETE', '/members/' + first.id, 'delete-historical-patron');
    const deleted = await mutate('DELETE', '/books/' + book.id, 'delete-historical-title');
    assert.equal(deleted.snapshot.circulation.loans.find(item => item.id === loan.id).bookTitle, book.title);
    assert.equal(deleted.snapshot.circulation.loans.find(item => item.id === loan.id).membershipId, first.membershipId);
    assert.equal(deleted.snapshot.circulation.payments.filter(item => item.fineId === fine.id).length, 2);
    console.log('PASS: eight resources, REST writes, FIFO checkout/renewal/return, full settlement, preserved terms and history, revisions, idempotency, rollback and disk reload.');
  } finally {
    if (server.listening) await close(server);
  }
}

verify().catch(error => { console.error(error); process.exitCode = 1; });
