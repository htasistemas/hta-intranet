import { z } from "zod";

const optionalText = z.string().trim().optional().nullable();
const lowercaseTitleWords = new Set(["a", "as", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por"]);

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizePart(value: string): string {
  const lower = value.toLocaleLowerCase("pt-BR");
  return lower.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function normalizeTitleText(value: string): string {
  return collapseSpaces(value)
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && lowercaseTitleWords.has(lower)) return lower;
      return word.split("-").map(capitalizePart).join("-");
    })
    .join(" ");
}

function optionalTitleText() {
  return z.string().trim().transform((value) => value ? normalizeTitleText(value) : value).optional().nullable();
}

function optionalUpperText() {
  return z.string().trim().transform((value) => value ? collapseSpaces(value).toLocaleUpperCase("pt-BR") : value).optional().nullable();
}

function optionalLowerText() {
  return z.string().trim().transform((value) => value ? collapseSpaces(value).toLocaleLowerCase("pt-BR") : value).optional().nullable();
}

function isRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function calculateCpfDigit(numbers: number[], factor: number): number {
  const total = numbers.reduce((sum, number) => sum + number * factor--, 0);
  const digit = 11 - (total % 11);
  return digit >= 10 ? 0 : digit;
}

function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false;
  const numbers = digits.split("").map(Number);
  const firstDigit = calculateCpfDigit(numbers.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit([...numbers.slice(0, 9), firstDigit], 11);
  return firstDigit === numbers[9] && secondDigit === numbers[10];
}

function calculateCnpjDigit(numbers: number[], factors: number[]): number {
  const total = numbers.reduce((sum, number, index) => sum + number * (factors[index] ?? 0), 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false;
  const numbers = digits.split("").map(Number);
  const firstDigit = calculateCnpjDigit(numbers.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit([...numbers.slice(0, 12), firstDigit], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === numbers[12] && secondDigit === numbers[13];
}

export const clientSchema = z.object({
  name: z.string().trim().min(2).transform(normalizeTitleText),
  document: optionalText,
  type: z.enum(["INDIVIDUAL", "COMPANY"]).default("INDIVIDUAL"),
  internalCode: optionalUpperText(),
  legalName: optionalTitleText(),
  tradeName: optionalTitleText(),
  stateRegistration: optionalUpperText(),
  municipalRegistration: optionalUpperText(),
  openingDate: z.coerce.date().optional().nullable(),
  birthDate: z.coerce.date().optional().nullable(),
  gender: optionalText,
  phone: optionalText,
  whatsapp: optionalText,
  email: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("")),
  postalCode: optionalText,
  street: optionalTitleText(),
  number: optionalText,
  district: optionalTitleText(),
  city: optionalTitleText(),
  state: optionalUpperText(),
  observations: optionalText,
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]).default("PROSPECT"),
  source: optionalTitleText(),
  segment: optionalTitleText(),
  companySize: optionalText,
  responsible: optionalTitleText(),
  priority: optionalText,
  temperature: optionalText,
  firstPurchaseAt: z.coerce.date().optional().nullable(),
  lastPurchaseAt: z.coerce.date().optional().nullable(),
  nextFollowUpAt: z.coerce.date().optional().nullable(),
  expectedValue: z.coerce.number().nonnegative().optional().nullable(),
  averageTicket: z.coerce.number().nonnegative().optional().nullable(),
  purchasePotential: z.coerce.number().nonnegative().optional().nullable(),
  creditLimit: z.coerce.number().nonnegative().optional().nullable(),
  paymentTerms: optionalTitleText(),
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
  projectIds: z.array(z.string()).default([]),
  productIds: z.array(z.string()).default([])
}).superRefine((fields, context) => {
  const document = fields.document ?? "";
  const documentDigits = onlyDigits(document);
  if (documentDigits.length > 0) {
    const validDocument = fields.type === "COMPANY" ? isValidCnpj(documentDigits) : isValidCpf(documentDigits);
    if (!validDocument) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: fields.type === "COMPANY" ? "Informe um CNPJ valido." : "Informe um CPF valido.",
        path: ["document"]
      });
    }
  }
  const hasContact = Boolean((fields.email ?? "").trim() || onlyDigits(fields.phone ?? "") || onlyDigits(fields.whatsapp ?? ""));
  if (!hasContact) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe email, telefone ou WhatsApp.",
      path: ["email"]
    });
  }
});

export const clientImportRequestSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(1000)
});

export const crmLeadImportRequestSchema = z.object({
  rows: z.array(z.unknown()).min(1).max(1000)
});

export const scheduleSchema = z.object({
  clientId: optionalText,
  projectId: optionalText,
  categoryId: optionalText,
  type: z.enum(["CALL", "MEETING", "VISIT", "DEMONSTRATION", "FOLLOW_UP", "IMPLEMENTATION", "TRAINING", "SUPPORT", "BILLING"]).default("FOLLOW_UP"),
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
  productId: optionalText,
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
export const userCreateSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).default("USER"),
  theme: z.enum(["dark", "light"]).default("dark"),
  notifications: z.boolean().default(true)
});
export const userAdminUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional(),
  password: z.string().min(6).optional(),
  role: z.enum(["ADMIN", "MANAGER", "USER"]).optional(),
  theme: z.enum(["dark", "light"]).optional(),
  notifications: z.boolean().optional()
});

export const productServiceSchema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2),
  type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION", "LICENSE", "PROJECT"]).default("SERVICE"),
  category: optionalText,
  commercialDescription: optionalText,
  technicalDescription: optionalText,
  unit: optionalText,
  price: z.coerce.number().nonnegative().optional().nullable(),
  cost: z.coerce.number().nonnegative().optional().nullable(),
  margin: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE"]).default("ACTIVE"),
  sla: optionalText,
  deliveryTime: optionalText,
  technicalOwner: optionalText,
  fiscalNotes: optionalText
});

export const clientProductSchema = z.object({
  clientId: z.string().min(1),
  productId: z.string().min(1),
  startDate: z.coerce.date().optional().nullable(),
  renewalDate: z.coerce.date().optional().nullable(),
  contractedValue: z.coerce.number().nonnegative().optional().nullable(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]).default("ACTIVE"),
  responsible: optionalText,
  notes: optionalText
});

export const partnerSchema = z.object({
  name: z.string().trim().min(2).transform(normalizeTitleText),
  company: optionalTitleText(),
  document: optionalText,
  type: z.enum(["REFERRAL", "RESELLER", "IMPLEMENTATION", "STRATEGIC", "AFFILIATE"]).default("REFERRAL"),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECTING", "SUSPENDED"]).default("PROSPECTING"),
  contactName: optionalTitleText(),
  email: z.string().trim().toLowerCase().email().optional().nullable().or(z.literal("")),
  phone: optionalText,
  whatsapp: optionalText,
  website: optionalLowerText(),
  city: optionalTitleText(),
  state: optionalUpperText(),
  segment: optionalTitleText(),
  commissionModel: z.enum(["ONE_TIME", "RECURRING", "REVENUE_SHARE", "PROJECT_BASED", "HYBRID"]).default("ONE_TIME"),
  commissionPercent: z.coerce.number().min(0).max(100).optional().nullable(),
  recurringMonths: z.coerce.number().int().min(0).max(120).optional().nullable(),
  fixedAmount: z.coerce.number().nonnegative().optional().nullable(),
  closeBonus: z.coerce.number().nonnegative().optional().nullable(),
  paymentTrigger: optionalText,
  contractStart: z.coerce.date().optional().nullable(),
  contractEnd: z.coerce.date().optional().nullable(),
  goals: optionalText,
  strengths: optionalText,
  rules: optionalText,
  notes: optionalText,
  projectIds: z.array(z.string()).default([])
}).refine((data) => !data.contractStart || !data.contractEnd || data.contractEnd >= data.contractStart, {
  message: "Fim do contrato deve ocorrer apos o inicio.",
  path: ["contractEnd"]
});

export const partnerInteractionSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "WHATSAPP", "NOTE", "TRAINING", "PROPOSAL", "REVIEW"]).default("NOTE"),
  title: z.string().trim().min(2),
  description: optionalText,
  occurredAt: z.coerce.date().optional().nullable(),
  nextStep: optionalText
});

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
  registrationStatus: z.enum(["COMPLETE", "INCOMPLETE", "UPDATING"]).default("INCOMPLETE"),
  registrationStatusManual: z.boolean().default(false),
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
