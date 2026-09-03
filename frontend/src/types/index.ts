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
