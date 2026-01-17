# Data Flow – Phase 2

## Client Runtime
- Tokens: stored only in memory inside AuthContext.
- Case data: hydrated from /api/cases after login and kept in React state; never written to localStorage / sessionStorage.
- Autosave: debounced (~1.2s) PATCH to /api/cases/:id whenever case data changes.
- Logout: clears React state and tokens, leaving no PHI in the browser.

## Server Interaction
1. Login → POST /api/auth/login → JWT + audit AUTH_LOGIN_SUCCESS.
2. Bootstrap → GET /api/cases.
   - Empty list → POST /api/cases with createEmptyCase payload.
   - Existing list → choose most recent updatedAt and load its data.
3. Editing → UI mutates React state; debounce timer issues PATCH /api/cases/:id with { title, data }. Backend updates Prisma + audit CASE_UPDATED.
4. Admin ingestion (unchanged) → /api/ingest/pdf (admin-only) logs INGEST_PDF.
5. Logout → client forgets state; server session remains JWT-only (no refresh token yet).

## Persistence Guarantees
- All PHI (cases, knowledge base, ingestion output) is persisted server-side (Postgres + Prisma).
- Every create/update/delete action emits an AuditEvent row.
- The browser guard (applyStorageGuard) warns if any code tries to touch legacy lexmedical_* keys.
