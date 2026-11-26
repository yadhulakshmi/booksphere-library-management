import { Member, MembershipStatus, MembershipType } from '../models/library';

export interface MemberFilters {
  search: string;
  type: MembershipType | '';
  status: MembershipStatus | '';
}

export type MemberColumn = 'name' | 'membershipId' | 'email' | 'membershipType' |
  'registrationDate' | 'expiryDate' | 'status';

export const EMPTY_MEMBER_FILTERS: MemberFilters = { search: '', type: '', status: '' };

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export function filterMembers(members: readonly Member[], filters: MemberFilters): Member[] {
  const query = filters.search.trim().toLowerCase();
  const terms = query.split(/\s+/).filter(Boolean);
  const phoneQuery = /^[\d +().-]+$/.test(query) ? query.replace(/\D/g, '') : '';
  return members.filter(member => {
    const text = [member.firstName, member.lastName, member.membershipId, member.email, member.phone].join(' ').toLowerCase();
    return (!filters.type || member.membershipType === filters.type) &&
      (!filters.status || member.status === filters.status) &&
      (terms.every(term => text.includes(term)) || (!!phoneQuery && member.phone.replace(/\D/g, '').includes(phoneQuery)));
  });
}

export function sortMembers(members: readonly Member[], column: MemberColumn, direction: 'asc' | 'desc'): Member[] {
  const value = (member: Member): string => column === 'name' ? member.firstName + ' ' + member.lastName : member[column];
  return [...members].sort((left, right) =>
    collator.compare(value(left), value(right)) * (direction === 'asc' ? 1 : -1) ||
      collator.compare(left.membershipId, right.membershipId)
  );
}
