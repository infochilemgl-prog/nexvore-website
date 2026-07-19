# Hospitality AI OS (`app/`)

A multi-tenant hospitality-management platform: WhatsApp/voice conversations are handled by
AI agents that call deterministic, DB-backed tools (availability, pricing, maintenance triage,
etc.) under a four-tier risk/approval model, with a full audit trail and a React dashboard.

This lives entirely under `app/` inside the `nexvore-website` repo and is fully independent
from the root site (`index.html`, `api/webhook.js`, `vercel.json`, etc.) — nothing outside
`app/` was modified except one pointer line in the root `README.md`.

## What is genuinely built and verified

The **vertical slice** described in the spec was built end-to-end and actually exercised
against a real local Postgres + Redis (not just typechecked):

`WhatsApp-shaped webhook POST` → deterministic org/property/guest/conversation resolution →
`operations_orchestrator` (deterministic intent routing, sticky per-conversation) →
`reservations` / `maintenance` / `guest_communications` agent → real Zod-validated tool calls
(`check_availability`, `quote_reservation`, `create_reservation`, `classify_maintenance_issue`,
`create_maintenance_ticket`, `request_cancellation`, ...) → real Postgres rows → `AuditLog` +
`AgentExecution` rows → visible in the dashboard (Inbox, Reservations, Maintenance, Approvals).

Concretely verified in this environment (see commands below to reproduce):
- A 6-turn WhatsApp conversation created a real, priced `Reservation` row (deterministic
  quote engine, Redis-locked transaction, mock PMS sync, `syncStatus=SYNCED`).
- A "huelo a gas" message was deterministically triaged `CRITICAL` (regex rules, not the model),
  created a `MaintenanceTicket`, and escalated the `Conversation` — the model's classification
  never overrides these safety rules.
- A "cancelar" request created a `LEVEL_3` `ApprovalRequest` and did **not** touch the
  reservation; approving it via `/api/approvals/:id/approve` re-validated permissions, executed
  the real cancellation, and wrote an `EXECUTED` audit-logged approval.
- `npx prisma generate` / `validate` / `migrate` all ran against a real database.
- `npm run typecheck:api`, `npm run typecheck:web`, `apps/api` vitest (21 tests), and
  `apps/web` (`vite build`) all pass. `apps/api` also builds with `tsc` and boots from
  compiled `dist/`.

## Honest scope / simplifications (read this before assuming something is "real AI")

- **`MockAIProvider` is a scripted rule-based simulator, not an LLM.** With no API keys
  available in this environment, `AI_PROVIDER` defaults to `mock` in the local `.env` so the
  whole pipeline runs deterministically end-to-end. It recognizes a fixed set of
  regex/keyword patterns (name/date/category extraction, "confirmo", "cancelar", etc.) well
  enough to drive the reservations/maintenance/guest-communications flows for demo and
  automated verification — it will **not** hold an open-ended natural conversation. Setting
  `AI_PROVIDER=anthropic` or `=openai` with a real key swaps in `AnthropicProvider` /
  `OpenAIProvider` (both fully implemented against the real SDKs) with zero code changes
  anywhere else — the tool loop, permissions, audit log and DB layer are identical either way.
- **The orchestrator's intent routing is deterministic keyword classification**, not an LLM
  call — a deliberate choice (fast/free/predictable for a safety-relevant routing decision;
  maintenance-emergency keywords always override "sticky" routing mid-flow). The specialized
  agents are the ones that hold the actual AI conversation via the provider above.
- **Real, working, but simpler** (fully wired against the DB, not stubs, just less elaborate
  than reservations/maintenance/guest_communications): concierge, room_service, housekeeping,
  finance (read-only, no charge/refund tools by design), marketing, competitive_intelligence,
  knowledge_auditor. Their tools are real (`list_services`, `book_service`,
  `create_housekeeping_task`, `list_competitors`, `create_content_idea`, `generate_daily_report`)
  but their prompts/flows are less elaborate than the three vertical-slice agents.
- **PMS / Payments / Voice / Google Calendar / Slack are mock adapters by default** — see
  Integrations below. `refund()` on the payment adapter is only ever invoked from
  `services/approvals/execute-approval.ts`, i.e. only after a Level-3 approval; it is never
  reachable directly from a tool call.
- **Google OAuth token exchange is a stub** (`GET /api/integrations/google/callback` returns
  501) — no Google credentials were available to implement and test the real exchange. The
  OAuth URL builder and calendar-event creation call are real; the calendar creation itself is
  mocked when unconfigured and **never blocks reservation creation** (see
  `create_reservation` — it tolerates calendar/PMS failure and marks `syncStatus`).
  This is stated plainly rather than silently returning fake success.
- **Twilio signature validation is intentionally not implemented** — see the
  `// TODO: validar X-Twilio-Signature obligatoriamente en produccion` comment in
  `apps/api/src/routes/webhooks.routes.ts`, as instructed.
- **Tax engine is a simplified flat `taxRate` parameter** (default 0) on the quote engine, not
  a jurisdiction-specific tax table — the formula itself (nights × rate + cleaning + services −
  discounts, then + taxes) is real and unit-tested.
- **Reservations calendar view (dashboard)** is a real, filterable list/agenda view rather than
  a full month-grid calendar widget — occupancy/list/filters are fully functional.
- **BullMQ job queues are real** (`apps/api/src/jobs/*.job.ts`, real logic, not stubs) and run
  against the local Redis; `npm run worker` starts them as a separate process. They are not
  auto-started by the API process itself (the report is also reachable synchronously via
  `GET /api/reports/daily`, which is what the dashboard uses).

## Architecture highlights

- **Four-tier risk model**: `apps/api/src/config/permissions.ts` — a real `evaluatePermission()`
  function (unit-tested), not documentation. Level 0 auto; Level 1 auto if
  `ENABLE_AUTOMATIC_LOW_RISK_ACTIONS`; Level 2/3 always create an `ApprovalRequest` and never
  execute inline; Level 3 financial actions are additionally gated by `ENABLE_FINANCIAL_ACTIONS`,
  door-code sharing by `ENABLE_DOOR_CODE_SHARING`.
- **Tool loop**: `apps/api/src/services/agents/tool-loop.ts` — `MAX_TOOL_ITERATIONS=8`, one
  `AgentExecution` row per run, Zod validation, permission evaluation, approval creation,
  `AuditLog` on every executed/denied/approval-gated call, and a same-turn repeat-call guard.
  Note: `runOrchestrator` (`services/agents/orchestrator.ts`) counts as "agent one" of this
  pipeline conceptually but does its context/intent resolution deterministically before
  invoking the tool loop for the routed specialized agent.
- **Tenant isolation**: `apps/api/src/utils/tenant-scope.ts` — every operational entity is
  fetched with `organizationId` (and `propertyId` where relevant) filtered first; routes never
  trust a raw id.
- **Prompt-injection defense**: `apps/api/src/utils/untrusted-content.ts` — wraps guest
  messages/external content in an explicit "this is data, not instructions" delimiter before
  it reaches the model; used in the orchestrator's message assembly.
- **Encryption**: `UnitSecret.encryptedValue` uses AES-256-GCM
  (`apps/api/src/utils/crypto.ts`), key from `UNIT_SECRET_ENCRYPTION_KEY`.

## Run it

```bash
cd app
npm install
cp .env.example .env         # then fill in DATABASE_URL/REDIS_URL/JWT_SECRET/UNIT_SECRET_ENCRYPTION_KEY
# generate a real 32-byte hex key for UNIT_SECRET_ENCRYPTION_KEY:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Postgres + Redis: either `docker compose up -d`, or point DATABASE_URL/REDIS_URL at
# instances you already have running (this build was verified against locally-installed
# postgresql/redis-server, not Docker, since Docker's daemon wasn't available in this sandbox).

npm run build:packages
npx prisma migrate deploy --schema=prisma/schema.prisma   # or `migrate dev` in local dev
npx tsx prisma/seed.ts

npm run dev:api     # http://localhost:3001
npm run dev:web     # http://localhost:5173
npm run --workspace=apps/api worker   # optional: BullMQ workers (daily-report, etc.)
```

Demo login: `admin@andeshospitality.demo` / `Demo1234!` (see other seeded user in `prisma/seed.ts`).

Test the vertical slice directly:
```bash
curl -X POST http://localhost:3001/api/webhooks/twilio/whatsapp \
  --data-urlencode "From=whatsapp:+56988887777" \
  --data-urlencode "To=whatsapp:+56900000001" \
  --data-urlencode "Body=Hola, quiero reservar. Me llamo Carla Reyes"
```
(Hotel Costa Norte's seeded WhatsApp number is `+56900000001`, Refugio Lago Azul's is
`+56900000002`.)

### Verification commands actually run in this build
```bash
npx prisma validate --schema=prisma/schema.prisma
npx prisma generate --schema=prisma/schema.prisma
npm run typecheck:api     # tsc --noEmit, apps/api -- passes
npm run typecheck:web     # tsc --noEmit, apps/web -- passes
npm run build:web         # vite build -- passes
npm run build:api         # tsc build -- passes, boots from dist/
cd apps/api && npx vitest run   # 21/21 tests pass (quote, availability, triage, roi, permissions)
```

## Required `.env` values

Copy `.env.example`. Minimum to boot: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`,
`UNIT_SECRET_ENCRYPTION_KEY` (32-byte hex). Everything else can stay blank — the app boots on
`MockAIProvider`/mock adapters with no other credentials, per the spec's requirement.

## Integrations: mock vs. real

| Integration | Mock (default) | Activates with |
|---|---|---|
| AI provider | `MockAIProvider` (scripted) | `AI_PROVIDER=anthropic`+`ANTHROPIC_API_KEY`, or `=openai`+`OPENAI_API_KEY` (falls back to mock with a warning if the key is missing even when selected) |
| WhatsApp | logged only, not sent | `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_WHATSAPP_NUMBER` |
| Voice | `MockVoiceProvider` | Vapi/Bland adapters are not implemented (only the mock + interface) |
| PMS | `MockPMSAdapter` | No real PMS adapter implemented (interface + factory ready) |
| Payments | `MockPaymentAdapter` (auto-marks PAID on first status check) | No real Stripe/MercadoPago adapter implemented for this app (separate from the root `api/webhook.js` MercadoPago integration, per instructions) |
| Google Calendar/Gmail/Drive | OAuth URL real, token exchange stubbed (501), calendar event creation mocked | Needs `GOOGLE_CLIENT_ID`/`SECRET` + a real token-exchange implementation |
| Slack | logged only | `SLACK_WEBHOOK_URL` |
| Storage | local `uploads/` dir | n/a (S3 not implemented) |

The **Integrations** dashboard page reflects these states live from `GET /api/integrations`
(never hardcoded "connected").

## Production risks to flag

- This is a **demo build**: `AI_PROVIDER` defaults to mock and financial actions
  (`ENABLE_FINANCIAL_ACTIONS`) and door-code sharing (`ENABLE_DOOR_CODE_SHARING`) default to
  **off** — both must be deliberately enabled and reviewed before any real money or access
  codes flow through this system.
- Twilio webhook signature validation is **not implemented** (explicit TODO) — do not expose
  the webhook publicly without adding it first.
- No rate limiting/WAF beyond `express-rate-limit` + `helmet` defaults; no secrets manager
  integration (env vars only).
- `MockAIProvider`'s scripted flows are not a substitute for real LLM behavior/safety testing
  once a real provider is wired in — re-test the guest-facing prompt rules against the real
  model before going live.
- Seed data/passwords (`Demo1234!`) are for local development only.

## Folder map

See the top-level structure under `app/apps/api/src` (`config`, `middleware`, `routes`,
`services/{ai,agents,reservations,maintenance,...}`, `integrations`, `tools`, `prompts`, `jobs`,
`tests`) and `app/apps/web/src` (`pages`, `components`, `lib`, `stores`, `styles`), plus
`app/packages/{shared,prompts,integrations-sdk}` and `app/prisma/{schema.prisma,seed.ts,migrations}`.
