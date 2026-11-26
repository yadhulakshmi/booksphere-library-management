import { SeedTitle } from './seed-title';

export const literature: readonly SeedTitle[] = [
  { title: "Leaves of Grass", author: "Walt Whitman", publisher: "Self-published",
    publicationYear: 1855, description: "A collection of poems about identity, individuality, and democracy.", language: "English",
    edition: "First edition", shelfLocation: 'LIT-01',
    totalCopies: 6 },
  { title: "Mrs Dalloway", author: "Virginia Woolf", publisher: "Hogarth Press",
    publicationYear: 1925, description: "A single London day reveals the interior lives of several characters.", language: "English",
    edition: "First edition", shelfLocation: 'LIT-02',
    totalCopies: 0 },
  { title: "Dubliners", author: "James Joyce", publisher: "Grant Richards",
    publicationYear: 1914, description: "Stories depict everyday life in Dublin in the early twentieth century.", language: "English",
    edition: "First edition", shelfLocation: 'LIT-03',
    totalCopies: 3 },
  { title: "Les Fleurs du mal", author: "Charles Baudelaire", publisher: "Poulet-Malassis et de Broise",
    publicationYear: 1857, description: "Poems explore beauty, modernity, and alienation.", language: "French",
    edition: "First edition", shelfLocation: 'LIT-04',
    totalCopies: 4 }
];
