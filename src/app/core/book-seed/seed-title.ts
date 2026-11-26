import { BookInput } from '../../models/library';

export type SeedTitle = Omit<BookInput, 'categoryId' | 'isbn' | 'coverImage'>;
