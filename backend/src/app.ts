import cors from "cors";
import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { apiRouter } from "./routes/index.js";
import { env } from "./utils/env.js";
import { errorHandler, notFound } from "./middleware/error-handler.js";

export const app = express();

app.use(helmet());
app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
app.use(express.json({ limit: "12mb" }));
app.use(rateLimit({ windowMs: 60 * 1000, limit: 180, standardHeaders: true, legacyHeaders: false }));
app.get("/", (_request, response) => response.json({
  name: "Torresoft API",
  status: "online",
  health: "/health",
  documentation: "/api/docs",
  frontend: env.FRONTEND_URL
}));
app.get("/health", (_request, response) => response.json({ status: "ok" }));
app.use("/api", apiRouter);
app.use(notFound);
app.use(errorHandler);
