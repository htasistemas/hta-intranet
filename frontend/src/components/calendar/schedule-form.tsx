import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import type { Schedule } from "@/types";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";

const schema = z.object({
  title: z.string().min(2),
  description: z.string(),
  location: z.string(),
  startAt: z.string().min(1),
  endAt: z.string().min(1),
  color: z.string(),
  recurrenceRule: z.string(),
  reminderAt: z.string()
});
type Fields = z.infer<typeof schema>;

function dateTime(value: string | Date): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

export function ScheduleForm({ schedule, selectedDate, onSave, onCancel }: { schedule?: Schedule; selectedDate?: Date; onSave: (data: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const start = selectedDate ?? new Date();
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<Fields>({
    resolver: zodResolver(schema),
    defaultValues: schedule ? {
      title: schedule.title, description: schedule.description ?? "", location: "", startAt: dateTime(schedule.startAt), endAt: dateTime(schedule.endAt), color: schedule.color ?? "#3B82F6", recurrenceRule: "", reminderAt: ""
    } : { title: "", description: "", location: "", startAt: dateTime(start), endAt: dateTime(new Date(start.getTime() + 3600000)), color: "#3B82F6", recurrenceRule: "", reminderAt: "" }
  });
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit((values) => onSave({ ...values, startAt: new Date(values.startAt).toISOString(), endAt: new Date(values.endAt).toISOString(), reminderAt: values.reminderAt ? new Date(values.reminderAt).toISOString() : null, allDay: false, status: "SCHEDULED", clientId: null, categoryId: null }))}>
      <label className="md:col-span-2">Titulo<Input {...register("title")} /></label>
      <label>Inicio<Input type="datetime-local" {...register("startAt")} /></label><label>Termino<Input type="datetime-local" {...register("endAt")} /></label>
      <label>Local<Input {...register("location")} /></label><label>Cor<Input type="color" {...register("color")} /></label>
      <label>Lembrete<Input type="datetime-local" {...register("reminderAt")} /></label><label>Repeticao<Input placeholder="RRULE:FREQ=WEEKLY" {...register("recurrenceRule")} /></label>
      <label className="md:col-span-2">Descricao<Textarea {...register("description")} /></label>
      <div className="flex justify-end gap-3 md:col-span-2"><Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>Salvar compromisso</Button></div>
    </form>
  );
}
