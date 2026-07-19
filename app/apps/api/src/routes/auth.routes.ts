import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../utils/prisma";
import { signToken, requireAuth } from "../middleware/auth";
import { authRateLimit } from "../middleware/rate-limit";
import { HttpError } from "../middleware/error-handler";

export const authRouter = Router();

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(6) });

authRouter.post("/login", authRateLimit, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.active) throw new HttpError(401, "Credenciales invalidas.");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new HttpError(401, "Credenciales invalidas.");
    const token = signToken({ id: user.id, organizationId: user.organizationId, role: user.role, email: user.email });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId } });
  } catch (err) {
    next(err);
  }
});

authRouter.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new HttpError(404, "Usuario no encontrado.");
    res.json({ id: user.id, name: user.name, email: user.email, role: user.role, organizationId: user.organizationId });
  } catch (err) {
    next(err);
  }
});
