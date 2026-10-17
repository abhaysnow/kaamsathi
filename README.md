# KaamSaathi AI

**Your Work. Your Rights. Your Saathi.**

A multilingual GenAI assistant for gig and informal workers in India — delivery partners, cab/auto/bike-taxi
drivers, construction and daily-wage workers, domestic workers. It helps workers track earnings, understand
their rights and safety options, discover potentially relevant welfare schemes, prepare documents, and draft
polite, factual complaints.

> Hackathon MVP (Hack2Skill). Not affiliated with, endorsed by, or partnered with any government body or
> platform. Guidance is general information, not legal advice.

---

## Contents

- [Quick start (no API key, no database)](#quick-start)
- [Demo script for judges](#demo-script)
- [Features](#features)
- [Architecture](#architecture)
- [Configuration](#configuration)
- [API reference](#api-reference)
- [Testing](#testing)
- [Deployment](#deployment)
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

| What    | Without config                                                                           | With config                            |
| ------- | ---------------------------------------------------------------------------------------- | -------------------------------------- |
| AI      | **Mock provider** — deterministic, labelled "Demo AI (not a live model)" on every answer | Anthropic Claude (`ANTHROPIC_API_KEY`) |
| Storage | In-memory (lost on restart; the server logs a warning)                                   | MongoDB (`MONGODB_URI`)                |

`GET /api/v1/health` always reports which AI provider and storage are active.

To use real Claude, put `ANTHROPIC_API_KEY=...` in `backend/.env` and restart the backend. The key is read
only on the server and never reaches the browser.

---

## Demo script

The app opens in **Demo mode** (amber banner: "DEMO MODE — all data shown is fictional"). Demo data lives in
its own bucket and never mixes with "My data".

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
7. **Privacy** — _Settings → Delete all my saved data_ removes everything the session stored.

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

backend/   Express 5 · TypeScript strict · Zod · Mongoose · Anthropic SDK · pino
  src/
    app.ts            helmet, CORS allow-list, 32 KB body limit, rate limits, session, CSRF guard
    config/env.ts     validated environment; production safety checks
    middleware/       session (signed anonymous cookie), csrf, validate, rateLimit, errorHandler
    routes/           /api/v1 router
    schemas/          Zod request schemas (strict: unknown fields rejected)
    services/         workerAssistant, earningsService, schemeGuidance, documentAssistant,
                      grievanceDraft, emergency, citations, demoData
    ai/               AIProvider interface · AnthropicProvider · MockAIProvider · prompts ·
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

| Variable                               | Default                 | Purpose                                                       |
| -------------------------------------- | ----------------------- | ------------------------------------------------------------- |
| `NODE_ENV`                             | `development`           | `production` turns on the safety checks below                 |
| `PORT`                                 | `4000`                  | API port                                                      |
| `FRONTEND_ORIGINS`                     | `http://localhost:3000` | Comma-separated CORS allow-list (`*` rejected in production)  |
| `MONGODB_URI`                          | empty → in-memory       | MongoDB connection string (**required in production**)        |
| `ANTHROPIC_API_KEY`                    | empty → mock AI         | Claude API key (server-side only)                             |
| `ANTHROPIC_MODEL`                      | `claude-sonnet-5-5`     | Claude model id                                               |
| `AI_TIMEOUT_MS`                        | `20000`                 | Per-request AI timeout                                        |
| `AI_MAX_OUTPUT_TOKENS`                 | `900`                   | Output token cap                                              |
| `SESSION_SECRET`                       | random per start        | Cookie signing secret, ≥32 chars (**required in production**) |
| `COOKIE_SECURE`                        | `false`                 | `true` behind HTTPS (**required in production**)              |
| `ALLOW_DEMO_MODE`                      | `true`                  | Set `false` to disable the demo bucket                        |
| `KNOWLEDGE_DIR`                        | built-in data           | Alternative folder of knowledge JSON files                    |
| `AI_RATE_LIMIT` / `GENERAL_RATE_LIMIT` | `20` / `300`            | Requests per minute per IP+session                            |
| `LOG_LEVEL`                            | `info`                  | pino log level                                                |

Frontend (`frontend/.env.local`): `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:4000/api/v1`). Nothing
secret belongs in the frontend.

---

## API reference

Base path `/api/v1`. JSON in and out. State-changing requests must send `X-Requested-With: kaamsaathi`
(CSRF guard). The optional `X-KS-Mode: demo` header selects the caller's own demo bucket. The owner of every
record comes from the signed session cookie, never from the request body.

Errors always look like `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }`.
Codes: `VALIDATION_ERROR` 400, `CSRF_REJECTED` 403, `NOT_FOUND` 404, `PAYLOAD_TOO_LARGE` 413,
`RATE_LIMITED` 429, `AI_BAD_OUTPUT` 502, `AI_UNAVAILABLE` 503, `INTERNAL_ERROR` 500 (no stack traces).

| Method & path                  | Body / query                                                                                                                                                               | Returns                                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET /health`                  | —                                                                                                                                                                          | status, AI provider (+ `isMock`), storage kind, knowledge record count                                |
| `GET /demo/info`               | —                                                                                                                                                                          | example questions, sample complaint scenario (fictional)                                              |
| `POST /assistant/chat`         | `message` (≤1000 chars), `language`, `history[]` (≤6), `profile{state, workCategory}`                                                                                      | `answer`, `followUpQuestions`, `citations[]`, `couldNotVerify`, `emergency`, `provider`, `disclaimer` |
| `GET /earnings/entries`        | `from`, `to` (YYYY-MM-DD)                                                                                                                                                  | `entries[]`                                                                                           |
| `POST /earnings/entries`       | `date`, `category`, `platform?`, `hoursWorked`, `basePay`, `tips`, `bonuses`, `incentives`, `expenses`, `deductions`, `notes?`                                             | `201 { entry }`                                                                                       |
| `PATCH /earnings/entries/:id`  | any subset of the above                                                                                                                                                    | `{ entry }` / 404                                                                                     |
| `DELETE /earnings/entries/:id` | —                                                                                                                                                                          | 204 / 404                                                                                             |
| `GET /earnings/summary`        | `period=day\|week\|month`, `anchor?`                                                                                                                                       | `totals`, `series`, `anomalies`, `formulas`, `dataNotice`                                             |
| `GET /earnings/export.csv`     | —                                                                                                                                                                          | CSV of the caller's entries                                                                           |
| `POST /earnings/explain`       | `language`, `period`                                                                                                                                                       | AI narration of computed totals + flagged entries                                                     |
| `GET /knowledge/sources`       | —                                                                                                                                                                          | every curated record with scope, sources, review status, limitations                                  |
| `POST /schemes/search`         | `language`, `state?`, `workCategory?`, `ageRange?`, `hasEShramCard?`, `hasBankAccount?`, `query?`                                                                          | `results[]` with label, benefit, eligibility, documents, steps, `applyUrl`, citation                  |
| `POST /documents/checklist`    | `language`, `purpose`                                                                                                                                                      | curated checklist + plain-language explanation                                                        |
| `POST /documents/draft`        | `language`, `kind`, `details`, `workerName?`                                                                                                                               | draft labelled as a draft                                                                             |
| `POST /grievances/draft`       | `language`, `facts{type, platformOrEmployer, whatHappened, incidentDate?, amountRupees?, stepsAlreadyTaken?, evidenceAvailable[], desiredResolution?}`, `saveWithConsent?` | structured draft; `201` + `id` only when consent was given                                            |
| `GET /grievances`              | —                                                                                                                                                                          | the caller's saved drafts                                                                             |
| `PATCH /grievances/:id`        | `status?`, `subject?`, `finalMessage?`                                                                                                                                     | `{ grievance }` / 404                                                                                 |
| `DELETE /grievances/:id`       | —                                                                                                                                                                          | 204 / 404                                                                                             |
| `DELETE /me/data`              | —                                                                                                                                                                          | counts of deleted earnings and complaints                                                             |

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
  helpers; production configuration guards; frontend error mapping and translation fallbacks.
- **Integration** — mock-provider chat in Hindi with citations; missing and invalid fields; provider outage and
  timeout (503); rate limiting (429); CSRF and CORS; oversized and malformed bodies; earnings CRUD + summary +
  CSV; **cross-user access prevention** and forged cookies; demo/guest separation; scheme search with citations;
  complaint drafting without invented facts and consent-only storage; prompt-injection attempts; Aadhaar-like
  extra fields rejected; the same ownership, NoSQL-injection and retention checks against real MongoDB.
- **End-to-end** — demo mode opens; switch to Hindi and ask a question; emergency banner; add an earnings entry
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
- Set `ALLOW_DEMO_MODE=false` for a real-user deployment, or clearly keep it a demo site.
- Put the API behind a reverse proxy that sets `X-Forwarded-For` (the app trusts one proxy hop in production).
- Read [SECURITY.md](SECURITY.md) before any public deployment: the anonymous session model is **not** account
  authentication.

---

## Known limitations

- **No accounts.** Each browser gets an anonymous, signed, HttpOnly session cookie. Clearing cookies or
  switching devices loses access to that data. Real accounts (for example phone OTP through an established
  provider) are future work.
- **Knowledge is a small seed set** (13 records: 5 schemes, 8 rights/safety topics). Links are checked by a
  tool; the content still needs review by a person against the official pages. Only Punjab has a
  state-specific record (BOCW welfare board); other states get central schemes plus general guidance.
- **Mock AI is not an AI.** It assembles replies from the retrieved records and computed numbers, and does not
  translate source text. Record summaries are in English, so with the mock provider a Hindi answer contains
  Hindi framing around English record text. Real Claude responses fully localise.
- **Real Claude integration has not been exercised in this environment** (no API key was available). The
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

**How AI is used — and where it is not.** Claude does the language work: understanding Romanised Hindi,
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
