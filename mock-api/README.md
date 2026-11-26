# BookSphere Mock API

The mock server uses JSON Server 0.17.4 for the Express application and JSON request parsing. It binds to `127.0.0.1:3000`. The Angular API development configuration proxies same-origin `/api` requests to that address. The server exposes named resource routes and uses shared, compiled TypeScript business rules for every write.

## Start API mode

Open two PowerShell sessions in the BookSphere directory.

**Mock API**

```powershell
$env:PATH = "$env:APPDATA\nvm\v16.20.2;$env:PATH"
npm.cmd run mock-api
```

**Angular**

```powershell
$env:PATH = "$env:APPDATA\nvm\v16.20.2;$env:PATH"
.\node_modules\.bin\ng.cmd serve --configuration api
```

Open `http://127.0.0.1:4200`. The shell displays **Mock API**. The API build configuration uses `src/environments/environment.api.ts` and writes to `dist/booksphere-api`. A built API-mode site requires a same-origin `/api` reverse proxy. It is intended for local development.

## Start standalone mode

```powershell
$env:PATH = "$env:APPDATA\nvm\v16.20.2;$env:PATH"
.\node_modules\.bin\ng.cmd serve --configuration development
```

Use your existing standalone URL to access the same browser data. For the usual development setup, that is `http://localhost:4200`. The shell displays **Standalone demo**. Standalone development and production builds select local persistence, retain the established keys and migrations, and need no API. A static host needs standard Angular route fallback to `index.html`.

API mode uses its own database and never reads, uploads, imports or replaces browser library records. This phase provides no import flow. If the API fails, use **Retry read** after restoring the server. The UI keeps the last confirmed snapshot during the session and blocks writes until it can resolve a transport failure or revision conflict. A safe read can be retried. Writes are never automatically resubmitted.

## Database and transactions

The first start creates `mock-api/data/db.json` from the fictional inventory and member fixtures using the fixed date in `seed.json`. The seed is applied only when the file is absent. Existing database files are loaded and validated. Invalid data stops startup and is left in place. The fictional seed includes 40 book titles, 30 members, and circulation examples. Their dates are fixed for reproducible demonstrations, so eligibility and ready holds can change as real calendar time progresses.

The JSON envelope contains a `snapshot` with `revision`, `circulation` (v2 inventory, loans, reservations, fines, payments, settings and activity) and `members` (membership ID counter, directory and registration activity). It also contains up to 250 idempotency receipts. GET resources are derived views of this snapshot.

Each mutation must send `If-Match: "N"`, where N came from the latest snapshot, and a unique `Idempotency-Key`. The server clones the confirmed state, applies the shared operation, advances the reservation queue where applicable, recalculates stock, and validates cross-record references and the fine ledger. It persists the complete result and receipt by writing a sibling temporary file and replacing the database file. Only then does it publish the new revision and respond. A failed validation or write leaves the prior revision intact. A stale revision receives 412. Repeating the same request key and payload returns the recorded result without another write. A conflicting payload receives 409.

Angular uses a typed HttpClient adapter, one confirmed snapshot stream, and a serial request queue. Matching in-flight submissions share a request. A retry of the same operation after an uncertain transport failure reuses its key within the current browser session. An API response contains the latest confirmed snapshot so a replay does not roll the UI back.

## Endpoints

All paths below are prefixed with `/api`. Mutation responses have the shape `{ "snapshot": { "revision": 1, "circulation": { ... }, "members": { ... } }, "result": ... }`. A successful removal, cancellation or maintenance returns `"result": null`. Examples list representative fields, and the complete TypeScript types are in `src/app/models/library-api.ts` and `library.ts`.

| Method and path | Example request | Example result |
| --- | --- | --- |
| GET `/snapshot` | No body | `{ "revision": 0, "circulation": { ... }, "members": { ... } }` |
| GET `/books`, `/members`, `/loans`, `/reservations`, `/fines`, `/payments`, `/activities` | No body | Array of the requested resource records |
| GET `/settings` | No body | `{ "name": "BookSphere Demonstration Library", "currency": "INR", ... }` |
| POST `/books` | BookInput, including title, category and total copies | Created book with assigned ID and stock |
| PUT or DELETE `/books/:id` | PUT `{ "book": { ... } }`; DELETE has no body | Updated book or null |
| POST `/members` | MemberInput, including email, membership type and dates | Created member with assigned membership ID |
| PUT or DELETE `/members/:id` | PUT `{ "member": { ... } }`; DELETE has no body | Updated member or null |
| PATCH `/members/:id/status` | `{ "state": "Suspended" }` | Updated member |
| POST `/members/:id/renewal` | `{ "expiryDate": "2027-11-25" }` | Renewed member |
| POST `/loans` | `{ "memberId": "member-BS-000031", "bookId": "book-id", "date": "2026-11-25" }` with optional reservationId | Issued loan |
| POST `/loans/:id/return` | `{ "date": "2026-11-25" }` | Returned loan; snapshot includes related stock, fines and holds |
| POST `/loans/:id/renewal` | `{}` | Renewed loan |
| POST `/reservations` | `{ "memberId": "member-BS-000031", "bookId": "book-id" }` | Waiting or ready reservation |
| POST `/reservations/:id/cancellation`, `/reservations/settle` | `{}` or no body for maintenance | Null result; updated snapshot |
| POST `/fines/:fineId/payments` | `{ "payment": { "requestId": "payment-intent", "amountMinor": 500, "method": "Cash", "paidOn": "2026-11-25", "reference": "", "notes": "" } }` | Recorded payment |
| PUT `/settings`, POST `/settings/restore` | Complete LibrarySettings for PUT; no body for restore | Updated settings |

Validation failures return 422 and `{ "message": "..." }`. Missing revisions return 428. Failed persistence returns 500. The server uses its local calendar for due dates and eligibility.

## Verification and limitations

Run `npm.cmd run test:mock-api` under Node.js 16. The integration test uses its own file under `.angular/mock-api/tests` and exercises HTTP requests, a forced persistence failure, and a server restart. The default database is separate from these tests.

This is a single-process, loopback-only development mock. Run one server per file, avoid editing its file while the server is running, and keep backups of any records that matter. File replacement is not a production database durability guarantee. The API has no user authentication, real payment processing, or production deployment configuration. Idempotency receipts have a bounded history. Browser-close recovery for an uncertain request requires inspecting the current data after reopening.
