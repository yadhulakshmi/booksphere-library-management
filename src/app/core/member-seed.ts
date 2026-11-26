import { MemberRecord, MEMBERSHIP_STATES, MEMBERSHIP_TYPES } from '../models/library';
import { localDate, membershipId } from './member-rules';

const names = [
  'Avery Linden', 'Mira Fenwick', 'Rowan Vale', 'Tessa Whitlock', 'Elian Brook',
  'Noor Hazel', 'Iris Meridian', 'Theo Wren', 'Anika Fern', 'Leo Ridley',
  'Nadia Crest', 'Felix North', 'Sana Birch', 'Miles Alder', 'Nina Moss',
  'Owen Lark', 'Leila Hartwood', 'Ezra Glen', 'Priya Dell', 'Ada Thorne',
  'Jules Linden', 'Amari Reed', 'Zara Holt', 'Eli Marlow', 'Samira Lyle',
  'Arlo Finch', 'Imani Grove', 'Rhea Quill', 'Remy Stone', 'Kai Winter'
];

export function demoMembers(now: Date): readonly MemberRecord[] {
  const dateOffset = (days: number): string => {
    const date = new Date(now);
    date.setDate(date.getDate() + days);
    return localDate(date);
  };
  const timestamp = now.toISOString();
  return names.map((name, index) => {
    const [firstName, lastName] = name.split(' ');
    const sequence = index + 1;
    return {
      id: 'member-' + membershipId(sequence), membershipId: membershipId(sequence), firstName, lastName,
      email: firstName.toLowerCase() + '.' + lastName.toLowerCase() + '@example.invalid',
      phone: '+1 202-555-' + String(100 + index).padStart(4, '0'),
      address: sequence + ' Example Lane, Fictional Sample District',
      membershipType: MEMBERSHIP_TYPES[index % MEMBERSHIP_TYPES.length],
      registrationDate: dateOffset(-430 + index * 9), expiryDate: dateOffset(-105 + index * 13),
      state: index % 5 < 3 ? 'Active' : MEMBERSHIP_STATES[index % 5 - 2],
      notes: '', createdAt: timestamp, updatedAt: timestamp, demonstration: true
    };
  });
}
