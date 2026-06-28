import type { ClientStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const includeRelations = {
  category: true,
  tags: { include: { tag: true } },
  contacts: true,
  projectLinks: { include: { project: true } },
  _count: { select: { schedules: true, tasks: true, notes: true, attachments: true } }
} satisfies Prisma.ClientInclude;

export class ClientRepository {
  public async list(ownerId: string, query: ListQuery, status?: ClientStatus): Promise<{ data: unknown[]; total: number }> {
    const where: Prisma.ClientWhereInput = {
      ownerId,
      ...(status ? { status } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { document: { contains: query.search } },
          { email: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const orderBy: Prisma.ClientOrderByWithRelationInput =
      query.sortBy === "name" ? { name: query.order } : { createdAt: query.order };
    const [data, total] = await prisma.$transaction([
      prisma.client.findMany({ where, ...pagination(query), orderBy, include: includeRelations }),
      prisma.client.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string, ownerId: string) {
    return prisma.client.findFirst({
      where: { id, ownerId },
      include: { ...includeRelations, schedules: true, tasks: true, notes: true, auditLogs: { orderBy: { createdAt: "desc" } }, attachments: true }
    });
  }

  public findByDocument(document: string) {
    return prisma.client.findUnique({ where: { document } });
  }

  public create(data: Prisma.ClientCreateInput) {
    return prisma.client.create({ data, include: includeRelations });
  }

  public update(id: string, data: Prisma.ClientUpdateInput) {
    return prisma.client.update({ where: { id }, data, include: includeRelations });
  }

  public delete(id: string) {
    return prisma.client.delete({ where: { id } });
  }
}
