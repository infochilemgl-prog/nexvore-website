import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger";
import { TenantAccessError } from "../utils/tenant-scope";

export class HttpError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "No encontrado", path: req.path });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({ error: "Datos invalidos", details: err.flatten() });
  }
  if (err instanceof TenantAccessError) {
    return res.status(403).json({ error: err.message });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }
  const message = err instanceof Error ? err.message : "Error interno";
  logger.error({ err, requestId: req.requestId, path: req.path }, "Unhandled error");
  return res.status(500).json({ error: "Error interno del servidor", requestId: req.requestId, message });
}
