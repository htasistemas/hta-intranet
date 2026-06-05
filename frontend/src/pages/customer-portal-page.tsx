import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, FolderKanban, Mail, ShieldCheck } from "lucide-react";
import { api } from "@/services/api";
import type { PageResult } from "@/types";
import type { CrmClient, CrmClientIntelligence } from "@/types/crm";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function CustomerPortalPage() {
  const [clientId, setClientId] = useState("");
  const clientsQuery = useQuery({ queryKey: ["portal-crm-clients"], queryFn: () => api.get<PageResult<CrmClient>>("/crm/clients?pageSize=100") });
  const clients = clientsQuery.data?.data ?? [];
  const selected = useMemo(() => clients.find((client) => client.id === clientId) ?? clients[0], [clients, clientId]);
  const intelligence = useQuery({
    queryKey: ["portal-client-intelligence", selected?.id],
    queryFn: () => api.get<CrmClientIntelligence>(`/crm/clients/${selected?.id}/intelligence`),
    enabled: Boolean(selected?.id)
  });

  if (clientsQuery.isLoading) return <Skeleton className="h-96" />;
  if (!selected) return <Card className="text-sm text-slate-400">Nenhum cliente CRM convertido ainda.</Card>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div><h2 className="text-lg font-semibold">Portal 360 do Cliente</h2><p className="text-sm text-slate-400">Visao consolidada para atendimento, entrega e relacionamento.</p></div>
        <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" value={selected.id} onChange={(event) => setClientId(event.target.value)}>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      </div>

      <Card>
        <CardTitle>{selected.name}</CardTitle>
        <div className="grid gap-4 md:grid-cols-4">
          <p className="rounded-xl bg-sidebar p-3 text-sm">Empresa<br /><span className="font-semibold">{selected.company ?? "-"}</span></p>
          <p className="rounded-xl bg-sidebar p-3 text-sm">Contato<br /><span className="font-semibold">{selected.email ?? selected.whatsapp ?? "-"}</span></p>
          <p className="rounded-xl bg-sidebar p-3 text-sm">Projetos<br /><span className="font-semibold">{selected.projects?.length ?? 0}</span></p>
          <p className="rounded-xl bg-sidebar p-3 text-sm">Score<br /><span className="font-semibold">{selected.scores?.[0]?.score ?? "Nao calculado"}</span></p>
        </div>
      </Card>

      {intelligence.data && <Card><CardTitle><ShieldCheck className="inline-block text-accent" size={18} /> Proxima melhor acao</CardTitle><p className="text-sm text-slate-300">{intelligence.data.nextAction}</p><p className="mt-3 rounded-xl bg-sidebar p-3 text-sm">{intelligence.data.suggestedMessage}</p></Card>}

      <section className="grid gap-5 xl:grid-cols-3">
        <Card><CardTitle><FolderKanban className="inline-block text-accent" size={18} /> Projetos</CardTitle><div className="space-y-2">{selected.projects?.map((project) => <div key={project.id} className="rounded-xl bg-sidebar p-3 text-sm">{project.name} - {project.progress}%</div>)}</div></Card>
        <Card><CardTitle><FileText className="inline-block text-accent" size={18} /> Propostas e contratos</CardTitle><div className="space-y-2">{selected.proposals?.map((proposal) => <div key={proposal.id} className="rounded-xl bg-sidebar p-3 text-sm">{proposal.number} - {proposal.status}</div>)}{selected.contracts?.map((contract) => <div key={contract.id} className="rounded-xl bg-sidebar p-3 text-sm">{contract.number} - {contract.status}</div>)}</div></Card>
        <Card><CardTitle><Mail className="inline-block text-accent" size={18} /> Comunicacoes</CardTitle><div className="space-y-2">{selected.messages?.slice(0, 8).map((message) => <div key={message.id} className="rounded-xl bg-sidebar p-3 text-sm">{message.channel} - {message.status}</div>)}</div></Card>
      </section>
    </div>
  );
}
