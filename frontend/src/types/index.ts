export type ClientStatus = "ACTIVE" | "INACTIVE" | "PROSPECT";
export type TaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED";
export type Priority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";
export type ProjectStatus = "PLANNING" | "ACTIVE" | "ON_HOLD" | "COMPLETED" | "CANCELLED";

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
  birthDate?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  status: ClientStatus;
  category?: Category | null;
  expectedValue?: string | number | null;
  observations?: string | null;
  projectLinks?: Array<{ project: Project }>;
}

export interface Schedule {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  color: string | null;
  allDay: boolean;
  googleEventId?: string | null;
  googleCalendarId?: string | null;
  googleSyncedAt?: string | null;
  googleSyncStatus?: string | null;
  client?: Client | null;
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
  _count?: { tasks: number };
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
  user: { id: string; name: string; email: string; role: string };
}

export interface PageResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}
