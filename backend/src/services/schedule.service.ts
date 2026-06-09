import type { z } from "zod";
import type { scheduleSchema } from "../validations/entities.validation.js";
import { ScheduleRepository } from "../repositories/schedule.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../prisma/client.js";
import { GoogleCalendarService } from "./google-calendar.service.js";

type ScheduleInput = z.infer<typeof scheduleSchema>;

export class ScheduleService {
  public constructor(
    private readonly repository = new ScheduleRepository(),
    private readonly auditRepository = new AuditRepository(),
    private readonly googleCalendarService = new GoogleCalendarService()
  ) {}

  public list(userId: string, start?: Date, end?: Date, search?: string) {
    return this.repository.list(userId, start, end, search);
  }

  private async syncWithGoogle(scheduleId: string, userId: string): Promise<void> {
    try {
      await this.googleCalendarService.syncSchedule(scheduleId, userId);
    } catch {
      await prisma.schedule.update({ where: { id: scheduleId }, data: { googleSyncStatus: "ERROR" } }).catch(() => undefined);
    }
  }

  public async create(input: ScheduleInput, userId: string) {
    const { clientId, projectId, categoryId, reminderAt, ...data } = input;
    const schedule = await this.repository.create({
      ...data,
      user: { connect: { id: userId } },
      ...(clientId ? { client: { connect: { id: clientId } } } : {}),
      ...(projectId ? { project: { connect: { id: projectId } } } : {}),
      ...(categoryId ? { category: { connect: { id: categoryId } } } : {}),
      ...(reminderAt ? { reminders: { create: { remindAt: reminderAt } } } : {})
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Schedule", entityId: schedule.id, action: "CREATED" });
    await this.syncWithGoogle(schedule.id, userId);
    return schedule;
  }

  public async update(id: string, input: ScheduleInput, userId: string) {
    const existing = await prisma.schedule.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Compromisso nao encontrado.");
    const { clientId, projectId, categoryId, reminderAt, ...data } = input;
    const schedule = await this.repository.update(id, {
      ...data,
      client: clientId ? { connect: { id: clientId } } : { disconnect: true },
      project: projectId ? { connect: { id: projectId } } : { disconnect: true },
      category: categoryId ? { connect: { id: categoryId } } : { disconnect: true },
      ...(reminderAt ? { reminders: { create: { remindAt: reminderAt } } } : {})
    });
    await this.auditRepository.log({ userId, clientId: clientId ?? undefined, entity: "Schedule", entityId: id, action: "UPDATED" });
    await this.syncWithGoogle(id, userId);
    return schedule;
  }

  public async delete(id: string, userId: string): Promise<void> {
    const existing = await prisma.schedule.findFirst({ where: { id, userId } });
    if (!existing) throw new ApiError(404, "Compromisso nao encontrado.");
    await this.googleCalendarService.deleteScheduleEvent(existing);
    await this.repository.delete(id);
  }
}
