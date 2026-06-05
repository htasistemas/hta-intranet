import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Clock3, ListTodo, Plus, Search, TimerReset } from "lucide-react";
import type { Task } from "@/types";
import { api } from "@/services/api";
import { KanbanBoard, type TaskColumn } from "@/components/personal/kanban-board";
import { TaskForm } from "@/components/personal/task-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/contexts/toast-context";

function taskPayload(task: Task, column: TaskColumn): Record<string, unknown> {
  return {
    title: task.title,
    description: task.description ?? "",
    priority: task.priority,
    dueDate: task.dueDate,
    clientId: task.client?.id ?? null,
    projectId: task.project?.id ?? null,
    categoryId: null,
    columnId: column.id,
    status: column.status,
    position: task.position
  };
}

function isOverdue(task: Task): boolean {
  return Boolean(task.dueDate && task.status !== "COMPLETED" && new Date(task.dueDate) < new Date());
}

export default function TasksPage() {
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | undefined>();
  const [taskToDelete, setTaskToDelete] = useState<Task | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: tasks = [], isLoading: tasksLoading } = useQuery({ queryKey: ["tasks", search], queryFn: () => api.get<Task[]>(`/tasks?search=${encodeURIComponent(search)}`) });
  const { data: columns = [], isLoading: columnsLoading } = useQuery({ queryKey: ["task-columns"], queryFn: () => api.get<TaskColumn[]>("/task-columns") });
  const isLoading = tasksLoading || columnsLoading;

  const metrics = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter((task) => task.status === "IN_PROGRESS").length,
    overdue: tasks.filter(isOverdue).length,
    completed: tasks.filter((task) => task.status === "COMPLETED").length
  }), [tasks]);

  const closeForm = (): void => {
    setOpened(false);
    setSelectedTask(undefined);
  };

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => selectedTask ? api.put<Task>(`/tasks/${selectedTask.id}`, input) : api.post<Task>("/tasks", input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["tasks"] }); closeForm(); toast(selectedTask ? "Tarefa atualizada." : "Tarefa criada."); },
    onError: (error) => toast(error.message, "error")
  });

  const remove = useMutation({
    mutationFn: (taskId: string) => api.delete(`/tasks/${taskId}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["tasks"] }); setTaskToDelete(undefined); toast("Tarefa excluida."); },
    onError: (error) => toast(error.message, "error")
  });

  const move = async (task: Task, column: TaskColumn): Promise<void> => {
    try {
      await api.put(`/tasks/${task.id}`, taskPayload(task, column));
      await queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast("Tarefa movimentada.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha ao mover tarefa.", "error");
    }
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card><p className="flex items-center gap-2 text-sm text-slate-400"><ListTodo size={17} className="text-accent" /> Total</p><p className="mt-3 text-3xl font-semibold">{metrics.total}</p></Card>
        <Card><p className="flex items-center gap-2 text-sm text-slate-400"><Clock3 size={17} className="text-blue-300" /> Em andamento</p><p className="mt-3 text-3xl font-semibold">{metrics.inProgress}</p></Card>
        <Card><p className="flex items-center gap-2 text-sm text-slate-400"><TimerReset size={17} className="text-red-300" /> Atrasadas</p><p className="mt-3 text-3xl font-semibold">{metrics.overdue}</p></Card>
        <Card><p className="flex items-center gap-2 text-sm text-slate-400"><CheckCircle2 size={17} className="text-emerald-300" /> Concluidas</p><p className="mt-3 text-3xl font-semibold">{metrics.completed}</p></Card>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar tarefa ou projeto" /></label>
        <Button onClick={() => { setSelectedTask(undefined); setOpened(true); }}><Plus size={17} /> Nova tarefa</Button>
      </div>

      {isLoading ? <Skeleton className="h-[560px]" /> : (
        <KanbanBoard
          columns={columns}
          tasks={tasks}
          onMove={(task, column) => void move(task, column)}
          onEdit={(task) => { setSelectedTask(task); setOpened(true); }}
          onDelete={setTaskToDelete}
        />
      )}

      <Dialog title={selectedTask ? "Editar tarefa" : "Nova tarefa"} open={opened} onClose={closeForm}>
        <TaskForm task={selectedTask} columns={columns} onCancel={closeForm} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      </Dialog>

      <ConfirmDialog
        open={Boolean(taskToDelete)}
        title="Excluir tarefa"
        description={`Deseja excluir a tarefa "${taskToDelete?.title ?? ""}"? Esta acao remove o card do Kanban.`}
        confirmLabel="Excluir tarefa"
        loading={remove.isPending}
        onClose={() => setTaskToDelete(undefined)}
        onConfirm={() => { if (taskToDelete) remove.mutate(taskToDelete.id); }}
      />
    </div>
  );
}
