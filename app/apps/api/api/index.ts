import { createApp } from "../src/app";

/**
 * Vercel serverless entrypoint for the API. Wired up via `app/vercel.json`
 * (`functions` + `rewrites` -- see that file's comments) since this file
 * lives at `apps/api/api/index.ts`, not at the project root's `api/`, so it
 * is not picked up by Vercel's zero-config API-routes convention.
 *
 * This exports the exact same Express app (`createApp()`, from
 * `apps/api/src/app.ts`) used by the persistent-server entrypoint
 * (`apps/api/src/index.ts`) -- every route, every middleware, every service
 * function is 100% shared code. Nothing here re-implements anything.
 *
 * What's deliberately NOT wired up in this file, because it fundamentally
 * cannot run inside a stateless, request-scoped serverless function (see
 * the repo README's "Limitaciones en Vercel" section for the full
 * explanation):
 *
 *   - Socket.IO: needs a persistent WebSocket connection held open
 *     server-side. `src/index.ts` (the persistent-server entrypoint) still
 *     sets one up for non-Vercel deployments. On Vercel, the dashboard's
 *     actual live-update mechanism is (and, examined honestly, already
 *     was) TanStack Query polling (`refetchInterval`) -- no frontend code
 *     ever actually opened a socket.io-client connection to begin with, so
 *     nothing that previously worked stops working here.
 *   - BullMQ workers (`npm run worker`, `src/worker.ts`): a long-lived
 *     queue consumer can't run inside a request handler that returns after
 *     each invocation. The same job logic those workers call
 *     (`jobs/*.job.ts`'s `run*` functions) is invoked directly and
 *     synchronously by the `/api/cron/*` routes below (mounted inside
 *     `createApp()`), triggered on a schedule by Vercel Cron
 *     (`vercel.json`'s `crons` array) instead of by a queue.
 *
 * Prisma: `utils/prisma.ts` caches a single `PrismaClient` on `globalThis`
 * so a warm serverless container reuses one connection pool across
 * invocations instead of opening a fresh one on every request -- see that
 * file's comments for the full explanation and the pooled-vs-direct
 * `DATABASE_URL` note.
 */
const app = createApp();

export default app;
