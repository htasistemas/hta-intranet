import { rm } from "node:fs/promises";
import type { Request, Response } from "express";
import { z } from "zod";
import { BackupService } from "../services/backup.service.js";
import { ApiError } from "../utils/api-error.js";

const backupEnvironmentSchema = z.object({
  environment: z.enum(["development", "production"]).default("development")
});

const restoreQuerySchema = z.object({
  environment: z.enum(["development", "production"]).default("development")
});

const restoreHeadersSchema = z.object({
  "x-backup-filename": z.string().trim().min(5),
  "x-restore-confirmation": z.literal("RESTAURAR")
});

export class BackupController {
  public constructor(private readonly service = new BackupService()) {}

  public create = async (request: Request, response: Response): Promise<void> => {
    const { environment } = backupEnvironmentSchema.parse(request.body ?? {});
    const backup = await this.service.createBackup(environment);
    response.download(backup.filePath, backup.fileName, async (error) => {
      await rm(backup.filePath, { force: true });
      if (error) console.error(error);
    });
  };

  public restore = async (request: Request, response: Response): Promise<void> => {
    if (!Buffer.isBuffer(request.body)) throw new ApiError(422, "Envie o arquivo .dump em application/octet-stream.");
    const { environment } = restoreQuerySchema.parse(request.query);
    const headers = restoreHeadersSchema.parse(request.headers);
    response.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
    response.setHeader("Cache-Control", "no-cache");
    response.flushHeaders();

    const send = (event: { type: "info" | "error" | "success"; message: string }) => {
      response.write(`${JSON.stringify(event)}\n`);
    };

    try {
      await this.service.restoreBackupWithProgress(environment, headers["x-backup-filename"], request.body, send);
      response.end();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao restaurar backup.";
      send({ type: "error", message });
      response.end();
    }
  };
}
