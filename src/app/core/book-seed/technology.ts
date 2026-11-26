import { SeedTitle } from './seed-title';

export const technology: readonly SeedTitle[] = [
  { title: "The Pragmatic Programmer", author: "Andrew Hunt and David Thomas", publisher: "Addison-Wesley",
    publicationYear: 1999, description: "Practical habits and techniques for developing reliable software.", language: "English",
    edition: "First edition", shelfLocation: 'TEC-01',
    totalCopies: 2 },
  { title: "Clean Code", author: "Robert C. Martin", publisher: "Prentice Hall",
    publicationYear: 2008, description: "A handbook for improving the readability and maintainability of code.", language: "English",
    edition: "First edition", shelfLocation: 'TEC-02',
    totalCopies: 6 },
  { title: "Design Patterns", author: "Erich Gamma, Richard Helm, Ralph Johnson, and John Vlissides", publisher: "Addison-Wesley",
    publicationYear: 1994, description: "Reusable patterns for designing object-oriented software.", language: "English",
    edition: "First edition", shelfLocation: 'TEC-03',
    totalCopies: 0 },
  { title: "Refactoring", author: "Martin Fowler", publisher: "Addison-Wesley",
    publicationYear: 1999, description: "Techniques for changing the structure of software while preserving behavior.", language: "English",
    edition: "First edition", shelfLocation: 'TEC-04',
    totalCopies: 3 }
];
