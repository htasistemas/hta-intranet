import type {
  CrmActivityType,
  CrmLeadStatus,
  CrmPipelineStage,
  CrmProjectStatus,
  Prisma
} from "@prisma/client";
import type { z } from "zod";
import { startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { CrmRepository, type CrmLeadFilters, type CrmProjectFilters, type CrmScope } from "../repositories/crm.repository.js";
import type {
  crmActivitySchema,
  crmAutomationSchema,
  crmContractSchema,
  crmProjectSchema,
  crmProjectTaskSchema,
  crmProposalSchema
} from "../validations/entities.validation.js";
import { crmLeadSchema } from "../validations/entities.validation.js";
import type { ListQuery } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../prisma/client.js";

type LeadInput = z.infer<typeof crmLeadSchema>;
type ActivityInput = z.infer<typeof crmActivitySchema>;
type ProposalInput = z.infer<typeof crmProposalSchema>;
type ContractInput = z.infer<typeof crmContractSchema>;
type ProjectInput = z.infer<typeof crmProjectSchema>;
type ProjectTaskInput = z.infer<typeof crmProjectTaskSchema>;
type AutomationInput = z.infer<typeof crmAutomationSchema>;

function automaticRegistrationStatus(input: LeadInput): "COMPLETE" | "INCOMPLETE" | "UPDATING" {
  if (input.registrationStatusManual) return input.registrationStatus;
  const hasPhone = Boolean(input.phone?.trim() || input.whatsapp?.trim());
  const requiredValues = [input.name, input.company, input.document, input.segment, input.email, input.city, input.state, input.responsible];
  return hasPhone && requiredValues.every((value) => value?.trim()) ? "COMPLETE" : "INCOMPLETE";
}

interface CrmLeadImportRowError {
  row: number;
  name?: string;
  message: string;
}

interface CrmLeadImportResult {
  created: number;
  failed: number;
  errors: CrmLeadImportRowError[];
}

const stageStatusMap: Record<CrmPipelineStage, CrmLeadStatus> = {
  LEAD_RECEIVED: "NEW",
  FIRST_CONTACT: "IN_SERVICE",
  QUALIFICATION: "QUALIFIED",
  DEMONSTRATION: "QUALIFIED",
  PROPOSAL_SENT: "PROPOSAL_SENT",
  NEGOTIATION: "NEGOTIATION",
  APPROVAL: "NEGOTIATION",
  IMPLEMENTATION: "WON",
  SALE_COMPLETED: "WON",
  LOST: "LOST"
};

const stageProbability: Record<CrmPipelineStage, number> = {
  LEAD_RECEIVED: 5,
  FIRST_CONTACT: 12,
  QUALIFICATION: 25,
  DEMONSTRATION: 35,
  PROPOSAL_SENT: 55,
  NEGOTIATION: 70,
  APPROVAL: 85,
  IMPLEMENTATION: 95,
  SALE_COMPLETED: 100,
  LOST: 0
};

function scope(ownerId: string): CrmScope {
  return { ownerId, tenantId: "default" };
}

function normalizeEmail(email: string | null | undefined): string | null {
  return email && email.trim().length > 0 ? email.trim() : null;
}

function sumCurrency(values: Array<string | number | Prisma.Decimal | null | undefined>): number {
  return values.reduce<number>((total, value) => total + Number(value ?? 0), 0);
}

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export class CrmService {
  public constructor(private readonly repository = new CrmRepository()) {}

  public async dashboard(ownerId: string) {
    const currentScope = scope(ownerId);
    const [leads, projects, proposals] = await this.repository.dashboard(currentScope);
    const now = new Date();
    const today = startOfDay(now);
    const week = startOfWeek(now, { weekStartsOn: 1 });
    const month = startOfMonth(now);
    const wonLeads = leads.filter((lead) => lead.status === "WON");
    const lostLeads = leads.filter((lead) => lead.status === "LOST");
    const openLeads = leads.filter((lead) => !["WON", "LOST"].includes(lead.status));
    const sentProposals = proposals.filter((proposal) => proposal.status === "SENT");
    const realizedRevenue = sumCurrency(proposals.filter((proposal) => proposal.status === "APPROVED").map((proposal) => proposal.value));
    const negotiationValue = sumCurrency(openLeads.map((lead) => lead.estimatedValue));
    const weightedPipelineValue = openLeads.reduce((total, lead) => total + Number(lead.estimatedValue ?? 0) * (stageProbability[lead.stage] / 100), 0);
    const monthlyKeys = Array.from({ length: 6 }, (_, index) => monthKey(subMonths(now, 5 - index)));

    return {
      kpis: {
        totalLeads: leads.length,
        leadsToday: leads.filter((lead) => lead.createdAt >= today).length,
        leadsWeek: leads.filter((lead) => lead.createdAt >= week).length,
        leadsMonth: leads.filter((lead) => lead.createdAt >= month).length,
        openOpportunities: openLeads.length,
        proposalsSent: sentProposals.length,
        wonSales: wonLeads.length,
        lostSales: lostLeads.length,
        conversionRate: leads.length ? Math.round((wonLeads.length / leads.length) * 100) : 0,
        averageTicket: wonLeads.length ? realizedRevenue / wonLeads.length : 0,
        negotiationValue,
        weightedPipelineValue,
        forecastRevenue: negotiationValue + sumCurrency(sentProposals.map((proposal) => proposal.value)),
        realizedRevenue
      },
      funnel: Object.entries(stageStatusMap).map(([stage]) => ({ stage, total: leads.filter((lead) => lead.stage === stage).length })),
      leadsBySource: Object.entries(leads.reduce<Record<string, number>>((accumulator, lead) => {
        const key = lead.source ?? "Nao informado";
        accumulator[key] = (accumulator[key] ?? 0) + 1;
        return accumulator;
      }, {})).map(([name, total]) => ({ name, total })),
      salesByResponsible: Object.entries(wonLeads.reduce<Record<string, number>>((accumulator, lead) => {
        accumulator[lead.responsible] = (accumulator[lead.responsible] ?? 0) + 1;
        return accumulator;
      }, {})).map(([name, total]) => ({ name, total })),
      monthlySales: monthlyKeys.map((key) => ({ month: key, total: wonLeads.filter((lead) => monthKey(lead.wonAt ?? lead.updatedAt) === key).length })),
      conversionByStage: Object.entries(stageStatusMap).map(([stage]) => {
        const stageLeads = leads.filter((lead) => lead.stage === stage);
        const converted = stageLeads.filter((lead) => lead.status === "WON").length;
        return { stage, rate: stageLeads.length ? Math.round((converted / stageLeads.length) * 100) : 0 };
      }),
      projectsInProgress: projects.filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status)).map((project) => ({
        id: project.id,
        name: project.name,
        client: project.client.name,
        progress: project.progress,
        status: project.status
      }))
    };
  }

  public listLeads(ownerId: string, query: ListQuery, filters: CrmLeadFilters) {
    return this.repository.listLeads(scope(ownerId), query, filters);
  }

  public async leadCities(ownerId: string): Promise<Array<{ city: string; state: string; total: number }>> {
    const cities = await prisma.crmLead.groupBy({
      by: ["city", "state"],
      where: { ...scope(ownerId), deletedAt: null, convertedAt: null, city: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { city: "desc" } }
    });
    return cities.map((city) => ({ city: city.city ?? "Nao informada", state: city.state ?? "", total: city._count._all }));
  }

  public async leadStats(ownerId: string): Promise<{ total: number; open: number; qualified: number; estimatedTotal: number }> {
    const currentScope = scope(ownerId);
    const [total, open, qualified, aggregate] = await prisma.$transaction([
      prisma.crmLead.count({ where: { ...currentScope, deletedAt: null, convertedAt: null } }),
      prisma.crmLead.count({ where: { ...currentScope, deletedAt: null, convertedAt: null, status: { notIn: ["WON", "LOST"] } } }),
      prisma.crmLead.count({ where: { ...currentScope, deletedAt: null, convertedAt: null, status: { in: ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION"] } } }),
      prisma.crmLead.aggregate({ where: { ...currentScope, deletedAt: null, convertedAt: null, status: { notIn: ["WON", "LOST"] } }, _sum: { estimatedValue: true } })
    ]);
    return { total, open, qualified, estimatedTotal: Number(aggregate._sum.estimatedValue ?? 0) };
  }

  public async getLead(id: string, ownerId: string) {
    const lead = await this.repository.findLead(id, scope(ownerId));
    if (!lead) throw new ApiError(404, "Lead nao encontrado.");
    return lead;
  }

  public async createLead(ownerId: string, input: LeadInput) {
    const currentScope = scope(ownerId);
    const lead = await this.repository.createLead({
      ...input,
      registrationStatus: automaticRegistrationStatus(input),
      email: normalizeEmail(input.email),
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } }
    });
    await this.repository.createActivity({
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } },
      lead: { connect: { id: lead.id } },
      type: "STATUS_CHANGE",
      status: "COMPLETED",
      title: "Lead criado",
      responsible: input.responsible,
      completedAt: new Date()
    });
    return lead;
  }

  public async importLeads(ownerId: string, rows: unknown[]): Promise<CrmLeadImportResult> {
    const result: CrmLeadImportResult = { created: 0, failed: 0, errors: [] };
    const currentScope = scope(ownerId);
    const validRows: LeadInput[] = [];

    for (const [index, row] of rows.entries()) {
      const line = index + 2;
      const parsed = crmLeadSchema.safeParse(row);
      if (!parsed.success) {
        result.failed += 1;
        result.errors.push({ row: line, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
        continue;
      }
      validRows.push(parsed.data);
    }

    for (let index = 0; index < validRows.length; index += 1000) {
      const chunk = validRows.slice(index, index + 1000);
      const created = await prisma.crmLead.createMany({
        data: chunk.map((lead) => ({
          ...lead,
          registrationStatus: automaticRegistrationStatus(lead),
          email: normalizeEmail(lead.email),
          tenantId: currentScope.tenantId,
          ownerId
        }))
      });
      result.created += created.count;
    }

    return result;
  }

  public async updateLead(id: string, ownerId: string, input: LeadInput) {
    const current = await this.getLead(id, ownerId);
    const lead = await this.repository.updateLead(id, {
      ...input,
      registrationStatus: automaticRegistrationStatus(input),
      email: normalizeEmail(input.email),
      wonAt: input.status === "WON" ? current.wonAt ?? new Date() : current.wonAt,
      lostAt: input.status === "LOST" ? current.lostAt ?? new Date() : current.lostAt
    });
    if (current.status !== input.status || current.stage !== input.stage) {
      await this.repository.createActivity({
        tenantId: scope(ownerId).tenantId,
        owner: { connect: { id: ownerId } },
        lead: { connect: { id } },
        type: "STATUS_CHANGE",
        status: "COMPLETED",
        title: `Status atualizado para ${input.status}`,
        responsible: input.responsible,
        completedAt: new Date(),
        metadata: { fromStatus: current.status, toStatus: input.status, fromStage: current.stage, toStage: input.stage }
      });
    }
    return lead;
  }

  public async moveLeadStage(id: string, ownerId: string, stage: CrmPipelineStage) {
    const lead = await this.getLead(id, ownerId);
    const status = stageStatusMap[stage];
    const updated = await this.repository.updateLead(id, {
      stage,
      status,
      lastInteractionAt: new Date(),
      wonAt: status === "WON" ? lead.wonAt ?? new Date() : lead.wonAt,
      lostAt: status === "LOST" ? lead.lostAt ?? new Date() : lead.lostAt
    });
    await this.repository.createActivity({
      tenantId: scope(ownerId).tenantId,
      owner: { connect: { id: ownerId } },
      lead: { connect: { id } },
      type: "STATUS_CHANGE",
      status: "COMPLETED",
      title: `Etapa alterada para ${stage}`,
      responsible: lead.responsible,
      completedAt: new Date(),
      metadata: { fromStage: lead.stage, toStage: stage }
    });
    if (stage === "SALE_COMPLETED") await this.convertLead(id, ownerId);
    return updated;
  }

  public async deleteLead(id: string, ownerId: string) {
    await this.getLead(id, ownerId);
    await this.repository.softDeleteLead(id);
  }

  public listClients(ownerId: string, query: ListQuery) {
    return this.repository.listClients(scope(ownerId), query);
  }

  public async getClient(id: string, ownerId: string) {
    const client = await this.repository.findClient(id, scope(ownerId));
    if (!client) throw new ApiError(404, "Cliente CRM nao encontrado.");
    return client;
  }

  public listActivities(ownerId: string, leadId?: string, clientId?: string) {
    return this.repository.listActivities(scope(ownerId), leadId, clientId);
  }

  public createActivity(ownerId: string, input: ActivityInput) {
    const currentScope = scope(ownerId);
    return this.repository.createActivity({
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } },
      ...(input.leadId ? { lead: { connect: { id: input.leadId } } } : {}),
      ...(input.clientId ? { client: { connect: { id: input.clientId } } } : {}),
      ...(input.projectId ? { project: { connect: { id: input.projectId } } } : {}),
      type: input.type,
      status: input.status,
      title: input.title,
      description: input.description,
      responsible: input.responsible,
      scheduledAt: input.scheduledAt,
      completedAt: input.completedAt
    });
  }

  public listProposals(ownerId: string) {
    return this.repository.listProposals(scope(ownerId));
  }

  public async createProposal(ownerId: string, input: ProposalInput) {
    const currentScope = scope(ownerId);
    const proposal = await this.repository.createProposal({
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } },
      ...(input.leadId ? { lead: { connect: { id: input.leadId } } } : {}),
      ...(input.clientId ? { client: { connect: { id: input.clientId } } } : {}),
      number: input.number,
      product: input.product,
      value: input.value,
      discount: input.discount,
      paymentTerms: input.paymentTerms,
      deadline: input.deadline,
      observations: input.observations,
      status: input.status,
      versionHistory: [{ version: 1, status: input.status, createdAt: new Date().toISOString() }]
    });
    if (input.leadId) {
      await this.repository.updateLead(input.leadId, { status: "PROPOSAL_SENT", stage: "PROPOSAL_SENT" });
    }
    return proposal;
  }

  public updateProposal(id: string, ownerId: string, input: ProposalInput) {
    return this.repository.updateProposal(id, {
      ...input,
      lead: input.leadId ? { connect: { id: input.leadId } } : { disconnect: true },
      client: input.clientId ? { connect: { id: input.clientId } } : { disconnect: true },
      version: { increment: 1 },
      versionHistory: { push: { status: input.status, updatedAt: new Date().toISOString() } },
      approvedAt: input.status === "APPROVED" ? new Date() : null,
      rejectedAt: input.status === "REJECTED" ? new Date() : null,
      owner: { connect: { id: ownerId } }
    });
  }

  public listContracts(ownerId: string) {
    return this.repository.listContracts(scope(ownerId));
  }

  public createContract(ownerId: string, input: ContractInput) {
    const currentScope = scope(ownerId);
    return this.repository.createContract({
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } },
      client: { connect: { id: input.clientId } },
      proposalId: input.proposalId,
      number: input.number,
      serviceOrder: input.serviceOrder,
      value: input.value,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      observations: input.observations
    });
  }

  public listProjects(ownerId: string, query: ListQuery, filters: CrmProjectFilters) {
    return this.repository.listProjects(scope(ownerId), query, filters);
  }

  public createProject(ownerId: string, input: ProjectInput) {
    const currentScope = scope(ownerId);
    return this.repository.createProject({
      tenantId: currentScope.tenantId,
      owner: { connect: { id: ownerId } },
      client: { connect: { id: input.clientId } },
      name: input.name,
      responsible: input.responsible,
      team: input.team,
      priority: input.priority,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      budget: input.budget,
      plannedHours: input.plannedHours,
      executedHours: input.executedHours,
      progress: input.progress,
      observations: input.observations
    });
  }

  public updateProject(id: string, ownerId: string, input: ProjectInput) {
    return this.repository.updateProject(id, {
      owner: { connect: { id: ownerId } },
      client: { connect: { id: input.clientId } },
      name: input.name,
      responsible: input.responsible,
      team: input.team,
      priority: input.priority,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      budget: input.budget,
      plannedHours: input.plannedHours,
      executedHours: input.executedHours,
      progress: input.progress,
      observations: input.observations
    });
  }

  public createProjectTask(ownerId: string, input: ProjectTaskInput) {
    return this.repository.createProjectTask({
      tenantId: scope(ownerId).tenantId,
      project: { connect: { id: input.projectId } },
      ...(input.parentTaskId ? { parentTask: { connect: { id: input.parentTaskId } } } : {}),
      title: input.title,
      description: input.description,
      responsible: input.responsible,
      priority: input.priority,
      status: input.status,
      startDate: input.startDate,
      endDate: input.endDate,
      plannedHours: input.plannedHours,
      checklist: input.checklist,
      attachments: input.attachments,
      comments: input.comments
    });
  }

  public listAutomations(ownerId: string) {
    return this.repository.listAutomations(scope(ownerId));
  }

  public createAutomation(ownerId: string, input: AutomationInput) {
    return this.repository.createAutomation({ ...input, tenantId: scope(ownerId).tenantId, owner: { connect: { id: ownerId } } });
  }

  public updateAutomation(id: string, ownerId: string, input: AutomationInput) {
    return this.repository.updateAutomation(id, { ...input, owner: { connect: { id: ownerId } } });
  }

  public async convertLead(id: string, ownerId: string) {
    const lead = await this.getLead(id, ownerId);
    if (lead.clientId) return lead.client;
    const currentScope = scope(ownerId);
    return this.repository.transaction(async (tx) => {
      const client = await tx.crmClient.create({
        data: {
          tenantId: currentScope.tenantId,
          ownerId,
          name: lead.name,
          company: lead.company,
          document: lead.document,
          segment: lead.segment,
          email: lead.email,
          phone: lead.phone,
          whatsapp: lead.whatsapp,
          postalCode: lead.postalCode,
          street: lead.street,
          number: lead.number,
          district: lead.district,
          city: lead.city,
          state: lead.state,
          observations: lead.observations
        }
      });
      const project = await tx.crmProject.create({
        data: {
          tenantId: currentScope.tenantId,
          ownerId,
          clientId: client.id,
          name: `Projeto - ${lead.company ?? lead.name}`,
          responsible: lead.responsible,
          priority: lead.priority,
          status: "NOT_STARTED",
          budget: lead.estimatedValue,
          plannedHours: 0,
          executedHours: 0,
          progress: 0
        }
      });
      const suffix = String(Date.now()).slice(-6);
      const contract = await tx.crmContract.create({
        data: {
          tenantId: currentScope.tenantId,
          ownerId,
          clientId: client.id,
          number: `CTR-${suffix}`,
          serviceOrder: `OS-${suffix}`,
          value: lead.estimatedValue ?? 0,
          status: "ACTIVE",
          startDate: new Date(),
          observations: "Contrato criado automaticamente a partir de venda concluida."
        }
      });
      await tx.crmLead.update({ where: { id }, data: { clientId: client.id, status: "WON", stage: "SALE_COMPLETED", convertedAt: new Date(), wonAt: lead.wonAt ?? new Date() } });
      await tx.crmActivity.create({
        data: {
          tenantId: currentScope.tenantId,
          ownerId,
          leadId: id,
          clientId: client.id,
          projectId: project.id,
          type: "STATUS_CHANGE" satisfies CrmActivityType,
          status: "COMPLETED",
          title: "Lead convertido em cliente, contrato, OS e projeto",
          responsible: lead.responsible,
          completedAt: new Date(),
          metadata: { contractId: contract.id, serviceOrder: contract.serviceOrder }
        }
      });
      return client;
    });
  }

  public async activateLeadAsClient(id: string, ownerId: string) {
    const lead = await this.getLead(id, ownerId);
    const email = normalizeEmail(lead.email);
    const existingClient = lead.document
      ? await prisma.client.findUnique({ where: { document: lead.document } })
      : email
        ? await prisma.client.findFirst({ where: { ownerId, email } })
        : null;
    if (existingClient && existingClient.ownerId !== ownerId) {
      throw new ApiError(409, "Ja existe um cliente com este documento em outro cadastro.");
    }

    const data = {
      ownerId,
      name: lead.name,
      document: lead.document,
      type: lead.document && lead.document.replace(/\D/g, "").length > 11 ? "COMPANY" as const : "INDIVIDUAL" as const,
      legalName: lead.company,
      tradeName: lead.company,
      email,
      phone: lead.phone,
      whatsapp: lead.whatsapp,
      postalCode: lead.postalCode,
      street: lead.street,
      number: lead.number,
      district: lead.district,
      city: lead.city,
      state: lead.state,
      observations: lead.observations,
      status: "ACTIVE" as const,
      source: lead.source,
      segment: lead.segment,
      responsible: lead.responsible,
      priority: lead.priority,
      temperature: lead.score,
      expectedValue: lead.estimatedValue,
      nextFollowUpAt: lead.nextFollowUpAt
    } satisfies Prisma.ClientUncheckedCreateInput;

    return prisma.$transaction(async (tx) => {
      const updateData: Prisma.ClientUncheckedUpdateInput = { ...data };
      delete updateData.ownerId;
      const client = existingClient
        ? await tx.client.update({ where: { id: existingClient.id }, data: updateData })
        : await tx.client.create({ data });
      await tx.crmLead.update({
        where: { id },
        data: {
          status: "WON",
          stage: "SALE_COMPLETED",
          convertedAt: new Date(),
          wonAt: lead.wonAt ?? new Date()
        }
      });
      await tx.auditLog.create({
        data: {
          userId: ownerId,
          clientId: client.id,
          entity: "Client",
          entityId: client.id,
          action: existingClient ? "UPDATED" : "CREATED",
          changes: { source: "crmLead", leadId: id }
        }
      });
      await tx.crmActivity.create({
        data: {
          tenantId: scope(ownerId).tenantId,
          ownerId,
          leadId: id,
          type: "STATUS_CHANGE" satisfies CrmActivityType,
          status: "COMPLETED",
          title: "Captacao convertida em cliente ativo",
          responsible: lead.responsible,
          completedAt: new Date(),
          metadata: { clientId: client.id }
        }
      });
      return client;
    });
  }

  public async reports(ownerId: string) {
    const data = await this.dashboard(ownerId);
    return {
      ...data,
      generatedAt: new Date().toISOString()
    };
  }

  public async clientIntelligence(id: string, ownerId: string) {
    const client = await this.getClient(id, ownerId);
    const latestScore = client.scores?.[0];
    const openProjects = client.projects?.filter((project) => !["COMPLETED", "CANCELLED"].includes(project.status)) ?? [];
    const openProposals = client.proposals?.filter((proposal) => ["DRAFT", "SENT"].includes(proposal.status)) ?? [];
    const lastActivity = client.activities?.[0];
    const lastMessage = client.messages?.[0];
    const hasRecentContact = Boolean(lastActivity && Date.now() - new Date(lastActivity.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
    const nextAction = !hasRecentContact
      ? "Realizar follow-up com o cliente ainda hoje."
      : openProposals.length
        ? "Revisar proposta aberta e confirmar decisor/responsavel pela aprovacao."
        : openProjects.length
          ? "Atualizar status do projeto e alinhar proxima entrega."
          : "Mapear nova oportunidade comercial ou acao de relacionamento.";
    return {
      summary: `${client.name} possui ${client.leads?.length ?? 0} lead(s), ${openProposals.length} proposta(s) aberta(s), ${openProjects.length} projeto(s) em andamento e score ${latestScore?.score ?? "nao calculado"}.`,
      risk: latestScore?.riskLevel ?? "NOT_CALCULATED",
      nextAction,
      suggestedMessage: `Ola ${client.name}, tudo bem? Estou entrando em contato para acompanhar seu atendimento e alinhar os proximos passos.`,
      lastActivityAt: lastActivity?.createdAt ?? null,
      lastMessageAt: lastMessage?.createdAt ?? null
    };
  }

  public async leadIntelligence(id: string, ownerId: string) {
    const lead = await this.getLead(id, ownerId);
    const probability = stageProbability[lead.stage];
    const idleDays = Math.floor((Date.now() - new Date(lead.lastInteractionAt ?? lead.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const nextAction = lead.status === "LOST"
      ? "Registrar aprendizado do motivo de perda e programar reativacao futura."
      : idleDays > 3
        ? "Lead parado: executar contato de follow-up e atualizar proxima acao."
        : lead.stage === "PROPOSAL_SENT"
          ? "Confirmar recebimento da proposta e prazo de decisao."
          : "Avancar qualificacao e validar dor, orcamento e decisor.";
    return {
      probability,
      weightedValue: Number(lead.estimatedValue ?? 0) * (probability / 100),
      idleDays,
      nextAction,
      suggestedMessage: `Ola ${lead.name}, tudo bem? Gostaria de dar continuidade ao nosso atendimento e entender como posso ajudar nos proximos passos.`,
      risk: idleDays > 7 ? "HIGH" : idleDays > 3 ? "MEDIUM" : "LOW"
    };
  }

  public async pipelineInsights(ownerId: string) {
    const leads = await prisma.crmLead.findMany({ where: { ...scope(ownerId), deletedAt: null } });
    const openLeads = leads.filter((lead) => !["WON", "LOST"].includes(lead.status));
    const staleLeads = openLeads.filter((lead) => Date.now() - new Date(lead.lastInteractionAt ?? lead.createdAt).getTime() > 3 * 24 * 60 * 60 * 1000);
    return {
      openLeads: openLeads.length,
      staleLeads: staleLeads.length,
      weightedPipelineValue: openLeads.reduce((total, lead) => total + Number(lead.estimatedValue ?? 0) * (stageProbability[lead.stage] / 100), 0),
      byStage: Object.keys(stageProbability).map((stage) => ({
        stage,
        total: openLeads.filter((lead) => lead.stage === stage).length,
        probability: stageProbability[stage as CrmPipelineStage]
      })),
      recommendations: [
        staleLeads.length ? `Existem ${staleLeads.length} lead(s) parados ha mais de 3 dias.` : "Nao ha leads parados acima do limite operacional.",
        "Priorize propostas enviadas e negociacoes com maior valor ponderado.",
        "Mantenha motivo de perda preenchido para melhorar analise comercial."
      ]
    };
  }
}
