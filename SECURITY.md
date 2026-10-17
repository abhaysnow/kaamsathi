# Security & Privacy — KaamSaathi AI

This document covers the threat model, the controls that are implemented (with where to find them), known
limitations, and what must happen before any public production deployment.

**Status: hackathon MVP** with real email/password accounts and server-side sessions. Read
[Known limitations](#known-limitations) and [Production hardening](#production-hardening) before serving
real workers.

## Users and data

The users are gig and informal workers. Many share phones, have limited digital literacy, and may be in a
dispute with an employer or platform. What the app handles:

| Data                                                          | Where it lives                                                      | Sent to AI provider?                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Profile (language, work type, state, platform, accessibility) | Browser `localStorage` only                                         | State and work type only, when relevant                      |
| Earnings entries                                              | Server (memory or MongoDB), owner-scoped                            | Aggregated totals and flags only — no notes, ids or platform |
| Complaint facts and drafts                                    | In the response only; stored **only with an explicit consent tick** | Yes (needed to draft)                                        |
| Chat messages                                                 | Not stored on the server                                            | Yes (last ≤6 turns)                                          |
| Account: name, email, password                                | Server; password stored **only** as an Argon2id hash                | No                                                           |
| Session                                                       | Server-side store (MongoDB `sessions`, or in-process memory)        | No                                                           |
| Password-reset token                                          | Emailed once; only its SHA-256 hash is stored, 30-minute TTL        | No                                                           |
| Aadhaar, bank account numbers, OTPs                           | **Never requested.** Schemas reject unknown fields                  | No                                                           |

## Threat model

| Threat                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading or editing another worker's records (IDOR) | Every private endpoint sits behind `requireAuth`. The owner id is derived on the server from the validated session (`user:<id>`, or `demo:<sandbox>` for the demo account) (`middleware/session.ts`). Every repository method requires it, and every single-record query filters by `_id` **and** `ownerId`. Client-supplied owner ids are rejected by strict schemas. Tested for memory and MongoDB storage, including switching accounts in one browser.                                                                                    |
| Unauthenticated access to private data             | `401 AUTH_REQUIRED` for earnings, documents, grievances, assistant, schemes and data deletion (tested endpoint by endpoint). The frontend redirects to login, but only as UX; it never decides access.                                                                                                                                                                                                                                                                                                                                        |
| Password theft from the database                   | Argon2id (libargon2, 64 MiB, t=3, p=4) with per-hash salt. Plaintext is never stored or logged. The demo password is also stored hashed.                                                                                                                                                                                                                                                                                                                                                                                                      |
| Credential stuffing / guessing                     | Login is rate-limited per IP+email (10 per 15 min) and per IP (50 per 15 min); a limited client is refused even with the right password. Generic `Incorrect email or password.` for unknown email, wrong password and disabled demo account; unknown emails still run a dummy Argon2 verification so timing does not reveal which emails exist.                                                                                                                                                                                               |
| Session hijacking / fixation                       | `express-session`: random session id, HMAC-signed cookie, HttpOnly, SameSite=Lax, `Secure` when `COOKIE_SECURE=true` (required in production). The id is regenerated at login. Absolute server-side expiry (12 h, or 30 days with "Keep me signed in"). Logout destroys the server session, so a copied cookie stops working (tested). A password reset bumps the user's `sessionVersion`, which signs out every other session.                                                                                                               |
| Forged session cookie                              | Unsigned or unknown session ids are treated as signed out (tested).                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Password-reset abuse                               | 256-bit random token from the OS CSPRNG; only its SHA-256 hash is stored; single use via an atomic update; 30-minute expiry (TTL-indexed); a new request voids the previous token. Same response for existing, unknown and demo emails, and the email is sent in the background so timing does not differ. Rate-limited per IP. Tokens and links are never logged. Without an email provider in production the endpoint returns `503 EMAIL_NOT_CONFIGURED` for everyone instead of pretending. The dev outbox exists only outside production. |
| Open redirect after login                          | `?next=` accepts same-site relative paths only (`lib/authPaths.ts`, tested).                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| CSRF                                               | State-changing requests need the custom `X-Requested-With: kaamsaathi` header, which a cross-origin page cannot send without passing the CORS allow-list; any `Origin` header must be an allowed frontend origin; and the session cookie is SameSite=Lax (`middleware/csrf.ts`, tested).                                                                                                                                                                                                                                                      |
| Cross-origin abuse                                 | CORS only reflects configured `FRONTEND_ORIGINS`; `*` is refused in production.                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| NoSQL injection                                    | Strict Zod schemas (unknown keys and non-primitive values rejected); `mongoose.set('sanitizeFilter', true)`; explicit `$eq` on ids and owner; `isValidObjectId` checks. Operators the server writes itself (date ranges over validated strings) are explicitly marked `mongoose.trusted`. Tested against a real `mongod`.                                                                                                                                                                                                                     |
| XSS                                                | React escapes all output; no `dangerouslySetInnerHTML`; model text rendered as plain text; external links use `rel="noopener noreferrer"`; helmet headers on the API; `X-Frame-Options: DENY`, `nosniff` and a restrictive `Permissions-Policy` on the frontend.                                                                                                                                                                                                                                                                              |
| Prompt injection (user text or retrieved text)     | Untrusted content is wrapped in named tags whose angle brackets are neutralised so it cannot close the block (`ai/sanitize.ts`). The system prompt declares those blocks to be data and puts security rules first. The model has **no tools**. Outputs must match a Zod schema. Citations come from curated records, not model text. Any URL not in the curated set is stripped. "Could not verify" is forced when nothing was retrieved. Emergency banners and earnings numbers do not depend on the model. Tested with injection payloads.  |
| AI hallucinating facts in complaints               | `services/grievanceDraft.ts` checks that every multi-digit number in the AI draft also appears in the worker's facts. If not, the AI draft is discarded and a plain template built only from worker facts is used.                                                                                                                                                                                                                                                                                                                            |
| AI deciding eligibility or doing maths             | Eligibility filtering and every calculation run in deterministic code (`knowledge/retrieval.ts`, `utils/earnings.ts`). The model only narrates.                                                                                                                                                                                                                                                                                                                                                                                               |
| Secret leakage                                     | `ANTHROPIC_API_KEY` is read only on the server (`config/env.ts`, `ai/anthropicProvider.ts`). The frontend only knows the public API URL. `.env*` files are gitignored; `.env.example` holds placeholders only.                                                                                                                                                                                                                                                                                                                                |
| Sensitive data in logs                             | pino logs route and error class only — never bodies (so never passwords or reset tokens), prompts or provider error messages (they can echo prompts). A redact list is a second line of defence. Logging is silent in tests.                                                                                                                                                                                                                                                                                                                  |
| Information leakage in errors                      | One error shape, no stack traces in any environment, generic 500 message, AI errors normalised to `AI_UNAVAILABLE` / `AI_BAD_OUTPUT`.                                                                                                                                                                                                                                                                                                                                                                                                         |
| Abuse and cost exhaustion                          | Rate limits per IP+session: AI endpoints 20/min, everything else 300/min. 32 KB body limit. Field length caps. Chat history ≤6 turns. AI output token cap and request timeout. One SDK retry and one bad-output retry.                                                                                                                                                                                                                                                                                                                        |
| Misuse of the public demo account                  | The demo account is a real user with a restricted `demo` role and no admin rights (no admin role exists). Each sign-in gets a private sandbox (`demo:<random>`), so visitors cannot see each other's data and it can never reach a real user's records. Its password cannot be reset, its email cannot be registered, and its data expires after 24 h. It is **off by default in production** (`DEMO_ACCOUNT_ENABLED`); when off, it is not seeded, an existing record cannot sign in, and its credentials are not published.                 |
| Accidental "production" deploy of the demo setup   | With `NODE_ENV=production` the server refuses to start without a ≥32-char `SESSION_SECRET`, `COOKIE_SECURE=true` and `MONGODB_URI`, or with `FRONTEND_ORIGINS=*` (tested).                                                                                                                                                                                                                                                                                                                                                                    |
| Malicious uploads                                  | There is no upload endpoint, so this attack surface does not exist yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## Data retention and deletion

- **Chat:** not stored on the server.
- **Complaint drafts:** not stored unless the worker ticks consent.
- **Account data** (earnings, consented complaints): kept until the user deletes it; never expired silently.
- **Demo-sandbox data:** removed by a MongoDB TTL index **24 hours** after the last write.
- **Sessions:** expire server-side after 12 hours (30 days with "Keep me signed in"); MongoDB's session
  collection is TTL-indexed. Logout deletes the session immediately.
- **Reset tokens:** expire after 30 minutes and are TTL-deleted; used tokens cannot be reused.
- **In-memory mode:** everything is lost on restart.
- **Deletion:** `DELETE /api/v1/me/data` (Settings → _Delete all my saved data_) removes all earnings and
  complaints of the signed-in account (or demo sandbox). Single records can be deleted individually.
- **Profile:** browser `localStorage` only. Clearing site data removes it.
- **Third parties:** with a real key, prompts go to Anthropic under their API data policy. Browser speech
  recognition may send audio to the browser vendor (the Ask screen says so next to the mic button).

## Dependency audit

`npm run audit` (production dependencies): **0 known vulnerabilities** at the time of writing.

The full audit, including dev tooling, reports `braces` (stack-exhaustion DoS, GHSA-vfj7-8cjw-p6xm), pulled in
only by `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob`. It runs only at lint time on our own
source files, never in the deployed app, and the only fix npm offers is a downgrade to the v14 lint config. It
is accepted until upstream ships a fix. Vitest was upgraded to v5 to resolve the `tinypool` and
`@vitest/mocker` advisories.

## Known limitations

- Email/password only: no email verification, no two-factor authentication, no phone-OTP sign-in, and no
  "change password while signed in" (reset by email works). Account deletion removes data but not the
  account record itself.
- Registration reveals whether an email is already registered (`409 EMAIL_IN_USE`); login and forgot-password
  do not. Registration is rate-limited.
- The frontend's route guard is client-side (the session cookie belongs to the API origin). Private data is
  still protected because the API checks every request; a signed-out visitor only sees an empty loading
  screen before the redirect.
- The in-memory session store (used when `MONGODB_URI` is empty) is for local demos only; production config
  requires MongoDB.
- No CSRF token. The custom-header + Origin + CORS + SameSite approach is standard for JSON APIs but relies on
  browsers enforcing CORS preflights.
- Rate limits are in-memory per process. Multi-instance deployments need a shared store (for example Redis).
- The Resend email integration is implemented against its documented HTTP API and unit-tested with a mocked
  `fetch`, but has not been exercised against the live service.
- Prompt-injection defences reduce risk but cannot eliminate it for LLMs. The design limits the damage: no
  tools, schema-checked output, link stripping, and deterministic facts.
- Knowledge content is marked `pending_human_review`. A wrong summary could mislead, which is why every answer
  links to the official source.

## Production hardening

Before serving real workers publicly:

1. Add email verification and optional two-factor or phone-OTP sign-in; consider breached-password checks.
2. Keep `DEMO_ACCOUNT_ENABLED` off (the production default), or run the demo on a separate deployment.
   Configure `EMAIL_PROVIDER` so password reset works.
3. Use HTTPS everywhere, `COOKIE_SECURE=true`, a secret manager for `SESSION_SECRET` and `ANTHROPIC_API_KEY`,
   and rotate them.
4. Use MongoDB with auth, TLS, least-privilege users, backups and encryption at rest.
5. Use a shared rate-limit store; add bot protection on AI endpoints; set spend alerts on the AI account.
6. Add a Content-Security-Policy to the frontend.
7. Have the knowledge base reviewed by a qualified person (labour lawyer / legal aid organisation), record the
   reviewer and date per record, and schedule re-verification.
8. Before adding uploads: allow-list types by magic bytes (PDF/JPEG/PNG), cap the size, scan for malware, store
   privately with no public URLs, delete after processing, never log extracted text, and require consent.
9. Publish a privacy notice in the supported languages that explains AI processing and browser speech.
10. Run `npm audit`, dependency updates and the test suite in CI on every change.

## Reporting a vulnerability

Please do not open a public issue. Contact the maintainers privately with steps to reproduce.
