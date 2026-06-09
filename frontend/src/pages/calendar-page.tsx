import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import FullCalendar from "@fullcalendar/react";
import type { DateSelectArg, EventChangeArg } from "@fullcalendar/core";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import ptBrLocale from "@fullcalendar/core/locales/pt-br";
import { CalendarCheck, Link2Off, Plus, RefreshCw } from "lucide-react";
import { api } from "@/services/api";
import type { Schedule } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScheduleForm } from "@/components/calendar/schedule-form";
import { useToast } from "@/contexts/toast-context";

interface GoogleCalendarStatus {
  connected: boolean;
  connection: {
    googleEmail: string | null;
    calendarId: string;
    syncEnabled: boolean;
    connectedAt: string;
    updatedAt: string;
    expiresAt: string;
  } | null;
}

const googleCredentialsSchema = z.object({
  clientId: z.string().trim().min(10, "Informe o Client ID."),
  clientSecret: z.string().trim().min(6, "Informe o Client Secret."),
  redirectUri: z.string().url("Informe uma URL valida."),
  calendarId: z.string().trim().min(1, "Informe o ID da agenda.")
});

type GoogleCredentialsInput = z.infer<typeof googleCredentialsSchema>;

function GoogleCredentialsForm({ onSave, onCancel }: { onSave: (input: GoogleCredentialsInput) => Promise<void>; onCancel: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<GoogleCredentialsInput>({
    resolver: zodResolver(googleCredentialsSchema),
    defaultValues: {
      clientId: "",
      clientSecret: "",
      redirectUri: "http://localhost:3333/api/google-calendar/callback",
      calendarId: "primary"
    }
  });
  return (
    <form className="grid gap-4" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <label className="space-y-1 text-sm text-slate-300">
        <span>Google Client ID</span>
        <Input {...register("clientId")} />
        {errors.clientId && <span className="text-xs text-red-300">{errors.clientId.message}</span>}
      </label>
      <label className="space-y-1 text-sm text-slate-300">
        <span>Google Client Secret</span>
        <Input type="password" {...register("clientSecret")} />
        {errors.clientSecret && <span className="text-xs text-red-300">{errors.clientSecret.message}</span>}
      </label>
      <label className="space-y-1 text-sm text-slate-300">
        <span>Redirect URI</span>
        <Input {...register("redirectUri")} />
        {errors.redirectUri && <span className="text-xs text-red-300">{errors.redirectUri.message}</span>}
      </label>
      <label className="space-y-1 text-sm text-slate-300">
        <span>ID da agenda</span>
        <Input placeholder="primary ou agenda@group.calendar.google.com" {...register("calendarId")} />
        {errors.calendarId && <span className="text-xs text-red-300">{errors.calendarId.message}</span>}
      </label>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
        <Button disabled={isSubmitting}>{isSubmitting ? "Conectando..." : "Autorizar Google"}</Button>
      </div>
    </form>
  );
}

export default function CalendarPage() {
  const [opened, setOpened] = useState(false);
  const [googleDialogOpen, setGoogleDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedSchedule, setSelectedSchedule] = useState<Schedule>();
  const client = useQueryClient();
  const { toast } = useToast();
  const { data = [] } = useQuery({ queryKey: ["schedules"], queryFn: () => api.get<Schedule[]>("/schedules") });
  const google = useQuery({ queryKey: ["google-calendar-status"], queryFn: () => api.get<GoogleCalendarStatus>("/google-calendar/status") });
  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => selectedSchedule ? api.put<Schedule>(`/schedules/${selectedSchedule.id}`, input) : api.post<Schedule>("/schedules", input),
    onSuccess: () => { void client.invalidateQueries({ queryKey: ["schedules"] }); setOpened(false); toast("Compromisso salvo."); },
    onError: (error) => toast(error.message, "error")
  });
  const connectGoogle = useMutation({
    mutationFn: (input: GoogleCredentialsInput) => api.post<{ url: string }>("/google-calendar/auth-url", input),
    onSuccess: ({ url }) => { window.location.assign(url); },
    onError: (error) => toast(error.message, "error")
  });
  const disconnectGoogle = useMutation({
    mutationFn: () => api.delete("/google-calendar"),
    onSuccess: () => { void google.refetch(); toast("Google Agenda desconectado."); },
    onError: (error) => toast(error.message, "error")
  });
  const change = async ({ event, revert }: EventChangeArg): Promise<void> => {
    const schedule = data.find((item) => item.id === event.id);
    if (!schedule || !event.start || !event.end) return;
    try {
      await api.put(`/schedules/${schedule.id}`, { title: schedule.title, type: schedule.type ?? "FOLLOW_UP", description: schedule.description, location: null, clientId: schedule.client?.id ?? null, projectId: schedule.project?.id ?? null, categoryId: null, startAt: event.start.toISOString(), endAt: event.end.toISOString(), allDay: event.allDay, status: schedule.status ?? "SCHEDULED", color: schedule.color, recurrenceRule: null, reminderAt: null });
      void client.invalidateQueries({ queryKey: ["schedules"] });
      toast("Horario atualizado.");
    } catch (error) { revert(); toast(error instanceof Error ? error.message : "Falha ao mover.", "error"); }
  };
  const select = (selection: DateSelectArg): void => { setSelectedDate(selection.start); setSelectedSchedule(undefined); setOpened(true); };
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-700/50 bg-card p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium">Google Agenda</p>
          <p className="text-xs text-slate-400">
            {google.data?.connected ? `Conectado em ${google.data.connection?.googleEmail ?? "conta Google"}` : "Conecte para sincronizar automaticamente novos compromissos."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {google.data?.connected ? (
            <Button variant="outline" onClick={() => disconnectGoogle.mutate()} disabled={disconnectGoogle.isPending}><Link2Off size={17} /> Desconectar</Button>
          ) : (
            <Button variant="outline" onClick={() => setGoogleDialogOpen(true)} disabled={connectGoogle.isPending}><CalendarCheck size={17} /> Conectar Google</Button>
          )}
          <Button variant="ghost" onClick={() => void google.refetch()}><RefreshCw size={17} /> Atualizar status</Button>
          <Button onClick={() => { setSelectedDate(undefined); setSelectedSchedule(undefined); setOpened(true); }}><Plus size={17} /> Novo compromisso</Button>
        </div>
      </div>
      <Card className="p-4 md:p-6">
        <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]} locale={ptBrLocale} initialView="dayGridMonth" selectable editable nowIndicator height="auto" headerToolbar={{ left: "prev,next today", center: "title", right: "dayGridMonth,timeGridWeek,timeGridDay,listWeek" }} events={data.map((item) => ({ id: item.id, title: item.googleEventId ? `${item.title} - Google` : `${item.title}${item.type ? ` - ${item.type}` : ""}`, start: item.startAt, end: item.endAt, color: item.googleSyncStatus === "ERROR" ? "#EF4444" : item.color ?? "#3B82F6", allDay: item.allDay }))} select={select} eventChange={(argument) => void change(argument)} eventClick={({ event }) => { setSelectedSchedule(data.find((item) => item.id === event.id)); setOpened(true); }} />
      </Card>
      <Dialog open={opened} title={selectedSchedule ? "Editar compromisso" : "Novo compromisso"} onClose={() => setOpened(false)}>
        <ScheduleForm schedule={selectedSchedule} selectedDate={selectedDate} onSave={(input) => save.mutateAsync(input).then(() => undefined)} onCancel={() => setOpened(false)} />
      </Dialog>
      <Dialog open={googleDialogOpen} title="Conectar Google Agenda" onClose={() => setGoogleDialogOpen(false)}>
        <GoogleCredentialsForm onCancel={() => setGoogleDialogOpen(false)} onSave={(input) => connectGoogle.mutateAsync(input).then(() => undefined)} />
      </Dialog>
    </div>
  );
}
