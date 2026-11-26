import { Member, MemberInput, MemberRecord, MEMBERSHIP_TYPES } from '../models/library';

export const MEMBER_EMAIL = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/;

export function validPhone(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  return /^\+?[0-9 ().-]+$/.test(value) && digits.length >= 7 && digits.length <= 15;
}

export function localDate(date = new Date()): string {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map((part, index) => String(part).padStart(index === 0 ? 4 : 2, '0')).join('-');
}

export function validDate(value: string): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    return false;
  }
  const stamp = Date.parse(value + 'T00:00:00Z');
  return Number.isFinite(stamp) && new Date(stamp).toISOString().slice(0, 10) === value;
}

export function memberInputError(input: MemberInput, today = localDate()): string | null {
  const required = [input.firstName, input.lastName, input.email, input.phone, input.address];
  if (required.some(value => typeof value !== 'string' || !value.trim()) || typeof input.notes !== 'string') {
    return 'Complete the required member fields.';
  }
  if (!MEMBER_EMAIL.test(input.email.trim())) {
    return 'Enter a valid email address.';
  }
  if (!validPhone(input.phone.trim())) {
    return 'Enter a phone number with 7 to 15 digits.';
  }
  if (!MEMBERSHIP_TYPES.includes(input.membershipType)) {
    return 'Choose a valid membership type.';
  }
  if (!validDate(input.registrationDate) || input.registrationDate > today) {
    return 'Registration must be a valid date on or before today.';
  }
  if (!validDate(input.expiryDate) || input.expiryDate < input.registrationDate) {
    return 'Expiry must be a valid date on or after registration.';
  }
  return null;
}

export function memberView(record: MemberRecord, today = localDate()): Member {
  return {
    ...record,
    status: record.state === 'Active' && record.expiryDate < today ? 'Expired' : record.state,
    initials: [record.firstName, record.lastName].map(name => Array.from(name)[0]).join('').toUpperCase()
  };
}

export function membershipId(sequence: number): string {
  return 'BS-' + String(sequence).padStart(6, '0');
}
