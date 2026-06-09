import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import type { Client, PageResult, Project, Schedule } from "@/types";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const schema = z.object({
  title: z.string().min(2),
  type: z.enum(["CALL", "MEETING", "VISIT", "DEMONSTRATION", "FOLLOW_UP", "IMPLEMENTATION", "TRAINING", "SUPPORT", "BILLING"]),
  status: z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]),
  clientId: z.string(),
  projectId: z.string(),
  description: z.string(),
  location: z.string(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  color: z.string(),
  recurrenceRule: z.string(),
  reminderAt: z.string()
});
type Fields = z.infer<typeof schema>;

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

function dateTime(value: string | Date): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

function values(schedule: Schedule | undefined, selectedDate: Date | undefined): Fields {
  const start = selectedDate ?? new Date();
  if (!schedule) {
    return {
      title: "",
      type: "FOLLOW_UP",
      status: "SCHEDULED",
      clientId: "",
      projectId: "",
      description: "",
      location: "",
      startAt: dateTime(start),
      endAt: dateTime(new Date(start.getTime() + 3600000)),
      color: "#3B82F6",
      recurrenceRule: "",
      reminderAt: ""
    };
  }
  return {
    title: schedule.title,
    type: (schedule.type ?? "FOLLOW_UP") as Fields["type"],
    status: schedule.status,
    clientId: schedule.client?.id ?? "",
    projectId: schedule.project?.id ?? "",
    description: schedule.description ?? "",
    location: "",
    startAt: dateTime(schedule.startAt),
    endAt: dateTime(schedule.endAt),
    color: schedule.color ?? "#3B82F6",
    recurrenceRule: "",
    reminderAt: ""
  };
}

export function ScheduleForm({ schedule, selectedDate, onSave, onCancel }: { schedule?: Schedule; selectedDate?: Date; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const { data: clientsResult } = useQuery({ queryKey: ["clients", "schedule-selector"], queryFn: () => api.get<PageResult<Client>>("/clients?pageSize=200") });
  const { data: projectsResult } = useQuery({ queryKey: ["projects", "schedule-selector"], queryFn: () => api.get<PageResult<Project>>("/projects?pageSize=200") });
  const clients = clientsResult?.data ?? [];
  const projects = projectsResult?.data ?? [];
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema),
    values: values(schedule, selectedDate)
  });
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit((fields) => onSave({
      ...fields,
      startAt: new Date(fields.startAt).toISOString(),
      endAt: new Date(fields.endAt).toISOString(),
      reminderAt: fields.reminderAt ? new Date(fields.reminderAt).toISOString() : null,
      allDay: false,
      clientId: fields.clientId || null,
      projectId: fields.projectId || null,
      categoryId: null
    }))}>
      <label className="md:col-span-2">Titulo<Input {...register("title")} /></label>
      <label>Tipo<select className={selectClass} {...register("type")}><option value="CALL">Ligacao</option><option value="MEETING">Reuniao</option><option value="VISIT">Visita</option><option value="DEMONSTRATION">Demonstracao</option><option value="FOLLOW_UP">Follow-up</option><option value="IMPLEMENTATION">Implantacao</option><option value="TRAINING">Treinamento</option><option value="SUPPORT">Suporte</option><option value="BILLING">Cobranca</option></select></label>
      <label>Status<select className={selectClass} {...register("status")}><option value="SCHEDULED">Agendado</option><option value="COMPLETED">Concluido</option><option value="CANCELLED">Cancelado</option></select></label>
      <label>Cliente<select className={selectClass} {...register("clientId")}><option value="">Sem cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Projeto<select className={selectClass} {...register("projectId")}><option value="">Sem projeto</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}</select></label>
      <label>Inicio<Input type="datetime-local" {...register("startAt")} /></label><label>Termino<Input type="datetime-local" {...register("endAt")} /></label>
      <label>Local<Input {...register("location")} /></label><label>Cor<Input type="color" {...register("color")} /></label>
      <label>Lembrete<Input type="datetime-local" {...register("reminderAt")} /></label><label>Repeticao<Input placeholder="RRULE:FREQ=WEEKLY" {...register("recurrenceRule")} /></label>
      <label className="md:col-span-2">Descricao<Textarea {...register("description")} /></label>
      <div className="flex justify-end gap-3 md:col-span-2"><Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>Salvar compromisso</Button></div>
    </form>
  );
}
