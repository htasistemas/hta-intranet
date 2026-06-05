import type { ErrorRequestHandler, RequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error.js";

export const notFound: RequestHandler = (_request, _response, next) => {
  next(new ApiError(404, "Rota nao encontrada."));
};

export const errorHandler: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
  if (error instanceof SyntaxError && "body" in error) {
    response.status(400).json({ message: "JSON malformado." });
    return;
  }
  if (error instanceof ZodError) {
    response.status(422).json({ message: "Dados invalidos.", issues: error.flatten() });
    return;
  }
  if (error instanceof ApiError) {
    response.status(error.statusCode).json({ message: error.message, details: error.details });
    return;
  }
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    response.status(409).json({ message: "Registro duplicado.", fields: error.meta?.target });
    return;
  }
  console.error(error);
  response.status(500).json({ message: "Erro interno do servidor." });
};
