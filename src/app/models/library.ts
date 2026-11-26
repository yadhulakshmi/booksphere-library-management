export interface BookCategory {
  readonly id: string;
  readonly name: string;
}

export interface BookInput {
  readonly isbn: string;
  readonly title: string;
  readonly author: string;
  readonly categoryId: string;
  readonly publisher: string;
  readonly publicationYear: number;
  readonly edition: string;
  readonly language: string;
  readonly description: string;
  readonly coverImage: string;
  readonly shelfLocation: string;
  readonly totalCopies: number;
}

export type BookStatus = 'Available' | 'Unavailable' | 'Out of stock';

export interface Book extends BookInput {
  readonly id: string;
  readonly borrowedCopies: number;
  readonly reservedCopies: number;
  readonly availableCopies: number;
  readonly status: BookStatus;
  readonly dateAdded: string;
  readonly lastUpdated: string;
  readonly demonstration: boolean;
}

export const MEMBERSHIP_TYPES = ['Student', 'Faculty', 'General', 'Premium'] as const;
export const MEMBERSHIP_STATES = ['Active', 'Inactive', 'Suspended'] as const;

export type MembershipType = typeof MEMBERSHIP_TYPES[number];
export type MembershipState = typeof MEMBERSHIP_STATES[number];
export type MembershipStatus = MembershipState | 'Expired';

export interface MemberInput {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly membershipType: MembershipType;
  readonly registrationDate: string;
  readonly expiryDate: string;
  readonly notes: string;
}

export interface MemberRecord extends MemberInput {
  readonly id: string;
  readonly membershipId: string;
  readonly state: MembershipState;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly demonstration: boolean;
}

export interface Member extends MemberRecord {
  readonly status: MembershipStatus;
  readonly initials: string;
}


export interface CirculationReference {
  readonly bookId: string;
  readonly memberId: string;
  readonly bookTitle: string;
  readonly memberName: string;
  readonly membershipId: string;
  readonly demonstration: boolean;
}

export interface FinePolicy {
  readonly currency: 'INR';
  readonly dailyFineMinor: number;
  readonly graceDays: number;
  readonly maxFineMinor: number;
}

export type LoanTerms = Pick<LibrarySettings, 'lendingDays' | 'maxLoanRenewals' | 'renewalDays'> & FinePolicy;

export interface Loan extends CirculationReference {
  readonly originalDueAt: string;
  readonly terms: LoanTerms;
  readonly id: string;
  readonly checkedOutAt: string;
  readonly dueAt: string;
  readonly returnedAt: string | null;
  readonly renewals: number;
  readonly overdueDaysAtReturn: number | null;
}

export type ReservationStatus = 'waiting' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';

export interface Reservation extends CirculationReference {
  readonly id: string;
  readonly sequence: number;
  readonly collectionDays: number;
  readonly placedAt: string;
  readonly readyAt: string | null;
  readonly expiresAt: string | null;
  readonly fulfilledAt: string | null;
  readonly status: ReservationStatus;
}

export type FineStatus = 'Outstanding' | 'Partially Paid' | 'Paid';

export interface Fine extends CirculationReference {
  readonly id: string;
  readonly loanId: string;
  readonly originalDueAt: string;
  readonly dueAt: string;
  readonly returnedAt: string;
  readonly overdueDays: number;
  readonly policy: FinePolicy;
  readonly assessedMinor: number;
  readonly paidMinor: number;
  readonly balanceMinor: number;
  readonly status: FineStatus;
  readonly assessedAt: string;
  readonly updatedAt: string;
}

export const PAYMENT_METHODS = ['Cash', 'UPI', 'Debit Card', 'Credit Card', 'Bank Transfer'] as const;
export type PaymentMethod = typeof PAYMENT_METHODS[number];

export interface FinePaymentInput {
  readonly requestId: string;
  readonly amountMinor: number;
  readonly method: PaymentMethod;
  readonly paidOn: string;
  readonly reference: string;
  readonly notes: string;
}

export interface FinePayment extends FinePaymentInput, CirculationReference {
  readonly id: string;
  readonly fineId: string;
  readonly recordedAt: string;
}

export interface LibrarySettings extends FinePolicy {
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly address: string;
  readonly openingTime: string;
  readonly closingTime: string;
  readonly lendingDays: number;
  readonly maxLoansPerMember: number;
  readonly maxLoanRenewals: number;
  readonly renewalDays: number;
  readonly reservationCollectionDays: number;
  readonly reservationPriority: 'first-come-first-served';
  readonly restrictionThresholdMinor: number;
}

export interface LibraryActivity {
  readonly description?: string;
  readonly id: string;
  readonly entityId: string;
  readonly type: 'book-added' | 'book-updated' | 'book-deleted' | 'member-registered' | 'checkout' | 'return' |
    'loan-renewed' | 'reservation' | 'reservation-ready' | 'reservation-fulfilled' |
    'reservation-cancelled' | 'reservation-expired' | 'fine' | 'fine-partial-payment' | 'fine-paid' | 'settings-updated' | 'settings-restored';
  readonly occurredAt: string;
}
