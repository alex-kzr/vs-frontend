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

Five feature areas: vacancies, criteria, companies, contacts and recorded conversations. Loaders propagate AbortSignal. Actions own persistence and revalidation; drafts and retry keys remain in memory on failures. No message body/contact details are persisted in browser storage. Record message never sends anything externally.

Search preview is offline fixture-v1, applies saved criteria and lets the user import selected synthetic records into an explicitly selected company. Live providers are not connected.

## Browser smoke

Start Rust with VACANCY_DB pointing to a new disposable file and the default port, after building this frontend. Then:

```powershell
npx playwright install chromium
npm run smoke
```

Smoke writes synthetic records; never point it at the personal operational database. Tests cover full search/import/status/contact/conversation flows, lost response with exact-token retry, cancel protection, validation conflict retention, 404, duplicate observations and filter Back. Evidence goes to ignored test-results/.

Unit tests are discovered separately under src/. No external accounts/API credentials are needed.
