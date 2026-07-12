import type { ClientStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const includeRelations = {
  category: true,
  tags: { include: { tag: true } },
  contacts: true,
  projects: { include: { product: true } },
  projectLinks: { include: { project: { include: { product: true } } } },
  products: { include: { product: true } },
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
          { email: { contains: query.search, mode: "insensitive" } },
          { city: { contains: query.search, mode: "insensitive" } },
          { state: { contains: query.search, mode: "insensitive" } }
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

  public async nextInternalCode(ownerId: string): Promise<string> {
    const clients = await prisma.client.findMany({
      where: { ownerId, internalCode: { not: null } },
      select: { internalCode: true }
    });
    const usedCodes = new Set(
      clients
        .map((client) => client.internalCode)
        .filter((code): code is string => Boolean(code))
        .map((code) => Number(code))
        .filter((code) => Number.isInteger(code) && code >= 1 && code <= 99999)
    );
    for (let code = 1; code <= 99999; code += 1) {
      if (!usedCodes.has(code)) return String(code);
    }
    throw new Error("Limite de codigos internos de clientes atingido.");
  }

  public async syncProductLinks(clientId: string, ownerId: string, productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds)];
    await prisma.$transaction(async (tx) => {
      await tx.clientProduct.deleteMany({
        where: {
          clientId,
          ownerId,
          ...(uniqueProductIds.length ? { productId: { notIn: uniqueProductIds } } : {})
        }
      });
      if (!uniqueProductIds.length) return;
      const existingLinks = await tx.clientProduct.findMany({
        where: { clientId, ownerId, productId: { in: uniqueProductIds } },
        select: { productId: true }
      });
      const existingProductIds = new Set(existingLinks.map((link) => link.productId));
      const missingProductIds = uniqueProductIds.filter((productId) => !existingProductIds.has(productId));
      if (!missingProductIds.length) return;
      await tx.clientProduct.createMany({
        data: missingProductIds.map((productId) => ({ clientId, ownerId, productId, status: "ACTIVE" }))
      });
    });
    return this.findById(clientId, ownerId);
  }

  public delete(id: string) {
    return prisma.client.delete({ where: { id } });
  }
}
