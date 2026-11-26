import { ApiAction } from '../models/library-api';

export const API_ROUTES: Record<ApiAction, { method: 'POST' | 'PUT' | 'PATCH' | 'DELETE'; path: string }> = {
  'book.create': { method: 'POST', path: '/books' },
  'book.update': { method: 'PUT', path: '/books/:id' },
  'book.delete': { method: 'DELETE', path: '/books/:id' },
  'member.create': { method: 'POST', path: '/members' },
  'member.update': { method: 'PUT', path: '/members/:id' },
  'member.renew': { method: 'POST', path: '/members/:id/renewal' },
  'member.status': { method: 'PATCH', path: '/members/:id/status' },
  'member.delete': { method: 'DELETE', path: '/members/:id' },
  'loan.issue': { method: 'POST', path: '/loans' },
  'loan.return': { method: 'POST', path: '/loans/:id/return' },
  'loan.renew': { method: 'POST', path: '/loans/:id/renewal' },
  'reservation.create': { method: 'POST', path: '/reservations' },
  'reservation.cancel': { method: 'POST', path: '/reservations/:id/cancellation' },
  'fine.pay': { method: 'POST', path: '/fines/:fineId/payments' },
  'settings.save': { method: 'PUT', path: '/settings' },
  'settings.restore': { method: 'POST', path: '/settings/restore' },
  'reservations.settle': { method: 'POST', path: '/reservations/settle' }
};
