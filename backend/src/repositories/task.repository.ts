import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export class TaskRepository {
  public list(userId: string, search?: string) {
    const where: Prisma.TaskWhereInput = {
      userId,
      ...(search ? {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
          { client: { name: { contains: search, mode: "insensitive" } } },
          { project: { name: { contains: search, mode: "insensitive" } } },
          { project: { code: { contains: search, mode: "insensitive" } } }
        ]
      } : {})
    };
    return prisma.task.findMany({ where, include: { client: true, category: true, project: true, column: true }, orderBy: [{ status: "asc" }, { position: "asc" }] });
  }

  public create(data: Prisma.TaskCreateInput) {
    return prisma.task.create({ data, include: { client: true, category: true, project: true, column: true } });
  }

  public update(id: string, data: Prisma.TaskUpdateInput) {
    return prisma.task.update({ where: { id }, data, include: { client: true, category: true, project: true, column: true } });
  }

  public delete(id: string) {
    return prisma.task.delete({ where: { id } });
  }
}
