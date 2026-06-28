import type { Request, Response } from "express";
import { z } from "zod";
import type { CrmLeadStatus, CrmPipelineStage, CrmProjectStatus } from "@prisma/client";
import { CrmService } from "../services/crm.service.js";
import { querySchema } from "../utils/pagination.js";
import { ApiError } from "../utils/api-error.js";

function userId(request: Request): string {
  if (!request.auth) throw new ApiError(401, "Nao autenticado.");
  return request.auth.userId;
}

function resourceId(request: Request): string {
  return z.string().parse(request.params.id);
}

const crmLeadFilterSchema = z.object({
  status: z.enum(["NEW", "IN_SERVICE", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).optional(),
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"]).optional(),
  responsible: z.string().optional(),
  source: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional()
});

const crmProjectFilterSchema = z.object({
  status: z.enum(["NOT_STARTED", "PLANNING", "IN_DEVELOPMENT", "IN_TESTS", "IN_APPROVAL", "IN_DEPLOYMENT", "IN_TRAINING", "COMPLETED", "CANCELLED"]).optional(),
  responsible: z.string().optional()
});

function escapeCsv(value: string | number): string {
  const text = String(value).replaceAll("\"", "\"\"");
  return `"${text}"`;
}

function escapePdf(text: string): string {
  return text.replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
}

function createPdf(lines: string[]): Buffer {
  const stream = lines.slice(0, 36).map((line, index) => `BT /F1 11 Tf 40 ${790 - index * 20} Td (${escapePdf(line)}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let document = "%PDF-1.4\n";
  const offsets = objects.map((object, index) => {
    const offset = Buffer.byteLength(document);
    document += `${index + 1} 0 obj\n${object}\nendobj\n`;
    return offset;
  });
  const xrefOffset = Buffer.byteLength(document);
  const xref = offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  document += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xref}trailer << /Root 1 0 R /Size ${objects.length + 1} >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(document);
}

export class CrmController {
  public constructor(private readonly service = new CrmService()) {}

  public dashboard = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.dashboard(userId(request)));
  };

  public listLeads = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const filters = crmLeadFilterSchema.parse(request.query);
    const result = await this.service.listLeads(userId(request), query, {
      ...filters,
      status: filters.status as CrmLeadStatus | undefined,
      stage: filters.stage as CrmPipelineStage | undefined
    });
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public leadCities = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.leadCities(userId(request)));
  };

  public leadStats = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.leadStats(userId(request)));
  };

  public getLead = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.getLead(resourceId(request), userId(request)));
  };

  public createLead = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createLead(userId(request), request.body));
  };

  public importLeads = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.importLeads(userId(request), request.body.rows));
  };

  public updateLead = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.updateLead(resourceId(request), userId(request), request.body));
  };

  public moveLeadStage = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.moveLeadStage(resourceId(request), userId(request), request.body.stage));
  };

  public deleteLead = async (request: Request, response: Response): Promise<void> => {
    await this.service.deleteLead(resourceId(request), userId(request));
    response.status(204).send();
  };

  public convertLead = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.convertLead(resourceId(request), userId(request)));
  };

  public listClients = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const result = await this.service.listClients(userId(request), query);
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public getClient = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.getClient(resourceId(request), userId(request)));
  };

  public clientIntelligence = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.clientIntelligence(resourceId(request), userId(request)));
  };

  public leadIntelligence = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.leadIntelligence(resourceId(request), userId(request)));
  };

  public pipelineInsights = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.pipelineInsights(userId(request)));
  };

  public listActivities = async (request: Request, response: Response): Promise<void> => {
    const filter = z.object({ leadId: z.string().optional(), clientId: z.string().optional() }).parse(request.query);
    response.json(await this.service.listActivities(userId(request), filter.leadId, filter.clientId));
  };

  public createActivity = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createActivity(userId(request), request.body));
  };

  public listProposals = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listProposals(userId(request)));
  };

  public createProposal = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createProposal(userId(request), request.body));
  };

  public updateProposal = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.updateProposal(resourceId(request), userId(request), request.body));
  };

  public listContracts = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listContracts(userId(request)));
  };

  public createContract = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createContract(userId(request), request.body));
  };

  public listProjects = async (request: Request, response: Response): Promise<void> => {
    const query = querySchema.parse(request.query);
    const filters = crmProjectFilterSchema.parse(request.query);
    const result = await this.service.listProjects(userId(request), query, { ...filters, status: filters.status as CrmProjectStatus | undefined });
    response.json({ ...result, page: query.page, pageSize: query.pageSize });
  };

  public createProject = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createProject(userId(request), request.body));
  };

  public updateProject = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.updateProject(resourceId(request), userId(request), request.body));
  };

  public createProjectTask = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createProjectTask(userId(request), request.body));
  };

  public listAutomations = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.listAutomations(userId(request)));
  };

  public createAutomation = async (request: Request, response: Response): Promise<void> => {
    response.status(201).json(await this.service.createAutomation(userId(request), request.body));
  };

  public updateAutomation = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.updateAutomation(resourceId(request), userId(request), request.body));
  };

  public reports = async (request: Request, response: Response): Promise<void> => {
    response.json(await this.service.reports(userId(request)));
  };

  public reportsCsv = async (request: Request, response: Response): Promise<void> => {
    const report = await this.service.reports(userId(request));
    const rows = [
      ["Indicador", "Valor"].map(escapeCsv).join(";"),
      ["Total de Leads", report.kpis.totalLeads].map(escapeCsv).join(";"),
      ["Vendas Fechadas", report.kpis.wonSales].map(escapeCsv).join(";"),
      ["Vendas Perdidas", report.kpis.lostSales].map(escapeCsv).join(";"),
      ["Taxa de Conversao", `${report.kpis.conversionRate}%`].map(escapeCsv).join(";"),
      ["Receita Prevista", report.kpis.forecastRevenue].map(escapeCsv).join(";"),
      ["Receita Realizada", report.kpis.realizedRevenue].map(escapeCsv).join(";")
    ];
    response.header("Content-Type", "text/csv; charset=utf-8");
    response.header("Content-Disposition", "attachment; filename=crm-comercial.csv");
    response.send(`\uFEFF${rows.join("\n")}`);
  };

  public reportsPdf = async (request: Request, response: Response): Promise<void> => {
    const report = await this.service.reports(userId(request));
    response.header("Content-Type", "application/pdf");
    response.header("Content-Disposition", "attachment; filename=crm-comercial.pdf");
    response.send(createPdf([
      "CRM Comercial Inteligente - Relatorio executivo",
      `Total de leads: ${report.kpis.totalLeads}`,
      `Vendas fechadas: ${report.kpis.wonSales}`,
      `Vendas perdidas: ${report.kpis.lostSales}`,
      `Taxa de conversao: ${report.kpis.conversionRate}%`,
      `Receita prevista: ${report.kpis.forecastRevenue}`,
      `Receita realizada: ${report.kpis.realizedRevenue}`,
      `Gerado em: ${report.generatedAt}`
    ]));
  };

  public reportsExcel = async (request: Request, response: Response): Promise<void> => {
    const report = await this.service.reports(userId(request));
    const html = `<table><tr><th>Indicador</th><th>Valor</th></tr><tr><td>Total de Leads</td><td>${report.kpis.totalLeads}</td></tr><tr><td>Vendas Fechadas</td><td>${report.kpis.wonSales}</td></tr><tr><td>Receita Prevista</td><td>${report.kpis.forecastRevenue}</td></tr><tr><td>Receita Realizada</td><td>${report.kpis.realizedRevenue}</td></tr></table>`;
    response.header("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    response.header("Content-Disposition", "attachment; filename=crm-comercial.xls");
    response.send(html);
  };
}
