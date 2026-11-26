import { FinePolicy, LibrarySettings, LoanTerms } from '../models/library';
import { MEMBER_EMAIL, validPhone } from './member-rules';

export const DEFAULT_LIBRARY_SETTINGS: LibrarySettings = Object.freeze({
  name: 'BookSphere Demonstration Library', email: 'library@example.invalid', phone: '+1 202-555-0142',
  address: '42 Example Lane, Fictional Sample District', openingTime: '09:00', closingTime: '18:00',
  lendingDays: 14, maxLoansPerMember: 5, maxLoanRenewals: 2, renewalDays: 7,
  reservationCollectionDays: 3, reservationPriority: 'first-come-first-served',
  currency: 'INR', dailyFineMinor: 500, graceDays: 0, maxFineMinor: 50000, restrictionThresholdMinor: 10000
});

export const POLICY_RANGES = {
  maxLoansPerMember: [1, 100], lendingDays: [1, 365], maxLoanRenewals: [0, 20], renewalDays: [1, 365],
  reservationCollectionDays: [1, 90], graceDays: [0, 365],
  dailyFineMinor: [0, 1000000], maxFineMinor: [0, 100000000], restrictionThresholdMinor: [1, 100000000]
} as const;

export function inRange(value: number, [min, max]: readonly [number, number]): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

export const CLOCK_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function validFinePolicy(value: FinePolicy): boolean {
  return !!value && value.currency === 'INR' && inRange(value.dailyFineMinor, POLICY_RANGES.dailyFineMinor) &&
    inRange(value.graceDays, POLICY_RANGES.graceDays) && inRange(value.maxFineMinor, POLICY_RANGES.maxFineMinor);
}

export function validLoanTerms(value: LoanTerms): boolean {
  return validFinePolicy(value) && inRange(value.lendingDays, POLICY_RANGES.lendingDays) &&
    inRange(value.maxLoanRenewals, POLICY_RANGES.maxLoanRenewals) && inRange(value.renewalDays, POLICY_RANGES.renewalDays);
}

export function loanTerms(settings: LibrarySettings): LoanTerms {
  const { dailyFineMinor, graceDays, maxFineMinor, currency, lendingDays, maxLoanRenewals, renewalDays } = settings;
  return { dailyFineMinor, graceDays, maxFineMinor, currency, lendingDays, maxLoanRenewals, renewalDays };
}

export function validateSettings(settings: LibrarySettings): LibrarySettings {
  if (!settings || [settings.name, settings.email, settings.phone, settings.address, settings.openingTime, settings.closingTime]
    .some(value => typeof value !== 'string' || !value.trim())) {
    throw new Error('Complete all library information fields.');
  }
  const email = settings.email.trim().toLowerCase();
  const phone = settings.phone.trim();
  if (!MEMBER_EMAIL.test(email) || !validPhone(phone)) {
    throw new Error('Enter a valid email address and contact number.');
  }
  if (!CLOCK_TIME.test(settings.openingTime) || !CLOCK_TIME.test(settings.closingTime) || settings.openingTime >= settings.closingTime) {
    throw new Error('Opening and closing times must be valid, with closing later on the same day.');
  }
  if (settings.currency !== 'INR' || settings.reservationPriority !== 'first-come-first-served' ||
      (Object.keys(POLICY_RANGES) as (keyof typeof POLICY_RANGES)[]).some(key => !inRange(settings[key], POLICY_RANGES[key]))) {
    throw new Error('One or more library policies are outside their allowed range.');
  }
  const { name, address, openingTime, closingTime, currency, dailyFineMinor, graceDays, maxFineMinor,
    restrictionThresholdMinor, lendingDays, maxLoansPerMember, maxLoanRenewals, renewalDays,
    reservationCollectionDays, reservationPriority } = settings;
  return { name: name.trim(), email, phone, address: address.trim(), openingTime, closingTime, currency,
    dailyFineMinor, graceDays, maxFineMinor, restrictionThresholdMinor, lendingDays, maxLoansPerMember,
    maxLoanRenewals, renewalDays, reservationCollectionDays, reservationPriority };
}

export function minorUnits(value: string | number): number {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value).trim());
  if (!match) {
    return NaN;
  }
  const minor = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return Number.isSafeInteger(minor) ? minor : NaN;
}
