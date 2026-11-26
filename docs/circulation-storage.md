# Phase 3C circulation storage

Phase 3D builds on this migration. See [fine and settings persistence](fine-and-settings-storage.md) for the current version.

Phase 3C used `booksphere.circulation.v1` as the authoritative version 1 snapshot for book metadata, loans, reservations, and library activity. Available copies are derived as total copies minus active loans minus ready reservations. Waiting reservations do not allocate stock.

On initialization, an existing Phase 3A inventory is validated and migrated with its book IDs, metadata, and total quantities intact. Unsupported demonstration allocations are released. An unexpected non-demonstration allocation or invalid snapshot blocks writes and leaves the original data in place. The legacy key is kept intact as a migration source and is not used once the new snapshot exists. Member records retain their existing dedicated key and IDs. A fresh inventory can include four labeled demonstration loans and two labeled reservations linked to eligible demonstration members. Migration never adds these transactions to an existing inventory.

The coordinator reads the current snapshot, checks member eligibility, advances the reservation queue, applies the operation, recomputes inventory, and writes a single localStorage entry. A failed write publishes no transaction changes. Member writes and circulation transactions share a Web Lock when the browser supports it. The fallback serializes writes within one tab. Loan and reservation snapshots retain title, member name, membership ID, and underlying IDs for history after deletion.

Waiting reservations are promoted by creation sequence. Ready reservations allocate one copy and can be collected through the deadline, in local calendar days. The coordinator expires holds after the deadline and cancels active reservations for members who become ineligible. Refresh and relevant transactions recheck the queue. Checkout of a ready hold creates the loan and fulfils that reservation in the same commit. Late returns retain the overdue day count for future fine assessment.
