import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, Plus, Search, Trash2, TrendingUp, Upload } from "lucide-react";
import { api } from "@/services/api";
import type { PageResult } from "@/types";
import type { CrmLead, CrmLeadCityStat, CrmLeadImportResult, CrmLeadScore, CrmLeadStats, CrmLeadStatus } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { LeadImportDialog } from "@/components/crm/lead-import-dialog";
import { LeadForm, type LeadFormInput } from "@/components/crm/crm-forms";
import { useToast } from "@/contexts/toast-context";
import { currency } from "@/lib/utils";

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

export default function ProspectingPage() {
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);
  const [selected, setSelected] = useState<CrmLead | undefined>();
  const [leadToDelete, setLeadToDelete] = useState<CrmLead | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["crm-leads", "prospecting", search], queryFn: () => api.get<PageResult<CrmLead>>(`/crm/leads?pageSize=100&search=${encodeURIComponent(search)}`) });
  const cityStats = useQuery({ queryKey: ["crm-lead-cities"], queryFn: () => api.get<CrmLeadCityStat[]>("/crm/leads/cities") });
  const leadStats = useQuery({ queryKey: ["crm-lead-stats"], queryFn: () => api.get<CrmLeadStats>("/crm/leads/stats") });
  const leads = data?.data ?? [];
  const cities = cityStats.data ?? [];

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
        <Button variant="outline" onClick={() => setImportOpened(true)}><Upload size={17} /> Importar</Button>
        <Button onClick={() => { setSelected(undefined); setOpened(true); }}><Plus size={17} /> Nova captacao</Button>
      </div>

      {isLoading ? <Skeleton className="h-96" /> : (
        <section className="grid gap-4 xl:grid-cols-3">
          {leads.map((lead) => (
            <Card key={lead.id} className="cursor-pointer" onClick={() => { setSelected(lead); setOpened(true); }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{lead.name}</h2>
                  <p className="truncate text-sm text-slate-400">{lead.company ?? lead.email ?? "Sem empresa"}</p>
                </div>
                <div className="flex shrink-0 gap-1" onClick={(event) => event.stopPropagation()}>
                  <Button type="button" variant="ghost" size="icon" onClick={() => { setSelected(lead); setOpened(true); }} aria-label="Editar captacao"><Edit3 size={16} /></Button>
                  <Button type="button" variant="danger" size="icon" onClick={() => setLeadToDelete(lead)} disabled={remove.isPending} aria-label="Excluir captacao"><Trash2 size={16} /></Button>
                </div>
              </div>
              <p className="mt-4 text-2xl font-semibold">{currency(Number(lead.estimatedValue ?? 0))}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-accent/10 px-2 py-1 text-accent">{statusLabels[lead.status]}</span>
                <span className="rounded-full bg-amber-500/15 px-2 py-1 text-amber-200">{scoreLabels[lead.score]}</span>
                <span className="rounded-full bg-blue-500/15 px-2 py-1 text-blue-200">{lead.source ?? "Origem nao informada"}</span>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                <TrendingUp size={14} />
                <span>{lead.segment ?? "Segmento nao informado"} - {lead.responsible}</span>
              </div>
            </Card>
          ))}
        </section>
      )}

      <Dialog open={opened} title={selected ? "Editar captacao" : "Nova captacao"} onClose={() => setOpened(false)}>
        <LeadForm lead={selected} onCancel={() => setOpened(false)} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <LeadImportDialog open={importOpened} onClose={() => setImportOpened(false)} onImported={handleImported} />
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
