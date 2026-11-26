const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { parseLibrarySnapshot } = require('../.angular/mock-api/domain/core/library-transaction');
const { initialCirculation } = require('../.angular/mock-api/domain/core/circulation-migration');
const { demoMembers } = require('../.angular/mock-api/domain/core/member-seed');
const { localDate, memberView } = require('../.angular/mock-api/domain/core/member-rules');
const { DEFAULT_LIBRARY_SETTINGS } = require('../.angular/mock-api/domain/core/library-policies');
const seed = require('./seed.json');

function initialDatabase() {
  const now = new Date(seed.anchor);
  const today = localDate(now);
  const records = demoMembers(now);
  const circulation = initialCirculation(null, {
    members: records.map(record => memberView(record, today)),
    policy: DEFAULT_LIBRARY_SETTINGS, today, now
  });
  return { snapshot: { revision: 0, circulation, members: { records, lastIssued: records.length } }, receipts: [] };
}

function atomicWrite(file, data) {
  const temporary = file + '.' + randomUUID() + '.tmp';
  try {
    const descriptor = fs.openSync(temporary, 'wx');
    try {
      fs.writeFileSync(descriptor, JSON.stringify(data, null, 2) + '\n', 'utf8');
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
  } finally {
    try {
      fs.unlinkSync(temporary);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Could not remove temporary database file:', error.message);
      }
    }
  }
}

function openDatabase(file) {
  const target = path.resolve(file);
  if (!fs.existsSync(target)) {
    fs.mkdirSync(path.dirname(target), { recursive: true });
    atomicWrite(target, initialDatabase());
  }
  const data = JSON.parse(fs.readFileSync(target, 'utf8'));
  const snapshot = parseLibrarySnapshot(data.snapshot);
  if (!Array.isArray(data.receipts) || data.receipts.some(item => !item || typeof item.id !== 'string' ||
      typeof item.fingerprint !== 'string' || !Object.prototype.hasOwnProperty.call(item, 'result')) ||
      new Set(data.receipts.map(item => item.id)).size !== data.receipts.length) {
    throw new Error('Invalid database receipts. The existing database was preserved.');
  }
  let confirmed = { snapshot, receipts: data.receipts };
  return {
    read: () => confirmed,
    commit: next => {
      atomicWrite(target, next);
      confirmed = next;
    }
  };
}

module.exports = { initialDatabase, openDatabase };
