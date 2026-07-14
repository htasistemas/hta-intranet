import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Filter, History, LayoutGrid, List, Mail, Plus, Printer, Search, Trash2, TrendingUp, Upload, UserCheck, X } from "lucide-react";
import { api } from "@/services/api";
import type { PageResult } from "@/types";
import type { CrmLead, CrmLeadCityStat, CrmLeadImportResult, CrmLeadScore, CrmLeadStats, CrmLeadStatus, CrmRegistrationStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadImportDialog } from "@/components/crm/lead-import-dialog";
import { LeadEmailDialog } from "@/components/crm/lead-email-dialog";
import { LeadHistoryDialog } from "@/components/crm/lead-history-dialog";
import { LeadForm, type LeadFormInput } from "@/components/crm/crm-forms";
import { useToast } from "@/contexts/toast-context";
import { cn, currency } from "@/lib/utils";

const statusLabels: Record<CrmLeadStatus, string> = {
  NEW: "Novo",
  IN_SERVICE: "Em atendimento",
  QUALIFIED: "Qualificado",
  PROPOSAL_SENT: "Proposta enviada",
  NEGOTIATION: "Negociacao",
  WON: "Ganho",
  LOST: "Perdido"
};

const scoreLabels: Record<CrmLeadScore, string> = {
  VERY_HOT: "Muito quente",
  HOT: "Quente",
  WARM: "Morno",
  COLD: "Frio"
};

const registrationLabels: Record<CrmRegistrationStatus, string> = {
  COMPLETE: "Completo",
  INCOMPLETE: "Incompleto",
  UPDATING: "Atualizando"
};

type PriorityFilter = "" | "LOW" | "MEDIUM" | "HIGH" | "URGENT";
type StatusFilter = "" | CrmLeadStatus;
type RegistrationFilter = "" | CrmRegistrationStatus;
type RelationshipFilter = "" | "MESSAGED" | "CONTACTED" | "UPDATED" | "WITH_HISTORY";

const filterSelectClass = "h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-slate-200 outline-none focus:border-accent";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function printableValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

function lastMovement(lead: CrmLead): { label: string; date: string } | null {
  const message = lead.messages?.[0];
  const activity = lead.activities?.[0];
  const messageDate = message ? new Date(message.sentAt ?? message.createdAt).getTime() : 0;
  const activityDate = activity ? new Date(activity.completedAt ?? activity.createdAt).getTime() : 0;
  const updatedDate = new Date(lead.updatedAt).getTime();
  const wasUpdatedAfterCreation = updatedDate - new Date(lead.createdAt).getTime() > 1_000;
  if (message && messageDate >= activityDate && messageDate >= updatedDate) return { label: message.channel === "EMAIL" ? "Último e-mail" : "Última mensagem", date: message.sentAt ?? message.createdAt };
  if (activity && activityDate >= updatedDate) return { label: activity.title, date: activity.completedAt ?? activity.createdAt };
  if (wasUpdatedAfterCreation) return { label: "Última atualização", date: lead.updatedAt };
  return null;
}

export default function ProspectingPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("");
  const [registrationFilter, setRegistrationFilter] = useState<RegistrationFilter>("");
  const [relationshipFilter, setRelationshipFilter] = useState<RelationshipFilter>("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [opened, setOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);
  const [selected, setSelected] = useState<CrmLead | undefined>();
  const [leadToDelete, setLeadToDelete] = useState<CrmLead | undefined>();
  const [leadToEmail, setLeadToEmail] = useState<CrmLead | undefined>();
  const [leadToHistory, setLeadToHistory] = useState<CrmLead | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["crm-leads", "prospecting", search, statusFilter, priorityFilter, registrationFilter, relationshipFilter],
    queryFn: () => {
      const params = new URLSearchParams({ pageSize: "100" });
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter) params.set("status", statusFilter);
      if (priorityFilter) params.set("priority", priorityFilter);
      if (registrationFilter) params.set("registrationStatus", registrationFilter);
      if (relationshipFilter) params.set("relationship", relationshipFilter);
      return api.get<PageResult<CrmLead>>(`/crm/leads?${params.toString()}`);
    }
  });
  const cityStats = useQuery({ queryKey: ["crm-lead-cities"], queryFn: () => api.get<CrmLeadCityStat[]>("/crm/leads/cities") });
  const leadStats = useQuery({ queryKey: ["crm-lead-stats"], queryFn: () => api.get<CrmLeadStats>("/crm/leads/stats") });
  const leads = data?.data ?? [];
  const cities = cityStats.data ?? [];
  const hasActiveFilters = Boolean(statusFilter || priorityFilter || registrationFilter || relationshipFilter);

  const clearFilters = (): void => {
    setStatusFilter("");
    setPriorityFilter("");
    setRegistrationFilter("");
    setRelationshipFilter("");
  };

  const printVisibleLeads = (): void => {
    if (!leads.length) {
      toast("Nao ha captacoes para imprimir.", "error");
      return;
    }

    const printWindow = window.open("", "_blank", "noopener,noreferrer");
    if (!printWindow) {
      toast("Nao foi possivel abrir a janela de impressao.", "error");
      return;
    }

    const generatedAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
    const rows = leads.map((lead) => `
      <tr>
        <td><strong>${escapeHtml(lead.name)}</strong><br><span>${escapeHtml(printableValue(lead.company ?? lead.segment))}</span></td>
        <td>${escapeHtml(printableValue(lead.email))}<br><span>${escapeHtml(printableValue(lead.whatsapp ?? lead.phone))}</span></td>
        <td>${escapeHtml([lead.city, lead.state].filter(Boolean).join(" / ") || "-")}</td>
        <td>${escapeHtml(statusLabels[lead.status])}<br><span>${escapeHtml(scoreLabels[lead.score])}</span></td>
        <td>${escapeHtml(currency(Number(lead.estimatedValue ?? 0)))}</td>
        <td>${escapeHtml(printableValue(lead.responsible))}</td>
        <td>${escapeHtml(printableValue(lead.source))}</td>
      </tr>
    `).join("");

    printWindow.document.write(`
      <!doctype html>
      <html lang="pt-BR">
        <head>
          <meta charset="utf-8">
          <title>Lista de captacao</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 24px; color: #111827; font-family: Arial, sans-serif; font-size: 12px; }
            header { margin-bottom: 18px; }
            h1 { margin: 0 0 6px; font-size: 20px; }
            p { margin: 0; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; }
            th { background: #f3f4f6; color: #374151; font-size: 10px; letter-spacing: .04em; text-align: left; text-transform: uppercase; }
            th, td { border: 1px solid #d1d5db; padding: 8px; vertical-align: top; }
            span { color: #6b7280; }
            @media print {
              body { margin: 12mm; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <header>
            <h1>Lista de captacao</h1>
            <p>${leads.length} registro(s) visualizado(s)${search ? ` - Busca: ${escapeHtml(search)}` : ""}</p>
            <p>Gerado em ${escapeHtml(generatedAt)}</p>
          </header>
          <table>
            <thead>
              <tr>
                <th>Captacao</th>
                <th>Contato</th>
                <th>Localidade</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Responsavel</th>
                <th>Origem</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <script>
            window.addEventListener("load", () => {
              window.print();
              window.close();
            });
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const refreshLists = () => {
    void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-lead-cities"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-lead-stats"] });
  };

  const save = useMutation({
    mutationFn: (input: LeadFormInput) => selected ? api.put<CrmLead>(`/crm/leads/${selected.id}`, input) : api.post<CrmLead>("/crm/leads", input),
    onSuccess: () => {
      refreshLists();
      setOpened(false);
      setSelected(undefined);
      toast("Cadastro de captacao salvo com sucesso.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const remove = useMutation({
    mutationFn: (leadId: string) => api.delete(`/crm/leads/${leadId}`),
    onSuccess: () => {
      refreshLists();
      setLeadToDelete(undefined);
      toast("Captacao excluida com sucesso.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const activateClient = useMutation({
    mutationFn: (leadId: string) => api.post<unknown>(`/crm/leads/${leadId}/activate-client`, {}),
    onSuccess: () => {
      refreshLists();
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      toast("Captacao movida para clientes ativos.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const handleImported = (result: CrmLeadImportResult) => {
    refreshLists();
    const message = result.failed ? `${result.created} captacao(oes) importada(s). ${result.failed} linha(s) com erro.` : `${result.created} captacao(oes) importada(s) com sucesso.`;
    toast(message, result.failed ? "error" : "success");
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Card>
          <p className="text-sm text-slate-400">Possiveis clientes</p>
          <p className="mt-3 text-2xl font-semibold">{leadStats.data?.open ?? data?.total ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Oportunidades qualificadas</p>
          <p className="mt-3 text-2xl font-semibold">{leadStats.data?.qualified ?? 0}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Valor estimado em captacao</p>
          <p className="mt-3 text-2xl font-semibold">{currency(leadStats.data?.estimatedTotal ?? 0)}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-400">Cidades cadastradas</p>
          <p className="mt-3 text-2xl font-semibold">{cities.length}</p>
          <div className="mt-3 space-y-1 text-xs text-slate-400">
            {cities.slice(0, 4).map((city) => <p key={`${city.city}-${city.state}`} className="flex justify-between gap-3"><span className="truncate">{[city.city, city.state].filter(Boolean).join(" / ")}</span><span>{city.total}</span></p>)}
          </div>
        </Card>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, cidade, UF, CNPJ ou email" />
        </label>
        <div className="grid grid-cols-2 rounded-xl border border-slate-700 bg-sidebar p-1">
          <button type="button" className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition", viewMode === "cards" && "bg-accent/10 text-accent")} onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"}>
            <LayoutGrid size={17} /> Cards
          </button>
          <button type="button" className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition", viewMode === "list" && "bg-accent/10 text-accent")} onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}>
            <List size={17} /> Lista
          </button>
        </div>
        <Button variant="outline" onClick={printVisibleLeads} disabled={isLoading || !leads.length}><Printer size={17} /> Imprimir</Button>
        <Button variant="outline" onClick={() => setImportOpened(true)}><Upload size={17} /> Importar</Button>
        <Button onClick={() => { setSelected(undefined); setOpened(true); }}><Plus size={17} /> Nova captacao</Button>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <div className="flex min-w-40 items-center gap-2 text-sm font-medium"><Filter size={17} className="text-accent" /> Filtrar captações</div>
          <div className="grid flex-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <label className="grid gap-1 text-xs text-slate-400">Status
              <select className={filterSelectClass} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
                <option value="">Todos os status</option>
                {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-xs text-slate-400">Prioridade
              <select className={filterSelectClass} value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}>
                <option value="">Todas as prioridades</option>
                <option value="LOW">Baixa</option><option value="MEDIUM">Média</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-slate-400">Cadastro
              <select className={filterSelectClass} value={registrationFilter} onChange={(event) => setRegistrationFilter(event.target.value as RegistrationFilter)}>
                <option value="">Todos os cadastros</option>
                <option value="COMPLETE">Completo</option><option value="INCOMPLETE">Incompleto</option><option value="UPDATING">Atualizando</option>
              </select>
            </label>
            <label className="grid gap-1 text-xs text-slate-400">Relacionamento
              <select className={filterSelectClass} value={relationshipFilter} onChange={(event) => setRelationshipFilter(event.target.value as RelationshipFilter)}>
                <option value="">Todos os contatos</option>
                <option value="MESSAGED">Com mensagem enviada</option><option value="CONTACTED">Com contato realizado</option><option value="UPDATED">Cadastro atualizado</option><option value="WITH_HISTORY">Com qualquer histórico</option>
              </select>
            </label>
          </div>
          <Button type="button" variant="ghost" onClick={clearFilters} disabled={!hasActiveFilters}><X size={16} /> Limpar filtros</Button>
        </div>
        <p className="mt-3 text-xs text-slate-400">{data?.total ?? 0} contato(s) encontrado(s) com os critérios selecionados.</p>
      </Card>

      {isLoading ? <Skeleton className="h-96" /> : (
        viewMode === "cards" ? (
          <section className="grid gap-4 xl:grid-cols-3">
            {leads.map((lead) => (
              <Card key={lead.id} className="cursor-pointer" onClick={() => { setSelected(lead); setOpened(true); }}>
                <div>
                  <div className="min-w-0">
                    <h2 className="break-words text-base font-semibold leading-6">{lead.name}</h2>
                    <p className="mt-1 break-words text-sm text-slate-400">{lead.company ?? lead.email ?? "Sem empresa"}</p>
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-1 border-t border-slate-700/60 pt-3" onClick={(event) => event.stopPropagation()}>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setLeadToHistory(lead)} aria-label="Ver histórico"><History size={16} /></Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => setLeadToEmail(lead)} disabled={!lead.email} aria-label={lead.email ? "Enviar e-mail" : "Captação sem e-mail"}><Mail size={16} /></Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => activateClient.mutate(lead.id)} disabled={activateClient.isPending} aria-label="Ativar como cliente"><UserCheck size={16} /> Ativar</Button>
                    <Button type="button" variant="ghost" size="icon" onClick={() => { setSelected(lead); setOpened(true); }} aria-label="Editar captacao"><Edit3 size={16} /></Button>
                    <Button type="button" variant="danger" size="icon" onClick={() => setLeadToDelete(lead)} disabled={remove.isPending} aria-label="Excluir captacao"><Trash2 size={16} /></Button>
                  </div>
                </div>
                <p className="mt-4 text-2xl font-semibold">{currency(Number(lead.estimatedValue ?? 0))}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">{statusLabels[lead.status]}</span>
                  <span className={cn("rounded-full px-2 py-1", lead.registrationStatus === "COMPLETE" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-500/15 text-slate-300")}>{registrationLabels[lead.registrationStatus]}</span>
                  <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">{scoreLabels[lead.score]}</span>
                  <span className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-200">{lead.source ?? "Origem nao informada"}</span>
                </div>
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <TrendingUp size={14} />
                  <span>{lead.segment ?? "Segmento nao informado"} - {lead.responsible}</span>
                </div>
                {lastMovement(lead) ? <p className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-400">{lastMovement(lead)?.label}: {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(lastMovement(lead)?.date ?? ""))}</p> : <p className="mt-3 border-t border-slate-700 pt-3 text-xs text-slate-500">Sem histórico de contato</p>}
              </Card>
            ))}
          </section>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
                <tr><th className="p-4">Captacao</th><th>Contato</th><th>Localidade</th><th>Status</th><th>Valor</th><th>Responsavel</th><th /></tr>
              </thead>
              <tbody>{leads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-700/50 transition hover:bg-white/[.025]">
                  <td className="p-4"><p className="font-medium">{lead.name}</p><p className="text-xs text-slate-400">{lead.company ?? lead.segment ?? "Sem empresa"}</p></td>
                  <td><p>{lead.email ?? "-"}</p><p className="text-xs text-slate-400">{lead.whatsapp ?? lead.phone ?? ""}</p></td>
                  <td>{[lead.city, lead.state].filter(Boolean).join(" / ") || "-"}</td>
                  <td><div className="flex flex-wrap gap-2"><span className="rounded-full bg-accent/10 px-2 py-1 text-xs text-accent">{statusLabels[lead.status]}</span><span className={cn("rounded-full px-2 py-1 text-xs", lead.registrationStatus === "COMPLETE" ? "bg-emerald-500/15 text-emerald-200" : "bg-slate-500/15 text-slate-300")}>{registrationLabels[lead.registrationStatus]}</span></div></td>
                  <td>{currency(Number(lead.estimatedValue ?? 0))}</td>
                  <td>{lead.responsible}</td>
                  <td>
                    <div className="flex justify-end gap-1 pr-3">
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLeadToHistory(lead)} aria-label="Ver histórico"><History size={16} /></Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => setLeadToEmail(lead)} disabled={!lead.email} aria-label={lead.email ? "Enviar e-mail" : "Captação sem e-mail"}><Mail size={16} /></Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => activateClient.mutate(lead.id)} disabled={activateClient.isPending} aria-label="Ativar como cliente"><UserCheck size={16} /> Ativar</Button>
                      <Button type="button" variant="ghost" size="icon" onClick={() => { setSelected(lead); setOpened(true); }} aria-label="Editar captacao"><Edit3 size={16} /></Button>
                      <Button type="button" variant="danger" size="icon" onClick={() => setLeadToDelete(lead)} disabled={remove.isPending} aria-label="Excluir captacao"><Trash2 size={16} /></Button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        )
      )}

      <Dialog open={opened} title={selected ? "Editar captacao" : "Nova captacao"} onClose={() => setOpened(false)} className="max-w-[96vw] xl:max-w-7xl">
        <LeadForm lead={selected} onCancel={() => setOpened(false)} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <LeadImportDialog open={importOpened} onClose={() => setImportOpened(false)} onImported={handleImported} />
      <LeadEmailDialog lead={leadToEmail} onClose={() => setLeadToEmail(undefined)} />
      <LeadHistoryDialog lead={leadToHistory} onClose={() => setLeadToHistory(undefined)} />
      <ConfirmDialog
        open={Boolean(leadToDelete)}
        title="Excluir captacao"
        description={`Deseja excluir a captacao "${leadToDelete?.name ?? ""}"? Esta acao remove o possivel cliente da listagem.`}
        confirmLabel="Excluir captacao"
        loading={remove.isPending}
        onClose={() => setLeadToDelete(undefined)}
        onConfirm={() => { if (leadToDelete) remove.mutate(leadToDelete.id); }}
      />
    </div>
  );
}
