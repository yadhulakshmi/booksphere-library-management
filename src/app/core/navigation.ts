import { NavigationItem } from '../models/navigation-item';

export const NAVIGATION: readonly NavigationItem[] = [
  { path: 'dashboard', label: 'Dashboard', icon: 'space_dashboard' },
  { path: 'catalogue', label: 'Book Catalogue', icon: 'menu_book' },
  { path: 'books', label: 'Book Management', icon: 'library_books' },
  { path: 'members', label: 'Members', icon: 'groups' },
  { path: 'circulation', label: 'Borrow and Return', icon: 'swap_horiz' },
  { path: 'reservations', label: 'Reservations', icon: 'bookmark_border' },
  { path: 'overdue', label: 'Overdue and Fines', icon: 'schedule' },
  { path: 'reports', label: 'Reports and Analytics', icon: 'bar_chart' },
  { path: 'settings', label: 'Settings', icon: 'settings' }
];
