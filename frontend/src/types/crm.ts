import type { Priority } from "@/types";

export type CrmLeadScore = "VERY_HOT" | "HOT" | "WARM" | "COLD";
export type CrmLeadStatus = "NEW" | "IN_SERVICE" | "QUALIFIED" | "PROPOSAL_SENT" | "NEGOTIATION" | "WON" | "LOST";
export type CrmPipelineStage = "LEAD_RECEIVED" | "FIRST_CONTACT" | "QUALIFICATION" | "DEMONSTRATION" | "PROPOSAL_SENT" | "NEGOTIATION" | "APPROVAL" | "IMPLEMENTATION" | "SALE_COMPLETED" | "LOST";
export type CrmActivityType = "CALL" | "EMAIL" | "WHATSAPP" | "MEETING" | "STATUS_CHANGE" | "PROPOSAL" | "CONTRACT" | "TASK" | "NOTE" | "VISIT" | "DEMONSTRATION" | "FOLLOW_UP" | "IMPLEMENTATION" | "TRAINING";
export type CrmActivityStatus = "PENDING" | "COMPLETED" | "CANCELLED";
export type CrmProposalStatus = "DRAFT" | "SENT" | "APPROVED" | "REJECTED";
export type CrmContractStatus = "DRAFT" | "ACTIVE" | "FINISHED" | "CANCELLED";
export type CrmProjectStatus = "NOT_STARTED" | "PLANNING" | "IN_DEVELOPMENT" | "IN_TESTS" | "IN_APPROVAL" | "IN_DEPLOYMENT" | "IN_TRAINING" | "COMPLETED" | "CANCELLED";
export type CrmTaskStatus = "NOT_STARTED" | "IN_PROGRESS" | "PAUSED" | "COMPLETED" | "CANCELLED";
export type CrmAutomationTrigger = "LEAD_CREATED" | "PROPOSAL_SENT" | "SALE_COMPLETED" | "PROJECT_COMPLETED" | "LEAD_IDLE";
export type CrmAutomationAction = "CREATE_TASK" | "CREATE_FOLLOW_UP" | "CREATE_PROJECT" | "REQUEST_SURVEY" | "CREATE_ALERT";
export type CommunicationChannel = "EMAIL" | "WHATSAPP";
export type CommunicationProvider = "SMTP" | "SENDGRID" | "RESEND" | "META_WHATSAPP" | "ZAPI" | "EVOLUTION" | "WEBHOOK";
export type CommunicationStatus = "DRAFT" | "QUEUED" | "SENDING" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "CANCELLED";
export type CampaignStatus = "DRAFT" | "SCHEDULED" | "RUNNING" | "FINISHED" | "CANCELLED";
export type CustomerRiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CrmLead {
  id: string;
  name: string;
  company: string | null;
  document: string | null;
  segment: string | null;
  position: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  site: string | null;
  postalCode: string | null;
  street: string | null;
  number: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  source: string | null;
  campaign: string | null;
  responsible: string;
  interest: string | null;
  productInterest: string | null;
  estimatedValue: string | number | null;
  observations: string | null;
  score: CrmLeadScore;
  priority: Priority;
  status: CrmLeadStatus;
  stage: CrmPipelineStage;
  lostReason: string | null;
  lastInteractionAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;
  client?: CrmClient | null;
  activities?: CrmActivity[];
  proposals?: CrmProposal[];
}

export interface CrmClient {
  id: string;
  name: string;
  company: string | null;
  document: string | null;
  segment: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  city: string | null;
  state: string | null;
  observations: string | null;
  leads?: CrmLead[];
  activities?: CrmActivity[];
  proposals?: CrmProposal[];
  contracts?: CrmContract[];
  projects?: CrmProject[];
  messages?: CommunicationMessage[];
  scores?: CrmCustomerScore[];
}

export interface CrmActivity {
  id: string;
  type: CrmActivityType;
  status: CrmActivityStatus;
  title: string;
  description: string | null;
  responsible: string;
  scheduledAt: string | null;
  completedAt: string | null;
  createdAt: string;
  lead?: CrmLead | null;
  client?: CrmClient | null;
  project?: CrmProject | null;
}

export interface CrmProposal {
  id: string;
  number: string;
  product: string;
  value: string | number;
  discount: string | number;
  paymentTerms: string | null;
  deadline: string | null;
  observations: string | null;
  status: CrmProposalStatus;
  version: number;
  createdAt: string;
  lead?: CrmLead | null;
  client?: CrmClient | null;
}

export interface CrmContract {
  id: string;
  number: string;
  serviceOrder: string;
  value: string | number;
  status: CrmContractStatus;
  startDate: string | null;
  endDate: string | null;
  observations: string | null;
  client?: CrmClient | null;
}

export interface CrmProjectTask {
  id: string;
  title: string;
  description: string | null;
  responsible: string;
  priority: Priority;
  status: CrmTaskStatus;
  startDate: string | null;
  endDate: string | null;
  plannedHours: string | number | null;
  subtasks?: CrmProjectTask[];
}

export interface CrmProject {
  id: string;
  name: string;
  responsible: string;
  team: string[];
  priority: Priority;
  status: CrmProjectStatus;
  startDate: string | null;
  endDate: string | null;
  budget: string | number | null;
  plannedHours: string | number | null;
  executedHours: string | number | null;
  progress: number;
  observations: string | null;
  client: CrmClient;
  tasks?: CrmProjectTask[];
}

export interface CrmAutomation {
  id: string;
  name: string;
  trigger: CrmAutomationTrigger;
  action: CrmAutomationAction;
  active: boolean;
  parameters: Record<string, string | number | boolean | null>;
}

export interface CrmDashboard {
  kpis: {
    totalLeads: number;
    leadsToday: number;
    leadsWeek: number;
    leadsMonth: number;
    openOpportunities: number;
    proposalsSent: number;
    wonSales: number;
    lostSales: number;
    conversionRate: number;
    averageTicket: number;
    negotiationValue: number;
    weightedPipelineValue: number;
    forecastRevenue: number;
    realizedRevenue: number;
  };
  funnel: Array<{ stage: CrmPipelineStage; total: number }>;
  leadsBySource: Array<{ name: string; total: number }>;
  salesByResponsible: Array<{ name: string; total: number }>;
  monthlySales: Array<{ month: string; total: number }>;
  conversionByStage: Array<{ stage: CrmPipelineStage; rate: number }>;
  projectsInProgress: Array<{ id: string; name: string; client: string; progress: number; status: CrmProjectStatus }>;
}

export interface CommunicationProviderConfig {
  id: string;
  channel: CommunicationChannel;
  provider: CommunicationProvider;
  name: string;
  senderName: string | null;
  senderAddress: string | null;
  endpointUrl: string | null;
  defaultFrom: string | null;
  active: boolean;
}

export interface CommunicationTemplate {
  id: string;
  channel: CommunicationChannel;
  name: string;
  subject: string | null;
  body: string;
  variables: string[];
  active: boolean;
}

export interface CommunicationMessage {
  id: string;
  channel: CommunicationChannel;
  provider: CommunicationProvider | null;
  status: CommunicationStatus;
  recipientName: string | null;
  recipient: string;
  subject: string | null;
  body: string;
  providerMessageId: string | null;
  errorMessage: string | null;
  sentAt: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  openCount: number;
  firstOpenedAt: string | null;
  lastOpenedAt: string | null;
  createdAt: string;
  client?: CrmClient | null;
  lead?: CrmLead | null;
  template?: CommunicationTemplate | null;
  webhookEvents?: CommunicationWebhookEvent[];
}

export interface CommunicationWebhookEvent {
  id: string;
  channel: CommunicationChannel;
  provider: CommunicationProvider | null;
  providerMessageId: string | null;
  status: CommunicationStatus | null;
  payload: Record<string, unknown>;
  receivedAt: string;
}

export interface CommunicationCampaign {
  id: string;
  name: string;
  channel: CommunicationChannel;
  status: CampaignStatus;
  scheduledAt: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  template?: CommunicationTemplate | null;
  messages?: CommunicationMessage[];
}

export interface CrmCustomerScore {
  id: string;
  score: number;
  riskLevel: CustomerRiskLevel;
  potentialValue: string | number | null;
  engagementScore: number;
  recurrenceScore: number;
  overdueScore: number;
  reason: string | null;
  calculatedAt: string;
}

export interface CommunicationReport {
  messagesByStatus: Array<{ status: CommunicationStatus; total: number }>;
  messagesByChannel: Array<{ channel: CommunicationChannel; total: number }>;
  campaigns: number;
  averageScore: number;
  slaAlerts: Array<{ leadId: string; leadName: string; stage: CrmPipelineStage; priority: Priority; rule: string; delayedHours: number }>;
}

export interface CrmGoal {
  id: string;
  name: string;
  responsible: string | null;
  periodStart: string;
  periodEnd: string;
  targetValue: string | number | null;
  targetCount: number | null;
  achievedValue: string | number | null;
  achievedCount: number;
  active: boolean;
}

export interface CrmSlaRule {
  id: string;
  name: string;
  stage: CrmPipelineStage | null;
  priority: Priority | null;
  maxHours: number;
  active: boolean;
}

export interface CrmClientIntelligence {
  summary: string;
  risk: string;
  nextAction: string;
  suggestedMessage: string;
  lastActivityAt: string | null;
  lastMessageAt: string | null;
}

export interface CrmLeadImportError {
  row: number;
  name?: string;
  message: string;
}

export interface CrmLeadImportResult {
  created: number;
  failed: number;
  errors: CrmLeadImportError[];
}

export interface CrmLeadCityStat {
  city: string;
  state: string;
  total: number;
}

export interface CrmLeadStats {
  total: number;
  open: number;
  qualified: number;
  estimatedTotal: number;
}
