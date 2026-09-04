import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import { pagination } from "../utils/pagination.js";
import type { z } from "zod";
import type { supportTicketFilterSchema } from "../validations/entities.validation.js";

export type SupportTicketFilter = z.infer<typeof supportTicketFilterSchema>;

export const supportTicketInclude = {
  client: true,
  product: true,
  requester: { select: { id: true, name: true, email: true, role: true, partnerId: true } },
  analyst: { select: { id: true, name: true, email: true, role: true, partnerId: true } },
  messages: {
    include: {
      author: { select: { id: true, name: true, email: true, role: true } },
      attachments: true
    },
    orderBy: { createdAt: "asc" }
  },
  attachments: { orderBy: { createdAt: "desc" } },
  history: {
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" }
  }
} satisfies Prisma.SupportTicketInclude;

export type SupportTicketWithRelations = Prisma.SupportTicketGetPayload<{ include: typeof supportTicketInclude }>;

export class SupportTicketRepository {
  public async list(where: Prisma.SupportTicketWhereInput, filter: SupportTicketFilter) {
    const orderBy: Prisma.SupportTicketOrderByWithRelationInput =
      filter.sortBy === "protocol" ? { protocol: filter.order } :
        filter.sortBy === "priority" ? { priority: filter.order } :
          filter.sortBy === "status" ? { status: filter.order } :
            filter.sortBy === "dueAt" ? { dueAt: filter.order } :
              filter.sortBy === "updatedAt" ? { updatedAt: filter.order } :
                { createdAt: filter.order };
    const [data, total] = await prisma.$transaction([
      prisma.supportTicket.findMany({ where, ...pagination(filter), include: supportTicketInclude, orderBy }),
      prisma.supportTicket.count({ where })
    ]);
    return { data, total };
  }

  public findById(id: string) {
    return prisma.supportTicket.findUnique({ where: { id }, include: supportTicketInclude });
  }

  public findAttachment(id: string) {
    return prisma.supportTicketAttachment.findUnique({ where: { id }, include: { ticket: { include: { client: true } } } });
  }

  public async nextProtocol(year: number): Promise<string> {
    const prefix = `CH-${year}-`;
    const last = await prisma.supportTicket.findFirst({
      where: { protocol: { startsWith: prefix } },
      orderBy: { protocol: "desc" },
      select: { protocol: true }
    });
    const lastNumber = last ? Number(last.protocol.slice(prefix.length)) : 0;
    return `${prefix}${String(lastNumber + 1).padStart(6, "0")}`;
  }

  public transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(handler);
  }

  public dashboard(where: Prisma.SupportTicketWhereInput) {
    return prisma.supportTicket.findMany({
      where,
      include: { client: true, product: true, requester: { select: { id: true, name: true } }, analyst: { select: { id: true, name: true } } }
    });
  }

  public listSlaRules(ownerId: string) {
    return prisma.supportTicketSlaRule.findMany({ where: { ownerId }, orderBy: [{ active: "desc" }, { priority: "asc" }, { name: "asc" }] });
  }

  public createSlaRule(data: Prisma.SupportTicketSlaRuleCreateInput) {
    return prisma.supportTicketSlaRule.create({ data });
  }

  public updateSlaRule(id: string, data: Prisma.SupportTicketSlaRuleUpdateInput) {
    return prisma.supportTicketSlaRule.update({ where: { id }, data });
  }

  public deleteSlaRule(id: string) {
    return prisma.supportTicketSlaRule.delete({ where: { id } });
  }

  public listArticles(ownerId: string, search?: string) {
    return prisma.knowledgeBaseArticle.findMany({
      where: {
        ownerId,
        published: true,
        ...(search ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } }
          ]
        } : {})
      },
      orderBy: { updatedAt: "desc" }
    });
  }

  public createArticle(data: Prisma.KnowledgeBaseArticleCreateInput) {
    return prisma.knowledgeBaseArticle.create({ data });
  }
}
