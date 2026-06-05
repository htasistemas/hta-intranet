import type { CrmLeadStatus, CrmPipelineStage, CrmProjectStatus, Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";
import { pagination, type ListQuery } from "../utils/pagination.js";

const leadInclude = {
  client: true,
  activities: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 8 },
  proposals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } }
} satisfies Prisma.CrmLeadInclude;

const clientInclude = {
  leads: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
  activities: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
  proposals: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
  contracts: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
  projects: { where: { deletedAt: null }, include: { tasks: { where: { deletedAt: null } } }, orderBy: { createdAt: "desc" } },
  messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } },
  scores: { orderBy: { calculatedAt: "desc" }, take: 5 }
} satisfies Prisma.CrmClientInclude;

const projectInclude = {
  client: true,
  tasks: { where: { deletedAt: null }, include: { subtasks: { where: { deletedAt: null } } }, orderBy: { createdAt: "desc" } }
} satisfies Prisma.CrmProjectInclude;

export interface CrmScope {
  ownerId: string;
  tenantId: string;
}

export interface CrmLeadFilters {
  status?: CrmLeadStatus;
  stage?: CrmPipelineStage;
  responsible?: string;
  source?: string;
  priority?: "LOW" | "MEDIUM" | "HIGH" | "URGENT";
}

export interface CrmProjectFilters {
  status?: CrmProjectStatus;
  responsible?: string;
}

export class CrmRepository {
  public async listLeads(scope: CrmScope, query: ListQuery, filters: CrmLeadFilters): Promise<{ data: unknown[]; total: number }> {
    const where: Prisma.CrmLeadWhereInput = {
      ...scope,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.stage ? { stage: filters.stage } : {}),
      ...(filters.responsible ? { responsible: { contains: filters.responsible, mode: "insensitive" } } : {}),
      ...(filters.source ? { source: { contains: filters.source, mode: "insensitive" } } : {}),
      ...(filters.priority ? { priority: filters.priority } : {}),
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { company: { contains: query.search, mode: "insensitive" } },
          { document: { contains: query.search } },
          { email: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    const orderBy: Prisma.CrmLeadOrderByWithRelationInput = query.sortBy === "name" ? { name: query.order } : { createdAt: query.order };
    const [data, total] = await prisma.$transaction([
      prisma.crmLead.findMany({ where, ...pagination(query), orderBy, include: leadInclude }),
      prisma.crmLead.count({ where })
    ]);
    return { data, total };
  }

  public findLead(id: string, scope: CrmScope) {
    return prisma.crmLead.findFirst({ where: { id, ...scope, deletedAt: null }, include: { ...leadInclude, activities: { where: { deletedAt: null }, orderBy: { createdAt: "desc" } } } });
  }

  public createLead(data: Prisma.CrmLeadCreateInput) {
    return prisma.crmLead.create({ data, include: leadInclude });
  }

  public updateLead(id: string, data: Prisma.CrmLeadUpdateInput) {
    return prisma.crmLead.update({ where: { id }, data, include: leadInclude });
  }

  public softDeleteLead(id: string) {
    return prisma.crmLead.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  public listClients(scope: CrmScope, query: ListQuery): Promise<{ data: unknown[]; total: number }> {
    const where: Prisma.CrmClientWhereInput = {
      ...scope,
      deletedAt: null,
      ...(query.search ? {
        OR: [
          { name: { contains: query.search, mode: "insensitive" } },
          { company: { contains: query.search, mode: "insensitive" } },
          { document: { contains: query.search } },
          { email: { contains: query.search, mode: "insensitive" } }
        ]
      } : {})
    };
    return prisma.$transaction([
      prisma.crmClient.findMany({ where, ...pagination(query), orderBy: { createdAt: query.order }, include: clientInclude }),
      prisma.crmClient.count({ where })
    ]).then(([data, total]) => ({ data, total }));
  }

  public findClient(id: string, scope: CrmScope) {
    return prisma.crmClient.findFirst({ where: { id, ...scope, deletedAt: null }, include: clientInclude });
  }

  public listActivities(scope: CrmScope, leadId?: string, clientId?: string) {
    return prisma.crmActivity.findMany({
      where: { ...scope, deletedAt: null, ...(leadId ? { leadId } : {}), ...(clientId ? { clientId } : {}) },
      orderBy: [{ scheduledAt: "desc" }, { createdAt: "desc" }],
      include: { lead: true, client: true, project: true }
    });
  }

  public createActivity(data: Prisma.CrmActivityCreateInput) {
    return prisma.crmActivity.create({ data, include: { lead: true, client: true, project: true } });
  }

  public listProposals(scope: CrmScope) {
    return prisma.crmProposal.findMany({ where: { ...scope, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { lead: true, client: true } });
  }

  public createProposal(data: Prisma.CrmProposalCreateInput) {
    return prisma.crmProposal.create({ data, include: { lead: true, client: true } });
  }

  public updateProposal(id: string, data: Prisma.CrmProposalUpdateInput) {
    return prisma.crmProposal.update({ where: { id }, data, include: { lead: true, client: true } });
  }

  public listContracts(scope: CrmScope) {
    return prisma.crmContract.findMany({ where: { ...scope, deletedAt: null }, orderBy: { createdAt: "desc" }, include: { client: true } });
  }

  public createContract(data: Prisma.CrmContractCreateInput) {
    return prisma.crmContract.create({ data, include: { client: true } });
  }

  public listProjects(scope: CrmScope, query: ListQuery, filters: CrmProjectFilters): Promise<{ data: unknown[]; total: number }> {
    const where: Prisma.CrmProjectWhereInput = {
      ...scope,
      deletedAt: null,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.responsible ? { responsible: { contains: filters.responsible, mode: "insensitive" } } : {}),
      ...(query.search ? { OR: [{ name: { contains: query.search, mode: "insensitive" } }, { client: { name: { contains: query.search, mode: "insensitive" } } }] } : {})
    };
    return prisma.$transaction([
      prisma.crmProject.findMany({ where, ...pagination(query), orderBy: { createdAt: query.order }, include: projectInclude }),
      prisma.crmProject.count({ where })
    ]).then(([data, total]) => ({ data, total }));
  }

  public createProject(data: Prisma.CrmProjectCreateInput) {
    return prisma.crmProject.create({ data, include: projectInclude });
  }

  public updateProject(id: string, data: Prisma.CrmProjectUpdateInput) {
    return prisma.crmProject.update({ where: { id }, data, include: projectInclude });
  }

  public createProjectTask(data: Prisma.CrmProjectTaskCreateInput) {
    return prisma.crmProjectTask.create({ data, include: { project: { include: { client: true } }, subtasks: true } });
  }

  public listAutomations(scope: CrmScope) {
    return prisma.crmAutomation.findMany({ where: { ...scope, deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  public createAutomation(data: Prisma.CrmAutomationCreateInput) {
    return prisma.crmAutomation.create({ data });
  }

  public updateAutomation(id: string, data: Prisma.CrmAutomationUpdateInput) {
    return prisma.crmAutomation.update({ where: { id }, data });
  }

  public dashboard(scope: CrmScope) {
    return prisma.$transaction([
      prisma.crmLead.findMany({ where: { ...scope, deletedAt: null }, include: { proposals: true } }),
      prisma.crmProject.findMany({ where: { ...scope, deletedAt: null }, include: { client: true } }),
      prisma.crmProposal.findMany({ where: { ...scope, deletedAt: null }, include: { lead: true } })
    ]);
  }

  public transaction<T>(handler: (tx: Prisma.TransactionClient) => Promise<T>) {
    return prisma.$transaction(handler);
  }
}
