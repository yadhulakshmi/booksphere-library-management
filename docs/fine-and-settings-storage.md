# Fine and settings persistence

Phase 3D writes the authoritative snapshot to `booksphere.circulation.v2`. It keeps the original v1 circulation snapshot and the earlier inventory key. Initialization uses v2 if present, validates v1 and migrates when v2 is absent, or initializes from the earlier inventory. Existing book, loan, reservation, member and activity identifiers survive the migration. Invalid storage is preserved and changes are blocked. A failed write leaves the last committed snapshot intact.

Each v1 loan receives the Phase 3D defaults of INR 5 per overdue day, zero grace days and an INR 500 cap. Migration infers its original due date by subtracting seven calendar days per recorded renewal from its stored due date. The stored due date remains in force. Existing returned overdue loans receive one fine when the calculated amount is positive. No payment history is generated, including for demonstration loans. Ready reservations keep their stored collection deadlines, and v1 reservations inherit the original three-day collection term.

New loans retain their initial due date, standard duration, renewal count limit, renewal extension and fine calculation terms. New reservations retain the collection term effective at placement. Settings updates leave existing terms and finalized amounts in place. The current active loan limit and fine borrowing threshold apply at the next eligibility check. A fine-restricted member retains queue position and any ready hold through its existing deadline. Payment below the threshold restores fine eligibility. Otherwise the hold expires normally and the copy goes to the next eligible member in sequence. Fine restrictions do not prevent placing a hold, returning a book or recording a payment.

Fines and payments use integer paise. Payment requests have persistent idempotency IDs. A payment and its effect on the assessed balance and activity ledger are saved in one write. Recorded payments are local manual demonstration entries. Existing transaction references and names are retained in the ledger after eligible deletion.

## Settings validation

| Field | Accepted values |
| --- | --- |
| Library name and address | Nonblank text |
| Email and phone | Email format and a phone number with 7–15 digits |
| Hours | 24-hour times with closing later on the same day |
| Active loan limit | 1–100 loans |
| Standard term and renewal extension | 1–365 calendar days |
| Renewal limit | 0–20 renewals |
| Reservation window | 1–90 calendar days |
| Fine grace period | 0–365 calendar days |
| Daily fine | INR 0–10,000 |
| Per-loan fine cap | INR 0–1,000,000 |
| Borrowing restriction threshold | INR 0.01–1,000,000 |
| Monetary input | Up to two decimal places |
