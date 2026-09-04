export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ProductType = "PRODUCT" | "SERVICE" | "SUBSCRIPTION" | "LICENSE" | "PROJECT";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type ClientProductStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
export type UserRole = "ADMIN" | "MANAGER" | "USER" | "PARTNER";
export type ClientCommunicationStatus = "DRAFT" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "CANCELLED";
export type ClientCommunicationChannel = "EMAIL" | "WHATSAPP";
export type PartnerType = "REFERRAL" | "RESELLER" | "IMPLEMENTATION" | "STRATEGIC" | "AFFILIATE";
export type PartnerStatus = "ACTIVE" | "INACTIVE" | "PROSPECTING" | "SUSPENDED";
export type CommissionModel = "ONE_TIME" | "RECURRING" | "REVENUE_SHARE" | "PROJECT_BASED" | "HYBRID";
export type PartnerInteractionType = "CALL" | "EMAIL" | "MEETING" | "WHATSAPP" | "NOTE" | "TRAINING" | "PROPOSAL" | "REVIEW";
export type SystemMonitorStatus = "UNKNOWN" | "ACTIVE" | "DOWN";
export type SupportTicketStatus = "NEW" | "TRIAGE" | "IN_PROGRESS" | "WAITING_USER" | "DEVELOPMENT" | "TESTING" | "RESOLVED" | "CLOSED" | "REOPENED" | "CANCELLED";
export type SupportTicketImpact = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SupportTicketUrgency = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type SupportTicketType = "INCIDENT" | "REQUEST" | "IMPROVEMENT" | "BUG" | "QUESTION" | "DEVELOPMENT";
export type SupportTicketMessageKind = "MESSAGE" | "INTERNAL_NOTE" | "STATUS_CHANGE" | "ATTACHMENT" | "AUTOMATIC";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  partnerId?: string | null;
  partner?: Partner | null;
  theme: "dark" | "light";
  notifications: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
}

export interface Client {
  id: string;
  name: string;
  document: string | null;
  type: "INDIVIDUAL" | "COMPANY";
  internalCode?: string | null;
  legalName?: string | null;
  tradeName?: string | null;
  stateRegistration?: string | null;
  municipalRegistration?: string | null;
  openingDate?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email: string | null;
  postalCode?: string | null;
  street?: string | null;
  number?: string | null;
  district?: string | null;
  city: string | null;
  state: string | null;
  status: ClientStatus;
  source?: string | null;
  segment?: string | null;
  companySize?: string | null;
  responsible?: string | null;
  priority?: string | null;
  temperature?: string | null;
  firstPurchaseAt?: string | null;
  lastPurchaseAt?: string | null;
  nextFollowUpAt?: string | null;
  category?: Category | null;
  expectedValue?: string | number | null;
  averageTicket?: string | number | null;
  purchasePotential?: string | number | null;
  creditLimit?: string | number | null;
  paymentTerms?: string | null;
  preferredPaymentMethod?: string | null;
  billingDay?: number | null;
  financialStatus?: string | null;
  financialNotes?: string | null;
  allowEmailMarketing?: boolean;
  allowWhatsapp?: boolean;
  allowCalls?: boolean;
  consentDate?: string | null;
  observations?: string | null;
  projectLinks?: Array<{ project: Project }>;
  projects?: Project[];
  products?: ClientProduct[];
  communicationMessages?: ClientCommunicationMessage[];
}

export interface ClientCommunicationMessage {
  id: string;
  channel: ClientCommunicationChannel;
  status: ClientCommunicationStatus;
  recipientName: string | null;
  recipient: string;
  subject: string | null;
  body: string;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  template?: { id: string; name: string; subject: string | null } | null;
  webhookEvents?: Array<{ id: string; receivedAt: string; status: ClientCommunicationStatus | null }>;
}

export interface Schedule {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  color: string | null;
  allDay: boolean;
  status: "SCHEDULED" | "COMPLETED" | "CANCELLED";
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  googleSyncedAt?: string | null;
  googleSyncStatus?: string | null;
  type?: string;
  client?: Client | null;
  project?: Project | null;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  columnId: string;
  position: number;
  client?: Client | null;
  project?: Project | null;
}

export interface Project {
  id: string;
  name: string;
  code: string;
  description: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate: string | null;
  dueDate: string | null;
  budget: string | number | null;
  progress: number;
  color: string;
  client?: Client | null;
  product?: ProductService | null;
  _count?: { tasks: number };
}

export interface ProductService {
  id: string;
  code: string;
  name: string;
  type: ProductType;
  category: string | null;
  commercialDescription: string | null;
  technicalDescription: string | null;
  unit: string | null;
  price: string | number | null;
  cost: string | number | null;
  margin: string | number | null;
  status: ProductStatus;
  sla: string | null;
  deliveryTime: string | null;
  technicalOwner: string | null;
  fiscalNotes: string | null;
  _count?: { clientProducts: number; projects: number };
}

export interface Partner {
  id: string;
  name: string;
  company: string | null;
  document: string | null;
  type: PartnerType;
  status: PartnerStatus;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  segment: string | null;
  commissionModel: CommissionModel;
  commissionPercent: string | number | null;
  recurringMonths: number | null;
  fixedAmount: string | number | null;
  closeBonus: string | number | null;
  paymentTrigger: string | null;
  contractStart: string | null;
  contractEnd: string | null;
  goals: string | null;
  strengths: string | null;
  rules: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  projectLinks?: Array<{ project: Project }>;
  interactions?: PartnerInteraction[];
  users?: Array<{ id: string; name: string; email: string; role: UserRole }>;
  _count?: { projectLinks: number; interactions: number; users?: number };
}

export interface PartnerInteraction {
  id: string;
  partnerId: string;
  type: PartnerInteractionType;
  title: string;
  description: string | null;
  occurredAt: string;
  nextStep: string | null;
  createdAt: string;
}

export interface ClientProduct {
  id: string;
  clientId: string;
  productId: string;
  startDate: string | null;
  renewalDate: string | null;
  contractedValue: string | number | null;
  status: ClientProductStatus;
  responsible: string | null;
  notes: string | null;
  client: Client;
  product: ProductService;
}

export interface SystemMonitor {
  id: string;
  ownerId: string;
  name: string;
  url: string;
  checkPath: string;
  expectedStatus: number;
  timeoutMs: number;
  active: boolean;
  status: SystemMonitorStatus;
  lastCheckedAt: string | null;
  lastStatusCode: number | null;
  responseTimeMs: number | null;
  lastError: string | null;
  lastOnlineAt: string | null;
  lastOfflineAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemMonitorCheckResult {
  monitor: SystemMonitor;
  previousStatus: SystemMonitorStatus;
  alert: boolean;
}

export interface SupportTicketAttachment {
  id: string;
  ticketId: string;
  messageId: string | null;
  uploaderId: string;
  name: string;
  mimeType: string;
  size: number;
  storagePath: string;
  previewable: boolean;
  createdAt: string;
}

export interface SupportTicketMessage {
  id: string;
  ticketId: string;
  authorId: string;
  author: Pick<UserAccount, "id" | "name" | "email" | "role">;
  kind: SupportTicketMessageKind;
  body: string;
  status: SupportTicketStatus;
  internal: boolean;
  createdAt: string;
  attachments: SupportTicketAttachment[];
}

export interface SupportTicketHistory {
  id: string;
  ticketId: string;
  userId: string;
  user: Pick<UserAccount, "id" | "name" | "email" | "role">;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  details: unknown;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  tenantId: string;
  ownerId: string;
  protocol: string;
  clientId: string | null;
  client: Client | null;
  productId: string | null;
  product: ProductService | null;
  requesterId: string;
  requester: Pick<UserAccount, "id" | "name" | "email" | "role" | "partnerId">;
  analystId: string | null;
  analyst: Pick<UserAccount, "id" | "name" | "email" | "role" | "partnerId"> | null;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
  unit: string | null;
  systemModule: string;
  category: string;
  type: SupportTicketType;
  priority: Priority;
  impact: SupportTicketImpact;
  urgency: SupportTicketUrgency;
  status: SupportTicketStatus;
  subject: string;
  description: string;
  currentActivity: string | null;
  happened: string | null;
  expectedResult: string | null;
  actualResult: string | null;
  reproductionSteps: string | null;
  solution: string | null;
  resolutionNote: string | null;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  reopenedAt: string | null;
  cancelledAt: string | null;
  dueAt: string | null;
  createdAt: string;
  updatedAt: string;
  messages: SupportTicketMessage[];
  attachments: SupportTicketAttachment[];
  history: SupportTicketHistory[];
}

export interface SupportTicketDashboard {
  cards: {
    total: number;
    newTickets: number;
    inProgress: number;
    waitingUser: number;
    development: number;
    testing: number;
    resolved: number;
    closed: number;
    reopened: number;
    slaRisk: number;
    slaExpired: number;
  };
  byClient: SupportTicketDashboardRow[];
  bySystem: SupportTicketDashboardRow[];
  byModule: SupportTicketDashboardRow[];
  byRequester: SupportTicketDashboardRow[];
  byAnalyst: SupportTicketDashboardRow[];
  indicators: {
    averageFirstResponseMinutes: number;
    averageResolutionMinutes: number;
    averageClosingMinutes: number;
    resolutionPercent: number;
    reopenPercent: number;
    slaMetPercent: number;
    slaExpiredPercent: number;
  };
}

export interface SupportTicketDashboardRow {
  label: string;
  total: number;
  newTickets: number;
  inProgress: number;
  resolved: number;
  closed: number;
  reopened: number;
  development: number;
  testing: number;
}

export interface SupportTicketSlaRule {
  id: string;
  ownerId: string;
  name: string;
  priority: Priority | null;
  category: string | null;
  clientId: string | null;
  productId: string | null;
  type: SupportTicketType | null;
  responseMinutes: number;
  resolutionMinutes: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeBaseArticle {
  id: string;
  ownerId: string;
  title: string;
  category: string;
  systemModule: string | null;
  productName: string | null;
  content: string;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  kpis: {
    total: number;
    active: number;
    prospects: number;
    inactive: number;
    activePartners: number;
    todayAppointments: number;
    weekAppointments: number;
    pendingTasks: number;
    revenue: number;
    birthdays: number;
  };
  clientsByMonth: Array<{ month: string; total: number }>;
  clientsByCategory: Array<{ name: string; total: number; color: string }>;
  appointments: Array<{ month: string; total: number }>;
  productivity: Array<{ name: string; total: number }>;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  user: { id: string; name: string; email: string; role: UserRole; partnerId?: string | null };
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ClientImportError {
  row: number;
  name?: string;
  message: string;
}

export interface ClientImportResult {
  created: number;
  failed: number;
  errors: ClientImportError[];
}
