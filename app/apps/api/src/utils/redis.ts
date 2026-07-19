import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { env, useUpstashRedis } from "../config/env";
import { logger } from "../config/logger";

// --- Redis client selection --------------------------------------------
// Two genuinely different clients, not an alias of one another:
//
// - `@upstash/redis` (`upstash` below): an HTTPS REST client. This is what
//   actually works from inside a Vercel serverless function -- there is no
//   long-lived TCP connection to hold open. Used whenever Vercel's KV
//   integration vars (KV_REST_API_URL/KV_REST_API_TOKEN) are present.
// - `ioredis` (`redis` below): a raw TCP client. Kept for local/docker
//   dev and for the persistent-server deployment path (`npm run worker` /
//   `npm run dev:api` without KV vars set), since BullMQ (jobs/queue.ts)
//   fundamentally requires a real TCP Redis connection -- it cannot run
//   over a REST API at all, on Vercel or anywhere else.
//
// Simple key/value and lock operations (this file) run against whichever
// client is active. BullMQ (jobs/queue.ts) always uses `ioredis`/REDIS_URL,
// regardless of which mode this file is in, because it has no REST-client
// option.
export const redis = useUpstashRedis
  ? null
  : new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 2,
      lazyConnect: false,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });

if (redis) {
  redis.on("error", (err) => {
    logger.warn({ err: err.message }, "Redis connection error");
  });
}

const upstash = useUpstashRedis
  ? new UpstashRedis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN })
  : null;

if (useUpstashRedis) {
  logger.info("utils/redis: usando @upstash/redis (REST) -- modo serverless/Vercel");
} else {
  logger.info("utils/redis: usando ioredis (TCP) -- modo persistente/local");
}

// Lua script for an atomic "delete only if I still own the lock" release.
// Both clients support server-side Lua eval, just with a different call
// shape (ioredis: numkeys + flat args; @upstash/redis: keys[] and args[]
// arrays), which is why the two branches below aren't just one function
// with a swapped-out client.
const RELEASE_SCRIPT =
  'if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end';

/**
 * Simple distributed lock (SET NX PX + Lua-guarded release). Used to
 * serialize reservation creation per unit+date-range so two concurrent
 * bookings can't both pass the availability check and double-book a unit.
 */
export async function withRedisLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lockKey = `lock:${key}`;

  const acquired = useUpstashRedis
    ? (await upstash!.set(lockKey, token, { nx: true, px: ttlMs })) !== null
    : (await redis!.set(lockKey, token, "PX", ttlMs, "NX")) === "OK";

  if (!acquired) {
    throw new Error(`No se pudo adquirir el lock para "${key}" (otra operacion esta en curso).`);
  }
  try {
    return await fn();
  } finally {
    // Release only if we still own it.
    if (useUpstashRedis) {
      await upstash!.eval(RELEASE_SCRIPT, [lockKey], [token]).catch(() => undefined);
    } else {
      await redis!.eval(RELEASE_SCRIPT, 1, lockKey, token).catch(() => undefined);
    }
  }
}
