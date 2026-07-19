import rateLimit from "express-rate-limit";

export const apiRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos de autenticacion, intenta de nuevo en un minuto." },
});

// 30/min per WhatsApp number (keyed by the "From" field in the webhook body).
export const whatsappPerNumberRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.From ?? req.ip ?? "unknown"),
  message: { error: "rate_limited" },
});

// 100/min per property (keyed by resolved property in body, fallback to ip).
export const whatsappPerPropertyRateLimit = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => String(req.body?.To ?? req.ip ?? "unknown"),
  message: { error: "rate_limited" },
});
