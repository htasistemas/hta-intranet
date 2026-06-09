import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export class ScheduleRepository {
  public list(userId: string, start?: Date, end?: Date, search?: string) {
    const where: Prisma.ScheduleWhereInput = {
      userId,
      ...(start || end ? { startAt: { ...(start ? { gte: start } : {}), ...(end ? { lte: end } : {}) } } : {}),
      ...(search ? { title: { contains: search, mode: "insensitive" } } : {})
    };
    return prisma.schedule.findMany({ where, orderBy: { startAt: "asc" }, include: { client: true, project: true, category: true, reminders: true } });
  }

  public create(data: Prisma.ScheduleCreateInput) {
    return prisma.schedule.create({ data, include: { client: true, project: true, category: true, reminders: true } });
  }

  public update(id: string, data: Prisma.ScheduleUpdateInput) {
    return prisma.schedule.update({ where: { id }, data, include: { client: true, project: true, category: true, reminders: true } });
  }

  public delete(id: string) {
    return prisma.schedule.delete({ where: { id } });
  }
}
