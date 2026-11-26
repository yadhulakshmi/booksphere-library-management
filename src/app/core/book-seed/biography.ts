import { SeedTitle } from './seed-title';

export const biography: readonly SeedTitle[] = [
  { title: "Steve Jobs", author: "Walter Isaacson", publisher: "Simon & Schuster",
    publicationYear: 2011, description: "A biography examining the life and work of the Apple co-founder.", language: "English",
    edition: "First edition", shelfLocation: 'BIO-01',
    totalCopies: 2 },
  { title: "Long Walk to Freedom", author: "Nelson Mandela", publisher: "Little, Brown and Company",
    publicationYear: 1994, description: "Mandela recounts his life and the struggle against apartheid.", language: "English",
    edition: "First edition", shelfLocation: 'BIO-02',
    totalCopies: 6 },
  { title: "The Story of My Life", author: "Helen Keller", publisher: "Doubleday, Page & Co.",
    publicationYear: 1903, description: "Keller recalls her early life and education with Anne Sullivan.", language: "English",
    edition: "First edition", shelfLocation: 'BIO-03',
    totalCopies: 0 },
  { title: "The Autobiography of Benjamin Franklin", author: "Benjamin Franklin", publisher: "J. Parsons",
    publicationYear: 1793, description: "Franklin recounts his early life, trade, and civic endeavors.", language: "English",
    edition: "1793 English edition", shelfLocation: 'BIO-04',
    totalCopies: 3 }
];
