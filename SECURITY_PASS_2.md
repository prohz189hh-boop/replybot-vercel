# Security pass 2 — final report

Scope: Section 3 critical fixes (customer identity, idempotency, CORS,
rate limiting, usage-limit races, conversation concurrency) + Section 8
centralized RBAC. Nothing else was touched.

## IMPLEMENTED

1. **Secure visitor identity.** Replaced the browser-generated
   `Math.random()` customer id with a server-issued, HMAC-signed,
   agent-scoped token (`src/lib/widget/visitor-token.ts`). The widget
   calls `POST /api/public/visitor/init` once, stores the opaque token,
   and sends it on every chat request; `/api/public/chat` verifies the
   signature, expiry, and agent binding before trusting the visitor id
   it contains. A tampered or cross-agent token is rejected.
2. **Message idempotency.** `Message.clientMessageId` (nullable,
   `@@unique([conversationId, clientMessageId])`) lets the widget retry
   a send safely. The route does an idempotent lookup, and if a
   concurrent duplicate insert races past that check, the resulting
   Postgres unique-violation (P2002) is caught and treated as a replay
   rather than an error — so the DB constraint, not app-level
   check-then-insert, is what actually prevents duplicates.
3. **Real CORS.** `src/lib/security/cors.ts` resolves the request
   `Origin` against a new `Agent.allowedDomains` column (exact-match
   allowlist, not a wildcard), allows `localhost`/`127.0.0.1` only
   outside production, handles `OPTIONS` preflight, and never sets
   `Access-Control-Allow-Credentials` (the widget authenticates via a
   token in the request body, not cookies, so credentialed CORS is
   never needed).
4. **Production-ready rate limiting.** `src/lib/security/rate-limit.ts`
   is now an adapter interface: an Upstash Redis REST adapter used when
   `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` are set, and an
   in-memory adapter for local dev that logs a warning if it detects
   `NODE_ENV=production`. `getTrustedClientIp()` prefers
   platform-specific headers (`cf-connecting-ip`,
   `x-vercel-forwarded-for`, `fly-client-ip`) over a bare
   `X-Forwarded-For`, and rate-limits chat by `visitorId + ip` (can't be
   bypassed by just changing headers, since the visitor id is signed).
5. **Atomic usage reservation.** `reserveUsage()`/`rollbackUsage()` in
   `src/lib/billing/entitlements.ts` replace the old
   check-then-increment pattern with a single
   `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE count < limit
   RETURNING` statement — the increment and the limit check happen
   atomically as one Postgres statement, closing the
   199/200-then-two-concurrent-requests-both-succeed race. A failed AI
   call rolls back its reservation.
6. **Conversation-level generation lease.** New `Conversation.aiLockedAt`
   column + `src/lib/rag/concurrency.ts`: a single atomic `UPDATE ...
   WHERE aiLockedAt IS NULL OR aiLockedAt < now() - TTL` claims the
   right to call the AI provider for a conversation. A second
   concurrent request for the same conversation gets
   `{ pending: true }` instead of generating a possibly-duplicate,
   possibly-out-of-order reply. TTL-based so a crashed request
   self-heals instead of wedging the conversation.
7. **Centralized RBAC.** `src/lib/tenant/permissions.ts` defines every
   permission → allowed-roles mapping in one place;
   `requirePermission()` in `guard.ts` is the single enforcement point.
   `requireBusinessAccess` (rank-based) is kept for simple
   any-member-at-role-X checks; `requirePermission` (permission-based)
   is for anything that doesn't reduce to a rank threshold (e.g. AGENT
   can reply to conversations but not manage billing).
8. **Session cleanup.** `cleanupExpiredSessions()` added to
   `src/lib/auth/session.ts` — expired sessions were already correctly
   rejected by `getSession()`, but nothing purged them; wire this into
   a scheduled job.
9. **Removed the one real `as any`.** `src/lib/security/audit.ts` now
   redacts a documented list of sensitive keys and produces a properly
   typed `Prisma.InputJsonValue` instead of casting past the type
   checker.

## FILES CHANGED

- `prisma/schema.prisma` — `Customer.externalId` now `@@unique`
  (was a plain index + nullable, previously combined with an `as any`
  cast at the call site); `Message.clientMessageId` +
  `@@unique([conversationId, clientMessageId])`; `Agent.allowedDomains
  String[]`; `Conversation.aiLockedAt DateTime?`.
- `prisma/migrations/20260101000000_init/migration.sql` +
  `migration_lock.toml` — **new**, hand-written baseline (no prior
  migration existed to diff against).
- `src/lib/widget/visitor-token.ts` — **new**.
- `src/app/api/public/visitor/init/route.ts` — **new**.
- `src/app/api/public/chat/route.ts` — rewritten: visitor-token
  verification, idempotent insert with P2002 handling, CORS, AI lease,
  atomic usage reserve/rollback.
- `src/app/api/public/widget/[agentPublicId]/route.ts` — added CORS
  (`OPTIONS` handler + `withCors` on the response).
- `src/lib/security/cors.ts` — **new**.
- `src/lib/security/rate-limit.ts` — rewritten (adapter interface +
  Upstash + trusted-IP extraction; was a bare `Map`).
- `src/lib/security/audit.ts` — removed `as any`, added redaction.
- `src/lib/billing/entitlements.ts` — rewritten: split into
  `enforceResourceLimit` (unchanged check-then-create, for low-
  concurrency dashboard actions) and new `reserveUsage`/`rollbackUsage`
  (atomic, for the hot public-chat path).
- `src/app/api/dashboard/agents/route.ts` — updated to call
  `enforceResourceLimit` (renamed from `enforceUsageLimit`).
- `src/lib/rag/concurrency.ts` — **new**.
- `src/lib/tenant/permissions.ts` — **new**.
- `src/lib/tenant/guard.ts` — added `requirePermission()`.
- `src/lib/auth/session.ts` — added `cleanupExpiredSessions()`.
- `public/widget/loader.js` — rewritten: visitor-token init flow,
  `clientMessageId` generation + resend-on-retry, 401→re-init→retry,
  basic ARIA (`role="dialog"`, `aria-live` status region,
  `aria-expanded`, `Escape` to close), plain-text message rendering
  (`textContent`, never `innerHTML`).
- `.env.example` — added `UPSTASH_REDIS_REST_URL`/`_TOKEN`, documented
  `AUTH_SECRET`'s expanded role.
- `vitest.config.ts` — **new** (tests import `@/lib/...`; nothing
  previously resolved that alias for Vitest specifically).
- Tests — see below.

## DATABASE CHANGES

Schema diff (see migration.sql for full DDL):
- `Customer`: `externalId` nullable→required, plain index→
  `@@unique([businessId, externalId])`.
- `Message`: + `clientMessageId String?`, +
  `@@unique([conversationId, clientMessageId])`.
- `Agent`: + `allowedDomains String[] @default([])`.
- `Conversation`: + `aiLockedAt DateTime?`.
- New extensions required: `pgcrypto` (for `gen_random_uuid()` in raw
  inserts — was already relied on, now made explicit in the migration).

## SECURITY IMPROVEMENTS

- Customer/conversation impersonation via a guessed or edited client-
  side id is no longer possible — identity is a signed, server-issued,
  agent-scoped token.
- A network retry (or a client that double-sends) can no longer create
  duplicate customer messages or duplicate AI replies.
- The widget can no longer be embedded and queried cross-origin from an
  arbitrary site the business didn't configure.
- A single-process in-memory rate limiter — which a distributed
  deployment could trivially bypass by hitting different instances — is
  replaced by a real distributed backend when configured, with the
  in-memory fallback now loud about being dev-only.
- `X-Forwarded-For` spoofing can no longer be used to reset rate-limit
  buckets by claiming a new IP on every request (platform-trusted
  headers are preferred).
- The `199/200 → two concurrent requests → 201/200` usage-limit bypass
  described in the spec is closed via a single atomic SQL statement.
- Two messages arriving close together on the same conversation can no
  longer both trigger AI generation and interleave/duplicate replies.
- Role checks are no longer something every route author has to get
  right independently — `permissions.ts` is the one place that can be
  wrong.

## TESTS ADDED

Pure unit tests (no DB required):
- `tests/security/visitor-token.test.ts` — issue/verify round-trip,
  cross-agent rejection, tampered payload, tampered signature,
  malformed token, expired token, no-collision sanity check.
- `tests/security/cors.test.ts` — allowed/disallowed origin, empty-
  allowlist-in-production, localhost-in-dev-only, non-browser request,
  subdomain-confusion rejection, preflight status/headers, no
  `Access-Control-Allow-Credentials`.
- `tests/security/rate-limit.test.ts` — allow-under-limit, block-over-
  limit, same-key sharing one bucket, independent keys, trusted-IP
  header precedence, spoofed-XFF resistance, no-header fallback.
- `tests/security/rbac.test.ts` — every role/permission combination
  used in `PERMISSIONS`, `assertCan` throw shape, no permission with an
  empty role list.

Integration tests (require a live PostgreSQL — see header comment in
each file; **not executed** in this environment):
- `tests/integration/public-chat-and-auth.test.ts` — duplicate
  `clientMessageId` reuses one row under a real unique-constraint
  violation; different ids both persist; same id in a different
  conversation doesn't collide; same `externalId` in two businesses
  creates two separate `Customer` rows; a token minted for business A's
  agent doesn't resolve to anything under business B; expired session
  rows are rejected; `cleanupExpiredSessions` removes only expired
  rows; **100 concurrent `reserveUsage` calls against a limit of 50
  yield exactly 50 successes** (the core race-condition regression
  test); `rollbackUsage` floors at 0; only one of two concurrent
  `acquireAiLease` calls on the same conversation succeeds.
- `tests/integration/tenant-guard-mocked-session.test.ts` — mocks
  `getSession()` to actually exercise `requireBusinessAccess`/
  `requirePermission`'s role-based branches (OWNER passes AGENT
  threshold, AGENT fails OWNER threshold → 403, no-membership → 404,
  no-session → 401, AGENT permission split, and a same-status/same-
  message check that a nonexistent business and a real-but-foreign
  business are indistinguishable to the caller — no existence leak).
- Updated `tests/tenant-isolation/cross-tenant-access.test.ts`: replaced
  the one placeholder-style test (misleading comment claiming a session
  was mocked when it wasn't) with an honest description of what it
  actually covers, and replaced the previous pass's
  `expect(true).toBe(true)` vector-search placeholder with a real test
  that seeds a business-B chunk with the closest possible embedding
  distance and asserts it never appears in business A's results.

## VERIFIED

- `bash_tool` confirmed this container has `node` v22.22.2 / `npm`
  10.9.7 installed, but network egress to the npm registry returns
  `403 host_not_allowed` — genuinely no path to `npm install` here.
- Static grep verification (Phase 15's exact checklist) was run and
  passed:
  - `as any` → zero matches outside a comment describing its removal.
  - `Access-Control-Allow-Origin.*\*` → zero matches.
  - `TODO|FIXME|not implemented|coming soon` → one match
    (`storage.ts`, an explicitly-disclosed swap-in-provider note, not
    hidden/security-relevant logic).
  - `console.log` → zero matches (errors use `console.error`/`warn`).
  - Every `$queryRawUnsafe`/`$executeRawUnsafe` call site was manually
    read: all pass values as bound `$1`/`$2`/... parameters, never
    string-concatenate request-derived data into the SQL text. "Unsafe"
    here refers to Prisma accepting raw SQL syntax (needed because
    Prisma has no native pgvector support), not to parameterization.
  - `Math.random` → one real match, in `loader.js`'s UUID fallback for
    browsers without `crypto.randomUUID`. This generates
    `clientMessageId` (an idempotency dedup key), not an identity/auth
    token — visitor identity itself never uses it.
- Manually re-read every changed file for import correctness and
  internal consistency (e.g., `enforceUsageLimit` renamed to
  `enforceResourceLimit` and its one call site updated to match).

## UNVERIFIED / BLOCKED

Explicitly, because this container has no network access and no live
PostgreSQL:

- `npm install` — **not run** (registry requests return `403
  host_not_allowed`).
- `npm run typecheck` / `npm run lint` / `npm run build` — **not run**
  (require installed `node_modules`, which requires the above).
- `npm test` — **not run**, for the same reason; every test file above
  was written but never executed.
- `npx prisma migrate dev` / any Prisma migration execution — **not
  run**; `migration.sql` was written by hand against `schema.prisma`
  and has not been diffed against or applied to a real database.
- The `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE ... RETURNING`
  atomicity claim in `reserveUsage()` is standard, well-documented
  Postgres behavior, but has not been empirically verified against a
  real concurrent workload in this environment — the concurrency test
  in `tests/integration/` exercises it correctly but has not run.
- The advisory-update-based lease in `concurrency.ts` has the same
  status: correct as written, not empirically load-tested here.

## REMAINING WORK

Everything outside Section 3 + Section 8 is intentionally untouched
this pass, per the instructions: full dashboard UI (agents, inbox,
knowledge, analytics, team, billing, settings), real Stripe integration
(Phase 5 of the original 49-section spec), real embeddings provider
wiring beyond the dev fallback, file upload validation/extraction
(PDF/DOCX/TXT), the crawler's redirect-limit/robots handling beyond
what pass 1 already did, background job queue, email provider,
security headers (CSP etc.), realtime/polling for the inbox, and the
marketing/pricing/onboarding pages.

---

## Verification pass (addendum)

A second pass re-inspected every file this pass touched and ran a real
`tsc` typecheck — not just a read-through. Method and findings below.

### How the typecheck was actually run

This container has no `node_modules` for the project (no network to
`npm install`), but it does have a global TypeScript compiler
(`tsc`, v6.0.3) and Node 22. To get a genuine cross-file typecheck
rather than eyeballing the code, I hand-wrote minimal `.d.ts` stubs for
the external packages the code imports (`@prisma/client`, `next/server`,
`next/headers`, `zod`, `argon2`, `vitest`, plus Node builtins `crypto`/
`dns`/`net`/`fs/promises`/`path`) and ran `tsc --noEmit --strict`
against every file in `src/`, `tests/`, and `prisma/seed.ts`.

**This is a real check of internal consistency** — cross-file imports,
exported function signatures, argument types, return types — but it is
**not equivalent to typechecking against the real generated Prisma
client or the real Next.js/Zod type definitions**, which have far more
detail than my stubs (e.g. Prisma's actual per-model delegate types vs.
my `[model: string]: any` shortcut). Treat "clean tsc run" below as
"no internal wiring bugs found," not "guaranteed to compile with real
dependencies installed."

### Bugs found and fixed during verification

1. **`src/lib/security/audit.ts`** and **`src/lib/rag/concurrency.ts`**
   — `.catch((err) => ...)` callbacks had no type annotation; added
   `(err: unknown)` explicitly rather than relying on inference.
2. **`tests/security/cors.test.ts`** — four `// @ts-expect-error`
   comments in front of `process.env.NODE_ENV = "..."` assignments
   were unnecessary (that assignment isn't actually a type error) and
   an unused `@ts-expect-error` is itself a compile error. Removed all
   four.
3. **`tests/security/rbac.test.ts`** — used `expect.unreachable()`,
   which isn't a real Vitest API, and `expect(value, message)` with a
   second "custom message" argument, which isn't reliably part of
   Vitest's public API either. Rewrote the throw-assertion using a
   plain try/catch + `expect(caught).toBeInstanceOf(Error)`, and
   dropped the second `expect()` argument.
4. **`tests/integration/tenant-guard-mocked-session.test.ts`** — used
   six raw `mockResolvedValue({...} as any)` casts, which is exactly
   the pattern this whole pass was supposed to be eliminating (my
   earlier grep only checked `src/`+`prisma/`, not `tests/`, and missed
   these). Replaced with a single typed `sessionFor(userId)` helper
   using `Awaited<ReturnType<typeof getSession>>` — one documented,
   narrow cast instead of six unchecked ones.
5. **`tests/tenant-isolation/cross-tenant-access.test.ts`** — two
   `.map((a) => a.id)` callbacks had no parameter type; added an
   explicit `Agent` import and annotated `(a: Agent)`.
6. **`src/app/api/public/chat/route.ts`** — the `history.filter(...).map(...)`
   chain building `historyForModel` had unannotated callback
   parameters and an unannotated `role` value; added
   `(m: (typeof history)[number])` and `as const` on the two literal
   role strings so the result provably matches `ChatMessage[]` rather
   than relying on inference.
7. **`src/lib/tenant/guard.ts`** — added an explicit
   `membership.role as BusinessRole` at the one place it indexes
   `ROLE_RANK`, removing reliance on inference through a Prisma
   lookup's return type.

None of these were logic bugs that would behave differently at
runtime — they were all either missing type annotations or (in cases
3–4) genuinely broken test code that would have failed at `npm test`
time with "not a function" / compile errors rather than silently
passing. Confirmed by re-running the full stubbed `tsc` check after
each fix until it reported zero errors.

### Migration ↔ schema consistency check

Extracted every `model`/`enum` name from `schema.prisma` and every
`CREATE TABLE`/`CREATE TYPE` name from `migration.sql` — both lists
match exactly, same order, 19 tables and 10 enums. Additionally
diffed the three models this pass actually changed (`Customer`,
`Message`, `Agent.allowedDomains`, `Conversation.aiLockedAt`)
column-by-column against the migration — all match.

### Other checks that genuinely ran

- `node --check public/widget/loader.js` — valid JS syntax (real
  check, not inspection; the widget is the one file in this pass
  plain Node can actually parse without stubs).
- `python3 -c "json.load(...)"` on `package.json` — valid JSON.
- Secret scan (`sk-...`, AWS key patterns, PEM private key headers)
  across `src/`, `prisma/`, `public/`, `.env.example` — no matches.
  Every `.env.example` value is an empty string or an obvious
  placeholder.
- Re-ran the exact Phase 15 grep checklist post-fix: `as any` (clean,
  2 matches both inside explanatory comments), `Math.random` (one real
  match, the non-security `clientMessageId` UUID fallback in
  `loader.js`, already documented as such), `Access-Control-Allow-
  Origin.*\*` (zero matches), unchecked `businessId` sourced directly
  from request body/params into a `where` clause (zero — the one
  dashboard route that reads `businessId` from the body runs it
  through `requireBusinessAccess`/`requireResourceAccess` first).

### Still not verified (unchanged from before)

`npm install`, `npm run typecheck` (the project's own script, as
opposed to my stubbed `tsc` run), `npm run lint`, `npm test`,
`npm run build`, and any Prisma migration execution — this container
still has no network access (`registry.npmjs.org` → `403
host_not_allowed`, reconfirmed this pass) and no live PostgreSQL.
Nothing above substitutes for actually running these once a real
environment is available.
