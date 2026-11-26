import { EMPTY_MEMBER_FILTERS, filterMembers, sortMembers } from './member-query';
import { memberView } from './member-rules';
import { demoMembers } from './member-seed';

describe('member directory query', () => {
  const members = demoMembers(new Date(2026, 10, 24)).map(record => memberView(record, '2026-11-24'));
  const first = members[0];

  it('matches names, membership IDs, email and unformatted phone numbers', () => {
    for (const search of ['linden avery', first.membershipId.toLowerCase(), first.email.toUpperCase(), '2025550100']) {
      expect(filterMembers(members, { ...EMPTY_MEMBER_FILTERS, search })).toEqual([first]);
    }
  });

  it('combines type, effective status and search', () => {
    const filters = { search: 'Avery', type: first.membershipType, status: first.status };
    expect(filterMembers(members, filters)).toEqual([first]);
    expect(filterMembers(members, { ...filters, status: 'Active' })).toEqual([]);
  });

  it('sorts IDs and date fields without mutating the original order', () => {
    expect(sortMembers(members, 'membershipId', 'desc')[0].membershipId).toBe('BS-000030');
    expect(sortMembers(members, 'registrationDate', 'asc')[0]).toEqual(first);
    expect(members[0]).toEqual(first);
  });
});
