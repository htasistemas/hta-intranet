import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Edit3, FolderKanban, Plus, Search, Trash2, Wallet, XCircle } from "lucide-react";
import { format } from "date-fns";
import { api } from "@/services/api";
import type { PageResult, Project, ProjectStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ProjectForm } from "@/components/projects/project-form";
import { useToast } from "@/contexts/toast-context";
import { cn, currency } from "@/lib/utils";

const statusLabels: Record<ProjectStatus, string> = {
  PLANNING: "Planejamento", ACTIVE: "Ativo", ON_HOLD: "Pausado", COMPLETED: "Concluído", CANCELLED: "Cancelado"
};

export default function ProjectsPage() {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Project | undefined>();
  const [opened, setOpened] = useState(false);
  const [projectToCancel, setProjectToCancel] = useState<Project | undefined>();
  const [projectToDelete, setProjectToDelete] = useState<Project | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data, isLoading } = useQuery({ queryKey: ["projects", search], queryFn: () => api.get<PageResult<Project>>(`/projects?pageSize=50&search=${encodeURIComponent(search)}`) });
  const projects = data?.data ?? [];
  const metrics = useMemo(() => ({
    active: projects.filter((project) => project.status === "ACTIVE").length,
    budget: projects.reduce((total, project) => total + Number(project.budget ?? 0), 0),
    delayed: projects.filter((project) => project.dueDate && new Date(project.dueDate) < new Date() && project.status !== "COMPLETED").length
  }), [projects]);
  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => selected ? api.put<Project>(`/projects/${selected.id}`, input) : api.post<Project>("/projects", input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["projects"] }); setOpened(false); toast("Projeto salvo com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });
  const cancel = useMutation({
    mutationFn: (project: Project) => api.put<Project>(`/projects/${project.id}`, {
      clientId: project.client?.id ?? null,
      productId: project.product?.id ?? null,
      name: project.name,
      code: project.code,
      description: project.description,
      status: "CANCELLED",
      priority: project.priority,
      startDate: project.startDate,
      dueDate: project.dueDate,
      budget: project.budget ? Number(project.budget) : null,
      progress: project.progress,
      color: project.color
    }),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["projects"] }); setProjectToCancel(undefined); toast("Projeto cancelado com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });
  const remove = useMutation({
    mutationFn: (projectId: string) => api.delete(`/projects/${projectId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["projects"] }); setProjectToDelete(undefined); toast("Projeto excluido com sucesso."); },
    onError: (error) => toast(error.message, "error")
  });
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-3">
        <Card><p className="text-sm text-slate-400">Projetos ativos</p><p className="mt-3 text-3xl font-semibold">{metrics.active}</p></Card>
        <Card><p className="text-sm text-slate-400">Orçamento monitorado</p><p className="mt-3 text-3xl font-semibold">{currency(metrics.budget)}</p></Card>
        <Card><p className="text-sm text-slate-400">Atenção ao prazo</p><p className="mt-3 text-3xl font-semibold">{metrics.delayed}</p></Card>
      </section>
      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar projeto, código ou cliente" /></label>
        <Button onClick={() => { setSelected(undefined); setOpened(true); }}><Plus size={17} /> Novo projeto</Button>
      </div>
      {isLoading ? <Skeleton className="h-72" /> : projects.length === 0 ? (
        <Card className="grid min-h-64 place-items-center text-center"><div><FolderKanban className="mx-auto mb-3 text-accent" /><h2 className="font-semibold">Nenhum projeto encontrado</h2><p className="mt-2 text-sm text-slate-400">Cadastre um projeto para acompanhar prazo, orçamento e progresso.</p></div></Card>
      ) : (
        <section className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {projects.map((project) => (
            <Card key={project.id} className="relative overflow-hidden">
              <span className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: project.color }} />
              <div className="mb-3 flex items-start justify-between gap-3">
                <div><p className="text-xs text-slate-400">{project.code}</p><h2 className="mt-1 font-semibold">{project.name}</h2><p className="text-sm text-slate-400">{project.client?.name ?? "Projeto interno"}</p></div>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => { setSelected(project); setOpened(true); }} aria-label="Editar projeto"><Edit3 size={17} /></Button>
                  {project.status !== "CANCELLED" && project.status !== "COMPLETED" && (
                    <Button variant="ghost" size="icon" onClick={() => setProjectToCancel(project)} disabled={cancel.isPending} aria-label="Cancelar projeto"><XCircle size={17} /></Button>
                  )}
                  <Button variant="danger" size="icon" onClick={() => setProjectToDelete(project)} disabled={remove.isPending} aria-label="Excluir projeto"><Trash2 size={17} /></Button>
                </div>
              </div>
              <div className="mb-4 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-blue-300">{statusLabels[project.status]}</span>
                <span className={cn("rounded-full px-2.5 py-1", project.priority === "HIGH" || project.priority === "URGENT" ? "bg-red-500/15 text-red-300" : "bg-accent/10 text-accent")}>{project.priority}</span>
              </div>
              <div className="mb-4"><div className="mb-2 flex justify-between text-xs text-slate-400"><span>Progresso</span><span>{project.progress}%</span></div><div className="h-2 rounded-full bg-sidebar"><div className="h-2 rounded-full gradient-fill" style={{ width: `${project.progress}%` }} /></div></div>
              <div className="flex justify-between text-xs text-slate-400">
                <span className="flex items-center gap-1"><Wallet size={14} /> {currency(Number(project.budget ?? 0))}</span>
                <span className="flex items-center gap-1"><CalendarClock size={14} /> {project.dueDate ? format(new Date(project.dueDate), "dd/MM/yyyy") : "Sem prazo"}</span>
              </div>
            </Card>
          ))}
        </section>
      )}
      <Dialog open={opened} title={selected ? "Editar projeto" : "Novo projeto"} onClose={() => setOpened(false)}>
        <ProjectForm project={selected} onCancel={() => setOpened(false)} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <ConfirmDialog
        open={Boolean(projectToCancel)}
        title="Cancelar projeto"
        description={`Deseja cancelar o projeto "${projectToCancel?.name ?? ""}"? Ele continuara registrado no sistema com status cancelado.`}
        confirmLabel="Cancelar projeto"
        loading={cancel.isPending}
        onClose={() => setProjectToCancel(undefined)}
        onConfirm={() => { if (projectToCancel) cancel.mutate(projectToCancel); }}
      />
      <ConfirmDialog
        open={Boolean(projectToDelete)}
        title="Excluir projeto"
        description={`Deseja excluir o projeto "${projectToDelete?.name ?? ""}"? Esta acao remove o projeto da listagem.`}
        confirmLabel="Excluir projeto"
        loading={remove.isPending}
        onClose={() => setProjectToDelete(undefined)}
        onConfirm={() => { if (projectToDelete) remove.mutate(projectToDelete.id); }}
      />
    </div>
  );
}
