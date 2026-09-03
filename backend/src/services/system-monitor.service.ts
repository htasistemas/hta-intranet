import type { SystemMonitor, SystemMonitorStatus } from "@prisma/client";
import type { z } from "zod";
import { AuditRepository } from "../repositories/audit.repository.js";
import { SystemMonitorRepository } from "../repositories/system-monitor.repository.js";
import type { systemMonitorSchema } from "../validations/entities.validation.js";
import { ApiError } from "../utils/api-error.js";

type SystemMonitorInput = z.infer<typeof systemMonitorSchema>;

interface CheckResult {
  monitor: SystemMonitor;
  previousStatus: SystemMonitorStatus;
  alert: boolean;
}

const defaultMonitors: SystemMonitorInput[] = [
  { name: "Portal Torresoft", url: "https://torresoftbrasil.com.br", checkPath: "/", expectedStatus: 200, timeoutMs: 8000, active: true },
  { name: "Intranet Torresoft", url: "https://intranet.torresoftbrasil.com.br", checkPath: "/health", expectedStatus: 200, timeoutMs: 8000, active: true },
  { name: "G3N", url: "https://g3n.torresoftbrasil.com.br", checkPath: "/health", expectedStatus: 200, timeoutMs: 8000, active: true }
];

function targetUrl(monitor: Pick<SystemMonitor, "url" | "checkPath">): string {
  const url = new URL(monitor.url);
  url.pathname = monitor.checkPath;
  url.search = "";
  url.hash = "";
  return url.toString();
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Falha desconhecida ao consultar o sistema.";
}

export class SystemMonitorService {
  public constructor(
    private readonly repository = new SystemMonitorRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public async list(userId: string) {
    await this.ensureDefaults(userId);
    return this.repository.list(userId);
  }

  public async checkAll(userId: string): Promise<CheckResult[]> {
    await this.ensureDefaults(userId);
    const monitors = await this.repository.list(userId);
    const activeMonitors = monitors.filter((monitor) => monitor.active);
    return Promise.all(activeMonitors.map((monitor) => this.check(monitor, userId)));
  }

  public async checkOne(id: string, userId: string): Promise<CheckResult> {
    const monitor = await this.get(id, userId);
    if (!monitor.active) throw new ApiError(400, "Sistema monitorado esta inativo.");
    return this.check(monitor, userId);
  }

  public async get(id: string, userId: string): Promise<SystemMonitor> {
    const monitor = await this.repository.findById(id, userId);
    if (!monitor) throw new ApiError(404, "Sistema monitorado nao encontrado.");
    return monitor;
  }

  public async create(input: SystemMonitorInput, userId: string): Promise<SystemMonitor> {
    const existing = await this.repository.findByUrl(userId, input.url);
    if (existing) throw new ApiError(409, "Ja existe um sistema cadastrado com esta URL.");
    const monitor = await this.repository.create({ ...input, owner: { connect: { id: userId } } });
    await this.auditRepository.log({ userId, entity: "SystemMonitor", entityId: monitor.id, action: "CREATED" });
    return monitor;
  }

  public async update(id: string, input: SystemMonitorInput, userId: string): Promise<SystemMonitor> {
    await this.get(id, userId);
    const existing = await this.repository.findByUrl(userId, input.url);
    if (existing && existing.id !== id) throw new ApiError(409, "Ja existe um sistema cadastrado com esta URL.");
    const monitor = await this.repository.update(id, input);
    await this.auditRepository.log({ userId, entity: "SystemMonitor", entityId: id, action: "UPDATED" });
    return monitor;
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.repository.delete(id);
    await this.auditRepository.log({ userId, entity: "SystemMonitor", entityId: id, action: "DELETED" });
  }

  private async ensureDefaults(userId: string): Promise<void> {
    const total = await this.repository.count(userId);
    if (total > 0) return;
    await this.repository.transaction(async (tx) => {
      await Promise.all(defaultMonitors.map((monitor) => tx.systemMonitor.create({ data: { ...monitor, ownerId: userId } })));
    });
  }

  private async check(monitor: SystemMonitor, userId: string): Promise<CheckResult> {
    const startedAt = Date.now();
    const previousStatus = monitor.status;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), monitor.timeoutMs);
    try {
      const response = await fetch(targetUrl(monitor), {
        method: "GET",
        redirect: "follow",
        signal: controller.signal,
        headers: { "User-Agent": "Torresoft-System-Monitor/1.0" }
      });
      clearTimeout(timeout);
      const responseTimeMs = Date.now() - startedAt;
      const nextStatus: SystemMonitorStatus = response.status === monitor.expectedStatus ? "ACTIVE" : "DOWN";
      const updated = await this.repository.update(monitor.id, {
        status: nextStatus,
        lastCheckedAt: new Date(),
        lastStatusCode: response.status,
        responseTimeMs,
        lastError: nextStatus === "ACTIVE" ? null : `Status HTTP ${response.status}, esperado ${monitor.expectedStatus}.`,
        ...(nextStatus === "ACTIVE" ? { lastOnlineAt: new Date() } : { lastOfflineAt: new Date() })
      });
      if (previousStatus !== "DOWN" && nextStatus === "DOWN") {
        await this.auditRepository.log({ userId, entity: "SystemMonitor", entityId: monitor.id, action: "DOWN" });
      }
      return { monitor: updated, previousStatus, alert: previousStatus !== "DOWN" && nextStatus === "DOWN" };
    } catch (error) {
      clearTimeout(timeout);
      const updated = await this.repository.update(monitor.id, {
        status: "DOWN",
        lastCheckedAt: new Date(),
        responseTimeMs: Date.now() - startedAt,
        lastError: errorMessage(error),
        lastOfflineAt: new Date()
      });
      if (previousStatus !== "DOWN") {
        await this.auditRepository.log({ userId, entity: "SystemMonitor", entityId: monitor.id, action: "DOWN" });
      }
      return { monitor: updated, previousStatus, alert: previousStatus !== "DOWN" };
    }
  }
}
