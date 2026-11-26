import { SeedTitle } from './seed-title';

export const business: readonly SeedTitle[] = [
  { title: "The Lean Startup", author: "Eric Ries", publisher: "Crown Business",
    publicationYear: 2011, description: "An approach to testing assumptions and learning through product experiments.", language: "English",
    edition: "First edition", shelfLocation: 'BUS-01',
    totalCopies: 3 },
  { title: "Good to Great", author: "Jim Collins", publisher: "HarperBusiness",
    publicationYear: 2001, description: "A study of businesses that sustained exceptional performance after a transition.", language: "English",
    edition: "First edition", shelfLocation: 'BUS-02',
    totalCopies: 4 },
  { title: "The Innovator's Dilemma", author: "Clayton M. Christensen", publisher: "Harvard Business School Press",
    publicationYear: 1997, description: "A study of why established companies struggle with disruptive technologies.", language: "English",
    edition: "First edition", shelfLocation: 'BUS-03',
    totalCopies: 2 },
  { title: "The Effective Executive", author: "Peter F. Drucker", publisher: "Harper & Row",
    publicationYear: 1967, description: "A guide to using time and making decisions as an executive.", language: "English",
    edition: "First edition", shelfLocation: 'BUS-04',
    totalCopies: 6 }
];
