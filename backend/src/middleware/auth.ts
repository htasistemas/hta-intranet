import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../utils/env.js";
import { ApiError } from "../utils/api-error.js";

const tokenPayloadSchema = z.object({
  sub: z.string(),
  email: z.string().email(),
  role: z.enum(["ADMIN", "MANAGER", "USER", "PARTNER"]),
  partnerId: z.string().nullable().optional()
});

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.headers.authorization;
  if (!authorization?.startsWith("Bearer ")) {
    next(new ApiError(401, "Token de autenticacao ausente."));
    return;
  }

  try {
    const token = authorization.slice(7);
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const payload = tokenPayloadSchema.parse(decoded);
    request.auth = { userId: payload.sub, email: payload.email, role: payload.role, partnerId: payload.partnerId ?? null };
    next();
  } catch {
    next(new ApiError(401, "Token invalido ou expirado."));
  }
};
