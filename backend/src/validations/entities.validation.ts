import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();

export const clientSchema = z.object({
  name: z.string().trim().min(2),
  document: optionalText,
  type: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
  internalCode: optionalText,
  legalName: optionalText,
  tradeName: optionalText,
  stateRegistration: optionalText,
  municipalRegistration: optionalText,
  openingDate: z.coerce.date().optional().nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  gender: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.string().email().optional().nullable().or(z.literal("")),
  postalCode: optionalText,
  street: optionalText,
  number: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText,
  observations: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
  source: optionalText,
  segment: optionalText,
  companySize: optionalText,
  responsible: optionalText,
  priority: optionalText,
  temperature: optionalText,
  firstPurchaseAt: z.coerce.date().optional().nullable(),
  lastPurchaseAt: z.coerce.date().optional().nullable(),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  expectedValue: z.coerce.number().nonnegative().optional().nullable(),
  averageTicket: z.coerce.number().nonnegative().optional().nullable(),
  purchasePotential: z.coerce.number().nonnegative().optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  paymentTerms: optionalText,
  preferredPaymentMethod: optionalText,
  billingDay: z.coerce.number().int().min(1).max(31).optional().nullable(),
  financialStatus: optionalText,
  financialNotes: optionalText,
  allowEmailMarketing: z.boolean().default(false),
  allowWhatsapp: z.boolean().default(false),
  allowCalls: z.boolean().default(false),
  consentDate: z.coerce.date().optional().nullable(),
  categoryId: optionalText,
  tagIds: z.array(z.string()).default([]),
  projectIds: z.array(z.string()).default([])
});

export const scheduleSchema = z.object({
  clientId: optionalText,
  categoryId: optionalText,
  title: z.string().trim().min(2),
  description: optionalText,
  location: optionalText,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  allDay: z.boolean().default(false),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]).default("SCHEDULED"),
  color: optionalText,
  recurrenceRule: optionalText,
  reminderAt: z.coerce.date().optional().nullable()
}).refine((data) => data.endAt >= data.startAt, { message: "Termino deve ocorrer apos inicio.", path: ["endAt"] });

export const taskSchema = z.object({
  clientId: optionalText,
  categoryId: optionalText,
  projectId: optionalText,
  columnId: z.string().min(1),
  title: z.string().trim().min(2),
  description: optionalText,
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED"]).default("NOT_STARTED"),
  dueDate: z.coerce.date().optional().nullable(),
  position: z.number().int().nonnegative().default(0)
});

export const projectSchema = z.object({
  clientId: optionalText,
  name: z.string().trim().min(2),
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  description: optionalText,
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]).default("PLANNING"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  startDate: z.coerce.date().optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().nonnegative().optional().nullable(),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  color: z.string().regex(/^#[0-9a-f]{6}$/i).default("#3B82F6")
}).refine((data) => !data.startDate || !data.dueDate || data.dueDate >= data.startDate, {
  message: "Prazo deve ocorrer apos o inicio.",
  path: ["dueDate"]
});

export const categorySchema = z.object({ name: z.string().trim().min(2), color: z.string().regex(/^#[0-9a-f]{6}$/i) });
export const noteSchema = z.object({ clientId: optionalText, title: z.string().trim().min(2), content: z.string().trim().min(2) });
export const userUpdateSchema = z.object({ name: z.string().min(2).optional(), theme: z.enum(["dark", "light"]).optional(), notifications: z.boolean().optional() });
export const userCreateSchema = z.object({ name: z.string().min(2), email: z.string().email(), password: z.string().min(6), role: z.enum(["ADMIN", "MANAGER", "USER"]).default("USER") });

export const crmLeadSchema = z.object({
  name: z.string().trim().min(2),
  company: optionalText,
  document: optionalText,
  segment: optionalText,
  position: optionalText,
  email: z.string().email().optional().nullable().or(z.literal("")),
  phone: optionalText,
  whatsapp: optionalText,
  site: optionalText,
  postalCode: optionalText,
  street: optionalText,
  number: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText,
  source: optionalText,
  campaign: optionalText,
  responsible: z.string().trim().min(2),
  interest: optionalText,
  productInterest: optionalText,
  estimatedValue: z.coerce.number().nonnegative().optional().nullable(),
  observations: optionalText,
  score: z.enum(["VERY_HOT", "HOT", "WARM", "COLD"]).default("WARM"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["NEW", "IN_SERVICE", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]).default("NEW"),
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"]).default("LEAD_RECEIVED"),
  lostReason: optionalText,
  lastInteractionAt: z.coerce.date().optional().nullable(),
  nextFollowUpAt: z.coerce.date().optional().nullable()
});

export const crmLeadStageSchema = z.object({
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"])
});

export const crmActivitySchema = z.object({
  leadId: optionalText,
  clientId: optionalText,
  projectId: optionalText,
  type: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "STATUS_CHANGE", "PROPOSAL", "CONTRACT", "TASK", "NOTE", "VISIT", "DEMONSTRATION", "FOLLOW_UP", "IMPLEMENTATION", "TRAINING"]),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]).default("PENDING"),
  title: z.string().trim().min(2),
  description: optionalText,
  responsible: z.string().trim().min(2),
  scheduledAt: z.coerce.date().optional().nullable(),
  completedAt: z.coerce.date().optional().nullable()
});

export const crmProposalSchema = z.object({
  leadId: optionalText,
  clientId: optionalText,
  number: z.string().trim().min(2),
  product: z.string().trim().min(2),
  value: z.coerce.number().nonnegative(),
  discount: z.coerce.number().nonnegative().default(0),
  paymentTerms: optionalText,
  deadline: optionalText,
  observations: optionalText,
  status: z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"]).default("DRAFT")
});

export const crmContractSchema = z.object({
  clientId: z.string().min(1),
  proposalId: optionalText,
  number: z.string().trim().min(2),
  serviceOrder: z.string().trim().min(2),
  value: z.coerce.number().nonnegative(),
  status: z.enum(["DRAFT", "ACTIVE", "FINISHED", "CANCELLED"]).default("DRAFT"),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  observations: optionalText
});

export const crmProjectSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(2),
  responsible: z.string().trim().min(2),
  team: z.array(z.string().trim().min(1)).default([]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["NOT_STARTED", "PLANNING", "IN_DEVELOPMENT", "IN_TESTS", "IN_APPROVAL", "IN_DEPLOYMENT", "IN_TRAINING", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  budget: z.coerce.number().nonnegative().optional().nullable(),
  plannedHours: z.coerce.number().nonnegative().optional().nullable(),
  executedHours: z.coerce.number().nonnegative().default(0),
  progress: z.coerce.number().int().min(0).max(100).default(0),
  observations: optionalText
});

export const crmProjectTaskSchema = z.object({
  projectId: z.string().min(1),
  parentTaskId: optionalText,
  title: z.string().trim().min(2),
  description: optionalText,
  responsible: z.string().trim().min(2),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED", "CANCELLED"]).default("NOT_STARTED"),
  startDate: z.coerce.date().optional().nullable(),
  endDate: z.coerce.date().optional().nullable(),
  plannedHours: z.coerce.number().nonnegative().optional().nullable(),
  checklist: z.array(z.object({ id: z.string(), title: z.string(), done: z.boolean() })).default([]),
  attachments: z.array(z.object({ name: z.string(), url: z.string(), mimeType: z.string().optional() })).default([]),
  comments: z.array(z.object({ author: z.string(), message: z.string(), createdAt: z.string() })).default([])
});

export const crmAutomationSchema = z.object({
  name: z.string().trim().min(2),
  trigger: z.enum(["LEAD_CREATED", "PROPOSAL_SENT", "SALE_COMPLETED", "PROJECT_COMPLETED", "LEAD_IDLE"]),
  action: z.enum(["CREATE_TASK", "CREATE_FOLLOW_UP", "CREATE_PROJECT", "REQUEST_SURVEY", "CREATE_ALERT"]),
  active: z.boolean().default(true),
  parameters: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export const communicationProviderConfigSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  provider: z.enum(["SMTP", "SENDGRID", "RESEND", "META_WHATSAPP", "ZAPI", "EVOLUTION", "WEBHOOK"]),
  name: z.string().trim().min(2),
  senderName: optionalText,
  senderAddress: optionalText,
  endpointUrl: optionalText,
  apiKey: optionalText,
  apiSecret: optionalText,
  defaultFrom: optionalText,
  active: z.boolean().default(true),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export const communicationTemplateSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  name: z.string().trim().min(2),
  subject: optionalText,
  body: z.string().trim().min(2),
  variables: z.array(z.string()).default([]),
  active: z.boolean().default(true)
});

export const communicationSendSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateId: optionalText,
  leadId: optionalText,
  clientId: optionalText,
  recipientName: optionalText,
  recipient: z.string().trim().min(3),
  subject: optionalText,
  body: z.string().trim().min(2),
  scheduledAt: z.coerce.date().optional().nullable(),
  variables: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

export const communicationCampaignSchema = z.object({
  name: z.string().trim().min(2),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateId: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "FINISHED", "CANCELLED"]).default("DRAFT"),
  filters: z.object({
    segment: optionalText,
    city: optionalText,
    state: optionalText,
    hasEmail: z.boolean().optional(),
    hasWhatsapp: z.boolean().optional(),
    riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional()
  }).default({}),
  scheduledAt: z.coerce.date().optional().nullable()
});

export const crmGoalSchema = z.object({
  name: z.string().trim().min(2),
  responsible: optionalText,
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  targetValue: z.coerce.number().nonnegative().optional().nullable(),
  targetCount: z.coerce.number().int().nonnegative().optional().nullable(),
  active: z.boolean().default(true)
});

export const crmSlaRuleSchema = z.object({
  name: z.string().trim().min(2),
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"]).optional().nullable(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional().nullable(),
  maxHours: z.coerce.number().int().positive(),
  active: z.boolean().default(true)
});

export const communicationWebhookSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  provider: z.enum(["SMTP", "SENDGRID", "RESEND", "META_WHATSAPP", "ZAPI", "EVOLUTION", "WEBHOOK"]).optional().nullable(),
  providerMessageId: optionalText,
  status: z.enum(["DRAFT", "QUEUED", "SENDING", "SENT", "DELIVERED", "READ", "FAILED", "CANCELLED"]).optional().nullable(),
  payload: z.record(z.unknown()).default({})
});
