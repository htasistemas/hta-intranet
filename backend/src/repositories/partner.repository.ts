import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const partnerInclude = {
  projectLinks: { include: { project: { include: { client: true, product: true } } } },
  interactions: { orderBy: { occurredAt: "desc" }, take: 20 },
  _count: { select: { projectLinks: true, interactions: true } }
} satisfies Prisma.PartnerInclude;

export class PartnerRepository {
  public async list(ownerId: string, query: ListQuery) {
    const where: Prisma.PartnerWhereInput = {
      ownerId,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { company: { contains: query.search, mode: "insensitive" } },
          { contactName: { contains: query.search, mode: "insensitive" } },
          { email: { contains: query.search, mode: "insensitive" } },
          { segment: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.partner.findMany({ where, ...pagination(query), include: partnerInclude, orderBy: { updatedAt: query.order } }),
      prisma.partner.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string, ownerId: string) {
    return prisma.partner.findFirst({ where: { id, ownerId }, include: partnerInclude });
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
