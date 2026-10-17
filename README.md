# KaamSaathi AI

**Your Work. Your Rights. Your Saathi.**

**Live demo:** https://kaamsaathi-ai.vercel.app — sign in with the prefilled demo account
(`demo@workwise.ai` / `WorkerDemo@2026`; fictional data, public credentials).

A multilingual GenAI assistant for gig and informal workers in India — delivery partners, cab/auto/bike-taxi
drivers, construction and daily-wage workers, domestic workers. It helps workers track earnings, understand
their rights and safety options, discover potentially relevant welfare schemes, prepare documents, and draft
polite, factual complaints.

> Hackathon MVP (Hack2Skill). Not affiliated with, endorsed by, or partnered with any government body or
> platform. Guidance is general information, not legal advice.

---

## Contents

- [Quick start (no API key, no database)](#quick-start)
- [Signing in & the demo account](#signing-in--the-demo-account)
- [Demo script for judges](#demo-script)
- [Features](#features)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
- [Deploying to Vercel](#deploying-to-vercel)
- [Known limitations](#known-limitations)
- [Hackathon pitch](#hackathon-pitch)

---

## Quick start

Requirements: Node.js 22+, npm 10+.

```bash
npm install
cp .env.example backend/.env                              # optional – defaults work without it
echo "NEXT_PUBLIC_API_BASE_URL=http://localhost:4000/api/v1" > frontend/.env.local   # optional

npm run dev:backend      # http://localhost:4000  (terminal 1)
npm run dev:frontend     # http://localhost:3000  (terminal 2)
```

With no configuration the app runs in a fully demonstrable mode:

| What    | Without config                                                                           | With config                      |
| ------- | ---------------------------------------------------------------------------------------- | -------------------------------- |
| AI      | **Mock provider** — deterministic, labelled "Demo AI (not a live model)" on every answer | Google Gemini (`GEMINI_API_KEY`) |
| Storage | In-memory (lost on restart; the server logs a warning)                                   | MongoDB (`MONGODB_URI`)          |

`GET /api/v1/health` always reports which AI provider and storage are active.

To use real Gemini, put `GEMINI_API_KEY=...` (from https://aistudio.google.com/apikey) in `backend/.env` and
restart the backend. The key is read
only on the server and never reaches the browser.

Open http://localhost:3000. You land on the login page with the demo account already filled in; press
**Sign in**.

---

## Signing in & the demo account

Everything except the login, registration and password pages requires a signed-in account. The API enforces
this on every request; the frontend only redirects.

### Demo account (public demonstration credentials)

| Email              | Password          |
| ------------------ | ----------------- |
| `demo@workwise.ai` | `WorkerDemo@2026` |

- The login page **prefills** these and has a **Fill demo credentials** button. It never signs in by itself;
  you still press _Sign in_.
- These are **public** credentials for judging. They are not suitable for any real account, and every screen
  shows a _Demo mode_ badge while you use them.
- The demo user is a real account in the database with a restricted `demo` role and an Argon2id password hash
  (the plaintext is never stored). Restrictions:
  - each demo sign-in gets its **own private sandbox** of fictional data (deleted after 24 h in MongoDB), so
    visitors sharing the login never see each other's entries, and the demo account can never see a real
    user's records;
  - its password cannot be reset or changed, and the demo email cannot be registered as a real account;
  - it has no administrative permissions (the app has no admin role at all).

### Provisioning, seeding and turning it off

| Setting                 | Default                                           |
| ----------------------- | ------------------------------------------------- |
| `DEMO_ACCOUNT_ENABLED`  | **on** in development/test, **off** in production |
| `DEMO_ACCOUNT_EMAIL`    | `demo@workwise.ai`                                |
| `DEMO_ACCOUNT_PASSWORD` | `WorkerDemo@2026`                                 |

- **In-memory mode** (no `MONGODB_URI`): the demo user is created each time the backend starts.
- **MongoDB:** the backend also seeds it at startup, and you can run `npm run seed` yourself. Seeding is
  idempotent: it updates the existing account (unique email index) instead of creating a duplicate, and it
  creates nothing when the demo account is disabled.
- **Production:** leave `DEMO_ACCOUNT_ENABLED` unset (or set `false`). The demo user is then not created, an
  existing demo record cannot sign in, `GET /auth/demo` reveals nothing, and the login page hides the demo box.
  Only set it to `true` on a deployment that is explicitly a public demo.

### Real accounts and password reset

- **Create an account** with a name, email and password (8–128 characters with a letter and a number). Nothing
  else is asked; never Aadhaar or bank details.
- **Forgot password** always answers with the same message, whether or not the email exists. The reset link is
  single-use, valid for 30 minutes (`RESET_TOKEN_TTL_MINUTES`), and only its SHA-256 hash is stored. A
  successful reset signs out every existing session of that account.
- **Local testing:** with no `EMAIL_PROVIDER` in development, no email is sent. The message (with the link) is
  kept in a local **dev outbox** at `http://localhost:4000/api/v1/dev/outbox`, and the forgot-password page
  links to it. This route does not exist in production.
- **Production email:** set `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` and `EMAIL_FROM`. Without a provider,
  password reset returns `503 EMAIL_NOT_CONFIGURED` for every email instead of pretending to send.

---

## Demo script

Sign in with the prefilled **demo account**. A _Demo mode_ badge stays visible, and the data you see is
fictional and lives in a private sandbox for this sign-in.

**Scenario: a food-delivery worker in Punjab who speaks Hindi/Punjabi.**

1. **Language** — pick हिन्दी or ਪੰਜਾਬੀ in the top-right selector. The interface and the AI answers switch.
2. **Earnings** — open _Earnings_. Seven fictional days are pre-loaded. Add today's entry, e.g. base pay 900,
   incentives 0, expenses 350, deductions 120. The summary updates using the formula shown on screen:
   - Gross = base pay + tips + bonuses + incentives
   - Net = gross − expenses − deductions
     Unusual days (negative net, expenses eating most of the gross, unusually high gross, very long hours) are
     flagged by deterministic code.
3. **Explain** — press _Explain my earnings_. The AI narrates numbers the backend computed; it never does the
   arithmetic itself.
4. **Ask AI** — try `Maine aaj kitna kamaya?` (answered from the worker's own records),
   `Company ne meri payment rok di hai, ab kya karun?` (rights guidance with official sources), and
   `Mujhe accident ho gaya` (a 112 emergency banner appears — deterministic, not model-dependent).
5. **Schemes** — choose Punjab + food delivery and search. Each card is labelled
   **"Potentially relevant — verify eligibility"** and shows benefit, eligibility, documents, steps, the official
   link, the source, and the date the link was checked.
6. **Complaint** — open _Complaints_, press _Use sample scenario_ (an unpaid ₹250 incentive), and generate.
   The draft separates **what the worker provided** from **AI suggestions**, keeps the worker's amount and
   platform exactly, can be edited, copied and downloaded, and is never sent automatically. It is stored only if
   the consent box is ticked.
7. **Privacy** — _Settings → Delete all my saved data_ removes everything this account stored. _Sign out_
   (sidebar or Settings) ends the session on the server.

To see failure handling, stop the backend and send a chat message: the UI shows a clear offline message with
_Try again_.

---

## Features

| Feature                       | What it does                                                                                                                                                                                                                                                   | How it stays trustworthy                                                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Multilingual assistant** | Chat in English, Hindi, Punjabi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam; Romanised input understood; suggested questions and quick actions; read-aloud and voice input via the browser speech API (behind a `SpeechProvider` interface) | Answers grounded in retrieved records, with citations; explicit "I could not verify this" when nothing matches; follow-up questions when details are missing |
| **B. Earnings tracker**       | Daily entries with hours, tips, bonuses, incentives, expenses, deductions, platform/category; day/week/month summaries; daily net chart; CSV export; AI explanation                                                                                            | All maths in deterministic backend code (`backend/src/utils/earnings.ts`); entries labelled _You entered_ vs _Demo sample_; no claim of platform integration |
| **C. Rights & safety guide**  | Payment disputes, accidents, occupational safety, harassment, account suspension, working conditions, fraud, free legal aid                                                                                                                                    | Each record is tagged central law / state provision / platform policy / best practice / emergency, with source name, link and link-check date                |
| **D. Scheme finder**          | Asks only state, work type, broad age range, e-Shram card and bank account yes/no                                                                                                                                                                              | Eligibility is filtered by code over a curated dataset; the model only writes a short "why relevant / next step" for schemes the filter already picked       |
| **E. Document assistant**     | Checklists (e-Shram, BOCW, bank account for schemes, accident claim, payment dispute); drafts of an application letter, payment request, work-experience summary, affidavit outline; plain-language form explanations                                          | Drafts labelled "DRAFT — review before use"; `[PLACEHOLDER]` for missing details; no forging of certificates, signatures or approvals                        |
| **F. Complaint drafting**     | Three-step guided form → subject, worker facts, timeline, evidence checklist, requested resolution, suggested official channels, final message in the chosen language                                                                                          | A fact check rejects AI drafts that add amounts or dates the worker did not give (a plain template is used instead); polite wording; consent-only storage    |
| **G. Profile (Settings)**     | Language, work type, state, platform, larger text, high contrast                                                                                                                                                                                               | Stored only in the browser; never asks for ID numbers                                                                                                        |
| **H. Demo mode**              | Fictional data, sample complaint, example questions, predictable mock AI                                                                                                                                                                                       | Separate `demo:` data bucket; every mock answer is badged as mock                                                                                            |

---

## Architecture

```
frontend/  Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind 4 · React Hook Form + Zod
  app/            pages: / ask earnings schemes rights documents complaints settings
  components/     Shell (navigation, language, mode banner), ui (errors, citations, chart, badges)
  hooks/          useApp (profile, language, demo/real mode), useAction, useSpeech
  lib/            api client, i18n, speech provider, types
  tests/unit      Vitest
  tests/e2e       Playwright (starts real backend + frontend)

backend/   Express 5 · TypeScript strict · Zod · Mongoose · Google Gen AI SDK (`@google/genai`) · pino
  src/
    app.ts            helmet, CORS allow-list, 32 KB body limit, rate limits, session, CSRF guard
    config/env.ts     validated environment; production safety checks
    auth/             Argon2id password hashing, reset tokens, mailer (dev outbox / Resend)
    middleware/       session (express-session + requireAuth), csrf, validate, rateLimit, errorHandler
    routes/           /api/v1 router
    schemas/          Zod request schemas (strict: unknown fields rejected)
    services/         workerAssistant, earningsService, schemeGuidance, documentAssistant,
                      grievanceDraft, emergency, citations, demoData
    ai/               AIProvider interface · GeminiProvider · MockAIProvider · prompts ·
                      structured (JSON + Zod validation, retry) · sanitize (prompt-injection defences)
    knowledge/        KnowledgeRetrievalService (keyword RAG) · schema · data/*.json (curated records)
    repositories/     memory + mongo implementations behind one owner-scoped interface
    models/           EarningsEntry, GrievanceDraft (Mongoose, indexed, TTL retention)
  tests/unit, tests/integration   Vitest + Supertest (+ real mongod via mongodb-memory-server)
```

### How an AI answer is produced (RAG)

1. **Retrieve** — `KnowledgeRetrievalService` scores curated records (`knowledge/data/*.json`) by keyword and
   transliteration-aware matching. No vector database: the dataset is small and keyword search is transparent.
2. **Attach metadata** — each record carries scope, source URLs, link-check date and review status.
3. **Generate** — the model gets the records and (for earnings questions) the worker's computed totals inside
   tagged _untrusted data_ blocks, with a system prompt that forbids inventing laws, schemes, numbers or links.
4. **Validate** — output must be JSON matching a Zod schema; one retry, then a clean error.
5. **Post-process** — citations are built from the curated record, never from model text; any URL the model wrote
   that is not in the curated set is removed; "could not verify" is forced when nothing was retrieved.
6. **Display** — the UI shows the answer, sources, links, check dates, limitations and the provider badge.

### Updating knowledge

Edit or add a JSON file in `backend/src/knowledge/data/` (or point `KNOWLEDGE_DIR` at another folder). The
schema is validated at startup, so a malformed record stops the server instead of being shown to workers.

```bash
npm run seed                      # validate all knowledge records and list them
npm run knowledge:check -w backend   # re-check every source URL (then update linkStatus/linkCheckedOn)
```

Every record is marked `contentReview: "pending_human_review"`. The tool checks that links are reachable; it
does not claim a person has verified the content against the official page.

---

## Configuration

Backend (`backend/.env`, see `.env.example`):

| Variable                                                       | Default                                | Purpose                                                                               |
| -------------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------- |
| `NODE_ENV`                                                     | `development`                          | `production` turns on the safety checks below                                         |
| `PORT`                                                         | `4000`                                 | API port                                                                              |
| `FRONTEND_ORIGINS`                                             | `http://localhost:3000`                | Comma-separated CORS allow-list (`*` rejected in production)                          |
| `MONGODB_URI`                                                  | empty → in-memory                      | MongoDB connection string (**required in production**)                                |
| `GEMINI_API_KEY`                                               | empty → mock AI                        | Google Gemini API key (server-side only)                                              |
| `GEMINI_MODEL`                                                 | `gemini-flash-latest`                  | Gemini model id or alias                                                              |
| `AI_TIMEOUT_MS`                                                | `20000`                                | Per-request AI timeout                                                                |
| `AI_MAX_OUTPUT_TOKENS`                                         | `900`                                  | Output token cap                                                                      |
| `SESSION_SECRET`                                               | random per start                       | Session cookie signing secret, ≥32 chars (**required in production**)                 |
| `COOKIE_SECURE`                                                | `false`                                | `true` behind HTTPS (**required in production**)                                      |
| `SESSION_TTL_HOURS` / `REMEMBER_ME_DAYS`                       | `12` / `30`                            | Server-side session lifetime without / with "Keep me signed in"                       |
| `DEMO_ACCOUNT_ENABLED`                                         | on in dev, off in prod                 | Provision the public demo account (see above)                                         |
| `DEMO_ACCOUNT_EMAIL` / `_PASSWORD`                             | `demo@workwise.ai` / `WorkerDemo@2026` | Public demo credentials                                                               |
| `EMAIL_PROVIDER`                                               | empty                                  | `resend` to send reset emails (needs `RESEND_API_KEY`, `EMAIL_FROM`)                  |
| `APP_BASE_URL`                                                 | first frontend origin                  | Base URL for reset links                                                              |
| `RESET_TOKEN_TTL_MINUTES`                                      | `30`                                   | Reset link lifetime                                                                   |
| `LOGIN_RATE_LIMIT` / `AUTH_RATE_LIMIT` / `REGISTER_RATE_LIMIT` | `10` / `5` / `10`                      | Per 15 min (login per IP+email and 5× per IP; forgot/reset per IP); register per hour |
| `KNOWLEDGE_DIR`                                                | built-in data                          | Alternative folder of knowledge JSON files                                            |
| `AI_RATE_LIMIT` / `GENERAL_RATE_LIMIT`                         | `20` / `300`                           | Requests per minute per IP+session                                                    |
| `LOG_LEVEL`                                                    | `info`                                 | pino log level                                                                        |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000/api/v1`). Nothing
secret belongs in the frontend.

---

## API reference

Base path `/api/v1`. JSON in and out. State-changing requests must send `X-Requested-With: kaamsaathi`
and, if the browser sends an `Origin`, it must be an allowed frontend origin (CSRF guard). Private endpoints
return `401 AUTH_REQUIRED` without a valid session. The owner of every record comes from the server-side
session, never from the request body.

Errors always look like `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`.
Codes: `VALIDATION_ERROR` 400, `RESET_TOKEN_INVALID` 400, `AUTH_REQUIRED` 401, `INVALID_CREDENTIALS` 401,
`CSRF_REJECTED` 403, `EMAIL_IN_USE` 409, `EMAIL_NOT_CONFIGURED` 503, `NOT_FOUND` 404, `PAYLOAD_TOO_LARGE` 413,
`RATE_LIMITED` 429, `AI_BAD_OUTPUT` 502, `AI_UNAVAILABLE` 503, `INTERNAL_ERROR` 500 (no stack traces).

| Method & path                     | Body / query                                                                                                                                                               | Returns                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `POST /auth/login` (public)       | `email`, `password`, `remember?`                                                                                                                                           | `{ user: { id, email, name, isDemo } }` + session cookie; generic 401 on any failure                  |
| `POST /auth/register` (public)    | `name`, `email`, `password`                                                                                                                                                | `201 { user }`, signed in                                                                             |
| `POST /auth/logout`               | —                                                                                                                                                                          | 204; session destroyed server-side, cookie cleared                                                    |
| `GET /auth/me`                    | —                                                                                                                                                                          | `{ user }` or 401                                                                                     |
| `POST /auth/forgot-password`      | `email`                                                                                                                                                                    | the same generic message for every email                                                              |
| `POST /auth/reset-password`       | `token`, `password`                                                                                                                                                        | 200, or 400 `RESET_TOKEN_INVALID` (unknown, expired or used)                                          |
| `GET /auth/demo` (public)         | —                                                                                                                                                                          | demo credentials when enabled, else `{ enabled: false }`                                              |
| `GET /dev/outbox` (dev only)      | —                                                                                                                                                                          | locally captured reset emails; absent in production                                                   |
| `GET /health`                     | —                                                                                                                                                                          | status, AI provider (+ `isMock`), storage kind, knowledge record count                                |
| `GET /demo/info`                  | —                                                                                                                                                                          | example questions, sample complaint scenario (fictional)                                              |
| `POST /assistant/chat`            | `message` (≤1000 chars), `language`, `history[]` (≤6), `profile{state, workCategory}`                                                                                      | `answer`, `followUpQuestions`, `citations[]`, `couldNotVerify`, `emergency`, `provider`, `disclaimer` |
| `GET /earnings/entries`           | `from`, `to` (YYYY-MM-DD)                                                                                                                                                  | `entries[]`                                                                                           |
| `POST /earnings/entries`          | `date`, `category`, `platform?`, `hoursWorked`, `basePay`, `tips`, `bonuses`, `incentives`, `expenses`, `deductions`, `notes?`                                             | `201 { entry }`                                                                                       |
| `PATCH /earnings/entries/:id`     | any subset of the above                                                                                                                                                    | `{ entry }` / 404                                                                                     |
| `DELETE /earnings/entries/:id`    | —                                                                                                                                                                          | 204 / 404                                                                                             |
| `GET /earnings/summary`           | `period=day\|week\|month`, `anchor?`                                                                                                                                       | `totals`, `series`, `anomalies`, `formulas`, `dataNotice`                                             |
| `GET /earnings/export.csv`        | —                                                                                                                                                                          | CSV of the caller's entries                                                                           |
| `POST /earnings/explain`          | `language`, `period`                                                                                                                                                       | AI narration of computed totals + flagged entries                                                     |
| `GET /knowledge/sources` (public) | —                                                                                                                                                                          | every curated record with scope, sources, review status, limitations                                  |
| `POST /schemes/search`            | `language`, `state?`, `workCategory?`, `ageRange?`, `hasEShramCard?`, `hasBankAccount?`, `query?`                                                                          | `results[]` with label, benefit, eligibility, documents, steps, `applyUrl`, citation                  |
| `POST /documents/checklist`       | `language`, `purpose`                                                                                                                                                      | curated checklist + plain-language explanation                                                        |
| `POST /documents/draft`           | `language`, `kind`, `details`, `workerName?`                                                                                                                               | draft labelled as a draft                                                                             |
| `POST /grievances/draft`          | `language`, `facts{type, platformOrEmployer, whatHappened, incidentDate?, amountRupees?, stepsAlreadyTaken?, evidenceAvailable[], desiredResolution?}`, `saveWithConsent?` | structured draft; `201` + `id` only when consent was given                                            |
| `GET /grievances`                 | —                                                                                                                                                                          | the caller's saved drafts                                                                             |
| `PATCH /grievances/:id`           | `status?`, `subject?`, `finalMessage?`                                                                                                                                     | `{ grievance }` / 404                                                                                 |
| `DELETE /grievances/:id`          | —                                                                                                                                                                          | 204 / 404                                                                                             |
| `DELETE /me/data`                 | —                                                                                                                                                                          | counts of deleted earnings and complaints                                                             |

Document upload is intentionally **not** implemented (see limitations), so there is no upload endpoint.

---

## Testing

No API key or database is needed. Tests use the mock provider, fake failing providers, in-memory storage, and
an ephemeral real `mongod` (downloaded once by `mongodb-memory-server`).

```bash
npm run typecheck          # backend + frontend tsc --noEmit (strict)
npm run lint               # ESLint, both workspaces
npm test                   # all unit + integration tests (backend) and unit tests (frontend)
npm run test:unit          # backend unit tests
npm run test:integration   # backend API tests (Supertest) incl. MongoDB repository
npm run test:e2e           # Playwright; starts backend :4100 and frontend :3100 itself
                           # first time: (cd frontend && npx playwright install chromium)
npm run audit              # production dependency audit
```

Coverage by area:

- **Unit** — earnings and net-income formulas, rounding, anomaly flags; input validation; language and prompt
  construction; AI output schema validation and retries; scheme eligibility filtering; source attribution and
  URL stripping; complaint fact preservation and the fact check that falls back to a template; authorization
  helpers; production configuration guards; Argon2id hashing and verification; email normalisation; password
  policy; reset-token generation, expiry, single use and supersession; demo seed idempotency and the
  disabled-demo path; email provider; frontend error mapping, translations, login/registration form
  validation and open-redirect-safe `?next=` handling.
- **Integration** — mock-provider chat in Hindi with citations; missing and invalid fields; provider outage and
  timeout (503); rate limiting (429); CSRF and CORS; oversized and malformed bodies; earnings CRUD + summary +
  CSV; **cross-user access prevention** and forged cookies; scheme search with citations;
  complaint drafting without invented facts and consent-only storage; prompt-injection attempts; Aadhaar-like
  extra fields rejected; the same ownership, NoSQL-injection and retention checks against real MongoDB (with
  sessions stored in Mongo).
- **Auth integration** — login success and minimal profile; wrong password and unknown email give identical
  responses; malformed input; HttpOnly/SameSite/Secure cookies and "remember me"; session-id regeneration;
  Origin-based CSRF rejection; login and forgot-password rate limits; 401 on every private endpoint; logout
  invalidates the old cookie; account switching shows no previous records; registration rules; forgot-password
  response consistency; reset single use, expiry and sign-out of old sessions; no reset for the demo account;
  honest 503 without an email provider; demo sandboxes isolated per sign-in; demo disabled.
- **End-to-end (auth)** — login form prefilled with the demo credentials but never auto-signs-in; _Fill demo
  credentials_ and show/hide password; inline validation; generic error for a wrong password; private pages
  redirect to login and back; redirect only after `GET /auth/me` confirms the session; demo indicator; logout
  ends the server session; registration; forgot-password generic answer with the dev outbox.
- **End-to-end (journeys, signed in as demo)** — demo account labelled; switch to Hindi and ask a question; emergency banner; add an earnings entry
  and see net change by the exact amount; scheme search with official source; generate, edit and copy a
  complaint draft (checked against clipboard contents); AI outage error with working retry; offline message.

The outage e2e test intercepts the chat request in the browser and returns the backend's real 503 contract.
The backend's actual outage and timeout handling is covered separately by integration tests.

---

## Deployment

The backend refuses to start with `NODE_ENV=production` unless `SESSION_SECRET` (≥32 chars),
`COOKIE_SECURE=true` and `MONGODB_URI` are set and `FRONTEND_ORIGINS` is not `*`.

```bash
npm run build                                  # backend → backend/dist, frontend → .next
NODE_ENV=production npm start -w backend       # reads backend/.env
npm start -w frontend
```

- Serve both over HTTPS. Same-site hosting (for example `app.example.in` and `api.example.in`) keeps the
  SameSite=Lax session cookie working.
- Use a managed MongoDB with authentication and TLS; Mongoose creates the indexes, including the TTL indexes.
- Keep `DEMO_ACCOUNT_ENABLED` unset/`false` for a real-user deployment (the default in production), or make the
  whole deployment an explicit public demo.
- Configure `EMAIL_PROVIDER` for password reset, otherwise reset honestly reports it is unavailable.
- Sessions are stored in MongoDB (`sessions` collection, TTL-indexed), so they survive restarts and work
  across several API instances.
- Put the API behind a reverse proxy that sets `X-Forwarded-For` (the app trusts one proxy hop in production).
- Read [SECURITY.md](SECURITY.md) before any public deployment.

### Deploying to Vercel

The app deploys as **two Vercel projects from this one repository**. The browser only ever talks to the
frontend's domain: Next.js proxies `/api/v1/*` to the API project, so the session cookie is first-party
(separate `*.vercel.app` domains would otherwise make it a blocked third-party cookie).

**Prerequisite: a MongoDB database** (for example MongoDB Atlas, free tier). Serverless functions keep no
memory between requests, so production requires `MONGODB_URI` for data _and_ sessions. In Atlas, allow
access from Vercel (Network Access → `0.0.0.0/0`, or Vercel's static IPs on paid plans).

**1. API project** — Vercel → _Add New Project_ → this repo → **Root Directory: `backend`**. Vercel reads
`backend/vercel.json` (build `npm run build`, serverless entry `backend/api/index.js`). Environment variables:

| Variable               | Value                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`             | `production`                                                                                     |
| `MONGODB_URI`          | your Atlas connection string                                                                     |
| `SESSION_SECRET`       | 64 random hex chars (`node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
| `COOKIE_SECURE`        | `true`                                                                                           |
| `FRONTEND_ORIGINS`     | the frontend URL, e.g. `https://kaamsaathi.vercel.app`                                           |
| `TRUST_PROXY_HOPS`     | `2` (frontend proxy + Vercel edge, so rate limits see real client IPs)                           |
| `DEMO_ACCOUNT_ENABLED` | `true` **only** if this deployment is a public demo for judges                                   |
| `GEMINI_API_KEY`       | optional; without it the clearly labelled mock AI is used                                        |
| `EMAIL_PROVIDER` etc.  | optional; without it password reset reports that email is not configured                         |

**2. Frontend project** — _Add New Project_ → same repo → **Root Directory: `frontend`** (framework: Next.js).
Environment variables:

| Variable                   | Value                                                         |
| -------------------------- | ------------------------------------------------------------- |
| `BACKEND_URL`              | the API project URL, e.g. `https://kaamsaathi-api.vercel.app` |
| `NEXT_PUBLIC_API_BASE_URL` | `/api/v1`                                                     |

**3.** After the first deploy, set the API's `FRONTEND_ORIGINS` to the frontend's real URL and redeploy the
API. Check `https://<frontend>/api/v1/health`: it should say `"storage":"mongo"`.

Serverless caveats: rate limits are kept per function instance (weaker than a single server; use a shared
store such as Upstash Redis for strict limits), and the first request after idle has a cold start while the
database connection and demo seed are set up.

---

## Known limitations

- **Email/password only.** No phone-OTP sign-in, no email verification on registration, no two-factor
  authentication and no "change password while signed in" screen yet (reset by email works).
- **Registration reveals whether an email is registered** (`409 EMAIL_IN_USE`). Login and forgot-password do
  not; registration is rate-limited to slow enumeration.
- **Rate limits are in-process.** Behind several API instances they need a shared store (for example Redis).
- **Knowledge is a small seed set** (13 records: 5 schemes, 8 rights/safety topics). Links are checked by a
  tool; the content still needs review by a person against the official pages. Only Punjab has a
  state-specific record (BOCW welfare board); other states get central schemes plus general guidance.
- **Mock AI is not an AI.** It assembles replies from the retrieved records and computed numbers, and does not
  translate source text. Record summaries are in English, so with the mock provider a Hindi answer contains
  Hindi framing around English record text. Real Gemini responses fully localise.
- **Real Gemini integration has not been exercised in this environment** (no API key was available). The
  provider is a thin wrapper over the official SDK and shares every validation path with the mock, but run a
  manual smoke test once a key is configured.
- **UI translation** covers English, Hindi and Punjabi. Other languages show English labels, while AI answers and
  drafts still come back in the selected language.
- **No document upload or OCR.** The document assistant works from text. Upload needs malware scanning, private
  storage and a retention job first (see SECURITY.md).
- **Speech** uses the browser's Web Speech API. Support varies, and some browsers (for example Chrome) send audio
  to the vendor's cloud.
- **Retrieval is keyword-based.** It handles common Hindi/Punjabi/Romanised terms but will miss some
  phrasings; in that case the assistant says it could not verify.
- Scheme availability and amounts change. The app never says a scheme is open or that someone is eligible.

---

## Hackathon pitch

**Problem.** India has hundreds of millions of informal and gig workers. Many cannot easily tell how much
they actually earn after fuel and platform cuts, do not know which welfare schemes might apply to them, and
find it hard to write a complaint when a payment goes missing. The information that exists is spread across
portals, written in formal English, and designed for people who are already comfortable online.

**Solution.** KaamSaathi AI is a companion in the worker's own language. It turns daily earnings into a clear
net figure with the formula shown, explains rights and safety steps with official sources, shortlists
_potentially_ relevant schemes along with the documents to collect, and drafts a polite, factual complaint
the worker can edit and send themselves.

**How AI is used — and where it is not.** Gemini does the language work: understanding Romanised Hindi,
explaining in simple words, writing drafts in the chosen language. Code handles everything that must be
right: arithmetic, eligibility filtering, citations, emergency detection, and checking that a complaint does
not add facts the worker never gave. Every factual answer is grounded in a curated, source-linked knowledge
base. When the sources do not cover a question, the app says so instead of guessing.

**Social impact.** Workers get a better view of their own income, easier routes to social-security
registration (e-Shram, pension and insurance schemes), and more confidence raising disputes, all without
sharing Aadhaar, bank numbers or OTPs.

**Security and privacy.** API keys stay on the server. Data is owner-scoped, with tested protection against
cross-user access and injection. Complaints are stored only with consent, data expires automatically, and
one button deletes everything. Prompt-injection defences are covered by tests.

**Future scope.** Phone-OTP accounts; a larger, human-reviewed knowledge base for every state with a review
workflow; secure document upload with OCR; voice-first IVR/WhatsApp access; authorised platform integrations
for verified earnings; partnerships with legal aid services and worker unions for content review.
