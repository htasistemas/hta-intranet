import type { RequestHandler } from "express";
import { ApiError } from "../utils/api-error.js";

export const requireAdmin: RequestHandler = (request, _response, next) => {
  if (request.auth?.role !== "ADMIN") {
    next(new ApiError(403, "Acesso restrito a administradores."));
    return;
  }
  next();
};
