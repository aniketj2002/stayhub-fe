# Feature boundaries

Add feature-owned pages, components, API functions, and DTOs under these directories in the corresponding phase:

- `auth`: Phase 2 accounts, sessions, role guards, profile, and permission helpers.
- `media`: Phase 2 presigned uploads, transfer progress, confirmation/retry, and reusable photo uploader.
- `listings`: Phase 3 working/live versions and listing wizard.
- `calendar`: Phase 3 availability and host block/unblock.
- `search`: Phase 3 destination/date/guest discovery and listing detail.
- `reservations`: Phase 4 checkout, trips, host actions, cancellation.
- `earnings`: Phase 4 payout summaries and reservation payout details.

Use the shared API client and UI primitives. Backend responses remain authoritative for permission, financial, availability, and state changes.
