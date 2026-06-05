import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import type { PageResult, Project, Task, TaskStatus } from "@/types";
import type { TaskColumn } from "./kanban-board";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { api } from "@/services/api";

const schema = z.object({ title: z.string().min(2), description: z.string(), priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]), dueDate: z.string(), columnId: z.string().min(1), projectId: z.string() });
type Fields = z.infer<typeof schema>;

function formValues(task: Task | undefined, firstColumnId: string): Fields {
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    priority: task?.priority ?? "MEDIUM",
    dueDate: task?.dueDate?.slice(0, 10) ?? "",
    columnId: task?.columnId ?? firstColumnId,
    projectId: task?.project?.id ?? ""
  };
}

export function TaskForm({ task, columns, onSave, onCancel }: { task?: Task; columns: TaskColumn[]; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const first = columns[0];
  const { data } = useQuery({ queryKey: ["projects", "task-selector"], queryFn: () => api.get<PageResult<Project>>("/projects?pageSize=100") });
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({ resolver: zodResolver(schema), values: formValues(task, first?.id ?? "") });
  const submit = (fields: Fields) => {
    const column = columns.find((item) => item.id === fields.columnId);
    const status: TaskStatus = column?.status ?? "NOT_STARTED";
    return onSave({ ...fields, projectId: fields.projectId || null, status, dueDate: fields.dueDate ? new Date(fields.dueDate).toISOString() : null, clientId: task?.client?.id ?? null, categoryId: null, position: task?.position ?? 0 });
  };
  return (
    <form className="space-y-4" onSubmit={handleSubmit(submit)}>
      <label>Titulo<Input {...register("title")} /></label>
      <label>Descricao<Textarea {...register("description")} /></label>
      <label>Projeto relacionado<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("projectId")}><option value="">Sem projeto</option>{data?.data.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}</select></label>
      <div className="grid gap-4 sm:grid-cols-3">
        <label>Prioridade<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("priority")}><option value="LOW">Baixa</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
        <label>Prazo<Input type="date" {...register("dueDate")} /></label>
        <label>Status<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("columnId")}>{columns.map((column) => <option value={column.id} key={column.id}>{column.title}</option>)}</select></label>
      </div>
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{task ? "Salvar tarefa" : "Criar tarefa"}</Button></div>
    </form>
  );
}
