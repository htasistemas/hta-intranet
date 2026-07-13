import type { z } from "zod";
import type { ClientStatus, Priority } from "@prisma/client";
import { ClientRepository } from "../repositories/client.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { clientSchema } from "../validations/entities.validation.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../prisma/client.js";

type ClientInput = z.infer<typeof clientSchema>;
type ClientWithCommunicationMessages = NonNullable<Awaited<ReturnType<ClientRepository["findById"]>>> & {
  communicationMessages: Awaited<ReturnType<typeof prisma.communicationMessage.findMany>>;
};

interface ClientImportRowError {
  row: number;
  name?: string;
  message: string;
}

interface ClientImportResult {
  created: number;
  failed: number;
  errors: ClientImportRowError[];
}

function priorityValue(priority: string | null | undefined): Priority {
  if (priority === "LOW" || priority === "HIGH" || priority === "URGENT") return priority;
  return "MEDIUM";
}

function clientInternalCode(input: ClientInput): string | null | undefined {
  return input.internalCode?.trim() || undefined;
}

function messageRecipients(client: { email: string | null; phone: string | null; whatsapp: string | null }): string[] {
  const values = [client.email, client.phone, client.whatsapp]
    .filter((value): value is string => Boolean(value?.trim()))
    .flatMap((value) => {
      const digits = value.replace(/\D/g, "");
      return digits && digits !== value ? [value, digits] : [value];
    })
    .map((value) => value.trim().toLowerCase());
  return [...new Set(values)];
}

export class ClientService {
  public constructor(
    private readonly repository = new ClientRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public list(userId: string, query: ListQuery, status?: ClientStatus) {
    return this.repository.list(userId, query, status);
  }

  public async get(id: string, userId: string) {
    const client = await this.repository.findById(id, userId);
    if (!client) throw new ApiError(404, "Cliente nao encontrado.");
    const recipients = messageRecipients(client);
    const communicationMessages = recipients.length
      ? await prisma.communicationMessage.findMany({
        where: {
          ownerId: userId,
          deletedAt: null,
          recipient: { in: recipients }
        },
        include: { template: true, webhookEvents: { orderBy: { receivedAt: "desc" } } },
        orderBy: { createdAt: "desc" },
        take: 10
      })
      : [];
    return { ...client, communicationMessages } satisfies ClientWithCommunicationMessages;
  }

  public async create(input: ClientInput, userId: string) {
    const { tagIds, projectIds, productIds, categoryId, ...data } = input;
    const internalCode = clientInternalCode(input) ?? await this.repository.nextInternalCode(userId);
    const client = await this.repository.create({
      ...data,
      internalCode,
      owner: { connect: { id: userId } },
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) } } : {}),
      ...(projectIds.length ? { projectLinks: { create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) } } : {})
    });
    const linkedClient = await this.repository.syncProductLinks(client.id, userId, productIds);
    await this.auditRepository.log({ userId, clientId: client.id, entity: "Client", entityId: client.id, action: "CREATED" });
    return linkedClient ?? client;
  }

  public async importMany(rows: unknown[], userId: string): Promise<ClientImportResult> {
    const result: ClientImportResult = { created: 0, failed: 0, errors: [] };
    const importedDocuments = new Set<string>();

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const parsed = clientSchema.safeParse(row);
      if (!parsed.success) {
        result.failed += 1;
        result.errors.push({ row: line, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }

      const document = parsed.data.document?.trim() ?? "";
      if (document && importedDocuments.has(document)) {
        result.failed += 1;
        result.errors.push({ row: line, name: parsed.data.name, message: "Documento duplicado no arquivo." });
        continue;
      }

      if (document && await this.repository.findByDocument(document)) {
        result.failed += 1;
        result.errors.push({ row: line, name: parsed.data.name, message: "Ja existe um cliente cadastrado com este documento." });
        continue;
      }

      try {
        await this.create(parsed.data, userId);
        if (document) importedDocuments.add(document);
        result.created += 1;
      } catch (error) {
        result.failed += 1;
        result.errors.push({ row: line, name: parsed.data.name, message: error instanceof Error ? error.message : "Nao foi possivel importar o cliente." });
      }
    }

    return result;
  }

  public async update(id: string, input: ClientInput, userId: string) {
    await this.get(id, userId);
    const { tagIds, projectIds, productIds, categoryId, ...data } = input;
    await this.repository.update(id, {
      ...data,
      category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
      tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
      projectLinks: { deleteMany: {}, create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) }
    });
    const client = await this.repository.syncProductLinks(id, userId, productIds);
    await this.auditRepository.log({ userId, clientId: id, entity: "Client", entityId: id, action: "UPDATED", changes: { updatedFields: Object.keys(input) } });
    return client ?? await this.get(id, userId);
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.auditRepository.log({ userId, clientId: id, entity: "Client", entityId: id, action: "DELETED" });
    await this.repository.delete(id);
  }

  public async moveToProspecting(id: string, userId: string) {
    const client = await this.get(id, userId);
    return prisma.$transaction(async (tx) => {
      const existingLead = client.document
        ? await tx.crmLead.findFirst({ where: { ownerId: userId, document: client.document, deletedAt: null, convertedAt: null } })
        : client.email
          ? await tx.crmLead.findFirst({ where: { ownerId: userId, email: client.email, deletedAt: null, convertedAt: null } })
          : null;
      const leadData = {
        tenantId: "default",
        ownerId: userId,
        name: client.name,
        company: client.legalName ?? client.tradeName,
        document: client.document,
        segment: client.segment,
        email: client.email,
        phone: client.phone,
        whatsapp: client.whatsapp,
        postalCode: client.postalCode,
        street: client.street,
        number: client.number,
        district: client.district,
        city: client.city,
        state: client.state,
        source: client.source,
        responsible: client.responsible ?? "Comercial",
        estimatedValue: client.expectedValue,
        observations: client.observations,
        priority: priorityValue(client.priority),
        status: "NEW" as const,
        stage: "LEAD_RECEIVED" as const,
        convertedAt: null,
        wonAt: null
      };
      const lead = existingLead
        ? await tx.crmLead.update({ where: { id: existingLead.id }, data: leadData })
        : await tx.crmLead.create({ data: leadData });
      const updatedClient = await tx.client.update({ where: { id }, data: { status: "PROSPECT" } });
      await tx.auditLog.create({
        data: {
          userId,
          clientId: updatedClient.id,
          entity: "Client",
          entityId: updatedClient.id,
          action: "UPDATED",
          changes: { status: "PROSPECT", source: "moveToProspecting", leadId: lead.id }
        }
      });
      return lead;
    });
  }
}
