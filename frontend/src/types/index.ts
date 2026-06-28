export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";
export type ProductType = "PRODUCT" | "SERVICE" | "SUBSCRIPTION" | "LICENSE" | "PROJECT";
export type ProductStatus = "ACTIVE" | "INACTIVE";
export type ClientProductStatus = "ACTIVE" | "SUSPENDED" | "CANCELLED" | "EXPIRED";
export type UserRole = "ADMIN" | "MANAGER" | "USER";

export interface UserAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
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
  products?: ClientProduct[];
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

export interface DashboardData {
  kpis: {
    total: number;
    active: number;
    inactive: number;
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
  user: { id: string; name: string; email: string; role: UserRole };
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
