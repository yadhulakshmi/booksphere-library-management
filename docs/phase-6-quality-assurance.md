# Phase 6 quality assurance

## Scope and fixes

BookSphere retains nine lazy-loaded Angular 13 feature modules, strict templates and reactive forms. Standalone uses the existing browser keys and migrations. API mode uses the existing authoritative v2 snapshot and loopback mock server. No packages, lockfile versions, runtime database, existing browser records or system settings were changed.

- The baseline production sweep found horizontal overflow on Dashboard at 1920, 1024, 768 and 360 px. At 1920 px, the remaining overflow came from the profile icon's ligature text when its remote font was late or unavailable. The existing Material Icons font is now a local asset with a fixed icon box. Dashboard chart and panel grid items can shrink, and its metric cards wrap on narrow screens.
- The sidebar is an overlay through 900 px. The shell has a keyboard skip link to the main region. Active navigation remains identified when a URL has workspace query parameters. Page spacing, breadcrumbs, empty states, report filters and mobile controls are more compact.
- Report pagination uses the existing all-row projection. Print markup is created on demand, staged outside the shell for native printing and removed afterward. CSV and print still use every filtered record.
- Production no longer fetches Google Fonts CSS during the build. Optional browser Roboto loading retains a system-font fallback. The Material Icons asset is 128,352 bytes and is fetched locally as a separate, cacheable asset.
- Removed unused Material component theme styles from the global stylesheet by compiling only the Material components used by BookSphere. Budget limits were kept intact.

## Functional verification

| Workspace | Coverage |
| --- | --- |
| Dashboard | Live and period metrics, finance aggregation, activity, historical rankings, quick links and chart data |
| Catalogue | Projection, filtering, availability, pagination and mobile visual controls |
| Book Management | Create/edit/delete, ISBN and duplicate validation, inventory guards, persistence |
| Members | Contact and duplicate validation, renewal, status changes, expiry, profile and deletion guards |
| Borrow and Return | Issue/return/renewal rules, limits, due dates, duplicate requests and stock |
| Reservations | Waiting/ready allocation, FIFO, expiry, cancellation, collection and promotion |
| Overdue and Fines | Calendar-day math, estimates, final assessment, partial/full payment and borrowing restrictions |
| Reports | Eight report types, sorting and filtering, pagination, CSV escaping and print staging |
| Settings | Responsive controls, validation, persistence, default restoration and preserved transaction terms |

The expanded HTTP workflow uses a temporary database. It creates books and members, checks unavailable/invalid operations, verifies the last copy with competing holds, finalizes an overdue return, checks rollback after an injected persistence failure, pays a fine in two parts, checks restored eligibility, and renews and returns a new loan. It verifies preserved loan terms after settings changes, later issues with the new duration, and historical references after deleting eligible records. Existing Jasmine suites independently cover standalone reservation expiry, policy changes, inventory and member migrations, and failed writes. Browser smoke tests and the responsive sweep use temporary Chrome profiles.

## Build and verification results

- **Angular 13 builds:** Development and API configurations passed without warnings. The optimized standalone production build passed without network escalation. There is no production API configuration.
- **Budgets:** The production initial bundle is 778.31 kB raw and 183.30 kB estimated transfer, down from 807.54 kB and 185.71 kB. The global stylesheet decreased from 99.59 to 69.67 kB raw. Angular's initial bundle estimate excludes the separately loaded icon asset. The largest lazy chunk is Dashboard at 191.46 kB raw and 57.29 kB estimated transfer. Other large lazy chunks include Book Management at 43.07 kB and Circulation at 42.86 kB raw. Webpack stats identify Angular core, forms, router, common, animations and CDK as sizeable startup modules.
- **Open warnings:** Production is still 278.31 kB over the 500 kB initial warning threshold. Dashboard and shell styles are 2.69 and 2.81 kB against the 2 kB component warning threshold. Existing error thresholds passed.
- **Automated checks:** 100 Jasmine/Karma tests passed in ChromeHeadless. This retains all 97 prior cases and adds tests for keyboard skip focus, query-aware navigation state, and report projection reuse. The isolated HTTP workflow and Angular dev-proxy smoke check passed.
- **Responsive production verification:** All nine routes loaded directly at 1920, 1440, 1280, 1024, 768, 390 and 360 px, for 63 cases. No whole-workspace horizontal overflow or application console exceptions were captured. Tables can scroll in their own regions. Chrome rendered four populated Dashboard charts at each width. The empty financial trend retained its empty state. The production sweep made zero Mock API calls.
- **Browser interaction checks:** At mobile width Chrome toggled Catalogue list view, searched, opened book details, closed the dialog with Escape, and navigated through the mobile drawer. At desktop width it changed the Dashboard period and opened the chart's accessible table. In both data modes it added a fictional book and checked reload persistence. API mode also verified Dashboard and Reports updates, real CSV download and browser PDF generation, explicit outage messaging and Retry read, and byte-for-byte preservation of the standalone snapshot. Browser automation startup locks and transition timing caused early harness failures. The harness was corrected and both browser suites passed on rerun.
- **Evidence:** `.angular/phase6/final-matrix.json` and representative PNGs for the 1440 px Dashboard, 768 px Members, 390 px Catalogue and 360 px Reports were captured with isolated data. The artifact directory is ignored.
- **Review limits:** A full assistive-technology or WCAG audit, Excel opening, native Save as PDF UI, and a manual click-through of every transaction in both modes remain outside automated verification. The checklist below covers the remaining manual workflows.

## Dependencies and security

`npm audit --json` reported 50 affected dependency entries. The production-only graph contained 10. These counts are npm dependency entries, including propagation through dependency chains, and do not establish which code paths are reachable in BookSphere.

| Scope | Low | Moderate | High | Critical | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Full dependency tree | 5 | 21 | 22 | 2 | 50 |
| Production dependency graph | 0 | 6 | 4 | 0 | 10 |
| Development-only difference | 5 | 15 | 18 | 2 | 40 |

All 10 production entries are direct Angular dependencies. The full audit flags 13 direct entries and 37 transitive entries. The critical entries are development transitives `piscina` and `tar`, reached through Angular build/CLI tooling. The production advisories involve framework HTTP, routing, formatting, and template/sanitization behavior. Some advisory conditions involve SSR or credentialed requests, which this client-rendered demo does not use. This inspection does not establish that the remaining advisories are unreachable.

npm proposed major Angular/CLI replacements for the direct entries. The non-major fix flags for two development schematic packages do not establish a supported fix for the pinned Angular/CLI graph. Plan a separate dependency modernization with a supported Node/Angular combination and retest it before public use. No audit fix was run. The existing `node-releases@2.0.65` engine mismatch comes from Browserslist in the build toolchain and requires Node 18 or newer. The builds exercised here completed under Node 16. `connect-pause@0.1.1` is pulled in by JSON Server 0.17.4 and is deprecated. Its replacement belongs in a separately approved mock-tool update.

Reviewed report text rendering, CSV escaping and formula neutralization, local Blob URLs, and mock API exposure. CSV URLs are created from the locally generated Blob. Report printing clones the rendered Angular template. Public cover URLs can make outbound requests. The loopback mock API has no authentication and should only handle fictional records. Store personal data, secrets, and real payments elsewhere. Production assets include fictional seeds through the existing app code. The default mock database, build outputs, npm/Karma caches, temporary profiles, screenshots and PDFs are ignored from source control.

## Isolated manual checklist

Use a fresh Chrome Guest window or a dedicated temporary profile. Use your usual browser profile and origin only when you intend to work with its existing standalone data. Stop the regular mock API before using port 3000 for a manual test and preserve its database.

From the project directory, start standalone mode:

```powershell
$env:PATH = "$env:APPDATA\nvm\v16.20.2;$env:PATH"
.\node_modules\.bin\ng.cmd serve --configuration development
```

Open `http://localhost:4200`. For API testing without touching the regular database, start the following test server in a separate PowerShell session:

```powershell
$env:PATH = "$env:APPDATA\nvm\v16.20.2;$env:PATH"
.\node_modules\.bin\tsc.cmd -p mock-api/tsconfig.json
if (!$env:BOOKSPHERE_PHASE6_DB) {
  $testDir = New-Item -ItemType Directory -Path (Join-Path '.angular' ('phase6-manual-' + [guid]::NewGuid()))
  $env:BOOKSPHERE_PHASE6_DB = Join-Path $testDir.FullName 'db.json'
}
node -e "const db=require('./mock-api/database.cjs'); const api=require('./mock-api/server.cjs'); api.createServer(db.openDatabase(process.env.BOOKSPHERE_PHASE6_DB)).listen(3000,'127.0.0.1')"
```

Start the API frontend in another session with `.\node_modules\.bin\ng.cmd serve --configuration api --port 4201` after setting the same Node PATH. Open `http://127.0.0.1:4201`.

1. **Issue, renew and return.** Add a one-copy fictional title and register a fictional member. Issue today, check Catalogue stock and the Dashboard open-loan total, renew, then return. Filter the Circulation report by title to check the returned entry and renewal count.
2. **FIFO.** Issue another last copy. Place reservations for two different active members. Return the copy. Confirm that only the first reservation becomes ready. Collect it, return it, then confirm the second reservation becomes ready. Cancel it and verify available stock.
3. **Fines.** In the disposable data only, register a fictional member with a registration date at least 40 days ago and an expiry in the future. Issue with a borrow date 34 days ago under the default 14-day term. Return today and verify the INR 100 assessment under default settings. Record a small partial payment, verify eligibility below the INR 100 threshold, then pay the remainder and check Payment History.
4. **Policy and history.** Save a 21-day loan duration while one loan is open. Confirm the old due date is unchanged and a new loan uses 21 days. Cancel an unsaved edit and confirm the saved value returns. After all allocations and balances are settled, delete the test title and member. Confirm Circulation and financial reports still show historical names.
5. **Invalid operations.** Try a malformed or duplicate ISBN, a duplicate member email, an invalid date, a payment above the balance, and deleting an allocated title. Confirm the messages and unchanged records.
6. **Output and recovery.** In Reports, filter a set with more rows than the page size, export it, and compare the CSV row count. Use native Print and choose Save as PDF. Confirm headings repeat and the last row appears. Stop the isolated API, verify the error, rerun the last Node command in the same test PowerShell session, and use Retry read. Recheck standalone mode with the backend stopped.

## Release assessment

The optimized standalone output is `dist/booksphere`. A static host must return `index.html` for direct routes such as `/reports` and serve assets normally. The API development build remains at `dist/booksphere-api` and needs a same-origin `/api` proxy. There is no separately configured API production target. Keep the mock backend local.

Phase 6 supports proceeding to a separate repository and deployment preparation review for a fictional-data portfolio. The legacy dependency findings and production budget warnings remain open. Production use with real patrons or payments requires a supported stack, a real authenticated backend, schema and operational controls, and a broader accessibility and security review.
