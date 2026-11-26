# Public source release review

## Dependency findings

This review uses the recorded Phase 6 npm dependency audits. npm counts affected package entries, including entries propagated through dependency chains. The full tree had 50 entries (5 low, 21 moderate, 22 high, 2 critical). The production graph had 10 entries (6 moderate and 4 high). The two critical entries were development transitives `piscina` and `tar`.

| Severity | Locked package | Recorded finding and relevance |
| --- | --- | --- |
| High | `@angular/common@13.3.12` | HTTP XSRF and transfer-cache findings, plus date/number formatter resource exhaustion. BookSphere uses a fixed relative API route and fixed display formats. It has no SSR transfer cache or credentialed session design. [HTTP advisory](https://github.com/advisories/GHSA-58c5-g7wp-6w37) · [Date formatting advisory](https://github.com/advisories/GHSA-48r7-hpm6-gfxm) |
| High | `@angular/compiler@13.3.12` | Template sanitization, SVG/MathML, two-way binding and i18n findings. The release uses AOT and project-authored templates. There is no feature that compiles user templates or imports user-supplied HTML. Framework findings remain open. [Compiler advisory](https://github.com/advisories/GHSA-58w9-8g37-x9v5) |
| High | `@angular/core@13.3.12` | Binding, template, i18n and hydration findings. This application uses fixed templates and interpolation with no SSR hydration. The core package remains a runtime dependency. [Core and compiler advisory](https://github.com/advisories/GHSA-hh8m-fm6v-7cvg) |
| High | `@angular/router@13.3.12` | SSR resource-exhaustion findings and inherited Angular findings. BookSphere routes in the browser, so the SSR-specific scenarios are outside this configuration. [Router advisory](https://github.com/advisories/GHSA-ff3f-86qr-9cv3) |
| Moderate | `@angular/animations@13.3.12` | Inherited from Angular core. Material transitions use this dependency. |
| Moderate | `@angular/cdk@13.3.9` | Inherited from Angular common/core. The app uses CDK layout, overlays and accessibility features. |
| Moderate | `@angular/forms@13.3.12` | Inherited from common/core/platform-browser. Reactive Forms are used across the editing workflows. |
| Moderate | `@angular/material@13.3.9` | Inherited through Angular and CDK dependencies. Material controls are used across every workspace. |
| Moderate | `@angular/platform-browser@13.3.12` | Inherited through animations/common/core. This is part of browser startup and rendering. |
| Moderate | `@angular/platform-browser-dynamic@13.3.12` | Inherited through Angular packages including the compiler. It is used by the bootstrap setup and test tooling. |

No supported, compatible patch within the pinned Angular 13 stack was verified for these production entries. npm proposed major upgrades for them. The current compatible risk reduction is to keep the demo client-rendered, use fixed same-origin API paths and formatter options, keep templates project-controlled, and use fictional data. These measures do not remediate the framework advisories. Plan a separately approved migration of Angular, CLI, Material/CDK, TypeScript and Node as a compatible set. Retest the UI, rules and builds after that migration. [Angular release support](https://angular.dev/reference/releases)

Node 16 is end-of-life. The build-tool transitive `node-releases@2.0.65` declares Node 18 or newer, and `connect-pause@0.1.1` is a deprecated JSON Server transitive. The development findings and budget warnings remain open. No dependency remediation or audit fix was applied. [Node.js release schedule](https://nodejs.org/en/about/previous-releases)

## Public source review

- Reviewed publication candidates for common credential and token formats, private-key markers, local absolute paths, hardcoded passwords and personal contact data. No such values were found in the scanned release candidates. This was a targeted scan and source review, not a claim of exhaustive detection.
- The server binds to loopback. Its startup and test logs describe status and failures. The runtime database, lock-related receipts, local profiles, caches and generated reports stay outside the publication set. It has no authentication and should only be used with fictional records.
- Templates display app records through Angular bindings. The report URL bypass is limited to an object URL made from the app's own CSV Blob. User-supplied text is escaped and formula-like cells are neutralized. External book covers can still make browser requests.
- Screenshots were captured from a fresh standalone profile populated with demonstration data. They show the app viewport without browser chrome. The bundled Material Icons asset retains the upstream Apache 2.0 notice. The production build generates third-party license notices. A project-wide license requires an explicit owner decision. [Upstream Material Icons license](https://github.com/google/material-design-icons/blob/master/LICENSE)

## Publication inventory

| Include | Exclude |
| --- | --- |
| `src/`, all specs, local font assets and upstream license | `node_modules/`, `dist/`, `.angular/`, coverage and test results |
| Package manifest and lockfile, Angular/TypeScript/Karma configuration, portable editor tasks | Temporary browser profiles, logs, machine-specific settings and environment secret files |
| Mock API source, TypeScript/proxy configuration, seed descriptor, and isolated HTTP tests | Runtime database, its backups, and temporary JSON data |
| README, architecture and QA documentation, and selected `docs/screenshots/` PNGs | Generated browser diagnostics and unselected screenshots |

The first mock API startup creates its fictional JSON database without any committed runtime state. The existing GitHub repository can be used for publication after owner approval. No Git metadata or publishing action is required for the preparation phase.
