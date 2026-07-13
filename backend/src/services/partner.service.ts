import type { z } from "zod";
import { PartnerRepository } from "../repositories/partner.repository.js";
import { AuditRepository } from "../repositories/audit.repository.js";
import type { partnerInteractionSchema, partnerSchema } from "../validations/entities.validation.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

type PartnerInput = z.infer<typeof partnerSchema>;
type PartnerInteractionInput = z.infer<typeof partnerInteractionSchema>;

export class PartnerService {
  public constructor(
    private readonly repository = new PartnerRepository(),
    private readonly auditRepository = new AuditRepository()
  ) {}

  public list(userId: string, query: ListQuery) {
    return this.repository.list(userId, query);
  }

  public async get(id: string, userId: string) {
    const partner = await this.repository.findById(id, userId);
    if (!partner) throw new ApiError(404, "Parceiro nao encontrado.");
    return partner;
  }

  public async create(input: PartnerInput, userId: string) {
    const { projectIds, ...data } = input;
    const partner = await this.repository.create({
      ...data,
      owner: { connect: { id: userId } },
      ...(projectIds.length ? { projectLinks: { create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) } } : {})
    });
    await this.auditRepository.log({ userId, entity: "Partner", entityId: partner.id, action: "CREATED" });
    return partner;
  }

  public async update(id: string, input: PartnerInput, userId: string) {
    await this.get(id, userId);
    const { projectIds, ...data } = input;
    const partner = await this.repository.update(id, {
      ...data,
      projectLinks: { deleteMany: {}, create: projectIds.map((projectId) => ({ project: { connect: { id: projectId } } })) }
    });
    await this.auditRepository.log({ userId, entity: "Partner", entityId: id, action: "UPDATED" });
    return partner;
  }

  public async delete(id: string, userId: string): Promise<void> {
    await this.get(id, userId);
    await this.repository.delete(id);
    await this.auditRepository.log({ userId, entity: "Partner", entityId: id, action: "DELETED" });
  }

  public async createInteraction(partnerId: string, input: PartnerInteractionInput, userId: string) {
    await this.get(partnerId, userId);
    const interaction = await this.repository.createInteraction({
      type: input.type,
      title: input.title,
      description: input.description,
      occurredAt: input.occurredAt ?? new Date(),
      nextStep: input.nextStep,
      partner: { connect: { id: partnerId } },
      owner: { connect: { id: userId } }
    });
    await this.auditRepository.log({ userId, entity: "PartnerInteraction", entityId: interaction.id, action: "CREATED" });
    return interaction;
  }
}
