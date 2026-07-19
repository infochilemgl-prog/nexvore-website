import { PrismaClient } from "@prisma/client";
import { env } from "../config/env";

// --- Prisma-on-serverless singleton ---------------------------------------
// A Vercel serverless function invocation is a fresh Node.js execution
// context; it can NOT keep a long-lived connection pool open across requests
// the way `apps/api/src/index.ts`'s persistent server does. Two invocations
// running concurrently would otherwise each construct their own
// `PrismaClient` (and thus their own Postgres connection pool), which
// quickly exhausts a normal Postgres connection limit under load.
//
// The standard fix (documented by both Vercel and Prisma) is to cache a
// single `PrismaClient` instance across invocations of the *same* warm
// lambda container by stashing it on `globalThis` -- a fresh cold start
// still creates a new client (that's unavoidable and fine), but a warm
// container reuses the exact same client/pool for every request it serves
// instead of recreating it every time. This also happens to fix the
// well-known `tsx watch` / ts-node-dev hot-reload problem in local dev,
// where re-evaluating this module on every file save would otherwise leak a
// new `PrismaClient`/pool on every save.
//
// IMPORTANT for the runtime `DATABASE_URL` on Vercel: use the *pooled*
// connection string (Vercel/Neon's `POSTGRES_PRISMA_URL`, which already has
// `?pgbouncer=true&connection_limit=1`-style params baked in) -- see
// config/env.ts for how that's resolved from Vercel's injected vars. Use
// the *direct* (non-pooled) URL -- `POSTGRES_URL_NON_POOLING` -- only for
// `prisma migrate deploy`, never for the app's runtime `DATABASE_URL`.
declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrismaClient();

// Cache on globalThis in every environment except a "real" production
// persistent-server boot, where a single process lives for the process
// lifetime anyway and there's no hot-reload/serverless-warm-container
// concern -- but caching there too is harmless, so we just always do it.
globalThis.__prisma = prisma;
