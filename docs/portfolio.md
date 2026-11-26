# BookSphere portfolio descriptions

## GitHub description

Angular library-management portfolio app with inventory, memberships, circulation, fines, reporting, and standalone or Mock REST API modes.

**Topics:** `angular`, `typescript`, `rxjs`, `angular-material`, `reactive-forms`, `json-server`, `library-management`, `chartjs`, `responsive-design`, `karma`.

## Resume project description

Built BookSphere, an independent Angular library-management application covering catalogue and inventory management, member registration, circulation, holds, fines and analytics. Implemented standalone browser persistence and a local mock REST API that applies shared transaction rules.

- Structured nine Angular Material workspaces as lazy-loaded NgModules and used RxJS projections to keep inventory, member, and circulation views synchronized.
- Built Reactive Forms and shared validation for ISBNs, membership states, inventory allocation, queue promotion, fines and partial payments.
- Integrated typed Angular HttpClient requests with revision checks, idempotency keys and atomic JSON snapshot commits in a loopback mock API.
- Built accessible Chart.js summaries, filtered CSV and printable reports, and reduced production CSS from 99.59 to 69.67 kB by compiling selected Material themes.
- Verified 100 Jasmine/Karma tests, 63 responsive route and viewport combinations, and an isolated HTTP suite covering transaction rollback, payment settlement and persistence.

## Technical interview explanation

BookSphere started with a consistency problem: checking out or returning a copy touches operational state across several screens. I separated Material components and forms from domain rules, then used RxJS to project confirmed records into the catalogue, dashboard and reports. In standalone mode, a coordinator applies and persists circulation changes as a versioned snapshot. In Mock API mode, the same rules run on a local server that checks the expected revision, commits the complete state, and then publishes the result. The two data modes are intentionally separate. I tested conflicting and duplicate requests, persistence after restart, inventory and fine updates, and responsive navigation in isolated environments.
