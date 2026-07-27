# WorkDesk

> A private, offline-first work organizer distributed as a single HTML file.

[Polski](README_PL.md) · **English**

![Status](https://img.shields.io/badge/status-release%20candidate-blue)
![Version](https://img.shields.io/badge/version-1.66.3--KF64-informational)
![Runtime](https://img.shields.io/badge/runtime-browser-success)
![Distribution](https://img.shields.io/badge/distribution-single%20HTML-success)
![Offline](https://img.shields.io/badge/offline-first-success)
![UI language](https://img.shields.io/badge/UI-Polish%20only-orange)

> [!IMPORTANT]
> The current application interface is available **only in Polish**. This README is provided in English for developers and international visitors, but the application does not currently include an English language pack or a complete i18n layer.

## Table of contents

- [What is WorkDesk?](#what-is-workdesk)
- [Project goals](#project-goals)
- [Key principles](#key-principles)
- [Features](#features)
- [How to use the application](#how-to-use-the-application)
- [Data, privacy and security](#data-privacy-and-security)
- [Backups and recovery](#backups-and-recovery)
- [Architecture](#architecture)
- [Repository structure](#repository-structure)
- [Development setup](#development-setup)
- [Build and verification](#build-and-verification)
- [How to modify the project](#how-to-modify-the-project)
- [How to add a module](#how-to-add-a-module)
- [Storage and data contracts](#storage-and-data-contracts)
- [Business workflow links](#business-workflow-links)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Current limitations](#current-limitations)
- [Release policy](#release-policy)
- [Contributing](#contributing)
- [Security](#security)
- [License](#license)
- [FAQ](#faq)

---

## What is WorkDesk?

WorkDesk is a browser-based personal workspace designed for repetitive office and operational work. It combines frequently used tools—email recipient groups, templates, tasks, reminders, notes, a journal, procedures, checklists and lightweight case tracking—inside one local application.

The production release is a **single self-contained HTML file**. It does not require a server, database service, package installation, user account or permanent Internet connection. The application can be copied to another folder or removable drive and opened directly in a modern browser.

WorkDesk is intended primarily for a single user working on one computer. Its goal is not to replace a collaborative project-management suite. Its goal is to reduce context switching during daily work while keeping operational data under the user's control.

## Project goals

WorkDesk was created around a practical problem: many office workflows are scattered across email clients, text files, browser bookmarks, sticky notes, spreadsheets, calendar reminders and separate task applications.

The project attempts to provide one compact workspace for:

- preparing repetitive emails;
- managing recipient groups and templates;
- recording tasks, reminders, notes and daily events;
- storing frequently used links, snippets and procedures;
- tracking calls and cases requiring a response;
- creating local backups and restoring data without a server;
- operating fully offline when external links are not required.

WorkDesk deliberately avoids mandatory cloud synchronization, accounts, subscriptions and remote telemetry.

## Key principles

### Offline first

The application itself is local and self-contained. Core features continue to work without network access. Links configured by the user may, of course, open external or intranet websites.

### Single-file distribution

The development source is modular, but the production output is generated as one HTML file containing HTML, CSS and JavaScript.

Benefits include:

- no installer;
- simple copying and deployment;
- easy archiving;
- straightforward rollback to a previous file;
- no runtime dependency on npm packages or a CDN;
- ability to run from a normal folder or removable drive.

### Local data ownership

Application data is stored in the browser's local storage for the origin used to open WorkDesk. Users can export their data to a JSON backup and create local restore points.

### Defensive data handling

The runtime includes validation, normalization, backup/restore support, checksums, retention controls, recovery paths and a diagnostic build.

### Maintainable source, portable release

Developers work with separated templates, styles and runtime modules. End users receive a single HTML file.

## Features

### Daily dashboard

The dashboard provides a consolidated view of current work, including:

- today's tasks;
- overdue tasks;
- reminders scheduled for today;
- unfinished email drafts;
- backup age and data-state information;
- frequently used modules and tiles.

A global data-confidence indicator communicates whether data has been saved, the approximate storage usage and whether a recent restore point exists.

### Email workspace

The email section supports:

- recipient groups organized into sections;
- separate **To**, **CC** and **BCC** selection;
- recent email groups;
- email templates;
- reusable signatures;
- email profiles;
- recipient validation;
- duplicate-address prevention;
- search over groups and sections;
- draft persistence;
- message preparation through `mailto:`;
- bulk/serial email preparation;
- reusable text snippets.

The current interface uses Polish labels such as `Do`, `DW` and `UDW`.

### TODO

The TODO module supports:

- task creation and editing;
- priorities;
- due dates;
- filters for today, overdue, priority and completion state;
- completion timestamps;
- archive handling;
- CSV export of archived tasks;
- conversion of tasks into reminders or journal entries;
- undo and restore-oriented workflows.

### Calendar and reminders

The calendar includes:

- monthly calendar rendering;
- local reminders;
- reminder completion state;
- filtering and list rendering;
- conversion from related business records;
- navigation from workflow links.

### Journal

The journal is intended for short operational records. It supports:

- timestamped entries;
- entry types such as information, problem, decision, contact and completed work;
- text search;
- date-range filtering;
- summaries;
- CSV export;
- retention and cleanup support.

### Notes

The notes module provides local notes with safe storage limits, editing, removal and restore-aware behavior.

### Tiles and frequent links

Users can maintain configurable tiles and frequently used links for internal systems, websites, shared resources or common actions. The default source contains example addresses that should be replaced before real use.

### Checklists

Checklists support repeatable procedures with stable item identifiers, item completion state and normalized storage.

### Response cases

Response cases are lightweight records for matters that require follow-up. A case can be converted into:

- a TODO item;
- a reminder;
- a journal entry.

### Phone log

The phone log stores operational call records. A call can create a linked response case, preserving a stable relation between the source phone record and the created case.

### Procedures

The procedures module stores reusable instructions and operational knowledge that can be found through global search.

### Global search and command palette

WorkDesk includes:

- global search across supported modules;
- ranked results;
- keyboard navigation;
- a command palette opened with `Ctrl+K`;
- quick operational commands;
- navigation to matching records.

### Utility tools

The application contains local helper tools, including features such as:

- password generation;
- QR generation;
- time and working-day calculations;
- identifier generation;
- currency/VAT helper tools;
- clipboard-oriented actions.

These tools do not turn WorkDesk into a financial, security or compliance authority. Outputs should be reviewed before professional use.

### Data management

The data panel supports:

- complete JSON export;
- complete JSON import;
- module-level export;
- local restore points;
- module reset;
- restoration of built-in default data;
- storage usage visibility;
- retention cleanup;
- round-trip and integrity diagnostics.

Advanced and destructive operations are separated from routine backup actions.

### Diagnostic build

In addition to the production file, the project can generate a diagnostic build containing additional runtime checks and the `WorkDeskDebug` interface. The diagnostic build is for verification and development, not normal daily use.

## How to use the application

### Option A: use the ready production file

1. Download or copy `index_KF64.html`.
2. Place it in a stable folder.
3. Open it in a modern browser, preferably Microsoft Edge or another Chromium-based browser.
4. Configure your groups, templates, links, tasks and preferences.
5. Create a backup from the **Dane** panel after initial configuration.

No installation command is required for normal use.

### Recommended first-run checklist

1. Replace example links and tiles with your own resources.
2. Review email groups and templates.
3. Configure the default reminder time and interface preferences.
4. Create several test records.
5. Export a JSON backup.
6. Confirm that the exported backup file is stored outside the browser profile.
7. Test restore using non-critical sample data before relying on it operationally.

### Daily use

A typical daily workflow may look like this:

1. Open WorkDesk and review the **Dzisiaj** section.
2. Check overdue tasks and today's reminders.
3. Prepare emails from saved groups and templates.
4. Record calls, cases and decisions.
5. Convert cases into tasks or reminders when needed.
6. Add important events to the journal.
7. Create a restore point before major imports or resets.
8. Export a backup regularly.

### Important note about file origins

Browser storage is scoped by origin. Opening the same HTML through a different path, host or browser profile may result in a separate storage context. Do not assume that opening a copied file from another location will automatically expose the same local data.

Always keep independent JSON backups.

## Data, privacy and security

### What remains local

In the current source version, WorkDesk does not require a backend service for its core features. Application records are stored locally in the browser.

The project does not include a built-in account system, cloud database, analytics SDK or application telemetry service.

### External navigation

Tiles and links may point to Internet or intranet resources. Opening such a link leaves the local application and is then governed by the destination service.

The source package contains example URLs such as intranet, CRM, wiki and help-desk placeholders. Replace them before deployment.

### Sensitive information

Because WorkDesk stores data locally:

- anyone with access to the browser profile or operating-system account may potentially access it;
- local storage is not a substitute for an encrypted secrets vault;
- passwords, API keys, medical information and highly sensitive personal data should not be stored unless the environment is appropriately protected;
- backup files should be protected like any other operational data export.

### No automatic synchronization

Data is not synchronized between devices. Copying the HTML file does not copy browser local storage. Use export/import for controlled transfer.

## Backups and recovery

WorkDesk offers several layers of data protection:

- central storage validation and normalization;
- safe writes and storage fallback behavior;
- complete JSON export/import;
- local restore points;
- checksums and semantic round-trip verification;
- module reset with a safety point;
- restoration of previous valid state;
- quarantine/recovery paths for damaged stored data;
- retention rules for selected record types.

### Recommended backup policy

- Create a JSON backup after major configuration changes.
- Create backups regularly during active use.
- Store at least one copy outside the browser profile.
- Keep multiple dated backups.
- Test restoration periodically.
- Do not depend only on local restore points because they use the same browser storage environment.

## Architecture

At a high level:

```text
Production / Diagnostic entry
             │
             ▼
        Bootstrap runtime
             │
    ┌────────┼─────────┐
    ▼        ▼         ▼
 UI Runtime  AppStore  ModuleRegistry
    │        │         │
    ├────────┼─────────┤
    ▼        ▼         ▼
Event      Storage    Business modules
Lifecycle  Services   and renderers
    │        │         │
    └──── Scheduler ───┘
             │
             ▼
       Diagnostics / recovery
```

### Core runtime responsibilities

#### AppStore

Maintains the canonical in-memory application state and coordinates access to persisted data.

#### Storage capability and storage core

Provide the controlled boundary around `localStorage`, including capability checks, memory fallback behavior, validation, safe commit paths and usage reporting.

#### ModuleRegistry

Defines module contracts and connects module lifecycle methods such as initialization, binding, rendering, serialization, reset and teardown.

#### EventLifecycle

Registers events with an owner/key model so listeners can be removed or replaced without uncontrolled duplication. It also supports delegated events.

#### SchedulerService

Centralizes timeouts, intervals and debounced work. Scheduled tasks can be associated with owners and cancelled during teardown.

#### UIRuntime

Handles shared transient surfaces, modals, focus behavior and other application-level UI interactions.

#### Accessibility runtime

Audits and supplements accessible names, keyboard behavior, focus flow, ARIA state and selected UI contracts.

#### Diagnostics

Provides static and runtime gates for storage, persistence, modules, workflows and other critical behavior. Additional diagnostics are included in the diagnostic build.

#### BusinessWorkflow

Coordinates stable relationships and conversions between phone log records, response cases, TODO items, reminders and journal entries.

## Repository structure

```text
.
├── src/
│   ├── diagnostics/
│   │   └── diagnostic-overlay.js
│   ├── runtime/
│   │   ├── entry/
│   │   │   ├── production.js
│   │   │   └── diagnostic.js
│   │   └── shared/
│   │       ├── 00-event-lifecycle.js
│   │       ├── 10-scheduler-events.js
│   │       ├── 20-ui-runtime.js
│   │       ├── 25-accessibility-runtime.js
│   │       ├── 27-storage-capability.js
│   │       ├── 30-email-composer.js
│   │       ├── 40-storage-core.js
│   │       ├── 60-storage-validation.js
│   │       ├── 70-module-registry.js
│   │       ├── 80-persistence-import.js
│   │       ├── 100-calendar-reminders.js
│   │       ├── 125-core-modules.js
│   │       ├── 130-business-foundation.js
│   │       ├── 131-search-quick-actions.js
│   │       ├── 140-business-workflow.js
│   │       └── ...
│   ├── styles/
│   │   ├── 00-tokens-navbar.css
│   │   ├── 10-email.css
│   │   ├── 20-layout-panels.css
│   │   ├── 90-design-system.css
│   │   └── 99-final-overrides.css
│   └── templates/
│       ├── production.html
│       └── diagnostic.html
├── tools/
│   ├── build.py
│   ├── check_build.py
│   ├── dead_code.py
│   └── browser_smoke.py
├── dist/
│   ├── index_KF64.html
│   └── index_KF64_DIAG.html
├── build-manifest.json
└── package.json
```

Numeric prefixes define deterministic concatenation order. Do not rename files or change manifest order without understanding bootstrap dependencies.

## Development setup

### Requirements

- Python 3;
- Node.js for JavaScript syntax checks executed by the verification script;
- Chromium or a compatible browser for browser smoke tests;
- no npm runtime dependencies are required by the current build scripts.

Check your environment:

```bash
python --version
node --version
```

### Clone the repository

```bash
git clone <repository-url>
cd <repository-directory>
```

### Build using Python directly

```bash
python tools/build.py --kind all
```

### Build through package scripts

```bash
npm run build
```

The current `package.json` only wraps local Python tools. It does not declare third-party production dependencies.

## Build and verification

### Generate production and diagnostic builds

```bash
python tools/build.py --kind all
```

Expected outputs:

```text
dist/index_KF64.html
dist/index_KF64_DIAG.html
```

### Run full project checks

```bash
python tools/check_build.py
```

The checker validates, among other things:

- JavaScript syntax;
- one embedded `<style>` and one embedded `<script>` block;
- duplicate HTML identifiers;
- shared runtime parity between production and diagnostic builds;
- absence of diagnostic APIs from production;
- required persistence and module contracts;
- storage and workflow regressions;
- accessibility and lifecycle regressions;
- current build/version markers.

### Dead-code scan

```bash
python tools/dead_code.py
```

or:

```bash
npm run dead-code
```

### Browser smoke test

```bash
python tools/browser_smoke.py
```

or:

```bash
npm run browser-smoke
```

The KF64 browser smoke test verifies that the application starts without JavaScript errors and renders critical UI areas such as:

- tiles;
- calendar cells;
- email groups;
- TODO;
- notes;
- journal.

A browser smoke test is essential. Static syntax checks alone did not catch the KF63 startup regression that KF64 fixed.

## How to modify the project

### General rules

1. Modify files under `src/`, not the generated HTML in `dist/`.
2. Preserve the single source of truth for application state.
3. Do not write directly to `localStorage` from business modules.
4. Use the central storage API and existing validators.
5. Register persistent event listeners through `EventLifecycle`.
6. Register delayed work through `SchedulerService`.
7. Render user-provided content through safe DOM methods or `textContent`.
8. Preserve module lifecycle and teardown behavior.
9. Update migration/normalization logic when changing stored schemas.
10. Rebuild and run all checks before committing generated files.

### Modifying HTML structure

Edit:

```text
src/templates/production.html
src/templates/diagnostic.html
```

Keep stable IDs when runtime modules depend on them. When adding an interactive control:

- use a semantic element;
- provide an accessible name;
- support keyboard interaction where relevant;
- add the corresponding lifecycle binding;
- add a diagnostic or smoke assertion for critical controls.

### Modifying styles

Edit the most specific existing stylesheet rather than appending a new global override.

Recommended ownership:

- tokens/navigation → `00-tokens-navbar.css`;
- email → `10-email.css`;
- layout/panels → `20-layout-panels.css`;
- modals/transient UI → `30-modals-transient.css`;
- tiles/notes → `40-tiles-notes.css`;
- calendar/tools → `50-calendar-tools.css`;
- journal/data → `60-journal-data.css`;
- themes → `70-theme.css`;
- storage/accessibility/business → `80-storage-a11y-business.css`;
- design-system primitives → `90-design-system.css`;
- component enforcement → `95-component-enforcement.css`;
- emergency/final compatibility only → `99-final-overrides.css`.

Avoid solving normal component issues by adding another rule to `99-final-overrides.css`.

### Modifying JavaScript

Choose the module that owns the responsibility. Avoid creating a second implementation of an existing renderer, storage path or helper.

Before adding a function, search for the existing contract and extend it when appropriate.

After changes:

```bash
python tools/build.py --kind all
python tools/check_build.py
python tools/dead_code.py
python tools/browser_smoke.py
```

## How to add a module

The exact implementation depends on the module type, but a persistent module should generally provide a contract equivalent to:

```js
{
  id,
  init,
  bind,
  render,
  serialize,
  deserialize,
  reset,
  teardown,
  smokeTest,
  getStats
}
```

### Suggested process

1. **Define the data model**
   - Choose stable record identifiers.
   - Define required and optional fields.
   - Decide limits and retention behavior.

2. **Add normalization and validation**
   - Update the central storage-validation layer.
   - Accept older records where backward compatibility is required.
   - Normalize missing new fields to safe defaults.

3. **Add the UI root**
   - Add a stable root element in the template.
   - Use semantic HTML and accessible labels.

4. **Implement rendering**
   - Build DOM safely.
   - Avoid injecting user data through `innerHTML`.
   - Keep rendering idempotent.

5. **Bind events through the lifecycle**
   - Use a stable owner and key.
   - Prefer delegation for dynamic lists.
   - Ensure teardown removes persistent listeners.

6. **Register the module**
   - Add it to `ModuleRegistry` in the correct registration order.
   - Add persistence mapping if the module is stored.

7. **Expose actions through services**
   - Put canonical CRUD behavior in an application/domain service rather than inside click handlers.

8. **Add import/export support**
   - Include the module in complete export as appropriate.
   - Define module-level export/reset behavior if needed.

9. **Add diagnostics**
   - Add a smoke test.
   - Add semantic round-trip coverage for persistent data.
   - Add browser assertions when failure could prevent UI startup.

10. **Build and verify**

## Storage and data contracts

### Storage boundary

Business modules should not access `window.localStorage` directly. Low-level access is isolated in the storage capability/backend layer.

### Normalization

Imported and stored data is normalized before use. New fields should have safe defaults so older backups continue to load.

### Limits

The application applies record and text-size limits to reduce uncontrolled browser-storage growth. Exact limits may differ by module and can be reviewed through advanced data/storage controls.

### Import compatibility

When changing a schema:

- preserve old field names only as long as necessary;
- normalize old values into the current shape;
- avoid keeping two active sources of truth;
- add a regression fixture or diagnostic scenario;
- verify export → reset → import → semantic comparison.

### Do not rely on browser quota assumptions

Available local-storage capacity varies by browser, browser mode, policy and origin. Treat the application's usage indicator as operational guidance, not a universal guarantee.

## Business workflow links

KF62/KF63 introduced linked operational flows:

```text
Phone log
    │
    ▼
Response case
    ├──► TODO
    ├──► Reminder
    └──► Journal entry
```

Relations use record identifiers, not only copied text. The runtime can:

- create linked records;
- display relationship counts;
- navigate to related records;
- highlight the destination;
- detect and ignore stale links;
- reconcile workflow integrity.

When modifying related modules, preserve referential behavior and backward-compatible normalization.

## Accessibility

WorkDesk includes accessibility-oriented behavior such as:

- accessible names for icon-only controls;
- keyboard navigation;
- focus management for modals and transient UI;
- ARIA state for selected controls;
- live regions for selected status updates;
- command-palette keyboard support;
- tooltip portal behavior;
- diagnostic accessibility checks.

Accessibility is an ongoing quality requirement, not a completed certification. Changes should be tested with keyboard-only navigation and, where possible, a screen reader.

## Browser support

The application is designed for modern desktop browsers. Microsoft Edge/Chromium is the primary tested environment for the current offline workflow.

Other current Chromium browsers and Firefox may work, but should be verified before operational deployment. Browser policies affecting local files, downloads, clipboard APIs, notifications or local storage may change behavior.

Private/incognito mode is not recommended for persistent use because storage may be cleared automatically.

## Current limitations

- The application UI is currently Polish only.
- There is no built-in cloud synchronization.
- There is no multi-user collaboration or conflict resolution.
- There is no server-side authentication or authorization model.
- Data is tied to the browser origin/profile until exported.
- Browser local storage has environment-dependent capacity limits.
- The application is not a replacement for an encrypted password manager.
- The `mailto:` workflow depends on the operating system and configured email client.
- External links require network or intranet access.
- No formal third-party accessibility, security or compliance certification is claimed.

## Release policy

The version format currently combines an application version and an internal KF build number, for example:

```text
1.66.3-KF64
```

Recommended release contents:

- production HTML;
- diagnostic HTML;
- source development package;
- changelog;
- SHA-256 checksums;
- successful static checks;
- successful browser smoke test.

Generated files should be treated as release artifacts. Source changes should be reviewed in `src/`.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

Before proposing a change:

- reproduce the issue on the newest release;
- describe the user-visible impact;
- identify whether data migration is involved;
- include verification steps;
- run build, static checks, dead-code scan and browser smoke tests.

## Security

See [SECURITY.md](SECURITY.md).

Do not publish real operational records, email addresses, internal URLs or exported backups in public issues.

## License

WorkDesk is released as full open-source software under the permissive [MIT License](LICENSE).

You are free to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the software without restrictions. See the [LICENSE](LICENSE) file for the full license text.

## FAQ

### Does WorkDesk require installation?

No. End users can open the production HTML directly in a modern browser.

### Does WorkDesk require Internet access?

Core local features do not. External and intranet links require access to their destinations.

### Does it send application data to a server?

The current core application has no required backend or telemetry service. User-configured links may open external systems.

### Where is my data stored?

Primarily in browser local storage associated with the file/origin and browser profile you use.

### Does copying the HTML file copy my data?

No. Export a JSON backup and import it in the destination environment.

### Can multiple people use the same data at once?

No. WorkDesk is currently a single-user local application.

### Is an English interface available?

Not yet. Only the documentation is bilingual; the UI is currently Polish.

### Can I edit the generated HTML directly?

Technically yes, but it is not recommended. Modify `src/` and rebuild so changes remain maintainable.

### Which file should normal users open?

Use `index_KF64.html`. The `_DIAG` build is intended for testing and diagnostics.

### What should I back up?

Keep the production HTML, source repository if you modify it, and regular exported JSON backups of user data.
