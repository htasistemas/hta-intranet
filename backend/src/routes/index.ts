import { raw, Router } from "express";
import { rateLimit } from "express-rate-limit";
import { AuthController } from "../controllers/auth.controller.js";
import { ClientController, ProjectController, ScheduleController, TaskController } from "../controllers/resource.controller.js";
import { UtilityController } from "../controllers/utility.controller.js";
import { ReportController } from "../controllers/report.controller.js";
import { CrmController } from "../controllers/crm.controller.js";
import { GoogleCalendarController } from "../controllers/google-calendar.controller.js";
import { CommunicationController } from "../controllers/communication.controller.js";
import { ProductController } from "../controllers/product.controller.js";
import { BackupController } from "../controllers/backup.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validateBody } from "../middleware/validate.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";
import {
  categorySchema,
  clientImportRequestSchema,
  clientSchema,
  crmActivitySchema,
  crmAutomationSchema,
  crmContractSchema,
  crmLeadSchema,
  crmLeadStageSchema,
  crmProjectSchema,
  crmProjectTaskSchema,
  crmProposalSchema,
  communicationCampaignSchema,
  communicationProviderConfigSchema,
  communicationSendSchema,
  communicationTemplateSchema,
  communicationWebhookSchema,
  crmGoalSchema,
  crmLeadImportRequestSchema,
  crmSlaRuleSchema,
  noteSchema,
  clientProductSchema,
  productServiceSchema,
  projectSchema,
  scheduleSchema,
  taskSchema,
  userAdminUpdateSchema,
  userCreateSchema,
  userUpdateSchema
} from "../validations/entities.validation.js";
import { loginSchema, refreshSchema } from "../validations/auth.validation.js";
import { openApiDocument } from "../utils/openapi.js";

const auth = new AuthController();
const clients = new ClientController();
const schedules = new ScheduleController();
const tasks = new TaskController();
const projects = new ProjectController();
const utility = new UtilityController();
const reports = new ReportController();
const crm = new CrmController();
const googleCalendar = new GoogleCalendarController();
const communication = new CommunicationController();
const products = new ProductController();
const backups = new BackupController();
export const apiRouter = Router();

const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false });
apiRouter.get("/", (_request, response) => response.json({
  name: "AMT Brasil API",
  version: "1.0.0",
  documentation: "/api/docs",
  authentication: "/api/auth/login"
}));
apiRouter.get("/docs", (_request, response) => response.json(openApiDocument));
apiRouter.post("/auth/login", loginLimiter, validateBody(loginSchema), asyncHandler(auth.login));
apiRouter.post("/auth/refresh", validateBody(refreshSchema), asyncHandler(auth.refresh));
apiRouter.post("/auth/logout", validateBody(refreshSchema), asyncHandler(auth.logout));
apiRouter.get("/google-calendar/callback", asyncHandler(googleCalendar.callback));

apiRouter.use(requireAuth);
apiRouter.get("/google-calendar/status", asyncHandler(googleCalendar.status));
apiRouter.get("/google-calendar/auth-url", asyncHandler(googleCalendar.authUrl));
apiRouter.post("/google-calendar/auth-url", asyncHandler(googleCalendar.manualAuthUrl));
apiRouter.delete("/google-calendar", asyncHandler(googleCalendar.disconnect));
apiRouter.get("/dashboard", asyncHandler(utility.summary));
apiRouter.get("/search", asyncHandler(utility.search));
apiRouter.get("/lookup/cep/:cep", asyncHandler(utility.lookupCep));
apiRouter.get("/lookup/cnpj/:cnpj", asyncHandler(utility.lookupCnpj));
apiRouter.get("/clients", asyncHandler(clients.list));
apiRouter.get("/clients/:id", asyncHandler(clients.get));
apiRouter.post("/clients/import", validateBody(clientImportRequestSchema), asyncHandler(clients.import));
apiRouter.post("/clients", validateBody(clientSchema), asyncHandler(clients.create));
apiRouter.put("/clients/:id", validateBody(clientSchema), asyncHandler(clients.update));
apiRouter.post("/clients/:id/move-to-prospecting", asyncHandler(clients.moveToProspecting));
apiRouter.delete("/clients/:id", asyncHandler(clients.delete));
apiRouter.get("/products", asyncHandler(products.list));
apiRouter.get("/products/insights", asyncHandler(products.insights));
apiRouter.get("/products/:id", asyncHandler(products.get));
apiRouter.post("/products", validateBody(productServiceSchema), asyncHandler(products.create));
apiRouter.put("/products/:id", validateBody(productServiceSchema), asyncHandler(products.update));
apiRouter.delete("/products/:id", asyncHandler(products.delete));
apiRouter.get("/client-products", asyncHandler(products.listClientProducts));
apiRouter.post("/client-products", validateBody(clientProductSchema), asyncHandler(products.createClientProduct));
apiRouter.put("/client-products/:id", validateBody(clientProductSchema), asyncHandler(products.updateClientProduct));
apiRouter.delete("/client-products/:id", asyncHandler(products.deleteClientProduct));
apiRouter.get("/projects", asyncHandler(projects.list));
apiRouter.get("/projects/:id", asyncHandler(projects.get));
apiRouter.post("/projects", validateBody(projectSchema), asyncHandler(projects.create));
apiRouter.put("/projects/:id", validateBody(projectSchema), asyncHandler(projects.update));
apiRouter.delete("/projects/:id", asyncHandler(projects.delete));
apiRouter.get("/schedules", asyncHandler(schedules.list));
apiRouter.post("/schedules", validateBody(scheduleSchema), asyncHandler(schedules.create));
apiRouter.put("/schedules/:id", validateBody(scheduleSchema), asyncHandler(schedules.update));
apiRouter.delete("/schedules/:id", asyncHandler(schedules.delete));
apiRouter.get("/tasks", asyncHandler(tasks.list));
apiRouter.get("/task-columns", asyncHandler(utility.taskColumns));
apiRouter.post("/tasks", validateBody(taskSchema), asyncHandler(tasks.create));
apiRouter.put("/tasks/:id", validateBody(taskSchema), asyncHandler(tasks.update));
apiRouter.delete("/tasks/:id", asyncHandler(tasks.delete));
apiRouter.get("/categories", asyncHandler(utility.categories));
apiRouter.post("/categories", validateBody(categorySchema), asyncHandler(utility.createCategory));
apiRouter.put("/categories/:id", validateBody(categorySchema), asyncHandler(utility.updateCategory));
apiRouter.delete("/categories/:id", asyncHandler(utility.deleteCategory));
apiRouter.get("/notes", asyncHandler(utility.notes));
apiRouter.post("/notes", validateBody(noteSchema), asyncHandler(utility.createNote));
apiRouter.put("/notes/:id", validateBody(noteSchema), asyncHandler(utility.updateNote));
apiRouter.delete("/notes/:id", asyncHandler(utility.deleteNote));
apiRouter.get("/users/me", asyncHandler(utility.profile));
apiRouter.put("/users/me", validateBody(userUpdateSchema), asyncHandler(utility.updateProfile));
apiRouter.get("/users", requireAdmin, asyncHandler(utility.users));
apiRouter.post("/users", requireAdmin, validateBody(userCreateSchema), asyncHandler(utility.createUser));
apiRouter.put("/users/:id", requireAdmin, validateBody(userAdminUpdateSchema), asyncHandler(utility.updateUser));
apiRouter.delete("/users/:id", requireAdmin, asyncHandler(utility.deleteUser));
apiRouter.post("/backups", requireAdmin, asyncHandler(backups.create));
apiRouter.post("/backups/restore", requireAdmin, raw({ type: "application/octet-stream", limit: "500mb" }), asyncHandler(backups.restore));
apiRouter.get("/reports/clients.csv", asyncHandler(reports.clientsCsv));
apiRouter.get("/reports/clients.pdf", asyncHandler(reports.clientsPdf));
apiRouter.get("/crm/dashboard", asyncHandler(crm.dashboard));
apiRouter.get("/crm/pipeline/insights", asyncHandler(crm.pipelineInsights));
apiRouter.get("/crm/leads", asyncHandler(crm.listLeads));
apiRouter.post("/crm/leads/import", validateBody(crmLeadImportRequestSchema), asyncHandler(crm.importLeads));
apiRouter.get("/crm/leads/cities", asyncHandler(crm.leadCities));
apiRouter.get("/crm/leads/stats", asyncHandler(crm.leadStats));
apiRouter.get("/crm/leads/:id/intelligence", asyncHandler(crm.leadIntelligence));
apiRouter.get("/crm/leads/:id", asyncHandler(crm.getLead));
apiRouter.post("/crm/leads", validateBody(crmLeadSchema), asyncHandler(crm.createLead));
apiRouter.put("/crm/leads/:id", validateBody(crmLeadSchema), asyncHandler(crm.updateLead));
apiRouter.put("/crm/leads/:id/stage", validateBody(crmLeadStageSchema), asyncHandler(crm.moveLeadStage));
apiRouter.post("/crm/leads/:id/activate-client", asyncHandler(crm.activateLead));
apiRouter.post("/crm/leads/:id/convert", asyncHandler(crm.convertLead));
apiRouter.delete("/crm/leads/:id", asyncHandler(crm.deleteLead));
apiRouter.get("/crm/clients", asyncHandler(crm.listClients));
apiRouter.get("/crm/clients/:id/intelligence", asyncHandler(crm.clientIntelligence));
apiRouter.get("/crm/clients/:id", asyncHandler(crm.getClient));
apiRouter.get("/crm/activities", asyncHandler(crm.listActivities));
apiRouter.post("/crm/activities", validateBody(crmActivitySchema), asyncHandler(crm.createActivity));
apiRouter.get("/crm/proposals", asyncHandler(crm.listProposals));
apiRouter.post("/crm/proposals", validateBody(crmProposalSchema), asyncHandler(crm.createProposal));
apiRouter.put("/crm/proposals/:id", validateBody(crmProposalSchema), asyncHandler(crm.updateProposal));
apiRouter.get("/crm/contracts", asyncHandler(crm.listContracts));
apiRouter.post("/crm/contracts", validateBody(crmContractSchema), asyncHandler(crm.createContract));
apiRouter.get("/crm/projects", asyncHandler(crm.listProjects));
apiRouter.post("/crm/projects", validateBody(crmProjectSchema), asyncHandler(crm.createProject));
apiRouter.put("/crm/projects/:id", validateBody(crmProjectSchema), asyncHandler(crm.updateProject));
apiRouter.post("/crm/project-tasks", validateBody(crmProjectTaskSchema), asyncHandler(crm.createProjectTask));
apiRouter.get("/crm/automations", asyncHandler(crm.listAutomations));
apiRouter.post("/crm/automations", validateBody(crmAutomationSchema), asyncHandler(crm.createAutomation));
apiRouter.put("/crm/automations/:id", validateBody(crmAutomationSchema), asyncHandler(crm.updateAutomation));
apiRouter.get("/crm/reports", asyncHandler(crm.reports));
apiRouter.get("/crm/reports.csv", asyncHandler(crm.reportsCsv));
apiRouter.get("/crm/reports.pdf", asyncHandler(crm.reportsPdf));
apiRouter.get("/crm/reports.xls", asyncHandler(crm.reportsExcel));
apiRouter.get("/communication/provider-configs", asyncHandler(communication.providerConfigs));
apiRouter.post("/communication/provider-configs", validateBody(communicationProviderConfigSchema), asyncHandler(communication.createProviderConfig));
apiRouter.get("/communication/templates", asyncHandler(communication.templates));
apiRouter.post("/communication/templates", validateBody(communicationTemplateSchema), asyncHandler(communication.createTemplate));
apiRouter.put("/communication/templates/:id", validateBody(communicationTemplateSchema), asyncHandler(communication.updateTemplate));
apiRouter.delete("/communication/templates/:id", asyncHandler(communication.deleteTemplate));
apiRouter.get("/communication/messages", asyncHandler(communication.messages));
apiRouter.post("/communication/send", validateBody(communicationSendSchema), asyncHandler(communication.send));
apiRouter.post("/communication/queue/process", asyncHandler(communication.processQueue));
apiRouter.get("/communication/campaigns", asyncHandler(communication.campaigns));
apiRouter.post("/communication/campaigns", validateBody(communicationCampaignSchema), asyncHandler(communication.createCampaign));
apiRouter.post("/communication/campaigns/:id/run", asyncHandler(communication.runCampaign));
apiRouter.get("/communication/report", asyncHandler(communication.report));
apiRouter.post("/communication/webhooks", validateBody(communicationWebhookSchema), asyncHandler(communication.webhook));
apiRouter.post("/crm/scores/calculate", asyncHandler(communication.calculateScores));
apiRouter.get("/crm/goals", asyncHandler(communication.goals));
apiRouter.post("/crm/goals", validateBody(crmGoalSchema), asyncHandler(communication.createGoal));
apiRouter.get("/crm/sla-rules", asyncHandler(communication.slaRules));
apiRouter.post("/crm/sla-rules", validateBody(crmSlaRuleSchema), asyncHandler(communication.createSlaRule));
apiRouter.get("/crm/sla-alerts", asyncHandler(communication.slaAlerts));
