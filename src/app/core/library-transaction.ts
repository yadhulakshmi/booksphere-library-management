import { ApiCommand, ApiResult, ApiAction, LibrarySnapshot } from '../models/library-api';
import { addBook, editBook, removeBook } from './book-commands';
import { cancelReservation, CirculationContext, issueLoan, placeReservation, renewLoan, returnLoan } from './circulation-commands';
import { parseCirculation, projectInventory, recordActivity, settleReservations } from './circulation-state';
import { payFine } from './fine-commands';
import { DEFAULT_LIBRARY_SETTINGS, validateSettings } from './library-policies';
import { memberDeletionReason } from './member-deletion-rules';
import { changeMembershipStatus, createMember, MemberSnapshot, parseMemberSnapshot, removeMember,
  renewMembership, updateMember } from './member-records';
import { localDate, memberView } from './member-rules';

export function parseLibrarySnapshot(value: unknown): LibrarySnapshot {
  const raw = value as LibrarySnapshot;
  if (!raw || !Number.isSafeInteger(raw.revision) || raw.revision < 0 || raw.circulation?.version !== 2) {
    throw new Error('Invalid library snapshot.');
  }
  const circulation = parseCirculation(JSON.stringify(raw.circulation));
  const members = parseMemberSnapshot(raw.members);
  const ids = new Set(members.records.map(member => member.id));
  if (circulation.loans.some(loan => !loan.returnedAt && !ids.has(loan.memberId)) ||
      circulation.reservations.some(item => (item.status === 'waiting' || item.status === 'ready') && !ids.has(item.memberId))) {
    throw new Error('An active circulation record references a missing member.');
  }
  return { revision: raw.revision, circulation, members };
}

export function applyLibraryCommand(snapshot: LibrarySnapshot, command: ApiCommand, now: Date) {
  let members = snapshot.members;
  const state = snapshot.circulation;
  const today = localDate(now);
  const directory = () => members.records.map(record => memberView(record, today));
  settleReservations(state, directory(), today, now);
  state.books = projectInventory(state);
  const context: CirculationContext = { state, members: directory(), policy: state.settings, now, today };
  let result: ApiResult<ApiAction> = undefined;
  let bookId: string | undefined;
  let reservationId: string | undefined;
  const useMember = <T>(change: { snapshot: MemberSnapshot; result: T }): T => {
    members = change.snapshot;
    return change.result;
  };
  switch (command.type) {
    case 'book.create': {
      const book = addBook(state.books, command.input, now);
      recordActivity(state, 'book-added', book.id, now, book.title);
      bookId = book.id;
      break;
    }
    case 'book.update': {
      const book = editBook(state.books, command.input.id, command.input.book, now);
      recordActivity(state, 'book-updated', book.id, now, book.title);
      bookId = book.id;
      break;
    }
    case 'book.delete': {
      const book = removeBook(state.books, command.input.id, state);
      recordActivity(state, 'book-deleted', book.id, now, book.title);
      break;
    }
    case 'member.create': result = useMember(createMember(members, command.input, now)); break;
    case 'member.update': result = useMember(updateMember(members, command.input.id, command.input.member, now)); break;
    case 'member.renew': result = useMember(renewMembership(members, command.input.id, command.input.expiryDate, now)); break;
    case 'member.status': result = useMember(changeMembershipStatus(members, command.input.id, command.input.state, now)); break;
    case 'member.delete': {
      const id = command.input.id;
      useMember(removeMember(members, id, memberDeletionReason(state, id, today)));
      break;
    }
    case 'loan.issue':
      result = issueLoan(context, command.input.memberId, command.input.bookId, command.input.date, command.input.reservationId);
      break;
    case 'loan.return': result = returnLoan(context, command.input.id, command.input.date); break;
    case 'loan.renew': result = renewLoan(context, command.input.id); break;
    case 'reservation.create': reservationId = placeReservation(context, command.input.memberId, command.input.bookId); break;
    case 'reservation.cancel': cancelReservation(context, command.input.id); break;
    case 'fine.pay': result = payFine(context, command.input.fineId, command.input.payment); break;
    case 'settings.save':
    case 'settings.restore': {
      state.settings = validateSettings(command.type === 'settings.save' ? command.input : DEFAULT_LIBRARY_SETTINGS);
      recordActivity(state, command.type === 'settings.save' ? 'settings-updated' : 'settings-restored', 'library-settings', now);
      result = state.settings;
      break;
    }
    case 'reservations.settle': break;
    default: throw new Error('Unsupported library operation.');
  }
  settleReservations(state, directory(), today, now);
  state.books = projectInventory(state);
  if (bookId) {
    result = state.books.find(book => book.id === bookId);
  }
  if (reservationId) {
    result = state.reservations.find(item => item.id === reservationId);
  }
  return { snapshot: { ...snapshot, circulation: state, members }, result };
}
