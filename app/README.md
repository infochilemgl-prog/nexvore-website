# Nexvore (`app/`)

A multi-tenant hospitality + restaurant reservations platform: WhatsApp/voice conversations are
handled by AI agents that call deterministic, DB-backed tools (availability, pricing,
maintenance triage, etc.) under a four-tier risk/approval model, with a full audit trail and a
React dashboard. "Nexvore" is the platform brand (dashboard title/nav, this README); it is not
guest-facing -- the AI persona a guest/comensal actually talks to (e.g. "Valentina") is a
per-organization configurable name (`BrandProfile.assistantName`), so each client business can
brand its own assistant differently. See "Restaurant / table reservations" below.

A restaurant is modeled as a `Property` with `propertyType: "RESTAURANT"`, a table is a `Unit`
with `category: "TABLE"`, and a table reservation is a `Reservation` whose `checkIn`/`checkOut`
span a short same-day window (default 120 minutes, `Property.reservationDurationMinutes`)
instead of multiple nights -- it reuses the exact same `Reservation`/`Unit`/availability/quote
engine as hotel stays, not a parallel system. See "Restaurant / table reservations" below for
what was specifically fixed/verified for this case.

This lives entirely under `app/` inside the `nexvore-website` repo and is fully independent
from the root site (`index.html`, `api/webhook.js`, `vercel.json`, etc.) — nothing outside
`app/` was modified except one pointer line in the root `README.md`.

## Restaurant / table reservations

The hotel-oriented reservation engine (`apps/api/src/services/reservations/`) was originally
written assuming whole-day granularity in two places, both fixed for the `RESTAURANT` case:

- `validateDateRange` gained a `granularity: "DATE" | "DATETIME"` parameter. `"DATE"` (hotel,
  unchanged default) only rejects a checkIn before the start of today, ignoring time-of-day.
  `"DATETIME"` (restaurant) rejects a checkIn earlier than the exact current instant, so a
  same-day slot that already elapsed (e.g. booking today 13:00 when it's already 15:00) is
  correctly rejected -- the coarse date-only check would have let it through.
- `computeQuote` gained a `pricingMode: "NIGHTLY" | "FLAT"` parameter. `"FLAT"` (restaurant)
  charges the unit's `basePrice` once as a flat/deposit fee (0 for a free reservation) instead
  of `nights * basePrice`, and omits zero-amount line items, so a 2-hour table booking never
  produces a "0 noche(s) x 0" or "Tarifa de aseo: 0" line.
- A new `validateRestaurantServiceWindow` rejects bookings outside `lunchOpen`/`lunchClose`/
  `dinnerOpen`/`dinnerClose` or on a `closedWeekdays` day (all new `Property` fields).
- The overlap check (`datesOverlap`) and per-unit capacity search (`findAvailableUnit`) needed
  **no changes** -- they already compare exact `Date` timestamps per-`unitId`, so multiple
  same-day table bookings across different tables were already handled correctly; only the
  coarse "is this in the past" check and the nights-based pricing assumed whole-day granularity.
- Unit-tested in `apps/api/src/tests/availability.test.ts` and `quote.test.ts`: same-day
  multi-table bookings, per-table overlap rejection, cross-table concurrency, DATETIME
  past-rejection, FLAT/free/paid quote breakdowns.

Verified live (not just typechecked) against a real local Postgres/Redis: `prisma db seed`
creates the `Demo Bistro` organization (3 tables, sample lunch/dinner reservations, sample
WhatsApp transcripts) alongside the original `Andes Hospitality` hotel/cabin demo, and a
webhook-driven conversation for Demo Bistro's WhatsApp number produces a real `Reservation` row
for the correct table with no overlap (see "Run it" below for the exact commands).

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
  `GET /api/reports/daily`, which is what the dashboard uses). On Vercel, where a long-lived
  worker process cannot run, the same job logic is instead invoked directly by
  `/api/cron/*` HTTP routes on a schedule via Vercel Cron — see **Desplegar en Vercel** below.

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

Demo login (Andes Hospitality, hotel/cabin vertical): `admin@andeshospitality.demo` / `Demo1234!`.
Demo login (Demo Bistro, restaurant vertical): `admin@demobistro.demo` / `Demo1234!` (see other
seeded users in `prisma/seed.ts`).

Test the hotel vertical slice directly:
```bash
curl -X POST http://localhost:3001/api/webhooks/twilio/whatsapp \
  --data-urlencode "From=whatsapp:+56988887777" \
  --data-urlencode "To=whatsapp:+56900000001" \
  --data-urlencode "Body=Hola, quiero reservar. Me llamo Carla Reyes"
```
(Hotel Costa Norte's seeded WhatsApp number is `+56900000001`, Refugio Lago Azul's is
`+56900000002`.)

Test the restaurant vertical slice directly (same webhook, different WhatsApp number -> routed
to Demo Bistro's `RESTAURANT` property, so the reservations agent uses the table-booking prompt
and the `MockAIProvider`'s restaurant flow -- name / party size / day / time / allergies, one at
a time, then recap+confirm):
```bash
curl -X POST http://localhost:3001/api/webhooks/twilio/whatsapp \
  --data-urlencode "From=whatsapp:+56977778888" \
  --data-urlencode "To=whatsapp:+56900000003" \
  --data-urlencode "Body=Hola, quiero reservar una mesa. Me llamo Pedro Alvarez"
```
(Demo Bistro Centro's seeded WhatsApp number is `+56900000003`.)

### Verification commands actually run in this build
```bash
npx prisma migrate dev --schema=prisma/schema.prisma   # applied the restaurant-support migration
npx prisma generate --schema=prisma/schema.prisma
npm run typecheck:api     # tsc --noEmit, apps/api -- passes
npm run typecheck:web     # tsc --noEmit, apps/web -- passes
npm run build:web         # vite build -- passes, dist/index.html title is "Nexvore"
npm run build:api         # tsc build -- passes, boots from dist/
cd apps/api && npx vitest run   # 36/36 tests pass (quote, availability, triage, roi, permissions --
                                 # 15 of the 36 are new: restaurant datetime-granularity overlap/
                                 # capacity/service-window tests + FLAT-pricing quote tests)
```

Also driven live against the real local Postgres/Redis (not just typechecked), after reseeding
`Demo Bistro` (see "Restaurant / table reservations" above): several multi-turn WhatsApp
conversations through `/api/webhooks/twilio/whatsapp` for Demo Bistro's number, inspecting the
resulting rows directly in Postgres --
- a full name→party-size→day→time→allergies→recap→confirm flow created a real `Reservation`
  (`totalAmount: 0`, correct `FLAT` pricing, correct table, correct 2-hour `checkIn`/`checkOut`);
- a second conversation for the **same day and time, same party size** was correctly assigned to
  a **different** table (cross-table concurrency working);
- a third conversation for that same exhausted slot was correctly **rejected** ("no hay
  disponibilidad", re-validated inside the transaction, no reservation row created);
- a booking attempt on a `closedWeekdays` day was correctly rejected before ever checking table
  availability.

Additionally verified when the Vercel adaptation (see **Desplegar en Vercel** below) was built: the
compiled `dist/index.js` persistent-server boot, the WhatsApp webhook vertical slice, and all five
`/api/cron/*` routes (auth rejection + real job execution against a real local Postgres/Redis) were
exercised directly with `curl` — not through an actual Vercel deployment (this sandbox cannot reach
`vercel.com`/`api.vercel.com`, so the real Vercel Cron scheduler, the real Vercel Postgres/Neon, and
the real Vercel KV/Upstash REST endpoint were never reached from here — see that section for exactly
what was verified live vs. by code/type inspection only). None of `vercel.json`, `apps/api/api/`,
`config/env.ts`, or the Prisma pooled/direct URL split were touched by the restaurant/rebrand work
in this change -- the serverless entrypoint shares the exact same `createApp()` Express app as the
persistent server, so the new schema/tools/prompts apply identically on both paths with zero
Vercel-specific changes needed.

## Desplegar en Vercel

Este proyecto puede desplegarse en Vercel, pero es un backend con estado (Postgres, colas,
WebSockets) corriendo sobre funciones serverless sin estado — algunas piezas se adaptaron
directamente, y otras tuvieron que rediseñarse o quedar documentadas como limitación conocida.
Lee **"Limitaciones en Vercel"** al final de esta sección antes de asumir que todo funciona igual
que en el servidor persistente.

### Pasos en el dashboard de Vercel

1. **Storage → Postgres**: crea (o conecta) una base de datos Postgres (respaldada por Neon) y
   conéctala al proyecto. Vercel inyecta automáticamente `POSTGRES_PRISMA_URL` (pooled,
   `pgbouncer=true` — úsala como `DATABASE_URL` en runtime), `POSTGRES_URL` y
   `POSTGRES_URL_NON_POOLING` (conexión directa — úsala **solo** para
   `prisma migrate deploy`, nunca como `DATABASE_URL` de la app en producción).
   `apps/api/src/config/env.ts` ya resuelve `DATABASE_URL` a partir de
   `POSTGRES_PRISMA_URL`/`POSTGRES_URL` si `DATABASE_URL` no está seteada explícitamente, así
   que normalmente no necesitas setear nada a mano aquí.
2. **Storage → KV**: crea (o conecta) un almacén KV (respaldado por Upstash Redis) y conéctalo
   al proyecto. Vercel inyecta `KV_URL`, `KV_REST_API_URL`, `KV_REST_API_TOKEN` y
   `KV_REST_API_READ_ONLY_TOKEN`. `KV_REST_API_URL`/`KV_REST_API_TOKEN` es lo que
   `apps/api/src/utils/redis.ts` y `middleware/rate-limit.ts` usan de verdad en Vercel (vía
   `@upstash/redis`, un cliente REST sobre HTTPS) — `KV_URL` es una URL `redis://` TCP que una
   función serverless no puede usar de forma confiable.
3. **Add New Project → import this repo → Root Directory = `app`**. Esto es obligatorio: el
   repo tiene un sitio estático no relacionado en la raíz, y todo este proyecto (workspaces npm,
   `vercel.json`, Prisma, etc.) vive bajo `app/`. Si dejas el Root Directory en blanco, Vercel
   intentará construir el sitio estático de la raíz, no esta app.
4. En **Project Settings → Environment Variables**, agrega (para Production y Preview según
   corresponda):
   - `JWT_SECRET` (string largo y aleatorio)
   - `UNIT_SECRET_ENCRYPTION_KEY` (32 bytes hex — `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `CRON_SECRET` (mismo generador de arriba) — Vercel adjunta automáticamente
     `Authorization: Bearer <CRON_SECRET>` a las peticiones GET que hace Vercel Cron cuando esta
     variable está seteada en el proyecto; `apps/api/src/routes/cron.routes.ts` la valida.
   - `AI_PROVIDER=anthropic` (o `openai`) + `ANTHROPIC_API_KEY` (u `OPENAI_API_KEY`) — sin esto
     el sistema sigue arrancando pero usa `MockAIProvider`.
   - `WEB_URL` / `PUBLIC_BASE_URL` apuntando al dominio real de Vercel una vez asignado.
   - Opcionales según qué integraciones actives: `TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/
     `TWILIO_WHATSAPP_NUMBER`, `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `SLACK_WEBHOOK_URL`,
     etc. — ver la tabla de integraciones más abajo.
   - No configures `DATABASE_URL`/`REDIS_URL` manualmente en Vercel salvo que quieras apuntar a
     un Postgres/Redis fuera de los productos Storage de Vercel — los fallbacks descritos arriba
     ya cubren el caso normal.
5. **Migraciones**: `prisma migrate deploy` necesita la URL **directa** (no pooled). Ejecútala
   localmente (o en un paso de CI) apuntando `DATABASE_URL` a `POSTGRES_URL_NON_POOLING`:
   `DATABASE_URL="$POSTGRES_URL_NON_POOLING" npx prisma migrate deploy --schema=prisma/schema.prisma`.
   El build de Vercel (`vercel-build`, ver `app/package.json`) solo corre `prisma generate`
   (no requiere conexión a la base), nunca `migrate deploy` — las migraciones son un paso
   manual/deliberado, no automático en cada deploy.
6. **Cron Jobs**: se activan solos a partir del arreglo `crons` en `app/vercel.json` — no hay un
   paso separado en el dashboard para "crear" cada cron job, Vercel los lee de ese archivo en
   cada deploy y los muestra en la pestaña **Cron Jobs** del proyecto. Lo único que el dueño debe
   confirmar/hacer manualmente es que `CRON_SECRET` esté seteado en las env vars del proyecto
   (paso 4) para que las peticiones estén protegidas, y revisar el plan de Vercel: **el plan
   Hobby limita los Cron Jobs a un máximo de 2 por proyecto y a una frecuencia mínima de una vez
   al día** — este proyecto define 5 jobs, uno de ellos (`follow-up`) horario, así que
   **funcionar tal cual como está configurado requiere plan Pro o superior**; en Hobby hay que
   recortar el arreglo `crons` a 2 entradas diarias como máximo antes de desplegar.

### Qué build produce Vercel

`app/vercel.json` fija `buildCommand: npm run vercel-build` (build de `packages/*`,
`prisma generate`, y `vite build` de `apps/web` → `apps/web/dist`) y `outputDirectory:
apps/web/dist` para el sitio estático (el dashboard React). La función serverless de la API vive
en `apps/api/api/index.ts` (exporta la misma app Express que usa el servidor persistente, ver ese
archivo) y está declarada en el bloque `functions` de `vercel.json` con `maxDuration: 60` (ajusta
este número según tu plan — Hobby sin Fluid Compute limita a 10s; revisa el límite real de tu
cuenta antes de asumir 60s). Los `rewrites` mandan `/api/*` a esa función y todo lo demás a
`index.html` (SPA de React Router).

### Limitaciones en Vercel (léelas antes de asumir que "ya funciona igual")

- **BullMQ / `npm run worker` no corre automáticamente.** Una función serverless de Vercel no
  puede mantener un proceso vivo haciendo polling sobre Redis. Los cinco jobs
  (`daily-report`, `knowledge-audit`, `competitor-audit`, `upsell`, `follow-up`) siguen siendo
  BullMQ-compatibles (`jobs/*.job.ts`, `npm run worker` sigue existiendo y sigue siendo la forma
  de correrlos como cola real en un host siempre-encendido fuera de Vercel), pero en el
  despliegue de Vercel se invocan en cambio como rutas HTTP (`/api/cron/*`) disparadas por
  Vercel Cron según el arreglo `crons` de `vercel.json` — la lógica real de cada job
  (`run*` functions) es exactamente la misma, solo cambia el disparador. Si en el futuro se
  necesita una cola *genuinamente* asíncrona (no solo un batch programado — p. ej. "encolar esto
  y procesarlo en 10 minutos"), eso **sigue necesitando** un worker BullMQ corriendo en un host
  persistente aparte (Railway, Fly.io, un VPS, etc.) apuntando al mismo Redis — el despliegue de
  Vercel por sí solo no lo cubre.
- **Socket.IO no corre en funciones serverless estándar de Vercel** — necesita mantener una
  conexión WebSocket abierta del lado del servidor, algo que un modelo de "invocación por
  request, sin estado" no soporta. Examinado con honestidad: en este build, el servidor de
  Socket.IO (`apps/api/src/index.ts`, solo usado en el modo persistente) nunca emitió ningún
  evento (`io.on("connection")` solo maneja `join-org`) y ningún componente del frontend abría
  jamás una conexión `socket.io-client` real hacia él pese a estar en `package.json` — así que
  no hay una funcionalidad "en vivo" real que se pierda al desplegar en Vercel. El mecanismo real
  de actualización del dashboard ya era, y sigue siendo, el *polling* de TanStack Query
  (`refetchInterval`); `apps/web/src/main.tsx` ahora fija un `refetchInterval` global de 20s por
  defecto (Inbox, Approvals, Maintenance y Overview ya usaban intervalos más cortos por página,
  que siguen teniendo prioridad). Si en algún momento se implementa push real por Socket.IO, esa
  pieza seguirá necesitando el modo servidor persistente (`npm run dev:api`/`npm start`, no
  Vercel) para funcionar.
- **Cold starts**: la primera petición después de un período sin tráfico puede tardar más
  (arranque en frío de la función + reconexión de Prisma) — normal en cualquier despliegue
  serverless, no es un bug.
- **Rate limiting**: en Vercel usa `@upstash/redis`/`@upstash/ratelimit` (compartido entre
  invocaciones, vía KV REST). Si `KV_REST_API_URL`/`KV_REST_API_TOKEN` no están configuradas, el
  rate limiting cae de vuelta al store en memoria de `express-rate-limit` — correcto para dev
  local/servidor persistente, pero **no confiable en Vercel** (cada instancia serverless tiene su
  propia memoria), así que no despliegues a Vercel sin conectar el producto KV.
- **Verificación de la ruta Upstash**: el cliente REST de `@upstash/redis`/`@upstash/ratelimit`
  fue verificado por inspección de código y contra los tipos (`.d.ts`) reales del SDK instalado
  (firma exacta de `.set(key, value, {nx, px})` y `.eval(script, keys, args)`), y el flujo
  completo (lock de reservas, jobs de cron, arranque del servidor) fue efectivamente probado en
  este sandbox contra Postgres/Redis locales reales — pero **no** contra un endpoint Upstash real
  ni contra el scheduler real de Vercel Cron, porque este sandbox no tiene salida de red hacia
  `vercel.com`/`api.vercel.com` ni (probablemente) hacia Upstash. Antes de confiar en producción,
  prueba al menos una vez el flujo completo contra el proyecto real de Vercel.

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
