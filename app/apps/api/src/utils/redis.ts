import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "../config/logger";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 2,
  lazyConnect: false,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on("error", (err) => {
  logger.warn({ err: err.message }, "Redis connection error");
});

/**
 * Simple Redis-based distributed lock (SET NX PX). Used to serialize
 * reservation creation per unit+date-range so two concurrent bookings can't
 * both pass the availability check and double-book a unit.
 */
export async function withRedisLock<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const token = `${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const lockKey = `lock:${key}`;
  const acquired = await redis.set(lockKey, token, "PX", ttlMs, "NX");
  if (!acquired) {
    throw new Error(`No se pudo adquirir el lock para "${key}" (otra operacion esta en curso).`);
  }
  try {
    return await fn();
  } finally {
    // Release only if we still own it.
    const script = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`;
    await redis.eval(script, 1, lockKey, token).catch(() => undefined);
  }
}
