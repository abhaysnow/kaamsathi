# Security & Privacy — KaamSaathi AI

This document covers the threat model, the controls that are implemented (with where to find them), known
limitations, and what must happen before any public production deployment.

**Status: hackathon MVP.** The anonymous-session model is suitable for a demo and for low-risk, single-device
use. It is **not** account authentication. See [Production hardening](#production-hardening).

## Users and data

The users are gig and informal workers. Many share phones, have limited digital literacy, and may be in a
dispute with an employer or platform. What the app handles:

| Data                                                          | Where it lives                                                      | Sent to AI provider?                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------ |
| Profile (language, work type, state, platform, accessibility) | Browser `localStorage` only                                         | State and work type only, when relevant                      |
| Earnings entries                                              | Server (memory or MongoDB), owner-scoped                            | Aggregated totals and flags only — no notes, ids or platform |
| Complaint facts and drafts                                    | In the response only; stored **only with an explicit consent tick** | Yes (needed to draft)                                        |
| Chat messages                                                 | Not stored on the server                                            | Yes (last ≤6 turns)                                          |
| Aadhaar, bank account numbers, OTPs, passwords                | **Never requested.** Schemas reject unknown fields                  | No                                                           |

## Threat model

| Threat                                             | Mitigation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reading or editing another worker's records (IDOR) | The owner id comes from a signed, server-issued session cookie (`middleware/session.ts`). Every repository method requires it, and every single-record query filters by `_id` **and** `ownerId` (`repositories/*`). Client-supplied owner ids are rejected by strict schemas. Tested for memory and MongoDB storage.                                                                                                                                                                                                                         |
| Forged or guessed session                          | Random UUIDv4, HMAC-signed cookie (`SESSION_SECRET`), HttpOnly, SameSite=Lax, `Secure` in production. Tampered cookies get a fresh empty session (tested).                                                                                                                                                                                                                                                                                                                                                                                   |
| CSRF                                               | State-changing requests need the custom `X-Requested-With: kaamsaathi` header, which a cross-origin page cannot send without passing the CORS allow-list. SameSite=Lax is a second layer (`middleware/csrf.ts`).                                                                                                                                                                                                                                                                                                                             |
| Cross-origin abuse                                 | CORS only reflects configured `FRONTEND_ORIGINS`; `*` is refused in production.                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| NoSQL injection                                    | Strict Zod schemas (unknown keys and non-primitive values rejected); `mongoose.set('sanitizeFilter', true)`; explicit `$eq` on ids and owner; `isValidObjectId` checks. Operators the server writes itself (date ranges over validated strings) are explicitly marked `mongoose.trusted`. Tested against a real `mongod`.                                                                                                                                                                                                                    |
| XSS                                                | React escapes all output; no `dangerouslySetInnerHTML`; model text rendered as plain text; external links use `rel="noopener noreferrer"`; helmet headers on the API; `X-Frame-Options: DENY`, `nosniff` and a restrictive `Permissions-Policy` on the frontend.                                                                                                                                                                                                                                                                             |
| Prompt injection (user text or retrieved text)     | Untrusted content is wrapped in named tags whose angle brackets are neutralised so it cannot close the block (`ai/sanitize.ts`). The system prompt declares those blocks to be data and puts security rules first. The model has **no tools**. Outputs must match a Zod schema. Citations come from curated records, not model text. Any URL not in the curated set is stripped. "Could not verify" is forced when nothing was retrieved. Emergency banners and earnings numbers do not depend on the model. Tested with injection payloads. |
| AI hallucinating facts in complaints               | `services/grievanceDraft.ts` checks that every multi-digit number in the AI draft also appears in the worker's facts. If not, the AI draft is discarded and a plain template built only from worker facts is used.                                                                                                                                                                                                                                                                                                                           |
| AI deciding eligibility or doing maths             | Eligibility filtering and every calculation run in deterministic code (`knowledge/retrieval.ts`, `utils/earnings.ts`). The model only narrates.                                                                                                                                                                                                                                                                                                                                                                                              |
| Secret leakage                                     | `ANTHROPIC_API_KEY` is read only on the server (`config/env.ts`, `ai/anthropicProvider.ts`). The frontend only knows the public API URL. `.env*` files are gitignored; `.env.example` holds placeholders only.                                                                                                                                                                                                                                                                                                                               |
| Sensitive data in logs                             | pino logs route and error class only — never bodies, prompts or provider error messages (they can echo prompts). A redact list is a second line of defence. Logging is silent in tests.                                                                                                                                                                                                                                                                                                                                                      |
| Information leakage in errors                      | One error shape, no stack traces in any environment, generic 500 message, AI errors normalised to `AI_UNAVAILABLE` / `AI_BAD_OUTPUT`.                                                                                                                                                                                                                                                                                                                                                                                                        |
| Abuse and cost exhaustion                          | Rate limits per IP+session: AI endpoints 20/min, everything else 300/min. 32 KB body limit. Field length caps. Chat history ≤6 turns. AI output token cap and request timeout. One SDK retry and one bad-output retry.                                                                                                                                                                                                                                                                                                                       |
| Demo data mixing with real data                    | Demo data is kept in a separate `demo:<sid>` bucket, can be turned off with `ALLOW_DEMO_MODE=false`, and is badged in the UI.                                                                                                                                                                                                                                                                                                                                                                                                                |
| Accidental "production" deploy of the demo setup   | With `NODE_ENV=production` the server refuses to start without a ≥32-char `SESSION_SECRET`, `COOKIE_SECURE=true` and `MONGODB_URI`, or with `FRONTEND_ORIGINS=*` (tested).                                                                                                                                                                                                                                                                                                                                                                   |
| Malicious uploads                                  | There is no upload endpoint, so this attack surface does not exist yet.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |

## Data retention and deletion

- **Chat:** not stored on the server.
- **Complaint drafts:** not stored unless the worker ticks consent.
- **MongoDB TTL:** every stored earnings entry and complaint carries `expiresAt`, and a TTL index removes it:
  - demo-bucket data: **24 hours** after the last write;
  - guest-bucket data: **30 days** after the last write. This matches the session cookie's lifetime, after
    which the data can no longer be reached by anyone.
- **In-memory mode:** everything is lost on restart.
- **Deletion:** `DELETE /api/v1/me/data` (Settings → _Delete all my saved data_) removes all earnings and
  complaints in the caller's bucket. Single records can be deleted individually.
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

- No user accounts. Anyone with access to the browser (for example a shared phone) can see that browser's
  data. Workers on shared phones should use _Delete all my saved data_.
- No CSRF token. The custom-header + CORS + SameSite approach is standard for JSON APIs but relies on browsers
  enforcing CORS preflights.
- Rate limits are in-memory per process. Multi-instance deployments need a shared store (for example Redis).
- Prompt-injection defences reduce risk but cannot eliminate it for LLMs. The design limits the damage: no
  tools, schema-checked output, link stripping, and deterministic facts.
- Knowledge content is marked `pending_human_review`. A wrong summary could mislead, which is why every answer
  links to the official source.

## Production hardening

Before serving real workers publicly:

1. Add real authentication (phone OTP through an established provider, or an auth library such as Auth.js),
   with server-side sessions that can be revoked. Migrate anonymous buckets on sign-in only with consent.
2. Set `ALLOW_DEMO_MODE=false`, or run demo on a separate deployment.
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
