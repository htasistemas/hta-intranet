import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const partnerInclude = {
  projectLinks: { include: { project: { include: { client: true, product: true } } } },
  interactions: { orderBy: { occurredAt: "desc" }, take: 20 },
  users: { select: { id: true, name: true, email: true, role: true } },
  _count: { select: { projectLinks: true, interactions: true, users: true } }
} satisfies Prisma.PartnerInclude;

export class PartnerRepository {
  public async list(ownerId: string, query: ListQuery) {
    const searchWhere: Prisma.PartnerWhereInput | undefined = query.search
      ? {
          OR: [
            { name: { contains: query.search, mode: "insensitive" } },
            { company: { contains: query.search, mode: "insensitive" } },
            { contactName: { contains: query.search, mode: "insensitive" } },
            { email: { contains: query.search, mode: "insensitive" } },
            { segment: { contains: query.search, mode: "insensitive" } }
          ]
        }
      : undefined;
    const where: Prisma.PartnerWhereInput = {
      AND: [
        { OR: [{ ownerId }, { users: { some: { id: ownerId } } }] },
        ...(searchWhere ? [searchWhere] : [])
      ]
    };
    const [data, total] = await prisma.$transaction([
      prisma.partner.findMany({ where, ...pagination(query), include: partnerInclude, orderBy: { updatedAt: query.order } }),
      prisma.partner.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string, ownerId: string) {
    return prisma.partner.findFirst({ where: { id, OR: [{ ownerId }, { users: { some: { id: ownerId } } }] }, include: partnerInclude });
  }

  public create(data: Prisma.PartnerCreateInput) {
    return prisma.partner.create({ data, include: partnerInclude });
  }

  public update(id: string, data: Prisma.PartnerUpdateInput) {
    return prisma.partner.update({ where: { id }, data, include: partnerInclude });
  }

  public delete(id: string) {
    return prisma.partner.delete({ where: { id } });
  }

  public createInteraction(data: Prisma.PartnerInteractionCreateInput) {
    return prisma.partnerInteraction.create({ data });
  }
}
