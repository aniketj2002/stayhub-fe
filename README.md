# StayHub frontend

React + TypeScript + Vite. Phases 1–3 provide the application shell, shared UI, route structure, API infrastructure, backend health screen, authentication, account profile, role guards, media uploads, listing creation/versioning, calendars, search, listing detail, and server quotes. Future features have explicit placeholders; no mock listings, bookings, or payments are represented as live functionality.

## Run locally

Requirements: Node.js 22.12+, 24, or 26+ and npm (matching the test runner's supported Node versions).

```sh
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5173. Run the backend separately using its Makefile. The development server proxies `/api` and `/healthz` to `http://localhost:8080`, matching the backend configuration. Override `API_PROXY_TARGET` in `.env` if needed, and restart Vite.

Visit `/system` to check the real backend connection. It shows failures with retry and request references; it never substitutes a fake healthy response. Backend dependencies must be running for a healthy result.

## Checks

```sh
npm run lint
npm test
npm run build
npm run format:check
```

`npm run preview` serves the production build locally. `npm run format` formats source and configuration.

## Structure

```text
src/
  app/             Router, public/host/auth layouts, foundation screens
  components/      Shared accessible UI primitives
  features/        Domain boundaries for subsequent phases
  lib/             API client, health integration, currency/date formatting
  main.tsx         React root and query provider
  styles.css       Provisional design tokens and responsive styling
```

Feature boundaries: `auth`, `media`, `listings`, `calendar`, `search`, `reservations`, `earnings`. Each feature owns its API functions, types, queries, components, and pages when implemented. Keep HTTP DTOs separate from view models; do not import database models into the frontend.

## Routes and next phases

| Routes                                                                                                 | Implementation       |
| ------------------------------------------------------------------------------------------------------ | -------------------- |
| `/`, `/system`, unknown route                                                                          | Phase 1              |
| `/login`, `/register`, `/admin/login`                                                                  | Phase 2 implemented  |
| `/search`, `/listings/:id`, `/host/listings`, `/host/listings/:id/edit`, `/host/listings/:id/calendar` | Phase 3 implemented  |
| `/checkout/:listingId`, `/trips`, `/trips/:id`, `/host/today`, `/host/earnings`                        | Phase 4 placeholders |

Auth forms call the backend. `/account` supports profile updates, avatar upload/attachment, and logout; `/account/media` provides reusable photo uploads. Guest routes require a user session; host routes require a user session plus host capability. A guest can enable hosting through the backend and continue to the requested host route. Admin login uses the separate admin endpoint and produces an admin identity, which cannot enter guest or host routes. There is one active identity per browser tab; sign out before switching account types. V1 does not include an admin dashboard. The supplied specification references UI mocks but the actual mock screens were not supplied; the current visual system is provisional.

## API contract

- All domain endpoints use `/api/v1` and `{ data: T }` or `{ error: { code, message, details? } }`.
- `/healthz` is a raw object and is fetched explicitly with `raw: true`.
- `request<T>()` forwards AbortSignal, supports JSON bodies, optional idempotency keys, bearer tokens, and request IDs. It accepts 204 responses.
- `ApiError` exposes status, code, details (including server field validation), and request ID. Screens own contextual 403/404/409 handling; a protected 401 triggers a shared refresh attempt and one replay. A failed/revoked refresh clears the session; transient refresh failures remain retryable. Login/refresh/logout calls bypass bearer authentication and automatic refresh.
- Queries may retry one server failure; mutations never retry automatically. Financial operations in Phase 4 must reuse one idempotency key per logical attempt.
- Access tokens stay in memory. The rotating refresh token is stored in `sessionStorage` for restoration within the current tab, matching the backend JSON refresh contract. It is accessible to same-origin JavaScript, so deploy with appropriate CSP and XSS protections. Tokens are not stored in `localStorage`. Bootstrap rotates the token and verifies `/me`; concurrent refreshes share one promise. Logout revokes the current refresh token and clears private query caches even if revocation fails. The frontend displays any revocation failure.
- Amounts are integer minor units, currently EUR cents. `formatMoney` is display-only; quotes, refund math, and fees come from the backend.
- Stay dates are `YYYY-MM-DD`, checkout is exclusive. `formatStayDate` preserves the calendar day; timestamp displays require an explicit timezone.
- Backend validation details are an array of `{ field, message }`, rendered on auth/profile fields. Per-listing permissions come from `host_access` in listing detail and summaries. Owners can manage all scopes; co-host actions require their specific flags. Backend authorization remains authoritative. Search uses limit/offset pagination; `count` is the number returned on the current page, not a total count.

## Production hosting handoff

`npm run build` produces `dist/`. Configure the host to serve `index.html` for application routes. Vite's proxy is development-only: production must proxy `/api` and `/healthz` to the backend, or set `VITE_API_BASE_URL` to an HTTPS backend origin at build time and allow the frontend origin in backend CORS. All `VITE_*` values are public; never place secrets there. Infrastructure integration belongs to Phase 5.

The current backend allows `X-Request-ID` as a request header but does not expose the response header for cross-origin reads. Same-origin proxying avoids this; with a separate API origin, expose `X-Request-ID` in backend CORS to read server-returned IDs. The client falls back to its generated ID.

## Phase 2 media integration

`PhotoUploader` supports avatar, listing photo, and evidence purposes. It validates the backend MIME types and 20 MB limit, obtains a presigned URL, transfers bytes with XHR progress using only storage-provided headers, and confirms only after a successful storage response. Only backend-confirmed uploads count as completed. A failed transfer retries with the current URL or requests a new URL if expired; a failed confirmation retries the same media record without re-uploading. Leaving the page aborts active transfers. Avatar attachment is a separate explicit action and can be retried without uploading again.

The storage endpoint must be reachable from the browser, the bucket must exist, and storage CORS must allow the frontend origin, PUT, and the returned upload headers. Vite only proxies the API; direct storage traffic uses the signed URL unchanged. Media GET is available through `getMedia(id)`. The backend does not expose a media-list endpoint, so the uploader shows this page session's files only. The listing wizard attaches confirmed media IDs and supports ordering/removal from the draft. Removing a photo from a draft does not delete the underlying media object.

### Local integration verification

1. Start backend Postgres/Redis/storage and apply backend migrations, then run `make run-api` in `backend/`.
2. Open `/host/listings` while signed out: sign in or register, verify return to that route, then enable hosting if needed.
3. Reload: verify session restoration. Visit `/account`, save a name, upload an avatar, and choose **Use uploaded photo**.
4. Visit `/account/media`, upload supported photos, verify transfer/confirmation and a retry after a failed transfer.
5. Sign out, verify protected routes return to login, then sign in through `/admin/login` using an existing admin account. Verify guest/host routes remain inaccessible.

During implementation, live backend verification was blocked: the supplied `minio/minio:latest` image could not be pulled, and local port 5432 was already allocated. No backend configuration or source changes were made to work around those issues. Automated tests verify API contracts, rotation/replay, logout, date formatting, media transfer headers, validation, and scoped permissions. Full live storage integration should be rerun once the backend services are available.

## Phase 3 listing and discovery integration

- `/host/listings`: real host listing summaries, status, nightly price, permission-aware links, and draft creation. `/host` redirects here.
- `/host/listings/:id/edit`: seven-step wizard for property/address/timezone, capacity/amenities, confirmed photos, title/description, pricing/booking mode, rules/policy, and review/submission.
- Each step change saves that step and the next wizard position through PATCH. Explicit **Save draft** also persists without advancing. Failed saves keep the form values and current step intact. Draft saving is explicit, not a timer-based autosave. Navigation away warns about unsaved changes/uploads. Uploads must finish before saving or changing steps.
- Existing live data is displayed separately from working-version data. The backend clones/publishes versions. Submission displays actual automated check outcomes (including 422 failure details) and actual returned publication status; the frontend never assumes approval.
- `/host/listings/:id/calendar`: monthly available/blocked/booked nights, selectable ranges, block/unblock, and permission-based read-only mode. Range end is exclusive. Before mutations, the entire selected range is fetched to reject booked nights outside the visible month, and the backend remains the final conflict arbiter. Changes invalidate calendar/search/detail caches.
- `/search`: URL-backed destination, country code, date range, guests, and page offset. Invalid filters do not trigger a search. Cards display server totals and null ratings as **New stay**.
- `/listings/:id`: gallery, public host, description, amenities, rules, policy, availability, and a quote panel. Quote keys include dates and guests; requests consume AbortSignal, and previous selection totals are never reused while a fresh quote is loading. The backend supplies all fee/refund values.
- Public listing availability contains approximately the upcoming 180 days of unavailable nights. Beyond that window, the calendar is informational; quotes verify the full selected stay. Reservations/payment remain Phase 4, and the Reserve link carries dates/guests into that route without charging or holding dates.
- Currency remains EUR. Price inputs are parsed to integer cents without rounding extra decimals. Property times use IANA timezones; stay nights use date-only UTC arithmetic to avoid shifting dates across timezones/DST.

### Phase 3 verification

`npm test` includes component integration tests using isolated response fixtures (under `src/test/`, never imported by production code): failed-save recovery, step advancement, automated submission errors, scoped read-only access, booked-night protection, stale quote responses, and URL-preserved search. Unit tests also cover calendar boundaries, minor-unit serialization, and exact endpoint/envelope contracts.

For live acceptance after backend startup: create/resume a draft; add at least five confirmed photos; submit; find the live listing via destination/date/guest search; open its quote; block those nights as host and verify the guest search/quote rejects them; unblock them and verify availability returns. Check co-host permission denial and editing a live listing without publishing its draft.

At Phase 3 implementation time, the API at `localhost:8080` was not running, so full live backend/storage acceptance remains pending. No production UI substitutes fixture data for unavailable APIs. The earlier Postgres port/MinIO setup issues should be resolved before running the live checklist.
