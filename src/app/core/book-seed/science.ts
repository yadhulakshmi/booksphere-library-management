import { SeedTitle } from './seed-title';

export const science: readonly SeedTitle[] = [
  { title: "Silent Spring", author: "Rachel Carson", publisher: "Houghton Mifflin",
    publicationYear: 1962, description: "An investigation into the ecological effects of widespread pesticide use.", language: "English",
    edition: "First edition", shelfLocation: 'SCI-01',
    totalCopies: 6 },
  { title: "A Brief History of Time", author: "Stephen Hawking", publisher: "Bantam Books",
    publicationYear: 1988, description: "An introduction to cosmology, black holes, and the origins of the universe.", language: "English",
    edition: "First edition", shelfLocation: 'SCI-02',
    totalCopies: 0 },
  { title: "The Selfish Gene", author: "Richard Dawkins", publisher: "Oxford University Press",
    publicationYear: 1976, description: "An explanation of evolution through a gene-centered perspective.", language: "English",
    edition: "First edition", shelfLocation: 'SCI-03',
    totalCopies: 3 },
  { title: "On the Origin of Species", author: "Charles Darwin", publisher: "John Murray",
    publicationYear: 1859, description: "Darwin presents evidence for evolution by natural selection.", language: "English",
    edition: "First edition", shelfLocation: 'SCI-04',
    totalCopies: 4 }
];
