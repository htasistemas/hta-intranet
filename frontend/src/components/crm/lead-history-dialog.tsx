import { useQuery } from "@tanstack/react-query";
import { History, Mail, MessageSquare, PencilLine, Phone } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/services/api";
import type { CommunicationMessage, CrmActivity, CrmLead } from "@/types/crm";

interface HistoryItem {
  id: string;
  date: string;
  title: string;
  description: string;
  kind: "message" | "contact" | "update";
}

function historyIcon(kind: HistoryItem["kind"]) {
  if (kind === "message") return <Mail size={16} />;
  if (kind === "contact") return <Phone size={16} />;
  return <PencilLine size={16} />;
}

export function LeadHistoryDialog({ lead, onClose }: { lead?: CrmLead; onClose: () => void }) {
  const activities = useQuery({ queryKey: ["crm-activities", "lead", lead?.id], queryFn: () => api.get<CrmActivity[]>(`/crm/activities?leadId=${encodeURIComponent(lead?.id ?? "")}`), enabled: Boolean(lead) });
  const messages = useQuery({ queryKey: ["communication-messages", "lead", lead?.id], queryFn: () => api.get<CommunicationMessage[]>(`/communication/messages?leadId=${encodeURIComponent(lead?.id ?? "")}`), enabled: Boolean(lead) });
  const contactTypes = new Set<CrmActivity["type"]>(["CALL", "EMAIL", "WHATSAPP", "MEETING", "VISIT", "FOLLOW_UP", "DEMONSTRATION"]);
  const items: HistoryItem[] = [
    ...(messages.data ?? []).map((message): HistoryItem => ({ id: `message-${message.id}`, date: message.sentAt ?? message.createdAt, title: message.channel === "EMAIL" ? "E-mail enviado" : "Mensagem enviada", description: message.subject ?? message.body.slice(0, 140), kind: "message" })),
    ...(activities.data ?? []).map((activity): HistoryItem => ({ id: `activity-${activity.id}`, date: activity.completedAt ?? activity.createdAt, title: activity.title, description: activity.description ?? `Responsável: ${activity.responsible}`, kind: contactTypes.has(activity.type) ? "contact" : "update" }))
  ].sort((left, right) => new Date(right.date).getTime() - new Date(left.date).getTime());

  return (
    <Dialog open={Boolean(lead)} title={`Histórico da captação${lead ? ` - ${lead.name}` : ""}`} onClose={onClose} className="max-w-3xl">
      {activities.isLoading || messages.isLoading ? <Skeleton className="h-64" /> : (
        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="flex gap-3 rounded-xl border border-slate-700 bg-sidebar p-4">
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/10 text-accent">{historyIcon(item.kind)}</span>
              <div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><h3 className="font-medium">{item.title}</h3><time className="text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.date))}</time></div><p className="mt-1 text-sm text-slate-400">{item.description}</p></div>
            </article>
          ))}
          {!items.length ? <div className="grid place-items-center gap-2 py-12 text-center text-slate-400"><History size={28} /><p>Nenhuma movimentação registrada para esta captação.</p></div> : null}
        </div>
      )}
    </Dialog>
  );
}
