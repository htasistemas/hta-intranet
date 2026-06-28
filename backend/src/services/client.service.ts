import type { z } from "zod";
import type { ClientStatus } from "@prisma/client";
import { ClientRepository } from "../repositories/client.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { clientSchema } from "../validations/entities.validation.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

type ClientInput = z.infer<typeof clientSchema>;

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
    return client;
  }

  public async create(input: ClientInput, userId: string) {
    const { tagIds, projectIds, categoryId, ...data } = input;
    const client = await this.repository.create({
      ...data,
      owner: { connect: { id: userId } },
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      ...(tagIds.length ? { tags: { create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) } } : {}),
      ...(projectIds.length ? { projectLinks: { create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) } } : {})
    });
    await this.auditRepository.log({ userId, clientId: client.id, entity: "Client", entityId: client.id, action: "CREATED" });
    return client;
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
    const { tagIds, projectIds, categoryId, ...data } = input;
    const client = await this.repository.update(id, {
      ...data,
      category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
      tags: { deleteMany: {}, create: tagIds.map((tagId) => ({ tag: { connect: { id: tagId } } })) },
      projectLinks: { deleteMany: {}, create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) }
    });
    await this.auditRepository.log({ userId, clientId: id, entity: "Client", entityId: id, action: "UPDATED", changes: { updatedFields: Object.keys(input) } });
    return client;
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.auditRepository.log({ userId, clientId: id, entity: "Client", entityId: id, action: "DELETED" });
    await this.repository.delete(id);
  }
}
