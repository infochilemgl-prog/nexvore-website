import type { NextFunction, Request, Response } from "express";
import { HttpError } from "./error-handler";

/**
 * Ensures the authenticated user's organizationId is what every downstream
 * route/service uses for scoping -- routes must never trust an
 * organizationId passed in the request body/query for a write operation.
 */
export function tenantContext(req: Request, _res: Response, next: NextFunction) {
  if (!req.user?.organizationId) {
    return next(new HttpError(401, "Contexto de organizacion no disponible."));
  }
  next();
}

export function currentOrgId(req: Request): string {
  if (!req.user?.organizationId) throw new HttpError(401, "No autenticado.");
  return req.user.organizationId;
}
