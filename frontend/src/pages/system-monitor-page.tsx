import { useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Edit3, ExternalLink, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { SystemMonitor, SystemMonitorCheckResult, SystemMonitorStatus } from "@/types";

const monitorSchema = z.object({
  name: z.string().min(2, "Informe o nome.").max(120, "Use no maximo 120 caracteres."),
  url: z.string().url("Informe uma URL valida.").transform((value) => value.replace(/\/+$/, "")),
  checkPath: z.string().min(1, "Informe o caminho.").max(200, "Use no maximo 200 caracteres.").transform((value) => value.startsWith("/") ? value : `/${value}`),
  expectedStatus: z.coerce.number().int().min(100).max(599),
  timeoutMs: z.coerce.number().int().min(1000).max(30000),
  active: z.boolean()
});

type MonitorFields = z.infer<typeof monitorSchema>;

const monitorDefaults: MonitorFields = {
  name: "",
  url: "https://",
  checkPath: "/health",
  expectedStatus: 200,
  timeoutMs: 8000,
  active: true
};

const statusLabels: Record<SystemMonitorStatus, string> = {
  ACTIVE: "Ativo",
  DOWN: "Fora do ar",
  UNKNOWN: "Pendente"
};

const statusClassNames: Record<SystemMonitorStatus, string> = {
  ACTIVE: "border-emerald-400/25 bg-emerald-500/10 text-emerald-300",
  DOWN: "border-red-400/25 bg-red-500/10 text-red-300",
  UNKNOWN: "border-amber-400/25 bg-amber-500/10 text-amber-200"
};

function monitorValues(monitor?: SystemMonitor): MonitorFields {
  if (!monitor) return monitorDefaults;
  return {
    name: monitor.name,
    url: monitor.url,
    checkPath: monitor.checkPath,
    expectedStatus: monitor.expectedStatus,
    timeoutMs: monitor.timeoutMs,
    active: monitor.active
  };
}

function formatDate(value: string | null): string {
  if (!value) return "Sem verificacao";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function averageResponse(monitors: SystemMonitor[]): number {
  const values = monitors.map((monitor) => monitor.responseTimeMs).filter((value): value is number => value !== null);
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function statusIcon(status: SystemMonitorStatus) {
  if (status === "ACTIVE") return <CheckCircle2 size={17} />;
  if (status === "DOWN") return <AlertTriangle size={17} />;
  return <Clock3 size={17} />;
}

function playOutageAlert(): void {
  const AudioContextClass = window.AudioContext;
  const audioContext = new AudioContextClass();
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(660, audioContext.currentTime + 0.18);
  gain.gain.setValueAtTime(0.001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.45);

  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.5);
  window.setTimeout(() => void audioContext.close(), 700);
}

function MonitorStatusBadge({ monitor }: { monitor: SystemMonitor }) {
  if (!monitor.active) {
    return <span className="inline-flex items-center gap-2 rounded-full border border-slate-600 bg-slate-700/30 px-3 py-1 text-xs text-slate-300"><Clock3 size={15} /> Pausado</span>;
  }
  return (
    <span className={cn("inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs", statusClassNames[monitor.status])}>
      {statusIcon(monitor.status)}
      {statusLabels[monitor.status]}
    </span>
  );
}

function MonitorForm({ monitor, onSave, onCancel }: { monitor?: SystemMonitor; onSave: (input: MonitorFields) => Promise<void>; onCancel: () => void }) {
  const values = useMemo(() => monitorValues(monitor), [monitor]);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<MonitorFields>({ resolver: zodResolver(monitorSchema), values });

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(onSave)}>
      <label className="md:col-span-2">Nome<Input {...register("name")} />{errors.name && <small className="text-red-400">{errors.name.message}</small>}</label>
      <label className="md:col-span-2">URL<Input {...register("url")} />{errors.url && <small className="text-red-400">{errors.url.message}</small>}</label>
      <label>Caminho<Input {...register("checkPath")} />{errors.checkPath && <small className="text-red-400">{errors.checkPath.message}</small>}</label>
      <label>Status esperado<Input type="number" min="100" max="599" {...register("expectedStatus")} />{errors.expectedStatus && <small className="text-red-400">{errors.expectedStatus.message}</small>}</label>
      <label>Timeout (ms)<Input type="number" min="1000" max="30000" step="500" {...register("timeoutMs")} />{errors.timeoutMs && <small className="text-red-400">{errors.timeoutMs.message}</small>}</label>
      <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-sidebar px-3 py-3 text-sm">
        <input type="checkbox" className="h-4 w-4 accent-emerald-500" {...register("active")} />
        Monitoramento ativo
      </label>
      <div className="flex justify-end gap-3 md:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar sistema"}</Button>
      </div>
    </form>
  );
}

export default function SystemMonitorPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMonitor, setSelectedMonitor] = useState<SystemMonitor | undefined>();
  const [monitorToDelete, setMonitorToDelete] = useState<SystemMonitor | undefined>();
  const alertedOutages = useRef<Set<string>>(new Set());
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const monitorsQuery = useQuery({ queryKey: ["system-monitors"], queryFn: () => api.get<SystemMonitor[]>("/system-monitors") });
  const checkQuery = useQuery({
    queryKey: ["system-monitors", "check"],
    queryFn: () => api.post<SystemMonitorCheckResult[]>("/system-monitors/check", {}),
    refetchInterval: 10000,
    enabled: Boolean(monitorsQuery.data)
  });

  const checkedMonitors = checkQuery.data?.map((result) => result.monitor) ?? [];
  const monitors = useMemo(() => {
    const latest = new Map<string, SystemMonitor>();
    for (const monitor of monitorsQuery.data ?? []) latest.set(monitor.id, monitor);
    for (const monitor of checkedMonitors) latest.set(monitor.id, monitor);
    return Array.from(latest.values()).sort((left, right) => Number(right.active) - Number(left.active) || left.name.localeCompare(right.name));
  }, [checkedMonitors, monitorsQuery.data]);

  const metrics = useMemo(() => ({
    active: monitors.filter((monitor) => monitor.active && monitor.status === "ACTIVE").length,
    down: monitors.filter((monitor) => monitor.active && monitor.status === "DOWN").length,
    pending: monitors.filter((monitor) => monitor.active && monitor.status === "UNKNOWN").length,
    paused: monitors.filter((monitor) => !monitor.active).length,
    average: averageResponse(monitors)
  }), [monitors]);

  useEffect(() => {
    if (!checkQuery.data) return;
    for (const result of checkQuery.data) {
      if (result.alert && !alertedOutages.current.has(result.monitor.id)) {
        alertedOutages.current.add(result.monitor.id);
        toast(`${result.monitor.name} saiu do ar.`, "error");
        try {
          playOutageAlert();
        } catch {
          toast("Som bloqueado pelo navegador ate haver interacao na pagina.", "error");
        }
      }
      if (result.monitor.status === "ACTIVE") alertedOutages.current.delete(result.monitor.id);
    }
  }, [checkQuery.data, toast]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["system-monitors"] });
    void queryClient.invalidateQueries({ queryKey: ["system-monitors", "check"] });
  };

  const saveMonitor = useMutation({
    mutationFn: (input: MonitorFields) => selectedMonitor ? api.put<SystemMonitor>(`/system-monitors/${selectedMonitor.id}`, input) : api.post<SystemMonitor>("/system-monitors", input),
    onSuccess: () => { invalidate(); setDialogOpen(false); setSelectedMonitor(undefined); toast("Sistema salvo."); },
    onError: (error) => toast(error.message, "error")
  });

  const removeMonitor = useMutation({
    mutationFn: (id: string) => api.delete(`/system-monitors/${id}`),
    onSuccess: () => { invalidate(); setMonitorToDelete(undefined); toast("Sistema removido."); },
    onError: (error) => toast(error.message, "error")
  });

  const checkOne = useMutation({
    mutationFn: (id: string) => api.post<SystemMonitorCheckResult>(`/system-monitors/${id}/check`, {}),
    onSuccess: (result) => {
      invalidate();
      if (result.alert) toast(`${result.monitor.name} saiu do ar.`, "error");
      else toast(`${result.monitor.name}: ${statusLabels[result.monitor.status]}.`);
    },
    onError: (error) => toast(error.message, "error")
  });

  const openForm = (monitor?: SystemMonitor): void => {
    setSelectedMonitor(monitor);
    setDialogOpen(true);
  };

  const closeForm = (): void => {
    setDialogOpen(false);
    setSelectedMonitor(undefined);
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-5">
        <Card><p className="text-sm text-slate-400">Ativos</p><p className="mt-3 text-3xl font-semibold text-emerald-300">{metrics.active}</p></Card>
        <Card><p className="text-sm text-slate-400">Fora do ar</p><p className="mt-3 text-3xl font-semibold text-red-300">{metrics.down}</p></Card>
        <Card><p className="text-sm text-slate-400">Pendentes</p><p className="mt-3 text-3xl font-semibold text-amber-200">{metrics.pending}</p></Card>
        <Card><p className="text-sm text-slate-400">Pausados</p><p className="mt-3 text-3xl font-semibold">{metrics.paused}</p></Card>
        <Card><p className="text-sm text-slate-400">Tempo medio</p><p className="mt-3 text-3xl font-semibold">{metrics.average}ms</p></Card>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3 text-sm text-slate-400">
          <span className={cn("h-2.5 w-2.5 rounded-full", checkQuery.isFetching ? "bg-amber-300" : "bg-emerald-400")} />
          <span>{checkQuery.isFetching ? "Verificando sistemas" : `Ultima leitura ${formatDate(monitors[0]?.lastCheckedAt ?? null)}`}</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => void checkQuery.refetch()} disabled={checkQuery.isFetching}><RefreshCw size={17} /> Verificar agora</Button>
          <Button onClick={() => openForm()}><Plus size={17} /> Novo sistema</Button>
        </div>
      </div>

      <section className="grid gap-4 xl:grid-cols-3">
        {monitorsQuery.isLoading ? Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-56" />) : monitors.map((monitor) => (
          <Card key={monitor.id} className={cn("space-y-4", monitor.status === "DOWN" && monitor.active && "animate-pulse border-red-400/70 bg-red-950/30 shadow-[0_0_32px_rgba(248,113,113,0.22)]")}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Activity className="shrink-0 text-slate-400" size={18} />
                  <h2 className="truncate font-semibold">{monitor.name}</h2>
                </div>
                <a className="mt-1 block truncate text-sm text-slate-400 transition hover:text-accent" href={monitor.url} target="_blank" rel="noreferrer">
                  {monitor.url}{monitor.checkPath}
                </a>
              </div>
              <MonitorStatusBadge monitor={monitor} />
            </div>

            <div className="grid grid-cols-3 gap-3 text-sm">
              <div className="rounded-xl border border-slate-700/60 bg-sidebar p-3">
                <p className="text-xs text-slate-500">HTTP</p>
                <p className="mt-1 font-semibold">{monitor.lastStatusCode ?? "-"}</p>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-sidebar p-3">
                <p className="text-xs text-slate-500">Resposta</p>
                <p className="mt-1 font-semibold">{monitor.responseTimeMs ?? 0}ms</p>
              </div>
              <div className="rounded-xl border border-slate-700/60 bg-sidebar p-3">
                <p className="text-xs text-slate-500">Esperado</p>
                <p className="mt-1 font-semibold">{monitor.expectedStatus}</p>
              </div>
            </div>

            <div className="space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500">Ultima verificacao:</span> {formatDate(monitor.lastCheckedAt)}</p>
              {monitor.lastError && <p className="rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-red-200">{monitor.lastError}</p>}
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button asChild variant="ghost" size="sm"><a href={monitor.url} target="_blank" rel="noreferrer"><ExternalLink size={16} /> Abrir</a></Button>
              <Button variant="outline" size="sm" onClick={() => checkOne.mutate(monitor.id)} disabled={!monitor.active || checkOne.isPending}><RefreshCw size={16} /> Testar</Button>
              <Button variant="ghost" size="sm" onClick={() => openForm(monitor)}><Edit3 size={16} /> Editar</Button>
              <Button variant="danger" size="icon" onClick={() => setMonitorToDelete(monitor)} aria-label="Excluir sistema"><Trash2 size={16} /></Button>
            </div>
          </Card>
        ))}
      </section>

      {!monitorsQuery.isLoading && !monitors.length && (
        <Card className="grid min-h-56 place-items-center text-center text-slate-400">
          <div><Activity className="mx-auto mb-3" /><p>Nenhum sistema cadastrado.</p></div>
        </Card>
      )}

      <Dialog open={dialogOpen} title={selectedMonitor ? "Editar sistema" : "Novo sistema"} onClose={closeForm}>
        <MonitorForm monitor={selectedMonitor} onCancel={closeForm} onSave={(input) => saveMonitor.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <ConfirmDialog
        open={Boolean(monitorToDelete)}
        title="Excluir sistema"
        description={`Deseja excluir "${monitorToDelete?.name ?? ""}"?`}
        confirmLabel="Excluir"
        loading={removeMonitor.isPending}
        onClose={() => setMonitorToDelete(undefined)}
        onConfirm={() => { if (monitorToDelete) removeMonitor.mutate(monitorToDelete.id); }}
      />
    </div>
  );
}
