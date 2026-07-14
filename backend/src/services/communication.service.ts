import type {
  CommunicationChannel,
  CommunicationProvider,
  CommunicationStatus,
  CrmPipelineStage,
  Priority,
  Prisma
} from "@prisma/client";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import type { z } from "zod";
import { randomBytes } from "node:crypto";
import { differenceInHours } from "date-fns";
import nodemailer from "nodemailer";
import { prisma } from "../prisma/client.js";
import { ApiError } from "../utils/api-error.js";
import { decryptSecret, encryptSecret } from "../utils/crypto.js";
import { env } from "../utils/env.js";
import type {
  communicationCampaignSchema,
  communicationProviderConfigSchema,
  communicationSendSchema,
  communicationTemplateSchema,
  communicationWebhookSchema,
  crmGoalSchema,
  crmSlaRuleSchema
} from "../validations/entities.validation.js";

type ProviderConfigInput = z.infer<typeof communicationProviderConfigSchema>;
type TemplateInput = z.infer<typeof communicationTemplateSchema>;
type SendInput = z.infer<typeof communicationSendSchema>;
type CampaignInput = z.infer<typeof communicationCampaignSchema>;
type GoalInput = z.infer<typeof crmGoalSchema>;
type SlaRuleInput = z.infer<typeof crmSlaRuleSchema>;
type WebhookInput = z.infer<typeof communicationWebhookSchema>;

interface CrmScope {
  ownerId: string;
  tenantId: string;
}

interface ProviderSendResult {
  provider: CommunicationProvider;
  providerMessageId: string | null;
}

interface CampaignFilters {
  segment?: string | null;
  city?: string | null;
  state?: string | null;
  hasEmail?: boolean;
  hasWhatsapp?: boolean;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const fallbackProvider: Record<CommunicationChannel, CommunicationProvider> = {
  EMAIL: "WEBHOOK",
  WHATSAPP: "WEBHOOK"
};
const publicBaseUrl = (env.EMAIL_TRACKING_BASE_URL ?? env.FRONTEND_URL).replace(/\/+$/, "");

function scope(ownerId: string): CrmScope {
  return { ownerId, tenantId: "default" };
}

function renderTemplate(value: string, variables: Record<string, string | number | boolean | null>): string {
  const rendered = Object.entries(variables).reduce((text, [key, variable]) => text.replaceAll(`{{${key}}}`, String(variable ?? "")), value);
  const unresolvedVariables = [...rendered.matchAll(/{{\s*([\w-]+)\s*}}/g)].map((match) => match[1]).filter((key): key is string => Boolean(key));
  if (unresolvedVariables.length > 0) {
    throw new ApiError(400, `Variaveis sem valor no template: ${[...new Set(unresolvedVariables)].join(", ")}.`);
  }
  return rendered;
}

function clientVariables(client: { name: string; company: string | null; email: string | null; whatsapp: string | null; city: string | null }): Record<string, string | number | boolean | null> {
  return { cliente: client.name, contato: client.name, empresa: client.company ?? client.name, email: client.email, whatsapp: client.whatsapp, cidade: client.city };
}

function leadVariables(lead: { name: string; company: string | null; email: string | null; whatsapp: string | null; city: string | null; responsible: string }): Record<string, string | number | boolean | null> {
  const contactName = lead.responsible.trim() && lead.responsible.toLowerCase() !== "nao informado" ? lead.responsible.trim() : lead.name;
  return {
    cliente: lead.name,
    lead: lead.name,
    contato: contactName,
    empresa: lead.company ?? lead.name,
    email: lead.email,
    whatsapp: lead.whatsapp,
    cidade: lead.city,
    responsavel: lead.responsible
  };
}

async function postProvider(config: { endpointUrl: string | null; apiKeyEncrypted: string | null; metadata: Prisma.JsonValue }, payload: Record<string, unknown>): Promise<string | null> {
  if (!config.endpointUrl) return `SIM-${Date.now()}`;
  const token = config.apiKeyEncrypted ? decryptSecret(config.apiKeyEncrypted) : null;
  const response = await fetch(config.endpointUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new ApiError(response.status, "Provider de comunicacao recusou o envio.");
  const body = await response.json().catch(() => ({})) as { id?: string; messageId?: string };
  return body.messageId ?? body.id ?? null;
}

function smtpConfigured(): boolean {
  return Boolean(env.APP_EMAIL_HABILITADO && env.MAIL_HOST && env.MAIL_PORT && env.MAIL_USER && env.MAIL_PASS && env.APP_EMAIL_REMETENTE);
}

function addressAccepted(result: SMTPTransport.SentMessageInfo, recipient: string): boolean {
  const accepted = result.accepted.map((address) => String(address).toLowerCase());
  return accepted.includes(recipient.toLowerCase());
}

async function sendSmtp(message: { recipient: string; recipientName: string | null; subject: string | null; body: string; trackingToken: string | null }): Promise<string | null> {
  if (!smtpConfigured()) throw new ApiError(500, "Servidor de e-mail SMTP nao configurado.");
  if (env.MAIL_PASS === "trocar_por_app_password") throw new ApiError(500, "Configure MAIL_PASS com a senha de app do Gmail.");
  const host = env.MAIL_HOST;
  const port = env.MAIL_PORT;
  const user = env.MAIL_USER;
  const pass = env.MAIL_PASS;
  const fromAddress = env.APP_EMAIL_REMETENTE;
  if (!host || !port || !user || !pass || !fromAddress) throw new ApiError(500, "Servidor de e-mail SMTP incompleto.");
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
  await transporter.verify();
  const result = await transporter.sendMail({
    from: { address: fromAddress, name: env.APP_EMAIL_NOME ?? fromAddress },
    to: message.recipientName ? { address: message.recipient, name: message.recipientName } : message.recipient,
    subject: message.subject ?? "Contato HTA Sistemas",
    text: message.body,
    html: `${message.body.replace(/\n/g, "<br />")}${message.trackingToken ? `<img src="${publicBaseUrl}/api/communication/track/open/${encodeURIComponent(message.trackingToken)}.gif" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0" />` : ""}`
  });
  if (result.rejected.length > 0 || !addressAccepted(result, message.recipient)) {
    throw new ApiError(502, `Servidor SMTP nao aceitou o destinatario ${message.recipient}.`);
  }
  return result.messageId ?? null;
}

export class CommunicationService {
  public listProviderConfigs(ownerId: string) {
    return prisma.communicationProviderConfig.findMany({
      where: { ...scope(ownerId), deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, channel: true, provider: true, name: true, senderName: true, senderAddress: true, endpointUrl: true, defaultFrom: true, active: true, metadata: true, createdAt: true }
    });
  }

  public saveProviderConfig(ownerId: string, input: ProviderConfigInput) {
    const currentScope = scope(ownerId);
    return prisma.communicationProviderConfig.create({
      data: {
        tenantId: currentScope.tenantId,
        ownerId,
        channel: input.channel,
        provider: input.provider,
        name: input.name,
        senderName: input.senderName,
        senderAddress: input.senderAddress,
        endpointUrl: input.endpointUrl,
        apiKeyEncrypted: input.apiKey ? encryptSecret(input.apiKey) : null,
        apiSecretEncrypted: input.apiSecret ? encryptSecret(input.apiSecret) : null,
        defaultFrom: input.defaultFrom,
        active: input.active,
        metadata: input.metadata
      }
    });
  }

  public listTemplates(ownerId: string) {
    return prisma.communicationTemplate.findMany({ where: { ...scope(ownerId), deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  public saveTemplate(ownerId: string, input: TemplateInput) {
    return prisma.communicationTemplate.create({ data: { ...input, tenantId: scope(ownerId).tenantId, ownerId } });
  }

  public async updateTemplate(ownerId: string, templateId: string, input: TemplateInput) {
    const template = await prisma.communicationTemplate.findFirst({ where: { id: templateId, ...scope(ownerId), deletedAt: null } });
    if (!template) throw new ApiError(404, "Template nao encontrado.");
    return prisma.communicationTemplate.update({ where: { id: templateId }, data: input });
  }

  public async deleteTemplate(ownerId: string, templateId: string): Promise<void> {
    const template = await prisma.communicationTemplate.findFirst({ where: { id: templateId, ...scope(ownerId), deletedAt: null } });
    if (!template) throw new ApiError(404, "Template nao encontrado.");
    await prisma.communicationTemplate.update({ where: { id: templateId }, data: { active: false, deletedAt: new Date() } });
  }

  public listMessages(ownerId: string, clientId?: string, leadId?: string) {
    return prisma.communicationMessage.findMany({
      where: { ...scope(ownerId), deletedAt: null, ...(clientId ? { clientId } : {}), ...(leadId ? { leadId } : {}) },
      include: { client: true, lead: true, template: true, webhookEvents: { orderBy: { receivedAt: "desc" } } },
      orderBy: { createdAt: "desc" }
    });
  }

  public async trackOpen(trackingToken: string): Promise<void> {
    const message = await prisma.communicationMessage.findUnique({ where: { trackingToken } });
    if (!message || message.channel !== "EMAIL") return;
    const openedAt = new Date();
    await prisma.communicationMessage.update({
      where: { id: message.id },
      data: {
        status: "READ",
        deliveredAt: message.deliveredAt ?? openedAt,
        readAt: message.readAt ?? openedAt,
        firstOpenedAt: message.firstOpenedAt ?? openedAt,
        lastOpenedAt: openedAt,
        openCount: { increment: 1 }
      }
    });
  }

  public async sendManual(ownerId: string, input: SendInput) {
    const message = await this.createMessage(ownerId, input, "QUEUED");
    await prisma.communicationQueueItem.create({ data: { tenantId: scope(ownerId).tenantId, messageId: message.id, scheduledAt: input.scheduledAt ?? new Date() } });
    if (!input.scheduledAt || input.scheduledAt <= new Date()) await this.processQueue(ownerId, 10);
    return prisma.communicationMessage.findUnique({ where: { id: message.id }, include: { client: true, lead: true, template: true } });
  }

  public async processQueue(ownerId: string, limit = 25) {
    const currentScope = scope(ownerId);
    const items = await prisma.communicationQueueItem.findMany({
      where: { tenantId: currentScope.tenantId, status: "QUEUED", scheduledAt: { lte: new Date() }, message: { ownerId } },
      include: { message: true },
      orderBy: { scheduledAt: "asc" },
      take: limit
    });
    const processed: string[] = [];
    for (const item of items) {
      try {
        await prisma.communicationQueueItem.update({ where: { id: item.id }, data: { status: "SENDING", attempts: { increment: 1 } } });
        await prisma.communicationMessage.update({ where: { id: item.messageId }, data: { status: "SENDING", attempts: { increment: 1 } } });
        const result = await this.deliver(item.message);
        await prisma.communicationMessage.update({
          where: { id: item.messageId },
          data: { provider: result.provider, providerMessageId: result.providerMessageId, sentAt: new Date(), errorMessage: null }
        });
        await prisma.communicationMessage.updateMany({ where: { id: item.messageId, status: { not: "READ" } }, data: { status: "SENT" } });
        await prisma.communicationQueueItem.update({ where: { id: item.id }, data: { status: "SENT", processedAt: new Date(), errorMessage: null } });
        processed.push(item.id);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha no envio.";
        await prisma.communicationMessage.update({ where: { id: item.messageId }, data: { status: "FAILED", errorMessage: message } });
        await prisma.communicationQueueItem.update({ where: { id: item.id }, data: { status: "FAILED", processedAt: new Date(), errorMessage: message } });
      }
    }
    return { processed: processed.length };
  }

  public listCampaigns(ownerId: string) {
    return prisma.communicationCampaign.findMany({ where: { ...scope(ownerId), deletedAt: null }, include: { template: true, messages: true }, orderBy: { createdAt: "desc" } });
  }

  public async createCampaign(ownerId: string, input: CampaignInput) {
    const campaign = await prisma.communicationCampaign.create({
      data: {
        tenantId: scope(ownerId).tenantId,
        ownerId,
        name: input.name,
        channel: input.channel,
        templateId: input.templateId,
        status: input.status,
        filters: input.filters,
        scheduledAt: input.scheduledAt
      }
    });
    if (input.status === "RUNNING" || (!input.scheduledAt && input.status !== "DRAFT")) await this.runCampaign(ownerId, campaign.id);
    return campaign;
  }

  public async runCampaign(ownerId: string, campaignId: string) {
    const campaign = await prisma.communicationCampaign.findFirst({ where: { id: campaignId, ...scope(ownerId), deletedAt: null }, include: { template: true } });
    if (!campaign?.template) throw new ApiError(404, "Campanha ou template nao encontrado.");
    const clients = await this.segmentClients(ownerId, campaign.filters as CampaignFilters, campaign.channel);
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "RUNNING", startedAt: new Date() } });
    for (const client of clients) {
      const recipient = campaign.channel === "EMAIL" ? client.email : client.whatsapp;
      if (!recipient) continue;
      const variables = clientVariables(client);
      const message = await this.createMessage(ownerId, {
        channel: campaign.channel,
        templateId: campaign.templateId,
        clientId: client.id,
        recipientName: client.name,
        recipient,
        subject: campaign.template.subject ? renderTemplate(campaign.template.subject, variables) : null,
        body: renderTemplate(campaign.template.body, variables),
        scheduledAt: campaign.scheduledAt,
        variables
      }, "QUEUED", campaignId);
      await prisma.communicationQueueItem.create({ data: { tenantId: scope(ownerId).tenantId, messageId: message.id, scheduledAt: campaign.scheduledAt ?? new Date() } });
    }
    await this.processQueue(ownerId, 100);
    await prisma.communicationCampaign.update({ where: { id: campaignId }, data: { status: "FINISHED", finishedAt: new Date() } });
    return { recipients: clients.length };
  }

  public async calculateScores(ownerId: string) {
    const clients = await prisma.crmClient.findMany({
      where: { ...scope(ownerId), deletedAt: null },
      include: { activities: true, proposals: true, contracts: true, projects: true, messages: true }
    });
    const results: Array<{ clientId: string; score: number }> = [];
    for (const client of clients) {
      const engagement = Math.min(40, client.activities.length * 5 + client.messages.filter((message) => ["DELIVERED", "READ", "SENT"].includes(message.status)).length * 3);
      const value = Math.min(30, Math.round(client.contracts.reduce((total, contract) => total + Number(contract.value), 0) / 1000));
      const project = Math.min(20, client.projects.filter((item) => item.status !== "CANCELLED").length * 5);
      const inactivityPenalty = client.activities.length ? 0 : 15;
      const score = Math.max(0, Math.min(100, engagement + value + project - inactivityPenalty));
      const riskLevel = score >= 70 ? "LOW" : score >= 45 ? "MEDIUM" : score >= 25 ? "HIGH" : "CRITICAL";
      await prisma.crmCustomerScore.create({
        data: {
          tenantId: scope(ownerId).tenantId,
          clientId: client.id,
          score,
          riskLevel,
          potentialValue: client.contracts.reduce((total, contract) => total + Number(contract.value), 0),
          engagementScore: engagement,
          recurrenceScore: project,
          overdueScore: inactivityPenalty,
          reason: "Score calculado por engajamento, contratos, projetos e inatividade."
        }
      });
      results.push({ clientId: client.id, score });
    }
    return { calculated: results.length, results };
  }

  public listGoals(ownerId: string) {
    return prisma.crmGoal.findMany({ where: { ...scope(ownerId), deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  public saveGoal(ownerId: string, input: GoalInput) {
    return prisma.crmGoal.create({ data: { ...input, tenantId: scope(ownerId).tenantId, ownerId } });
  }

  public listSlaRules(ownerId: string) {
    return prisma.crmSlaRule.findMany({ where: { ...scope(ownerId), deletedAt: null }, orderBy: { createdAt: "desc" } });
  }

  public saveSlaRule(ownerId: string, input: SlaRuleInput) {
    return prisma.crmSlaRule.create({ data: { ...input, tenantId: scope(ownerId).tenantId, ownerId } });
  }

  public async slaAlerts(ownerId: string) {
    const [rules, leads] = await Promise.all([
      prisma.crmSlaRule.findMany({ where: { ...scope(ownerId), active: true, deletedAt: null } }),
      prisma.crmLead.findMany({ where: { ...scope(ownerId), deletedAt: null, status: { notIn: ["WON", "LOST"] } } })
    ]);
    return leads.flatMap((lead) => rules.filter((rule) => this.ruleMatches(rule, lead.stage, lead.priority) && differenceInHours(new Date(), lead.lastInteractionAt ?? lead.createdAt) > rule.maxHours).map((rule) => ({
      leadId: lead.id,
      leadName: lead.name,
      stage: lead.stage,
      priority: lead.priority,
      rule: rule.name,
      delayedHours: differenceInHours(new Date(), lead.lastInteractionAt ?? lead.createdAt) - rule.maxHours
    })));
  }

  public async communicationReport(ownerId: string) {
    const [messages, campaigns, scores, alerts] = await Promise.all([
      prisma.communicationMessage.findMany({ where: { ...scope(ownerId), deletedAt: null } }),
      prisma.communicationCampaign.findMany({ where: { ...scope(ownerId), deletedAt: null } }),
      prisma.crmCustomerScore.findMany({ where: { tenantId: scope(ownerId).tenantId }, orderBy: { calculatedAt: "desc" }, take: 100 }),
      this.slaAlerts(ownerId)
    ]);
    return {
      messagesByStatus: Object.entries(messages.reduce<Record<string, number>>((accumulator, message) => {
        accumulator[message.status] = (accumulator[message.status] ?? 0) + 1;
        return accumulator;
      }, {})).map(([status, total]) => ({ status, total })),
      messagesByChannel: Object.entries(messages.reduce<Record<string, number>>((accumulator, message) => {
        accumulator[message.channel] = (accumulator[message.channel] ?? 0) + 1;
        return accumulator;
      }, {})).map(([channel, total]) => ({ channel, total })),
      campaigns: campaigns.length,
      averageScore: scores.length ? Math.round(scores.reduce((total, score) => total + score.score, 0) / scores.length) : 0,
      slaAlerts: alerts
    };
  }

  public async webhook(ownerId: string, input: WebhookInput) {
    const message = input.providerMessageId ? await prisma.communicationMessage.findFirst({ where: { ownerId, providerMessageId: input.providerMessageId } }) : null;
    const event = await prisma.communicationWebhookEvent.create({
      data: {
        tenantId: scope(ownerId).tenantId,
        channel: input.channel,
        provider: input.provider ?? null,
        messageId: message?.id,
        providerMessageId: input.providerMessageId,
        status: input.status,
        payload: input.payload as Prisma.InputJsonValue
      }
    });
    if (message && input.status) {
      await prisma.communicationMessage.update({
        where: { id: message.id },
        data: {
          status: input.status,
          deliveredAt: input.status === "DELIVERED" ? new Date() : message.deliveredAt,
          readAt: input.status === "READ" ? new Date() : message.readAt
        }
      });
    }
    return event;
  }

  private async createMessage(ownerId: string, input: SendInput, status: CommunicationStatus, campaignId?: string) {
    const template = input.templateId ? await prisma.communicationTemplate.findFirst({ where: { id: input.templateId, ...scope(ownerId), deletedAt: null } }) : null;
    const client = input.clientId ? await prisma.crmClient.findFirst({ where: { id: input.clientId, ...scope(ownerId), deletedAt: null } }) : null;
    const lead = input.leadId ? await prisma.crmLead.findFirst({ where: { id: input.leadId, ...scope(ownerId), deletedAt: null } }) : null;
    const variables = { ...(client ? clientVariables(client) : {}), ...(lead ? leadVariables(lead) : {}), ...input.variables };
    const body = template ? renderTemplate(template.body, variables) : renderTemplate(input.body, variables);
    const subject = input.channel === "EMAIL" ? renderTemplate(input.subject ?? template?.subject ?? "Contato comercial", variables) : null;
    return prisma.communicationMessage.create({
      data: {
        tenantId: scope(ownerId).tenantId,
        ownerId,
        channel: input.channel,
        status,
        templateId: input.templateId,
        leadId: input.leadId,
        clientId: client?.id,
        campaignId,
        recipientName: input.recipientName ?? client?.name ?? lead?.name,
        recipient: input.recipient,
        subject,
        body,
        trackingToken: input.channel === "EMAIL" ? randomBytes(32).toString("hex") : null,
        scheduledAt: input.scheduledAt,
        metadata: { variables }
      }
    });
  }

  private async deliver(message: { channel: CommunicationChannel; recipient: string; recipientName: string | null; subject: string | null; body: string; trackingToken: string | null; metadata: Prisma.JsonValue }): Promise<ProviderSendResult> {
    if (message.channel === "EMAIL" && smtpConfigured()) {
      return { provider: "SMTP", providerMessageId: await sendSmtp(message) };
    }
    const config = await prisma.communicationProviderConfig.findFirst({
      where: { tenantId: "default", channel: message.channel, active: true, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
    if (!config && message.channel === "EMAIL") {
      throw new ApiError(500, "Envio de e-mail real nao configurado. Configure APP_EMAIL_HABILITADO=true e as variaveis SMTP.");
    }
    if (!config) return { provider: fallbackProvider[message.channel], providerMessageId: `SIM-${Date.now()}` };
    const providerMessageId = await postProvider(config, {
      channel: message.channel,
      to: message.recipient,
      name: message.recipientName,
      subject: message.subject,
      body: message.body,
      from: config.defaultFrom,
      metadata: message.metadata
    });
    return { provider: config.provider, providerMessageId };
  }

  private async segmentClients(ownerId: string, filters: CampaignFilters, channel: CommunicationChannel) {
    return prisma.crmClient.findMany({
      where: {
        ...scope(ownerId),
        deletedAt: null,
        ...(filters.segment ? { segment: { contains: filters.segment, mode: "insensitive" } } : {}),
        ...(filters.city ? { city: { contains: filters.city, mode: "insensitive" } } : {}),
        ...(filters.state ? { state: { contains: filters.state, mode: "insensitive" } } : {}),
        ...(channel === "EMAIL" || filters.hasEmail ? { email: { not: null } } : {}),
        ...(channel === "WHATSAPP" || filters.hasWhatsapp ? { whatsapp: { not: null } } : {})
      }
    });
  }

  private ruleMatches(rule: { stage: CrmPipelineStage | null; priority: Priority | null }, stage: CrmPipelineStage, priority: Priority): boolean {
    return (!rule.stage || rule.stage === stage) && (!rule.priority || rule.priority === priority);
  }
}
