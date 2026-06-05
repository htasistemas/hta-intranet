import type { ProjectStatus } from "@prisma/client";
import type { z } from "zod";
import { ProjectRepository } from "../repositories/project.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";
import type { projectSchema } from "../validations/entities.validation.js";

type ProjectInput = z.infer<typeof projectSchema>;

export class ProjectService {
  public constructor(
    private readonly repository = new ProjectRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public list(userId: string, query: ListQuery, status?: ProjectStatus) {
    return this.repository.list(userId, query, status);
  }

  public async get(id: string, userId: string) {
    const project = await this.repository.findById(id, userId);
    if (!project) throw new ApiError(404, "Projeto nao encontrado.");
    return project;
  }

  public async create(input: ProjectInput, userId: string) {
    const { clientId, ...data } = input;
    const project = await this.repository.create({
      ...data,
      owner: { connect: { id: userId } },
      ...(clientId ? { client: { connect: { id: clientId } } } : {})
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Project", entityId: project.id, action: "CREATED" });
    return project;
  }

  public async update(id: string, input: ProjectInput, userId: string) {
    await this.get(id, userId);
    const { clientId, ...data } = input;
    const project = await this.repository.update(id, {
      ...data,
      client: clientId ? { connect: { id: clientId } } : { disconnect: true }
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Project", entityId: id, action: "UPDATED" });
    return project;
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.repository.delete(id);
    await this.auditRepository.log({ userId, entity: "Project", entityId: id, action: "DELETED" });
  }
}
