import { LibraryActivity, MemberInput, MemberRecord, MEMBERSHIP_STATES, MembershipState } from '../models/library';
import { localDate, memberInputError, membershipId, memberView, validDate } from './member-rules';

export interface MemberSnapshot {
  readonly lastIssued: number;
  readonly records: readonly MemberRecord[];
  readonly registrations?: readonly LibraryActivity[];
}

export function parseMemberSnapshot(value: unknown): MemberSnapshot {
  const snapshot = value as MemberSnapshot;
  if (!snapshot || !Number.isSafeInteger(snapshot.lastIssued) || snapshot.lastIssued < 0 || !Array.isArray(snapshot.records)) {
    throw new Error('Invalid member directory.');
  }
  const ids = new Set<string>();
  const emails = new Set<string>();
  for (const record of snapshot.records) {
    if (!record || typeof record.membershipId !== 'string' || !/^BS-\d{6,}$/.test(record.membershipId)) {
      throw new Error('Invalid membership ID.');
    }
    const sequence = Number(record.membershipId.slice(3));
    if (!Number.isSafeInteger(sequence) || sequence < 1 || sequence > snapshot.lastIssued ||
        membershipId(sequence) !== record.membershipId || record.id !== 'member-' + record.membershipId ||
        memberInputError(record, '9999-12-31') || !MEMBERSHIP_STATES.includes(record.state) ||
        !Number.isFinite(Date.parse(record.createdAt)) || !Number.isFinite(Date.parse(record.updatedAt)) ||
        typeof record.demonstration !== 'boolean' || ids.has(record.id) ||
        record.email !== record.email.trim().toLowerCase() || emails.has(record.email)) {
      throw new Error('Invalid or duplicate member record.');
    }
    ids.add(record.id);
    emails.add(record.email);
  }
  const registrations = snapshot.registrations;
  if (registrations !== undefined &&
      (!Array.isArray(registrations) || registrations.some(item => !item ||
        item.type !== 'member-registered' || typeof item.id !== 'string' ||
        typeof item.entityId !== 'string' || typeof item.description !== 'string' ||
        !Number.isFinite(Date.parse(item.occurredAt))) ||
        new Set(registrations.map(item => item.id)).size !== registrations.length)) {
    throw new Error('Invalid member registration history.');
  }
  return snapshot;
}

function clean(input: MemberInput, snapshot: MemberSnapshot, today: string, id?: string): MemberInput {
  const error = memberInputError(input, today);
  if (error) {
    throw new Error(error);
  }
  const email = input.email.trim().toLowerCase();
  if (snapshot.records.some(record => record.id !== id && record.email === email)) {
    throw new Error('A member with this email already exists.');
  }
  return { firstName: input.firstName.trim(), lastName: input.lastName.trim(), email, phone: input.phone.trim(),
    address: input.address.trim(), membershipType: input.membershipType, registrationDate: input.registrationDate,
    expiryDate: input.expiryDate, notes: input.notes.trim() };
}

export function createMember(snapshot: MemberSnapshot, input: MemberInput, now: Date) {
  const details = clean(input, snapshot, localDate(now));
  const sequence = snapshot.lastIssued + 1;
  if (!Number.isSafeInteger(sequence)) {
    throw new Error('No new membership IDs are available.');
  }
  const code = membershipId(sequence);
  const timestamp = now.toISOString();
  const record: MemberRecord = { ...details, id: 'member-' + code, membershipId: code, state: 'Active',
    createdAt: timestamp, updatedAt: timestamp, demonstration: false };
  const activity: LibraryActivity = {
    id: 'REG-' + code, entityId: record.id, type: 'member-registered', occurredAt: timestamp,
    description: record.firstName + ' ' + record.lastName + ' · ' + code
  };
  return { result: memberView(record, localDate(now)), snapshot: {
    lastIssued: sequence, records: [...snapshot.records, record], registrations: [...(snapshot.registrations ?? []), activity]
  } };
}

function find(snapshot: MemberSnapshot, id: string): MemberRecord {
  const member = snapshot.records.find(record => record.id === id);
  if (!member) {
    throw new Error('This member is no longer in the directory.');
  }
  return member;
}

function change(snapshot: MemberSnapshot, id: string, now: Date, edit: (record: MemberRecord) => MemberRecord) {
  const updated = { ...edit(find(snapshot, id)), updatedAt: now.toISOString() };
  return { result: memberView(updated, localDate(now)),
    snapshot: { ...snapshot, records: snapshot.records.map(record => record.id === id ? updated : record) } };
}

export function updateMember(snapshot: MemberSnapshot, id: string, input: MemberInput, now: Date) {
  return change(snapshot, id, now, record => ({ ...record, ...clean(input, snapshot, localDate(now), id) }));
}

export function renewMembership(snapshot: MemberSnapshot, id: string, expiryDate: string, now: Date) {
  return change(snapshot, id, now, record => {
    if (!validDate(expiryDate) || expiryDate <= localDate(now) || expiryDate <= record.expiryDate) {
      throw new Error('Choose an expiry date after today and the current expiry date.');
    }
    return { ...record, expiryDate };
  });
}

export function changeMembershipStatus(snapshot: MemberSnapshot, id: string, state: MembershipState, now: Date) {
  return change(snapshot, id, now, record => {
    if (!MEMBERSHIP_STATES.includes(state)) {
      throw new Error('Choose a valid membership status.');
    }
    if (state === 'Active' && record.expiryDate < localDate(now)) {
      throw new Error('Renew this membership before setting it to Active.');
    }
    return { ...record, state };
  });
}

export function removeMember(snapshot: MemberSnapshot, id: string, reason: string | null) {
  find(snapshot, id);
  if (reason) {
    throw new Error(reason);
  }
  return { result: undefined, snapshot: { ...snapshot, records: snapshot.records.filter(record => record.id !== id) } };
}
