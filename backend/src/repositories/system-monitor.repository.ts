import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export class SystemMonitorRepository {
  public list(ownerId: string) {
    return prisma.systemMonitor.findMany({ where: { ownerId }, orderBy: [{ active: "desc" }, { name: "asc" }] });
  }

  public findById(id: string, ownerId: string) {
    return prisma.systemMonitor.findFirst({ where: { id, ownerId } });
  }

  public findByUrl(ownerId: string, url: string) {
    return prisma.systemMonitor.findUnique({ where: { ownerId_url: { ownerId, url } } });
  }

  public count(ownerId: string) {
    return prisma.systemMonitor.count({ where: { ownerId } });
  }

  public create(data: Prisma.SystemMonitorCreateInput) {
    return prisma.systemMonitor.create({ data });
  }

  public update(id: string, data: Prisma.SystemMonitorUpdateInput) {
    return prisma.systemMonitor.update({ where: { id }, data });
  }

  public delete(id: string) {
    return prisma.systemMonitor.delete({ where: { id } });
  }

  public transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(handler);
  }
}
