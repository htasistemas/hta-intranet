import type { z } from "zod";
import type { taskSchema } from "../validations/entities.validation.js";
import { TaskRepository } from "../repositories/task.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../prisma/client.js";

type TaskInput = z.infer<typeof taskSchema>;

export class TaskService {
  public constructor(
    private readonly repository = new TaskRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public list(userId: string, search?: string) {
    return this.repository.list(userId, search);
  }

  public async create(input: TaskInput, userId: string) {
    const { clientId, categoryId, projectId, columnId, ...data } = input;
    const task = await this.repository.create({
      ...data,
      user: { connect: { id: userId } },
      column: { connect: { id: columnId } },
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      ...(projectId ? { project: { connect: { id: projectId } } } : {})
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Task", entityId: task.id, action: "CREATED" });
    return task;
  }

  public async update(id: string, input: TaskInput, userId: string) {
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Tarefa nao encontrada.");
    const { clientId, categoryId, projectId, columnId, ...data } = input;
    const task = await this.repository.update(id, {
      ...data,
      column: { connect: { id: columnId } },
      client: clientId ? { connect: { id: clientId } } : { disconnect: true },
      category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
      project: projectId ? { connect: { id: projectId } } : { disconnect: true }
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Task", entityId: id, action: "UPDATED" });
    return task;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.task.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Tarefa nao encontrada.");
    await this.repository.delete(id);
  }
}
