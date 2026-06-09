import type { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const includeRelations = {
  client: true,
  product: true,
  _count: { select: { tasks: true } }
} satisfies Prisma.ProjectInclude;

export class ProjectRepository {
  public async list(ownerId: string, query: ListQuery, status?: ProjectStatus) {
    const where: Prisma.ProjectWhereInput = {
      ownerId,
      ...(status ? { status } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { code: { contains: query.search, mode: "insensitive" } },
          { client: { name: { contains: query.search, mode: "insensitive" } } }
        ]
      } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.project.findMany({ where, ...pagination(query), include: includeRelations, orderBy: { updatedAt: query.order } }),
      prisma.project.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string, ownerId: string) {
    return prisma.project.findFirst({ where: { id, ownerId }, include: { ...includeRelations, tasks: true } });
  }

  public create(data: Prisma.ProjectCreateInput) {
    return prisma.project.create({ data, include: includeRelations });
  }

  public update(id: string, data: Prisma.ProjectUpdateInput) {
    return prisma.project.update({ where: { id }, data, include: includeRelations });
  }

  public delete(id: string) {
    return prisma.project.delete({ where: { id } });
  }
}
