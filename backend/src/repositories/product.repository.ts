import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import type { ListQuery } from "../utils/pagination.js";
import { pagination } from "../utils/pagination.js";

const productInclude = {
  _count: { select: { clientProducts: true, projects: true } }
} satisfies Prisma.ProductServiceInclude;

const clientProductInclude = {
  client: true,
  product: true
} satisfies Prisma.ClientProductInclude;

export class ProductRepository {
  public async list(ownerId: string, query: ListQuery) {
    const where: Prisma.ProductServiceWhereInput = {
      ownerId,
      ...(query.search ? {
        OR: [
          { code: { contains: query.search, mode: "insensitive" } },
          { name: { contains: query.search, mode: "insensitive" } },
          { category: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.productService.findMany({ where, ...pagination(query), include: productInclude, orderBy: { updatedAt: query.order } }),
      prisma.productService.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string, ownerId: string) {
    return prisma.productService.findFirst({ where: { id, ownerId }, include: { ...productInclude, clientProducts: { include: clientProductInclude } } });
  }

  public create(data: Prisma.ProductServiceCreateInput) {
    return prisma.productService.create({ data, include: productInclude });
  }

  public update(id: string, data: Prisma.ProductServiceUpdateInput) {
    return prisma.productService.update({ where: { id }, data, include: productInclude });
  }

  public delete(id: string) {
    return prisma.productService.delete({ where: { id } });
  }

  public async insights(ownerId: string) {
    const now = new Date();
    const nextThirtyDays = new Date(now);
    nextThirtyDays.setDate(nextThirtyDays.getDate() + 30);
    const [products, clientProducts, upcomingRenewals] = await prisma.$transaction([
      prisma.productService.findMany({ where: { ownerId }, include: productInclude }),
      prisma.clientProduct.findMany({ where: { ownerId }, include: clientProductInclude }),
      prisma.clientProduct.findMany({
        where: { ownerId, status: "ACTIVE", renewalDate: { gte: now, lte: nextThirtyDays } },
        include: clientProductInclude,
        orderBy: { renewalDate: "asc" },
        take: 10
      })
    ]);
    const contractedRevenue = clientProducts.reduce((total, item) => total + Number(item.contractedValue ?? 0), 0);
    const byType = products.reduce<Record<string, number>>((accumulator, product) => ({ ...accumulator, [product.type]: (accumulator[product.type] ?? 0) + 1 }), {});
    return {
      totalProducts: products.length,
      activeProducts: products.filter((product) => product.status === "ACTIVE").length,
      contractedProducts: clientProducts.length,
      activeContracts: clientProducts.filter((item) => item.status === "ACTIVE").length,
      upcomingRenewals: upcomingRenewals.length,
      contractedRevenue,
      byType,
      renewals: upcomingRenewals
    };
  }

  public async listClientProducts(ownerId: string, query: ListQuery, clientId?: string) {
    const where: Prisma.ClientProductWhereInput = {
      ownerId,
      ...(clientId ? { clientId } : {}),
      ...(query.search ? {
        OR: [
          { client: { name: { contains: query.search, mode: "insensitive" } } },
          { product: { name: { contains: query.search, mode: "insensitive" } } },
          { product: { code: { contains: query.search, mode: "insensitive" } } }
        ]
      } : {})
    };
    const [data, total] = await prisma.$transaction([
      prisma.clientProduct.findMany({ where, ...pagination(query), include: clientProductInclude, orderBy: { updatedAt: query.order } }),
      prisma.clientProduct.count({ where })
    ]);
    return { data, total };
  }

  public createClientProduct(data: Prisma.ClientProductCreateInput) {
    return prisma.clientProduct.create({ data, include: clientProductInclude });
  }

  public updateClientProduct(id: string, data: Prisma.ClientProductUpdateInput) {
    return prisma.clientProduct.update({ where: { id }, data, include: clientProductInclude });
  }

  public findClientProduct(id: string, ownerId: string) {
    return prisma.clientProduct.findFirst({ where: { id, ownerId }, include: clientProductInclude });
  }

  public deleteClientProduct(id: string) {
    return prisma.clientProduct.delete({ where: { id } });
  }

  public createRenewalFollowUp(data: Prisma.ScheduleCreateInput) {
    return prisma.schedule.create({ data });
  }
}
