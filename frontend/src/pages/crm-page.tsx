import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Download, FileText, Handshake, KanbanSquare, LayoutDashboard, ListFilter, Mail, Plus, Search, Settings2, UserRoundCheck } from "lucide-react";
import { api } from "@/services/api";
import type { PageResult } from "@/types";
import type { CrmActivity, CrmAutomation, CrmClient, CrmClientIntelligence, CrmDashboard, CrmLead, CrmPipelineStage, CrmProject, CrmProjectStatus, CrmProposal } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { currency } from "@/lib/utils";
import { useToast } from "@/contexts/toast-context";
import { ActivityForm, AutomationForm, AutomationList, CompactActivityList, LeadForm, ProjectForm, ProposalForm, ProposalList, type ActivityFormInput, type AutomationFormInput, type LeadFormInput, type ProjectFormInput, type ProposalFormInput } from "@/components/crm/crm-forms";
import { CrmPipelineKanban, CrmProjectKanban } from "@/components/crm/crm-kanban";
import { CommunicationPanel } from "@/components/crm/communication-panel";

type CrmTab = "dashboard" | "leads" | "pipeline" | "timeline" | "proposals" | "projects" | "portal" | "communication" | "automations" | "reports";

const tabs: Array<{ id: CrmTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "leads", label: "Leads", icon: UserRoundCheck },
  { id: "pipeline", label: "Funil", icon: KanbanSquare },
  { id: "timeline", label: "Timeline", icon: ListFilter },
  { id: "proposals", label: "Propostas", icon: FileText },
  { id: "projects", label: "Projetos", icon: Handshake },
  { id: "portal", label: "Cliente 360", icon: UserRoundCheck },
  { id: "communication", label: "Comunicacao", icon: Mail },
  { id: "automations", label: "Automacoes", icon: Settings2 },
  { id: "reports", label: "Relatorios", icon: Download }
];

const stageLabels: Record<string, string> = {
  LEAD_RECEIVED: "Recebido",
  FIRST_CONTACT: "Contato",
  QUALIFICATION: "Qualificacao",
  DEMONSTRATION: "Demo",
  PROPOSAL_SENT: "Proposta",
  NEGOTIATION: "Negociacao",
  APPROVAL: "Aprovacao",
  IMPLEMENTATION: "Implantacao",
  SALE_COMPLETED: "Venda",
  LOST: "Perdido"
};

const statusLabels: Record<string, string> = {
  NEW: "Novo",
  IN_SERVICE: "Em Atendimento",
  QUALIFIED: "Qualificado",
  PROPOSAL_SENT: "Proposta Enviada",
  NEGOTIATION: "Negociacao",
  WON: "Fechado Ganho",
  LOST: "Fechado Perdido"
};

const chartColors = ["#2DD4BF", "#3B82F6", "#F59E0B", "#EF4444", "#A78BFA", "#22C55E"];

function tabButtonClass(active: boolean): string {
  return active ? "gradient-fill text-white" : "border border-slate-700 bg-sidebar text-slate-300 hover:bg-white/5";
}

function projectPayload(input: ProjectFormInput) {
  const { teamText, ...rest } = input;
  return { ...rest, team: teamText?.split(",").map((item) => item.trim()).filter(Boolean) ?? [] };
}

function automationPayload(input: AutomationFormInput) {
  const { parameterKey, parameterValue, ...rest } = input;
  return { ...rest, parameters: parameterKey ? { [parameterKey]: parameterValue ?? null } : {} };
}

export default function CrmPage() {
  const [tab, setTab] = useState<CrmTab>("dashboard");
  const [search, setSearch] = useState("");
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | undefined>();
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const dashboard = useQuery({ queryKey: ["crm-dashboard"], queryFn: () => api.get<CrmDashboard>("/crm/dashboard") });
  const leadsQuery = useQuery({ queryKey: ["crm-leads", search], queryFn: () => api.get<PageResult<CrmLead>>(`/crm/leads?pageSize=100&search=${encodeURIComponent(search)}`) });
  const clientsQuery = useQuery({ queryKey: ["crm-clients", search], queryFn: () => api.get<PageResult<CrmClient>>(`/crm/clients?pageSize=100&search=${encodeURIComponent(search)}`) });
  const activitiesQuery = useQuery({ queryKey: ["crm-activities"], queryFn: () => api.get<CrmActivity[]>("/crm/activities") });
  const proposalsQuery = useQuery({ queryKey: ["crm-proposals"], queryFn: () => api.get<CrmProposal[]>("/crm/proposals") });
  const projectsQuery = useQuery({ queryKey: ["crm-projects", search], queryFn: () => api.get<PageResult<CrmProject>>(`/crm/projects?pageSize=100&search=${encodeURIComponent(search)}`) });
  const automationsQuery = useQuery({ queryKey: ["crm-automations"], queryFn: () => api.get<CrmAutomation[]>("/crm/automations") });

  const leads = leadsQuery.data?.data ?? [];
  const clients = clientsQuery.data?.data ?? [];
  const activities = activitiesQuery.data ?? [];
  const proposals = proposalsQuery.data ?? [];
  const projects = projectsQuery.data?.data ?? [];
  const automations = automationsQuery.data ?? [];
  const selectedClient = useMemo(() => clients.find((client) => client.id === selectedClientId) ?? clients[0], [clients, selectedClientId]);
  const clientIntelligence = useQuery({
    queryKey: ["crm-client-intelligence", selectedClient?.id],
    queryFn: () => api.get<CrmClientIntelligence>(`/crm/clients/${selectedClient?.id}/intelligence`),
    enabled: Boolean(selectedClient?.id)
  });

  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["crm-dashboard"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-clients"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-activities"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-proposals"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-projects"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-automations"] });
  };

  const saveLead = useMutation({
    mutationFn: (input: LeadFormInput) => selectedLead ? api.put<CrmLead>(`/crm/leads/${selectedLead.id}`, input) : api.post<CrmLead>("/crm/leads", input),
    onSuccess: () => { setLeadDialogOpen(false); setSelectedLead(undefined); refreshAll(); toast("Lead salvo com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });

  const moveLead = useMutation({
    mutationFn: ({ lead, stage }: { lead: CrmLead; stage: CrmPipelineStage }) => api.put<CrmLead>(`/crm/leads/${lead.id}/stage`, { stage }),
    onSuccess: () => { refreshAll(); toast("Funil atualizado."); },
    onError: (error) => toast(error.message, "error")
  });

  const saveActivity = useMutation({
    mutationFn: (input: ActivityFormInput) => api.post<CrmActivity>("/crm/activities", input),
    onSuccess: () => { refreshAll(); toast("Atividade criada."); },
    onError: (error) => toast(error.message, "error")
  });

  const saveProposal = useMutation({
    mutationFn: (input: ProposalFormInput) => api.post<CrmProposal>("/crm/proposals", input),
    onSuccess: () => { refreshAll(); toast("Proposta salva."); },
    onError: (error) => toast(error.message, "error")
  });

  const saveProject = useMutation({
    mutationFn: (input: ProjectFormInput) => api.post<CrmProject>("/crm/projects", projectPayload(input)),
    onSuccess: () => { refreshAll(); toast("Projeto salvo."); },
    onError: (error) => toast(error.message, "error")
  });

  const moveProject = useMutation({
    mutationFn: ({ project, status }: { project: CrmProject; status: CrmProjectStatus }) => api.put<CrmProject>(`/crm/projects/${project.id}`, { ...projectPayload({ ...project, clientId: project.client.id, teamText: project.team.join(", "), executedHours: Number(project.executedHours ?? 0), budget: project.budget ? Number(project.budget) : null, plannedHours: project.plannedHours ? Number(project.plannedHours) : null }), status }),
    onSuccess: () => { refreshAll(); toast("Projeto atualizado."); },
    onError: (error) => toast(error.message, "error")
  });

  const saveAutomation = useMutation({
    mutationFn: (input: AutomationFormInput) => api.post<CrmAutomation>("/crm/automations", automationPayload(input)),
    onSuccess: () => { refreshAll(); toast("Automacao salva."); },
    onError: (error) => toast(error.message, "error")
  });

  function renderDashboard() {
    if (dashboard.isLoading || !dashboard.data) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-32" />)}</div>;
    const kpis = dashboard.data.kpis;
    const cards = [
      ["Total de Leads", kpis.totalLeads],
      ["Leads do Dia", kpis.leadsToday],
      ["Leads da Semana", kpis.leadsWeek],
      ["Leads do Mes", kpis.leadsMonth],
      ["Oportunidades em Aberto", kpis.openOpportunities],
      ["Propostas Enviadas", kpis.proposalsSent],
      ["Vendas Fechadas", kpis.wonSales],
      ["Vendas Perdidas", kpis.lostSales],
      ["Taxa de Conversao", `${kpis.conversionRate}%`],
      ["Ticket Medio", currency(kpis.averageTicket)],
      ["Valor em Negociacao", currency(kpis.negotiationValue)],
      ["Pipeline Ponderado", currency(kpis.weightedPipelineValue)],
      ["Receita Prevista", currency(kpis.forecastRevenue)],
      ["Receita Realizada", currency(kpis.realizedRevenue)]
    ] as const;
    return (
      <div className="space-y-5">
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <Card key={label} className="min-h-28"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 text-2xl font-semibold">{value}</p></Card>)}</section>
        <section className="grid gap-5 xl:grid-cols-2">
          <Card><CardTitle>Funil de Conversao</CardTitle><ResponsiveContainer width="100%" height={260}><BarChart data={dashboard.data.funnel.map((item) => ({ ...item, stage: stageLabels[item.stage] }))}><CartesianGrid stroke="#263857" vertical={false} /><XAxis dataKey="stage" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Bar dataKey="total" fill="#2DD4BF" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></Card>
          <Card><CardTitle>Leads por Origem</CardTitle><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={dashboard.data.leadsBySource} dataKey="total" nameKey="name" innerRadius={58} outerRadius={88}>{dashboard.data.leadsBySource.map((item, index) => <Cell key={item.name} fill={chartColors[index % chartColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card>
          <Card><CardTitle>Vendas por Vendedor</CardTitle><ResponsiveContainer width="100%" height={250}><BarChart data={dashboard.data.salesByResponsible}><XAxis dataKey="name" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Bar dataKey="total" fill="#3B82F6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></Card>
          <Card><CardTitle>Evolucao Mensal de Vendas</CardTitle><ResponsiveContainer width="100%" height={250}><LineChart data={dashboard.data.monthlySales}><CartesianGrid stroke="#263857" vertical={false} /><XAxis dataKey="month" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Line type="monotone" dataKey="total" stroke="#F59E0B" strokeWidth={3} /></LineChart></ResponsiveContainer></Card>
          <Card><CardTitle>Conversao por Etapa</CardTitle><ResponsiveContainer width="100%" height={250}><BarChart data={dashboard.data.conversionByStage.map((item) => ({ ...item, stage: stageLabels[item.stage] }))}><XAxis dataKey="stage" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Bar dataKey="rate" fill="#22C55E" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></Card>
          <Card><CardTitle>Projetos em Andamento</CardTitle><div className="space-y-3">{dashboard.data.projectsInProgress.map((project) => <div key={project.id} className="rounded-xl bg-sidebar p-3"><div className="flex justify-between text-sm"><span>{project.name}</span><span>{project.progress}%</span></div><p className="text-xs text-slate-400">{project.client}</p></div>)}</div></Card>
        </section>
      </div>
    );
  }

  function renderLeads() {
    if (leadsQuery.isLoading) return <Skeleton className="h-96" />;
    return (
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row"><label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar lead, empresa, CNPJ ou e-mail" /></label><Button onClick={() => { setSelectedLead(undefined); setLeadDialogOpen(true); }}><Plus size={17} /> Novo lead</Button></div>
        <section className="grid gap-4 xl:grid-cols-3">{leads.map((lead) => <Card key={lead.id} className="cursor-pointer" onClick={() => { setSelectedLead(lead); setLeadDialogOpen(true); }}><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{lead.name}</h2><p className="text-sm text-slate-400">{lead.company ?? lead.email ?? "Sem empresa"}</p></div><span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">{statusLabels[lead.status]}</span></div><p className="mt-4 text-2xl font-semibold">{currency(Number(lead.estimatedValue ?? 0))}</p><div className="mt-4 flex flex-wrap gap-2 text-xs"><span className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-300">{lead.source ?? "Origem nao informada"}</span><span className="rounded-full bg-red-500/15 px-2 py-1 text-red-300">{lead.priority}</span><span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-300">{lead.score}</span></div></Card>)}</section>
      </div>
    );
  }

  function renderPortal() {
    if (!selectedClient) return <Card className="text-sm text-slate-400">Nenhum cliente convertido ainda.</Card>;
    return (
      <div className="space-y-4">
        <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" value={selectedClient.id} onChange={(event) => setSelectedClientId(event.target.value)}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <Card><CardTitle>{selectedClient.name}</CardTitle><div className="grid gap-4 md:grid-cols-3"><p className="text-sm text-slate-400">Empresa<br /><span className="text-slate-100">{selectedClient.company ?? "-"}</span></p><p className="text-sm text-slate-400">Contato<br /><span className="text-slate-100">{selectedClient.email ?? selectedClient.whatsapp ?? "-"}</span></p><p className="text-sm text-slate-400">Local<br /><span className="text-slate-100">{selectedClient.city ?? "-"} {selectedClient.state ?? ""}</span></p></div></Card>
        {clientIntelligence.data && <Card><CardTitle>Inteligencia comercial</CardTitle><p className="text-sm text-slate-300">{clientIntelligence.data.summary}</p><div className="mt-4 grid gap-3 md:grid-cols-3"><p className="rounded-xl bg-sidebar p-3 text-sm">Risco<br /><span className="font-semibold text-accent">{clientIntelligence.data.risk}</span></p><p className="rounded-xl bg-sidebar p-3 text-sm md:col-span-2">Proxima acao<br /><span className="font-semibold text-slate-100">{clientIntelligence.data.nextAction}</span></p></div><p className="mt-3 rounded-xl bg-sidebar p-3 text-sm text-slate-300">{clientIntelligence.data.suggestedMessage}</p></Card>}
        <section className="grid gap-4 xl:grid-cols-3">
          <Card><CardTitle>Leads</CardTitle><div className="space-y-2">{selectedClient.leads?.map((lead) => <p key={lead.id} className="rounded-lg bg-sidebar p-2 text-sm">{lead.name}</p>)}</div></Card>
          <Card><CardTitle>Propostas</CardTitle><ProposalList proposals={selectedClient.proposals ?? []} /></Card>
          <Card><CardTitle>Projetos</CardTitle><div className="space-y-2">{selectedClient.projects?.map((project) => <p key={project.id} className="rounded-lg bg-sidebar p-2 text-sm">{project.name} - {project.progress}%</p>)}</div></Card>
          <Card><CardTitle>Contratos</CardTitle><div className="space-y-2">{selectedClient.contracts?.map((contract) => <p key={contract.id} className="rounded-lg bg-sidebar p-2 text-sm">{contract.number} - {contract.status}</p>)}</div></Card>
          <Card><CardTitle>Mensagens</CardTitle><div className="space-y-2">{selectedClient.messages?.slice(0, 5).map((message) => <p key={message.id} className="rounded-lg bg-sidebar p-2 text-sm">{message.channel} - {message.status}</p>)}</div></Card>
          <Card><CardTitle>Score</CardTitle><div className="space-y-2">{selectedClient.scores?.slice(0, 3).map((score) => <p key={score.id} className="rounded-lg bg-sidebar p-2 text-sm">{score.score} pontos - {score.riskLevel}</p>)}</div></Card>
          <Card className="xl:col-span-2"><CardTitle>Historico</CardTitle><CompactActivityList activities={selectedClient.activities ?? []} /></Card>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap gap-2">{tabs.map(({ id, label, icon: Icon }) => <button key={id} type="button" onClick={() => setTab(id)} className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition ${tabButtonClass(tab === id)}`}><Icon size={16} /> {label}</button>)}</section>
      {tab === "dashboard" && renderDashboard()}
      {tab === "leads" && renderLeads()}
      {tab === "pipeline" && (leadsQuery.isLoading ? <Skeleton className="h-96" /> : <CrmPipelineKanban leads={leads} onMove={(lead, stage) => moveLead.mutate({ lead, stage })} />)}
      {tab === "timeline" && <div className="space-y-4"><Card><CardTitle>Nova atividade</CardTitle><ActivityForm onSave={(input) => saveActivity.mutateAsync(input).then(() => undefined)} /></Card><Card><CardTitle>Historico completo</CardTitle><CompactActivityList activities={activities} /></Card></div>}
      {tab === "proposals" && <div className="space-y-4"><Card><CardTitle>Nova proposta</CardTitle><ProposalForm leads={leads} clients={clients} onSave={(input) => saveProposal.mutateAsync(input).then(() => undefined)} /></Card><Card><CardTitle>Propostas comerciais</CardTitle><ProposalList proposals={proposals} /></Card></div>}
      {tab === "projects" && <div className="space-y-4"><Card><CardTitle>Novo projeto</CardTitle><ProjectForm clients={clients} onSave={(input) => saveProject.mutateAsync(input).then(() => undefined)} /></Card>{projectsQuery.isLoading ? <Skeleton className="h-96" /> : <CrmProjectKanban projects={projects} onMove={(project, status) => moveProject.mutate({ project, status })} />}</div>}
      {tab === "portal" && renderPortal()}
      {tab === "communication" && <CommunicationPanel leads={leads} clients={clients} />}
      {tab === "automations" && <div className="space-y-4"><Card><CardTitle>Automacao configuravel</CardTitle><AutomationForm onSave={(input) => saveAutomation.mutateAsync(input).then(() => undefined)} /></Card><Card><CardTitle>Regras ativas</CardTitle><AutomationList automations={automations} /></Card></div>}
      {tab === "reports" && <Card><CardTitle>Relatorios</CardTitle><div className="grid gap-3 md:grid-cols-3"><Button variant="outline" onClick={() => void api.download("/crm/reports.csv", "crm-comercial.csv")}><Download size={16} /> Pipeline comercial CSV</Button><Button variant="outline" onClick={() => void api.download("/crm/reports.pdf", "crm-comercial.pdf")}><Download size={16} /> Receita PDF</Button><Button variant="outline" onClick={() => void api.download("/crm/reports.xls", "crm-comercial.xls")}><Download size={16} /> Produtividade Excel</Button></div><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-sidebar p-4 text-xs text-slate-300">{JSON.stringify(dashboard.data ?? {}, null, 2)}</pre></Card>}
      <Dialog open={leadDialogOpen} title={selectedLead ? "Editar lead" : "Novo lead"} onClose={() => setLeadDialogOpen(false)}>
        <LeadForm lead={selectedLead} onCancel={() => setLeadDialogOpen(false)} onSave={(input) => saveLead.mutateAsync(input).then(() => undefined)} />
      </Dialog>
    </div>
  );
}
