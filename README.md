# Vacancy Search Frontend

React 19.3 + TypeScript 5.9 + React Router 8.4 Data Mode + Vite 8.3.4. One npm lockfile; Node 24.14 or a compatible newer supported release.

## Run and check

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

Development uses http://127.0.0.1:45173 and a /api proxy to 127.0.0.1:48173. strictPort prevents taking a different port silently. Production dist is served by Rust on the same origin.

Seven feature areas: vacancies, criteria, companies, contacts, recorded conversations, CVs and explicit matching history. Loaders propagate AbortSignal. Actions own persistence and revalidation; drafts and retry keys remain in memory on failures. No message body/contact details are persisted in browser storage. Record message never sends anything externally.

Fixture-v1 preview applies saved criteria and imports selected synthetic records into an explicitly selected company. Optional HH criteria support the user's query, named regions and current provider filters, with manual page navigation, cancellation and selective import. HH access status is displayed, with preview disabled when local setup is absent. No credential entry form, automatic pagination or retry exists. Search snippets and original salary/source metadata are labelled and preserved.

HH browser responses in smoke tests are synthetic; live API availability and applicant registration eligibility are unverified. The user reports a company-only registration form, so real HH access remains blocked. See ../../docs/architecture/hh.md. Email-file/text import is not implemented.

## Browser smoke

Prefer ../../scripts/check.ps1: it builds the app, creates a new disposable database and starts its own server on a free 48174–48189 port. For manual smoke set VACANCY_DB to a disposable file and VACANCY_TEST_URL to that isolated server. Never use the operational 48173 database. Then:

```powershell
npx playwright install chromium
npm run smoke
```

Smoke writes synthetic records; never point it at the personal operational database. Tests cover full search/import/status/contact/conversation flows, lost response with exact-token retry, cancel protection, validation conflict retention, 404, duplicate observations and filter Back. Evidence goes to ignored test-results/.

Unit tests are discovered separately under src/. No external accounts/API credentials are needed. The Russian UI gate is recorded in ../../docs/architecture/localization-and-statuses.md. The previous baseline had 7 unit tests and 7 Chromium workflows, including HH criteria/import/history, cancellation/rate-limit recovery and disabled setup with fixture fallback.

Russian UI uses src/i18n.ts for status/format/direction/lookup presentation and safe errors. User text and raw provenance are retained. Detail radio choices show both refusal parties; legacy rejected stays unspecified. History reloads after successful PATCH. The user release app always runs at 127.0.0.1:48173.

## HTTP-origin compatibility

All client receipt/entity/request UUIDs use src/identity.ts. The native secure-context API has a cryptographic getRandomValues fallback for ordinary HTTP origins. tests/http-save.spec.ts exercises a real non-secure HTTP hostname against an isolated database, including PATCH/POST, failure, retry and retained drafts. No browser security override is used.

## Multi-value filters

src/filter-select.tsx exports CheckboxFilter (small lists, no search) and SearchableCheckboxFilter (large lists, internal name search). Status/company list filters preserve selection across searches, URL pagination, Back/Forward and reload. Native keyboard disclosure and checkboxes, Russian labels and per-filter clearing are supported. Apply preserves profile/source/page size and resets the cursor. Current checks: 16 unit tests and 13 Chromium workflows; see ../../docs/roadmap/multi-filters.md.

## CV / matching UI

src/cvs.tsx provides text/.txt/.md import preview, confirmation, immutable version edits and history. src/matching.tsx requires an explicit CV/selection preview and confirmation, then exposes pinned JSON inputs, external-agent results/citations, attempt history, retry/cancellation and staleness. Import/edit does not start matching. Direct HH resume extraction and in-app LLM execution are absent; synthetic results are visibly labelled. No CV is stored in browser local/session storage. Isolated tests/cv-matching.spec.ts covers file preview, lost response replay, old revisions, saved selection, partial retry, cancellation, quotes, staleness and draft recovery. Current suite: 16 unit tests and 17 Chromium scenarios; see ../../docs/roadmap/cv-matching-verification.md.

## CV lifecycle and origins

CV detail has Russian delete confirmation (cancel/Escape sends no request) and restoration through the shared state filter, including mixed lists. Versions remain accessible. List rows display origin and reuse the source checkbox multiselect, with search above six origins and URL-backed active/deleted selection. New imports choose manual/hh.ru/skillstaff.ru or an explicit domain; source identity is read-only for existing CVs. Removed CVs cannot create new revisions or matching packets; historical packets still show pinned inputs. tests/cv-management.spec.ts uses only an isolated synthetic server and checks cancellation, restore, lost-response retries, stale actions, origin filtering/history and pinned packets.

**Состояние CV** reuses CheckboxFilter with Активные/Удалённые; default active, either/both values, or empty = Все. Individual state buttons are removed. Each row displays its own state. Source-search text uses an optional controlled query in the shared SearchableCheckboxFilter and persists in source_search URL/context. Detail/history return links preserve states, sources and search through delete/restore; Back/Forward restores applied query state. The CV smoke covers restoration from mixed lists and all/empty/legacy scope regressions.

## Explicit CV recommendations

Russian CV cards now request single-CV reviews, directional CV comparisons or saved-vacancy packets. The local agent API persists revision-bound recommendations, user rejections, explicit resolutions, history and merged vacancy evidence. Import never resolves recommendations and no model runs in the background. See [../../docs/cv-recommendations.md](../../docs/cv-recommendations.md) for the API, transport, batching and deployment contract.
