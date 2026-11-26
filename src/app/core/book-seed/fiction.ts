import { SeedTitle } from './seed-title';

export const fiction: readonly SeedTitle[] = [
  { title: "Pride and Prejudice", author: "Jane Austen", publisher: "T. Egerton",
    publicationYear: 1813, description: "A country family navigates courtship, money, and social expectations.", language: "English",
    edition: "First edition", shelfLocation: 'FIC-01',
    totalCopies: 4 },
  { title: "Jane Eyre", author: "Charlotte Brontë", publisher: "Smith, Elder & Co.",
    publicationYear: 1847, description: "A governess seeks independence while confronting the secrets of Thornfield Hall.", language: "English",
    edition: "First edition", shelfLocation: 'FIC-02',
    totalCopies: 2 },
  { title: "Frankenstein", author: "Mary Shelley", publisher: "Lackington, Hughes, Harding, Mavor & Jones",
    publicationYear: 1818, description: "A young scientist gives life to a creature and faces the consequences.", language: "English",
    edition: "First edition", shelfLocation: 'FIC-03',
    totalCopies: 6 },
  { title: "Le Tour du monde en quatre-vingts jours", author: "Jules Verne", publisher: "Pierre-Jules Hetzel",
    publicationYear: 1873, description: "Phileas Fogg races around the world to win a wager.", language: "French",
    edition: "First edition", shelfLocation: 'FIC-04',
    totalCopies: 0 }
];
