import rateLimit from "express-rate-limit";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis as UpstashRedis } from "@upstash/redis";
import type { NextFunction, Request, Response } from "express";
import { env, useUpstashRedis } from "../config/env";
import { logger } from "../config/logger";

// --- Rate limiting: in-memory (express-rate-limit) vs. Upstash Redis ------
// The original implementation used express-rate-limit's default in-memory
// store only. That is correct for a persistent server (one long-lived
// process, one counter in memory) but is NOT correct on Vercel: a
// serverless function has no shared memory across invocations, and
// concurrent requests can land on entirely separate, short-lived instances
// that each start counting from zero. So the "300 requests/min" limit would
// actually be "300 requests/min per cold-started instance", which isn't a
// real limit at all under any real traffic.
//
// When Vercel's KV integration is configured (KV_REST_API_URL/TOKEN) this
// swaps to `@upstash/ratelimit` (a sliding-window counter backed by
// `@upstash/redis`'s REST client), which is shared across every
// invocation/instance because the counter lives in Redis, not in process
// memory. When KV isn't configured (local/docker-compose dev, or the
// persistent-server deployment path) it falls back to the original
// in-memory express-rate-limit behavior, which is correct there.
const upstashRedis = useUpstashRedis
  ? new UpstashRedis({ url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN })
  : null;

interface RateLimitOptions {
  windowMs: number;
  limit: number;
  keyPrefix: string;
  keyGenerator?: (req: Request) => string;
  message: string;
}

function buildRateLimit(opts: RateLimitOptions) {
  if (upstashRedis) {
    const limiter = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(opts.limit, `${opts.windowMs} ms`),
      prefix: `ratelimit:${opts.keyPrefix}`,
      analytics: false,
    });

    return async (req: Request, res: Response, next: NextFunction) => {
      const identifier = opts.keyGenerator ? opts.keyGenerator(req) : String(req.ip ?? "unknown");
      try {
        const result = await limiter.limit(identifier);
        res.setHeader("RateLimit-Limit", String(result.limit));
        res.setHeader("RateLimit-Remaining", String(result.remaining));
        res.setHeader("RateLimit-Reset", String(result.reset));
        if (!result.success) {
          return res.status(429).json({ error: opts.message });
        }
        return next();
      } catch (err) {
        // Fail OPEN on a Redis/Upstash outage -- an unavailable rate
        // limiter should not take down the whole API. Logged so it's
        // visible, never silently retried against the DB/model instead.
        logger.warn({ err, keyPrefix: opts.keyPrefix }, "Upstash rate limiter no disponible, dejando pasar la solicitud");
        return next();
      }
    };
  }

  return rateLimit({
    windowMs: opts.windowMs,
    limit: opts.limit,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: opts.keyGenerator,
    message: { error: opts.message },
  });
}

export const apiRateLimit = buildRateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  keyPrefix: "api",
  message: "Demasiadas solicitudes, intenta de nuevo en un minuto.",
});

export const authRateLimit = buildRateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  keyPrefix: "auth",
  message: "Demasiados intentos de autenticacion, intenta de nuevo en un minuto.",
});

// 30/min per WhatsApp number (keyed by the "From" field in the webhook body).
export const whatsappPerNumberRateLimit = buildRateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  keyPrefix: "wa-number",
  keyGenerator: (req) => String(req.body?.From ?? req.ip ?? "unknown"),
  message: "rate_limited",
});

// 100/min per property (keyed by resolved property in body, fallback to ip).
export const whatsappPerPropertyRateLimit = buildRateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  keyPrefix: "wa-property",
  keyGenerator: (req) => String(req.body?.To ?? req.ip ?? "unknown"),
  message: "rate_limited",
});
