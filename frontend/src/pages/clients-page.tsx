import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Edit3, LayoutGrid, List, Plus, Search, Trash2, Upload, UserPlus } from "lucide-react";
import { api } from "@/services/api";
import type { Client, ClientImportResult, PageResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ClientForm } from "@/components/clients/client-form";
import { ClientImportDialog } from "@/components/clients/client-import-dialog";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("list");
  const [selected, setSelected] = useState<Client | undefined>();
  const [clientToDelete, setClientToDelete] = useState<Client | undefined>();
  const [opened, setOpened] = useState(false);
  const [importOpened, setImportOpened] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["clients", "active", search], queryFn: () => api.get<PageResult<Client>>(`/clients?pageSize=30&status=ACTIVE&search=${encodeURIComponent(search)}`) });
  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => selected ? api.put<Client>(`/clients/${selected.id}`, input) : api.post<Client>("/clients", input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["clients"] }); setOpened(false); toast("Cliente salvo com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });
  const remove = useMutation({
    mutationFn: (clientId: string) => api.delete(`/clients/${clientId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["clients"] }); setClientToDelete(undefined); toast("Cliente excluido com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });
  const moveToProspecting = useMutation({
    mutationFn: (clientId: string) => api.post<unknown>(`/clients/${clientId}/move-to-prospecting`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["clients"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-leads"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-lead-cities"] });
      void queryClient.invalidateQueries({ queryKey: ["crm-lead-stats"] });
      toast("Cliente voltou para captacao.");
    },
    onError: (error) => toast(error.message, "error")
  });
  const exportReport = async (type: "csv" | "pdf") => {
    try { await api.download(`/reports/clients.${type}`, `clientes.${type}`); toast("Relatorio exportado."); }
    catch (error) { toast(error instanceof Error ? error.message : "Falha na exportacao.", "error"); }
  };
  const handleImported = (result: ClientImportResult) => {
    void queryClient.invalidateQueries({ queryKey: ["clients"] });
    const message = result.failed ? `${result.created} cliente(s) importado(s). ${result.failed} linha(s) com erro.` : `${result.created} cliente(s) importado(s) com sucesso.`;
    toast(message, result.failed ? "error" : "success");
  };
  const openClient = (client: Client) => {
    setSelected(client);
    setOpened(true);
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar cliente ativo, documento ou email" /></label>
        <div className="grid grid-cols-2 rounded-xl border border-slate-700 bg-sidebar p-1">
          <button type="button" className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition", viewMode === "cards" && "bg-accent/10 text-accent")} onClick={() => setViewMode("cards")} aria-pressed={viewMode === "cards"}>
            <LayoutGrid size={17} /> Cards
          </button>
          <button type="button" className={cn("inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm text-slate-400 transition", viewMode === "list" && "bg-accent/10 text-accent")} onClick={() => setViewMode("list")} aria-pressed={viewMode === "list"}>
            <List size={17} /> Lista
          </button>
        </div>
        <Button variant="outline" onClick={() => void exportReport("csv")}><Download size={17} /> Excel</Button>
        <Button variant="outline" onClick={() => setImportOpened(true)}><Upload size={17} /> Importar</Button>
        <Button onClick={() => { setSelected(undefined); setOpened(true); }}><Plus size={17} /> Novo cliente</Button>
      </div>
      {isLoading ? <Skeleton className="h-60" /> : (
        viewMode === "cards" ? (
          <section className="grid gap-4 xl:grid-cols-3">
            {data?.data.map((client) => (
              <Card key={client.id} className="cursor-pointer" onClick={() => openClient(client)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <button type="button" className="truncate text-left font-semibold text-foreground transition hover:text-accent" onClick={(event) => { event.stopPropagation(); openClient(client); }}>{client.name}</button>
                    <p className="truncate text-sm text-slate-400">{client.email ?? "Sem email"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{client.status}</span>
                </div>
                <div className="mt-4 grid gap-2 text-sm text-slate-300">
                  <p>{client.phone ?? client.whatsapp ?? "Telefone nao informado"}</p>
                  <p>{[client.city, client.state].filter(Boolean).join(" / ") || "Localidade nao informada"}</p>
                  <p>{client.category?.name ?? "Sem categoria"}</p>
                </div>
                <div className="mt-4 flex justify-end gap-1" onClick={(event) => event.stopPropagation()}>
                  <Button variant="outline" size="sm" onClick={() => moveToProspecting.mutate(client.id)} disabled={moveToProspecting.isPending} aria-label="Voltar para captacao"><UserPlus size={17} /> Captacao</Button>
                  <Button variant="ghost" size="icon" onClick={() => openClient(client)} aria-label="Editar cliente"><Edit3 size={17} /></Button>
                  <Button variant="danger" size="icon" onClick={() => setClientToDelete(client)} disabled={remove.isPending} aria-label="Excluir cliente"><Trash2 size={17} /></Button>
                </div>
              </Card>
            ))}
          </section>
        ) : (
          <Card className="overflow-x-auto p-0">
            <table className="w-full min-w-[820px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400"><tr><th className="p-5">Cliente</th><th>Telefone</th><th>Status</th><th>Categoria</th><th>Localidade</th><th /></tr></thead>
              <tbody>{data?.data.map((client) => (
                <tr key={client.id} className="border-b border-slate-700/50 transition hover:bg-white/[.025]">
                  <td className="p-5"><button type="button" className="text-left font-medium transition hover:text-accent" onClick={() => openClient(client)}>{client.name}</button><p className="text-xs text-slate-400">{client.email}</p></td>
                  <td>{client.phone ?? client.whatsapp ?? "-"}</td>
                  <td><span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{client.status}</span></td>
                  <td>{client.category?.name ?? "-"}</td><td>{[client.city, client.state].filter(Boolean).join(" / ") || "-"}</td>
                  <td>
                    <div className="flex justify-end gap-1 pr-3">
                      <Button variant="outline" size="sm" onClick={() => moveToProspecting.mutate(client.id)} disabled={moveToProspecting.isPending} aria-label="Voltar para captacao"><UserPlus size={17} /> Captacao</Button>
                      <Button variant="ghost" size="icon" onClick={() => openClient(client)} aria-label="Editar cliente"><Edit3 size={17} /></Button>
                      <Button variant="danger" size="icon" onClick={() => setClientToDelete(client)} disabled={remove.isPending} aria-label="Excluir cliente"><Trash2 size={17} /></Button>
                    </div>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </Card>
        ))}
      <Dialog open={opened} title={selected ? "Editar cliente" : "Novo cliente"} onClose={() => setOpened(false)} className="max-w-[96vw] xl:max-w-7xl">
        <ClientForm client={selected} onCancel={() => setOpened(false)} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <ClientImportDialog open={importOpened} onClose={() => setImportOpened(false)} onImported={handleImported} />
      <ConfirmDialog
        open={Boolean(clientToDelete)}
        title="Excluir cliente"
        description={`Deseja excluir o cliente "${clientToDelete?.name ?? ""}"? Esta acao remove o cliente da listagem.`}
        confirmLabel="Excluir cliente"
        loading={remove.isPending}
        onClose={() => setClientToDelete(undefined)}
        onConfirm={() => { if (clientToDelete) remove.mutate(clientToDelete.id); }}
      />
    </div>
  );
}
