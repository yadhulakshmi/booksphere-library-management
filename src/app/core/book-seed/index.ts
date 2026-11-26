import { Book } from '../../models/library';
import { withAvailability } from '../book-rules';
import { fiction } from './fiction';
import { technology } from './technology';
import { science } from './science';
import { history } from './history';
import { business } from './business';
import { education } from './education';
import { biography } from './biography';
import { literature } from './literature';
import { psychology } from './psychology';
import { mathematics } from './mathematics';

export function demoBooks(timestamp: string): readonly Book[] {
  const titles = { fiction, technology, science, history, business, education, biography, literature, psychology, mathematics };
  return Object.entries(titles).flatMap(([categoryId, records]) => records.map((record, index) => {
    const borrowedCopies = record.totalCopies > 0 && index === 1 ? record.totalCopies : 0;
    const reservedCopies = record.totalCopies > 1 && index === 2 ? 1 : 0;
    return withAvailability({
      ...record, categoryId, isbn: '', coverImage: '', id: 'demo-' + categoryId + '-' + (index + 1),
      borrowedCopies, reservedCopies, dateAdded: timestamp, lastUpdated: timestamp, demonstration: true
    });
  }));
}
