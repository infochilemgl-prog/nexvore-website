import dotenv from "dotenv";
import path from "node:path";
import { z } from "zod";

// Load .env from the current working directory first (normal case when the
// process is started from apps/api), then fall back to the monorepo root
// .env (app/.env) so `vitest`/tooling invoked from apps/api still finds it.
// dotenv.config() never overrides a variable that's already set, so this is
// safe to call twice.
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// --- Vercel Postgres / KV fallback resolution ---------------------------
// Vercel's "Postgres" storage integration (Neon-backed) injects
// POSTGRES_PRISMA_URL (pooled, pgbouncer-flavored -- use this one at
// runtime), POSTGRES_URL (also pooled, generic), and
// POSTGRES_URL_NON_POOLING (direct connection -- use this one only for
// running migrations, never for the request-serving app). None of these are
// named DATABASE_URL, so if DATABASE_URL isn't already set (local/docker
// dev sets it explicitly in .env) we derive it from whichever Postgres var
// Vercel actually provided. Prisma itself also still reads DATABASE_URL
// directly from prisma/schema.prisma's datasource block, so this must run
// before that client is constructed (i.e. here, before the zod parse below).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || "";
}

// Vercel's "KV" storage integration (Upstash-backed) injects KV_URL (a
// redis:// TCP URL -- NOT guaranteed reachable from serverless functions,
// Upstash's free/serverless tier is REST-only) plus KV_REST_API_URL /
// KV_REST_API_TOKEN (the HTTPS REST endpoint, which is what actually works
// from Vercel serverless functions). We only use KV_REST_API_URL/TOKEN
// (via @upstash/redis) for anything that runs inside a serverless request.
// REDIS_URL keeps its local/docker-compose meaning and is what BullMQ /
// `npm run worker` (persistent-server-only) still needs, since BullMQ
// requires a real TCP Redis connection that a REST API cannot provide.
if (!process.env.REDIS_URL && process.env.KV_URL) {
  process.env.REDIS_URL = process.env.KV_URL;
}

const boolFromString = z
  .string()
  .optional()
  .transform((v) => v === "true" || v === "1")
  .default("false");

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(3001),
  WEB_URL: z.string().default("http://localhost:5173"),
  PUBLIC_BASE_URL: z.string().default("http://localhost:3001"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL es obligatorio (o POSTGRES_PRISMA_URL/POSTGRES_URL en Vercel)"),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Raw Vercel-injected vars, kept around (not just folded into DATABASE_URL/
  // REDIS_URL above) so other code can tell exactly which flavor is active
  // and so the direct/non-pooled URL is available for migrations.
  POSTGRES_PRISMA_URL: z.string().optional().default(""),
  POSTGRES_URL: z.string().optional().default(""),
  POSTGRES_URL_NON_POOLING: z.string().optional().default(""),
  KV_URL: z.string().optional().default(""),
  KV_REST_API_URL: z.string().optional().default(""),
  KV_REST_API_TOKEN: z.string().optional().default(""),
  KV_REST_API_READ_ONLY_TOKEN: z.string().optional().default(""),

  // Shared secret Vercel Cron sends as `Authorization: Bearer <CRON_SECRET>`
  // when this env var is configured on the project. See routes/cron.routes.ts.
  CRON_SECRET: z.string().optional().default(""),

  JWT_SECRET: z.string().min(8, "JWT_SECRET debe tener al menos 8 caracteres"),
  JWT_EXPIRES_IN: z.string().default("7d"),

  AI_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional().default(""),
  ANTHROPIC_MODEL: z.string().optional().default(""),
  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().optional().default(""),

  TWILIO_ACCOUNT_SID: z.string().optional().default(""),
  TWILIO_AUTH_TOKEN: z.string().optional().default(""),
  TWILIO_WHATSAPP_NUMBER: z.string().optional().default(""),

  VOICE_PROVIDER: z.enum(["mock", "vapi", "bland"]).default("mock"),
  VAPI_API_KEY: z.string().optional().default(""),
  BLAND_API_KEY: z.string().optional().default(""),

  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_REDIRECT_URI: z.string().optional().default("http://localhost:3001/api/integrations/google/callback"),

  SLACK_WEBHOOK_URL: z.string().optional().default(""),

  PMS_PROVIDER: z.enum(["mock", "real"]).default("mock"),
  PMS_API_KEY: z.string().optional().default(""),
  PMS_BASE_URL: z.string().optional().default(""),

  PAYMENT_PROVIDER: z.enum(["mock", "stripe", "mercadopago"]).default("mock"),
  STRIPE_SECRET_KEY: z.string().optional().default(""),
  MERCADOPAGO_ACCESS_TOKEN: z.string().optional().default(""),

  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  UPLOAD_DIR: z.string().default("uploads"),

  DEFAULT_TIMEZONE: z.string().default("America/Santiago"),
  DEFAULT_LOCALE: z.string().default("es-CL"),

  ENABLE_AUTOMATIC_LOW_RISK_ACTIONS: boolFromString,
  ENABLE_FINANCIAL_ACTIONS: boolFromString,
  ENABLE_DOOR_CODE_SHARING: boolFromString,

  UNIT_SECRET_ENCRYPTION_KEY: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("Configuracion de entorno invalida:", parsed.error.flatten().fieldErrors);
  throw new Error("Fallo la validacion de variables de entorno (ver detalle arriba)");
}

export const env = parsed.data;

// The app must be able to boot even with a real provider selected but no key
// configured -- it falls back to the mock provider at the AI-provider factory
// level (see services/ai/provider-factory.ts), not here. This flag lets the
// rest of the app know whether the *selected* provider actually has usable
// credentials.
export const aiProviderHasCredentials =
  (env.AI_PROVIDER === "anthropic" && env.ANTHROPIC_API_KEY.length > 0) ||
  (env.AI_PROVIDER === "openai" && env.OPENAI_API_KEY.length > 0) ||
  env.AI_PROVIDER === "mock";

// When true, utils/redis.ts and middleware/rate-limit.ts use the
// @upstash/redis REST client (works over HTTPS from a serverless function)
// instead of `ioredis` (a raw TCP connection, which a Vercel serverless
// function cannot hold open the way a persistent server can).
export const useUpstashRedis = Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);

export type Env = typeof env;
