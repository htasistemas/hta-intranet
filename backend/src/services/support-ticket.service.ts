import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { Prisma, Priority, SupportTicketStatus, SupportTicketType, UserRole } from "@prisma/client";
import type { z } from "zod";
import { prisma } from "../prisma/client.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { SupportTicketRepository, type SupportTicketFilter, type SupportTicketWithRelations } from "../repositories/support-ticket.repository.js";
import type {
  knowledgeBaseArticleSchema,
  supportTicketAssignSchema,
  supportTicketAttachmentInputSchema,
  supportTicketCreateSchema,
  supportTicketMessageSchema,
  supportTicketSlaRuleSchema,
  supportTicketStatusChangeSchema
} from "../validations/entities.validation.js";
import { ApiError } from "../utils/api-error.js";

type TicketCreateInput = z.infer<typeof supportTicketCreateSchema>;
type TicketMessageInput = z.infer<typeof supportTicketMessageSchema>;
type TicketStatusChangeInput = z.infer<typeof supportTicketStatusChangeSchema>;
type TicketAssignInput = z.infer<typeof supportTicketAssignSchema>;
type TicketAttachmentInput = z.infer<typeof supportTicketAttachmentInputSchema>;
type TicketSlaRuleInput = z.infer<typeof supportTicketSlaRuleSchema>;
type KnowledgeArticleInput = z.infer<typeof knowledgeBaseArticleSchema>;

interface AuthContext {
  userId: string;
  role: UserRole;
  partnerId?: string | null;
}

interface DashboardRow {
  label: string;
  total: number;
  newTickets: number;
  inProgress: number;
  resolved: number;
  closed: number;
  reopened: number;
  development: number;
  testing: number;
}

const teamRoles: UserRole[] = ["ADMIN", "MANAGER"];
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain"
]);

const validTransitions: Record<SupportTicketStatus, SupportTicketStatus[]> = {
  NEW: ["TRIAGE", "IN_PROGRESS", "WAITING_USER", "CANCELLED"],
  TRIAGE: ["IN_PROGRESS", "WAITING_USER", "DEVELOPMENT", "CANCELLED"],
  IN_PROGRESS: ["WAITING_USER", "DEVELOPMENT", "TESTING", "RESOLVED", "CANCELLED"],
  WAITING_USER: ["IN_PROGRESS", "DEVELOPMENT", "CANCELLED"],
  DEVELOPMENT: ["IN_PROGRESS", "TESTING", "WAITING_USER", "RESOLVED", "CANCELLED"],
  TESTING: ["IN_PROGRESS", "DEVELOPMENT", "RESOLVED", "CANCELLED"],
  RESOLVED: ["CLOSED", "REOPENED"],
  CLOSED: ["REOPENED"],
  REOPENED: ["TRIAGE", "IN_PROGRESS", "WAITING_USER", "DEVELOPMENT", "CANCELLED"],
  CANCELLED: ["REOPENED"]
};

function isTeam(role: UserRole): boolean {
  return teamRoles.includes(role);
}

function optionalText(value: string | null | undefined): string | undefined {
  return value?.trim() ? value.trim() : undefined;
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

function storageRoot(): string {
  return path.resolve(process.env.TICKET_STORAGE_DIR ?? path.join(process.cwd(), "storage", "tickets"));
}

function mimePreviewable(mimeType: string): boolean {
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/");
}

function baseWhere(auth: AuthContext): Prisma.SupportTicketWhereInput {
  if (isTeam(auth.role)) return {};
  return {
    OR: [
      { requesterId: auth.userId },
      ...(auth.partnerId ? [{ client: { ownerId: auth.userId } }] : [])
    ]
  };
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function defaultResolutionMinutes(priority: Priority): number {
  if (priority === "URGENT") return 240;
  if (priority === "HIGH") return 480;
  if (priority === "MEDIUM") return 1440;
  return 2880;
}

function groupRows<T>(tickets: SupportTicketWithSummary[], label: (ticket: SupportTicketWithSummary) => T | null): DashboardRow[] {
  const groups = new Map<string, SupportTicketWithSummary[]>();
  for (const ticket of tickets) {
    const key = label(ticket);
    const groupKey = key ? String(key) : "Nao informado";
    groups.set(groupKey, [...(groups.get(groupKey) ?? []), ticket]);
  }
  return Array.from(groups.entries()).map(([rowLabel, rowTickets]) => ({
    label: rowLabel,
    total: rowTickets.length,
    newTickets: rowTickets.filter((ticket) => ticket.status === "NEW").length,
    inProgress: rowTickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
    resolved: rowTickets.filter((ticket) => ticket.status === "RESOLVED").length,
    closed: rowTickets.filter((ticket) => ticket.status === "CLOSED").length,
    reopened: rowTickets.filter((ticket) => ticket.status === "REOPENED").length,
    development: rowTickets.filter((ticket) => ticket.status === "DEVELOPMENT").length,
    testing: rowTickets.filter((ticket) => ticket.status === "TESTING").length
  })).sort((left, right) => right.total - left.total);
}

type SupportTicketWithSummary = Awaited<ReturnType<SupportTicketRepository["dashboard"]>>[number];

export class SupportTicketService {
  public constructor(
    private readonly repository = new SupportTicketRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public async list(auth: AuthContext, filter: SupportTicketFilter) {
    const where = this.filteredWhere(auth, filter);
    const result = await this.repository.list(where, filter);
    return { ...result, page: filter.page, pageSize: filter.pageSize };
  }

  public async get(id: string, auth: AuthContext): Promise<SupportTicketWithRelations> {
    const ticket = await this.repository.findById(id);
    if (!ticket || !this.canView(ticket, auth)) throw new ApiError(404, "Chamado nao encontrado.");
    return this.visibleTicket(ticket, auth);
  }

  public async create(input: TicketCreateInput, auth: AuthContext) {
    const ownerId = await this.resolveOwnerId(input, auth);
    const dueAt = await this.calculateDueAt(ownerId, input.priority, input.category, input.clientId ?? null, input.productId ?? null, input.type);
    const ticketId = await this.repository.transaction(async (tx) => {
      const protocol = await this.uniqueProtocol(tx);
      const ticket = await tx.supportTicket.create({
        data: {
          tenantId: "default",
          ownerId,
          protocol,
          clientId: input.clientId ?? null,
          productId: input.productId ?? null,
          requesterId: auth.userId,
          requesterName: input.requesterName,
          requesterEmail: input.requesterEmail,
          requesterPhone: optionalText(input.requesterPhone),
          unit: optionalText(input.unit),
          systemModule: input.systemModule,
          category: input.category,
          type: input.type,
          priority: input.priority,
          impact: input.impact,
          urgency: input.urgency,
          subject: input.subject,
          description: input.description,
          currentActivity: optionalText(input.currentActivity),
          happened: optionalText(input.happened),
          expectedResult: optionalText(input.expectedResult),
          actualResult: optionalText(input.actualResult),
          reproductionSteps: optionalText(input.reproductionSteps),
          dueAt
        }
      });
      await tx.supportTicketMessage.create({
        data: { ticketId: ticket.id, authorId: auth.userId, status: "NEW", body: input.description, kind: "MESSAGE" }
      });
      await this.storeAttachments(tx, ticket.id, auth.userId, input.attachments);
      await this.history(tx, ticket.id, auth.userId, "CREATED", null, ticket.protocol, { subject: ticket.subject });
      await this.notification(tx, ticket.id, auth.userId, "Chamado aberto", `Chamado ${ticket.protocol} registrado para atendimento.`);
      await tx.auditLog.create({ data: { userId: auth.userId, clientId: ticket.clientId, entity: "SupportTicket", entityId: ticket.id, action: "CREATED", changes: { protocol: ticket.protocol } } });
      return ticket.id;
    });
    return this.get(ticketId, auth);
  }

  public async reply(id: string, input: TicketMessageInput, auth: AuthContext) {
    const ticket = await this.get(id, auth);
    if (ticket.status === "CLOSED" || ticket.status === "CANCELLED") throw new ApiError(400, "Chamado encerrado ou cancelado nao aceita novas respostas.");
    if (input.internal && !isTeam(auth.role)) throw new ApiError(403, "Somente equipe tecnica pode registrar nota interna.");
    const nextStatus = !isTeam(auth.role) && ticket.status === "WAITING_USER" ? "IN_PROGRESS" : ticket.status;
    const ticketId = await this.repository.transaction(async (tx) => {
      if (nextStatus !== ticket.status) {
        await tx.supportTicket.update({ where: { id }, data: { status: nextStatus } });
        await this.history(tx, id, auth.userId, "STATUS_CHANGED", ticket.status, nextStatus, { automatic: true });
      }
      const message = await tx.supportTicketMessage.create({
        data: {
          ticketId: id,
          authorId: auth.userId,
          status: nextStatus,
          body: input.body,
          kind: input.internal ? "INTERNAL_NOTE" : "MESSAGE",
          internal: input.internal
        }
      });
      await this.storeAttachments(tx, id, auth.userId, input.attachments, message.id);
      await this.history(tx, id, auth.userId, input.internal ? "INTERNAL_NOTE" : "MESSAGE_CREATED", null, null, { messageId: message.id });
      await this.notification(tx, id, auth.userId, input.internal ? "Nota interna registrada" : "Nova resposta", input.body.slice(0, 240));
      await tx.auditLog.create({ data: { userId: auth.userId, clientId: ticket.clientId, entity: "SupportTicket", entityId: id, action: input.internal ? "INTERNAL_NOTE" : "MESSAGE_CREATED" } });
      return id;
    });
    return this.get(ticketId, auth);
  }

  public async assign(id: string, input: TicketAssignInput, auth: AuthContext) {
    if (!isTeam(auth.role)) throw new ApiError(403, "Somente equipe tecnica pode atribuir chamados.");
    const ticket = await this.get(id, auth);
    if (input.analystId) {
      const analyst = await prisma.user.findUnique({ where: { id: input.analystId } });
      if (!analyst || !isTeam(analyst.role)) throw new ApiError(400, "Analista invalido.");
    }
    const ticketId = await this.repository.transaction(async (tx) => {
      const updated = await tx.supportTicket.update({
        where: { id },
        data: {
          analystId: input.analystId ?? auth.userId,
          status: ticket.status === "NEW" || ticket.status === "TRIAGE" || ticket.status === "REOPENED" ? "IN_PROGRESS" : ticket.status,
          firstResponseAt: ticket.firstResponseAt ?? new Date()
        }
      });
      await this.history(tx, id, auth.userId, "ASSIGNED", ticket.analystId, updated.analystId, { note: input.note ?? null });
      await tx.auditLog.create({ data: { userId: auth.userId, clientId: ticket.clientId, entity: "SupportTicket", entityId: id, action: "ASSIGNED", changes: { from: ticket.analystId, to: updated.analystId } } });
      return id;
    });
    return this.get(ticketId, auth);
  }

  public async changeStatus(id: string, input: TicketStatusChangeInput, auth: AuthContext) {
    const ticket = await this.get(id, auth);
    this.assertStatusPermission(ticket, input, auth);
    this.assertTransition(ticket.status, input.status);
    const ticketId = await this.repository.transaction(async (tx) => {
      const now = new Date();
      const data: Prisma.SupportTicketUpdateInput = {
        status: input.status,
        ...(input.priority ? { priority: input.priority } : {}),
        ...(input.category ? { category: input.category } : {}),
        ...(input.systemModule ? { systemModule: input.systemModule } : {}),
        ...(input.analystId ? { analyst: { connect: { id: input.analystId } } } : {})
      };
      if (input.status === "RESOLVED") {
        if (!input.note?.trim()) throw new ApiError(400, "Informe a solucao aplicada.");
        data.solution = input.note;
        data.resolutionNote = input.note;
        data.resolvedAt = now;
      }
      if (input.status === "CLOSED") data.closedAt = now;
      if (input.status === "REOPENED") data.reopenedAt = now;
      if (input.status === "CANCELLED") {
        if (!input.note?.trim()) throw new ApiError(400, "Informe a justificativa do cancelamento.");
        data.cancelledAt = now;
      }
      const updated = await tx.supportTicket.update({ where: { id }, data });
      await tx.supportTicketMessage.create({
        data: {
          ticketId: id,
          authorId: auth.userId,
          status: updated.status,
          body: input.note ?? `Status alterado para ${updated.status}.`,
          kind: "STATUS_CHANGE",
          internal: false
        }
      });
      await this.history(tx, id, auth.userId, "STATUS_CHANGED", ticket.status, updated.status, { note: input.note ?? null });
      await this.notification(tx, id, auth.userId, this.notificationTitle(updated.status), input.note ?? `Chamado ${updated.protocol} atualizado.`);
      await tx.auditLog.create({ data: { userId: auth.userId, clientId: ticket.clientId, entity: "SupportTicket", entityId: id, action: "STATUS_CHANGED", changes: { from: ticket.status, to: updated.status } } });
      return id;
    });
    return this.get(ticketId, auth);
  }

  public async dashboard(auth: AuthContext, filter: SupportTicketFilter) {
    const where = this.filteredWhere(auth, filter);
    const tickets = await this.repository.dashboard(where);
    const now = new Date();
    const openTickets = tickets.filter((ticket) => ticket.status !== "CLOSED" && ticket.status !== "CANCELLED");
    const slaRisk = openTickets.filter((ticket) => ticket.dueAt && ticket.dueAt > now && ticket.dueAt.getTime() - now.getTime() <= 60 * 60 * 1000).length;
    const slaExpired = openTickets.filter((ticket) => ticket.dueAt && ticket.dueAt <= now).length;
    return {
      cards: {
        total: tickets.length,
        newTickets: tickets.filter((ticket) => ticket.status === "NEW").length,
        inProgress: tickets.filter((ticket) => ticket.status === "IN_PROGRESS").length,
        waitingUser: tickets.filter((ticket) => ticket.status === "WAITING_USER").length,
        development: tickets.filter((ticket) => ticket.status === "DEVELOPMENT").length,
        testing: tickets.filter((ticket) => ticket.status === "TESTING").length,
        resolved: tickets.filter((ticket) => ticket.status === "RESOLVED").length,
        closed: tickets.filter((ticket) => ticket.status === "CLOSED").length,
        reopened: tickets.filter((ticket) => ticket.status === "REOPENED").length,
        slaRisk,
        slaExpired
      },
      byClient: groupRows(tickets, (ticket) => ticket.client?.name ?? null),
      bySystem: groupRows(tickets, (ticket) => ticket.product?.name ?? null),
      byModule: groupRows(tickets, (ticket) => `${ticket.product?.name ?? "Sistema nao informado"} - ${ticket.systemModule}`),
      byRequester: groupRows(tickets, (ticket) => `${ticket.client?.name ?? "Cliente nao informado"} - ${ticket.requesterName}`),
      byAnalyst: groupRows(tickets, (ticket) => ticket.analyst?.name ?? "Sem responsavel"),
      indicators: this.indicators(tickets)
    };
  }

  public async listSlaRules(auth: AuthContext) {
    this.assertManager(auth);
    return this.repository.listSlaRules(auth.userId);
  }

  public async listAnalysts(auth: AuthContext) {
    if (!isTeam(auth.role)) throw new ApiError(403, "Acesso restrito a equipe tecnica.");
    return prisma.user.findMany({
      where: { role: { in: teamRoles } },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" }
    });
  }

  public async createSlaRule(input: TicketSlaRuleInput, auth: AuthContext) {
    this.assertManager(auth);
    const { productId, clientId, category, ...data } = input;
    return this.repository.createSlaRule({
      ...data,
      category: optionalText(category),
      clientId: clientId ?? null,
      product: productId ? { connect: { id: productId } } : undefined,
      owner: { connect: { id: auth.userId } }
    });
  }

  public async deleteSlaRule(id: string, auth: AuthContext): Promise<void> {
    this.assertManager(auth);
    const result = await prisma.supportTicketSlaRule.deleteMany({ where: { id, ownerId: auth.userId } });
    if (!result.count) throw new ApiError(404, "Regra de SLA nao encontrada.");
  }

  public listArticles(auth: AuthContext, search?: string) {
    return this.repository.listArticles(auth.userId, search);
  }

  public async createArticle(input: KnowledgeArticleInput, auth: AuthContext) {
    this.assertManager(auth);
    return this.repository.createArticle({ ...input, owner: { connect: { id: auth.userId } } });
  }

  public async attachmentPath(id: string, auth: AuthContext) {
    const attachment = await this.repository.findAttachment(id);
    if (!attachment || !this.canView(attachment.ticket, auth)) throw new ApiError(404, "Anexo nao encontrado.");
    return { path: attachment.storagePath, name: attachment.name, mimeType: attachment.mimeType };
  }

  private filteredWhere(auth: AuthContext, filter: SupportTicketFilter): Prisma.SupportTicketWhereInput {
    const clauses: Prisma.SupportTicketWhereInput[] = [baseWhere(auth)];
    if (filter.scope === "mine") clauses.push(isTeam(auth.role) ? { analystId: auth.userId } : { requesterId: auth.userId });
    if (filter.scope === "unassigned") clauses.push({ analystId: null });
    if (filter.clientId) clauses.push({ clientId: filter.clientId });
    if (filter.productId) clauses.push({ productId: filter.productId });
    if (filter.requesterId) clauses.push({ requesterId: filter.requesterId });
    if (filter.analystId) clauses.push({ analystId: filter.analystId });
    if (filter.status) clauses.push({ status: filter.status });
    if (filter.priority) clauses.push({ priority: filter.priority });
    if (filter.category) clauses.push({ category: { contains: filter.category, mode: "insensitive" } });
    if (filter.systemModule) clauses.push({ systemModule: { contains: filter.systemModule, mode: "insensitive" } });
    if (filter.periodFrom || filter.periodTo) clauses.push({ createdAt: { gte: filter.periodFrom, lte: filter.periodTo } });
    if (filter.search) {
      clauses.push({
        OR: [
          { protocol: { contains: filter.search, mode: "insensitive" } },
          { requesterName: { contains: filter.search, mode: "insensitive" } },
          { requesterEmail: { contains: filter.search, mode: "insensitive" } },
          { subject: { contains: filter.search, mode: "insensitive" } },
          { client: { name: { contains: filter.search, mode: "insensitive" } } },
          { product: { name: { contains: filter.search, mode: "insensitive" } } }
        ]
      });
    }
    return { AND: clauses };
  }

  private canView(ticket: Pick<SupportTicketWithRelations, "requesterId" | "analystId" | "client"> | { requesterId: string; analystId: string | null; client: { ownerId: string } | null }, auth: AuthContext): boolean {
    if (isTeam(auth.role)) return true;
    if (ticket.requesterId === auth.userId) return true;
    return Boolean(auth.partnerId && ticket.client?.ownerId === auth.userId);
  }

  private visibleTicket(ticket: SupportTicketWithRelations, auth: AuthContext): SupportTicketWithRelations {
    if (isTeam(auth.role)) return ticket;
    return { ...ticket, messages: ticket.messages.filter((message) => !message.internal), history: ticket.history.filter((item) => item.action !== "INTERNAL_NOTE") };
  }

  private async resolveOwnerId(input: TicketCreateInput, auth: AuthContext): Promise<string> {
    if (!input.clientId) return auth.userId;
    const client = await prisma.client.findUnique({ where: { id: input.clientId } });
    if (!client) throw new ApiError(404, "Cliente nao encontrado.");
    if (!isTeam(auth.role) && client.ownerId !== auth.userId) throw new ApiError(403, "Cliente nao permitido para este usuario.");
    return client.ownerId;
  }

  private async calculateDueAt(ownerId: string, priority: Priority, category: string, clientId: string | null, productId: string | null, type: SupportTicketType): Promise<Date> {
    const rules = await prisma.supportTicketSlaRule.findMany({
      where: { ownerId, active: true, OR: [{ priority }, { category }, { clientId }, { productId }, { type }] },
      orderBy: { resolutionMinutes: "asc" }
    });
    const minutes = rules[0]?.resolutionMinutes ?? defaultResolutionMinutes(priority);
    return addMinutes(new Date(), minutes);
  }

  private async uniqueProtocol(tx: Prisma.TransactionClient): Promise<string> {
    for (let attempts = 0; attempts < 5; attempts += 1) {
      const protocol = await this.repository.nextProtocol(new Date().getFullYear());
      const exists = await tx.supportTicket.findUnique({ where: { protocol } });
      if (!exists) return protocol;
    }
    throw new ApiError(409, "Nao foi possivel gerar protocolo unico.");
  }

  private async storeAttachments(tx: Prisma.TransactionClient, ticketId: string, uploaderId: string, attachments: TicketAttachmentInput[], messageId?: string): Promise<void> {
    if (!attachments.length) return;
    const folder = path.join(storageRoot(), ticketId);
    await mkdir(folder, { recursive: true });
    for (const attachment of attachments) {
      if (!allowedMimeTypes.has(attachment.mimeType)) throw new ApiError(400, `Tipo de arquivo nao permitido: ${attachment.mimeType}.`);
      const buffer = Buffer.from(attachment.contentBase64, "base64");
      if (buffer.byteLength !== attachment.size) throw new ApiError(400, `Tamanho invalido para o arquivo ${attachment.name}.`);
      const fileName = `${randomUUID()}-${safeFileName(attachment.name)}`;
      const filePath = path.join(folder, fileName);
      await writeFile(filePath, buffer);
      await tx.supportTicketAttachment.create({
        data: {
          ticketId,
          messageId,
          uploaderId,
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          storagePath: filePath,
          previewable: mimePreviewable(attachment.mimeType)
        }
      });
    }
  }

  private assertStatusPermission(ticket: SupportTicketWithRelations, input: TicketStatusChangeInput, auth: AuthContext): void {
    if (isTeam(auth.role)) return;
    const userAllowed = ticket.requesterId === auth.userId && ticket.status === "RESOLVED" && (input.status === "CLOSED" || input.status === "REOPENED");
    if (!userAllowed) throw new ApiError(403, "Usuario nao autorizado para esta alteracao.");
  }

  private assertTransition(from: SupportTicketStatus, to: SupportTicketStatus): void {
    if (from === to) return;
    if (!validTransitions[from].includes(to)) throw new ApiError(400, `Transicao invalida de ${from} para ${to}.`);
  }

  private assertManager(auth: AuthContext): void {
    if (auth.role !== "ADMIN" && auth.role !== "MANAGER") throw new ApiError(403, "Acesso restrito a gestores.");
  }

  private async history(tx: Prisma.TransactionClient, ticketId: string, userId: string, action: string, fromValue: string | null, toValue: string | null, details?: Prisma.InputJsonValue): Promise<void> {
    await tx.supportTicketHistory.create({ data: { ticketId, userId, action, fromValue, toValue, details } });
  }

  private async notification(tx: Prisma.TransactionClient, ticketId: string, userId: string, title: string, body: string): Promise<void> {
    await tx.supportTicketHistory.create({ data: { ticketId, userId, action: "NOTIFICATION", toValue: title, details: { body } } });
  }

  private notificationTitle(status: SupportTicketStatus): string {
    if (status === "RESOLVED") return "Seu chamado foi marcado como resolvido.";
    if (status === "CLOSED") return "Chamado encerrado.";
    if (status === "REOPENED") return "Chamado reaberto.";
    if (status === "WAITING_USER") return "Chamado aguardando informacoes.";
    return "Chamado atualizado.";
  }

  private indicators(tickets: SupportTicketWithSummary[]) {
    const resolved = tickets.filter((ticket) => ticket.resolvedAt);
    const closed = tickets.filter((ticket) => ticket.closedAt);
    const firstResponse = tickets.filter((ticket) => ticket.firstResponseAt);
    const averageMinutes = (items: SupportTicketWithSummary[], end: (ticket: SupportTicketWithSummary) => Date | null): number => {
      if (!items.length) return 0;
      const total = items.reduce((sum, ticket) => {
        const endAt = end(ticket);
        return sum + (endAt ? endAt.getTime() - ticket.createdAt.getTime() : 0);
      }, 0);
      return Math.round(total / items.length / 60000);
    };
    const slaExpired = tickets.filter((ticket) => ticket.dueAt && ticket.resolvedAt && ticket.resolvedAt > ticket.dueAt).length;
    return {
      averageFirstResponseMinutes: averageMinutes(firstResponse, (ticket) => ticket.firstResponseAt),
      averageResolutionMinutes: averageMinutes(resolved, (ticket) => ticket.resolvedAt),
      averageClosingMinutes: averageMinutes(closed, (ticket) => ticket.closedAt),
      resolutionPercent: tickets.length ? Math.round((resolved.length / tickets.length) * 100) : 0,
      reopenPercent: tickets.length ? Math.round((tickets.filter((ticket) => ticket.status === "REOPENED").length / tickets.length) * 100) : 0,
      slaMetPercent: resolved.length ? Math.round(((resolved.length - slaExpired) / resolved.length) * 100) : 100,
      slaExpiredPercent: resolved.length ? Math.round((slaExpired / resolved.length) * 100) : 0
    };
  }
}
