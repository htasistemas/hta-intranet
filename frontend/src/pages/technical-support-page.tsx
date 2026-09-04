import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  Inbox,
  LifeBuoy,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Settings2,
  UserCheck
} from "lucide-react";
import { useForm } from "react-hook-form";
import { useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";
import { api, API_URL, storedSession } from "@/services/api";
import type {
  Client,
  KnowledgeBaseArticle,
  PageResult,
  Priority,
  ProductService,
  SupportTicket,
  SupportTicketDashboard,
  SupportTicketDashboardRow,
  SupportTicketSlaRule,
  SupportTicketStatus,
  SupportTicketType,
  UserAccount
} from "@/types";

interface FilePayload {
  name: string;
  mimeType: string;
  size: number;
  contentBase64: string;
}

interface TicketFilters {
  search: string;
  scope: "all" | "mine" | "unassigned";
  status: string;
  priority: string;
  clientId: string;
  productId: string;
  category: string;
}

const ticketSchema = z.object({
  clientId: z.string(),
  productId: z.string(),
  requesterName: z.string().trim().min(2, "Informe o solicitante."),
  requesterEmail: z.string().trim().email("Informe um e-mail valido."),
  requesterPhone: z.string(),
  unit: z.string(),
  systemModule: z.string().trim().min(2, "Informe o modulo."),
  category: z.string().trim().min(2, "Informe a categoria."),
  type: z.enum(["INCIDENT", "REQUEST", "IMPROVEMENT", "BUG", "QUESTION", "DEVELOPMENT"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  subject: z.string().trim().min(5, "Informe o assunto."),
  description: z.string().trim().min(10, "Descreva o problema."),
  currentActivity: z.string(),
  happened: z.string(),
  expectedResult: z.string(),
  actualResult: z.string(),
  reproductionSteps: z.string()
});

const replySchema = z.object({
  body: z.string().trim().min(2, "Digite a mensagem."),
  internal: z.boolean()
});

const resolutionSchema = z.object({
  note: z.string().trim().min(5, "Informe a solucao ou justificativa.")
});

const articleSchema = z.object({
  title: z.string().trim().min(3, "Informe o titulo."),
  category: z.string().trim().min(2, "Informe a categoria."),
  systemModule: z.string(),
  productName: z.string(),
  content: z.string().trim().min(10, "Informe o conteudo."),
  published: z.boolean()
});

const slaSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  priority: z.enum(["", "LOW", "MEDIUM", "HIGH", "URGENT"]),
  category: z.string(),
  productId: z.string(),
  type: z.enum(["", "INCIDENT", "REQUEST", "IMPROVEMENT", "BUG", "QUESTION", "DEVELOPMENT"]),
  responseMinutes: z.coerce.number().int().min(5),
  resolutionMinutes: z.coerce.number().int().min(15),
  active: z.boolean()
});

type TicketFields = z.infer<typeof ticketSchema>;
type ReplyFields = z.infer<typeof replySchema>;
type ResolutionFields = z.infer<typeof resolutionSchema>;
type ArticleFields = z.infer<typeof articleSchema>;
type SlaFields = z.infer<typeof slaSchema>;

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

const statusLabels: Record<SupportTicketStatus, string> = {
  NEW: "Novo",
  TRIAGE: "Em Triagem",
  IN_PROGRESS: "Em Atendimento",
  WAITING_USER: "Aguardando Usuario",
  DEVELOPMENT: "Em Desenvolvimento",
  TESTING: "Em Testes",
  RESOLVED: "Resolvido",
  CLOSED: "Encerrado",
  REOPENED: "Reaberto",
  CANCELLED: "Cancelado"
};

const priorityLabels: Record<Priority, string> = {
  LOW: "Baixa",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Critica"
};

const typeLabels: Record<SupportTicketType, string> = {
  INCIDENT: "Incidente",
  REQUEST: "Solicitacao",
  IMPROVEMENT: "Melhoria",
  BUG: "Erro",
  QUESTION: "Duvida",
  DEVELOPMENT: "Desenvolvimento"
};

const statusClass: Record<SupportTicketStatus, string> = {
  NEW: "bg-sky-500/15 text-sky-200",
  TRIAGE: "bg-blue-500/15 text-blue-200",
  IN_PROGRESS: "bg-emerald-500/15 text-emerald-200",
  WAITING_USER: "bg-amber-500/15 text-amber-200",
  DEVELOPMENT: "bg-purple-500/15 text-purple-200",
  TESTING: "bg-cyan-500/15 text-cyan-200",
  RESOLVED: "bg-lime-500/15 text-lime-200",
  CLOSED: "bg-slate-500/20 text-slate-200",
  REOPENED: "bg-orange-500/15 text-orange-200",
  CANCELLED: "bg-red-500/15 text-red-200"
};

const priorityClass: Record<Priority, string> = {
  LOW: "border-slate-500/40 text-slate-200",
  MEDIUM: "border-blue-400/40 text-blue-200",
  HIGH: "border-amber-400/40 text-amber-200",
  URGENT: "border-red-400/50 text-red-200"
};

const tabRoutes = [
  { path: "/atendimento", label: "Dashboard", icon: BarChart3 },
  { path: "/atendimento/abrir", label: "Abrir Chamado", icon: Plus },
  { path: "/atendimento/meus", label: "Meus Chamados", icon: FileText },
  { path: "/atendimento/central", label: "Central de Chamados", icon: LifeBuoy },
  { path: "/atendimento/fila", label: "Fila de Atendimento", icon: Inbox },
  { path: "/atendimento/base", label: "Base de Conhecimento", icon: BookOpen },
  { path: "/atendimento/relatorios", label: "Relatorios", icon: BarChart3 },
  { path: "/atendimento/configuracoes", label: "Configuracoes", icon: Settings2 }
];

function minutesLabel(minutes: number): string {
  if (minutes <= 0) return "0min";
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

function dateLabel(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function slaLabel(ticket: SupportTicket): { text: string; className: string } {
  if (!ticket.dueAt || ticket.status === "CLOSED" || ticket.status === "CANCELLED") return { text: "Sem SLA ativo", className: "text-slate-400" };
  const diff = new Date(ticket.dueAt).getTime() - Date.now();
  if (diff <= 0) return { text: "SLA estourado", className: "text-red-300" };
  const minutes = Math.round(diff / 60000);
  return { text: `Restam ${minutesLabel(minutes)}`, className: minutes <= 60 ? "text-amber-200" : "text-emerald-200" };
}

async function fileToPayload(file: File): Promise<FilePayload> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Nao foi possivel ler o arquivo."));
    reader.readAsDataURL(file);
  });
  return {
    name: file.name,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    contentBase64: dataUrl.split(",")[1] ?? ""
  };
}

function authHeaders(): HeadersInit {
  const session = storedSession();
  return session ? { Authorization: `Bearer ${session.accessToken}` } : {};
}

function ticketQuery(filters: TicketFilters, forcedScope?: TicketFilters["scope"]): string {
  const params = new URLSearchParams({ pageSize: "50", scope: forcedScope ?? filters.scope });
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.priority) params.set("priority", filters.priority);
  if (filters.clientId) params.set("clientId", filters.clientId);
  if (filters.productId) params.set("productId", filters.productId);
  if (filters.category) params.set("category", filters.category);
  return params.toString();
}

function StatusBadge({ status }: { status: SupportTicketStatus }) {
  return <span className={cn("rounded-full px-3 py-1 text-xs", statusClass[status])}>{statusLabels[status]}</span>;
}

function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={cn("rounded-full border px-3 py-1 text-xs", priorityClass[priority])}>{priorityLabels[priority]}</span>;
}

function TicketForm({ clients, products, onSave }: { clients: Client[]; products: ProductService[]; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const { session } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<TicketFields>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      clientId: "",
      productId: "",
      requesterName: session?.user.name ?? "",
      requesterEmail: session?.user.email ?? "",
      requesterPhone: "",
      unit: "",
      systemModule: "",
      category: "Suporte",
      type: "INCIDENT",
      priority: "MEDIUM",
      impact: "MEDIUM",
      urgency: "MEDIUM",
      subject: "",
      description: "",
      currentActivity: "",
      happened: "",
      expectedResult: "",
      actualResult: "",
      reproductionSteps: ""
    }
  });

  const submit = async (values: TicketFields): Promise<void> => {
    const attachments = await Promise.all(files.map(fileToPayload));
    await onSave({
      ...values,
      clientId: values.clientId || null,
      productId: values.productId || null,
      requesterPhone: values.requesterPhone || null,
      unit: values.unit || null,
      attachments
    });
    reset();
    setFiles([]);
  };

  return (
    <Card>
      <CardTitle>Abertura do chamado</CardTitle>
      <form className="grid gap-5" onSubmit={(event) => void handleSubmit(submit)(event)}>
        <section className="grid gap-4 md:grid-cols-4">
          <label>Cliente<select className={selectClass} {...register("clientId")}><option value="">Nao vinculado</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
          <label>Sistema<select className={selectClass} {...register("productId")}><option value="">Nao vinculado</option>{products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}</select></label>
          <label>Usuario solicitante<Input {...register("requesterName")} />{errors.requesterName ? <small className="text-red-400">{errors.requesterName.message}</small> : null}</label>
          <label>E-mail<Input type="email" {...register("requesterEmail")} />{errors.requesterEmail ? <small className="text-red-400">{errors.requesterEmail.message}</small> : null}</label>
          <label>Telefone<Input {...register("requesterPhone")} /></label>
          <label>Unidade<Input {...register("unit")} /></label>
          <label>Modulo<Input placeholder="Financeiro, vendas, relatorios..." {...register("systemModule")} />{errors.systemModule ? <small className="text-red-400">{errors.systemModule.message}</small> : null}</label>
          <label>Categoria<Input placeholder="Erro, acesso, lentidao..." {...register("category")} />{errors.category ? <small className="text-red-400">{errors.category.message}</small> : null}</label>
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-700 bg-sidebar p-4 md:grid-cols-5">
          <label>Tipo<select className={selectClass} {...register("type")}><option value="INCIDENT">Incidente</option><option value="BUG">Erro</option><option value="REQUEST">Solicitacao</option><option value="IMPROVEMENT">Melhoria</option><option value="QUESTION">Duvida</option><option value="DEVELOPMENT">Desenvolvimento</option></select></label>
          <label>Prioridade<select className={selectClass} {...register("priority")}><option value="LOW">Baixa</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Critica</option></select></label>
          <label>Impacto<select className={selectClass} {...register("impact")}><option value="LOW">Baixo</option><option value="MEDIUM">Medio</option><option value="HIGH">Alto</option><option value="CRITICAL">Critico</option></select></label>
          <label>Urgencia<select className={selectClass} {...register("urgency")}><option value="LOW">Baixa</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="CRITICAL">Critica</option></select></label>
          <label>Arquivos<Input type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} /></label>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <label className="md:col-span-2">Assunto<Input {...register("subject")} />{errors.subject ? <small className="text-red-400">{errors.subject.message}</small> : null}</label>
          <label className="md:col-span-2">Descricao detalhada<Textarea className="min-h-32" {...register("description")} />{errors.description ? <small className="text-red-400">{errors.description.message}</small> : null}</label>
          <label>O que estava sendo feito?<Textarea {...register("currentActivity")} /></label>
          <label>O que aconteceu?<Textarea {...register("happened")} /></label>
          <label>Resultado esperado<Textarea {...register("expectedResult")} /></label>
          <label>Resultado apresentado<Textarea {...register("actualResult")} /></label>
          <label className="md:col-span-2">Passos para reproduzir<Textarea {...register("reproductionSteps")} /></label>
        </section>

        {files.length ? (
          <div className="grid gap-2 md:grid-cols-3">
            {files.map((file) => <span key={`${file.name}-${file.size}`} className="rounded-xl border border-slate-700 bg-sidebar px-3 py-2 text-sm text-slate-300">{file.name}</span>)}
          </div>
        ) : null}

        <div className="flex justify-end"><Button disabled={isSubmitting}><Plus size={17} /> {isSubmitting ? "Abrindo..." : "Abrir chamado"}</Button></div>
      </form>
    </Card>
  );
}

function DashboardView({ dashboard, loading }: { dashboard?: SupportTicketDashboard; loading: boolean }) {
  const cards = dashboard?.cards;
  const items = [
    ["Total de Chamados", cards?.total ?? 0],
    ["Novos", cards?.newTickets ?? 0],
    ["Em Atendimento", cards?.inProgress ?? 0],
    ["Aguardando Usuario", cards?.waitingUser ?? 0],
    ["Em Desenvolvimento", cards?.development ?? 0],
    ["Em Testes", cards?.testing ?? 0],
    ["Resolvidos", cards?.resolved ?? 0],
    ["Encerrados", cards?.closed ?? 0],
    ["Reabertos", cards?.reopened ?? 0],
    ["SLA em Risco", cards?.slaRisk ?? 0],
    ["SLA Estourado", cards?.slaExpired ?? 0]
  ] satisfies Array<[string, number]>;
  if (loading) return <Skeleton className="h-96" />;
  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4 xl:grid-cols-6">
        {items.map(([label, value]) => <Card key={label}><p className="text-sm text-slate-400">{label}</p><strong className="mt-3 block text-3xl">{value}</strong></Card>)}
      </section>
      <section className="grid gap-5 xl:grid-cols-2">
        <DashboardTable title="Visao por cliente" rows={dashboard?.byClient ?? []} />
        <DashboardTable title="Visao por sistema" rows={dashboard?.bySystem ?? []} />
        <DashboardTable title="Visao por modulo" rows={dashboard?.byModule ?? []} />
        <DashboardTable title="Visao por usuario" rows={dashboard?.byRequester ?? []} />
      </section>
      <Card>
        <CardTitle>Indicadores</CardTitle>
        <div className="grid gap-3 md:grid-cols-4">
          <Metric label="Primeiro atendimento" value={minutesLabel(dashboard?.indicators.averageFirstResponseMinutes ?? 0)} />
          <Metric label="Resolucao media" value={minutesLabel(dashboard?.indicators.averageResolutionMinutes ?? 0)} />
          <Metric label="Encerramento medio" value={minutesLabel(dashboard?.indicators.averageClosingMinutes ?? 0)} />
          <Metric label="SLA cumprido" value={`${dashboard?.indicators.slaMetPercent ?? 100}%`} />
        </div>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-700 bg-sidebar p-4"><p className="text-xs text-slate-500">{label}</p><strong className="mt-2 block text-xl">{value}</strong></div>;
}

function DashboardTable({ title, rows }: { title: string; rows: SupportTicketDashboardRow[] }) {
  return (
    <Card className="overflow-x-auto p-0">
      <div className="border-b border-slate-700 p-5"><h2 className="font-semibold">{title}</h2></div>
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="text-xs uppercase text-slate-400"><tr><th className="p-4">Nome</th><th>Chamados</th><th>Novos</th><th>Atendimento</th><th>Resolvidos</th><th>Reabertos</th></tr></thead>
        <tbody>{rows.slice(0, 8).map((row) => (
          <tr key={row.label} className="border-t border-slate-700/60">
            <td className="p-4 font-medium">{row.label}</td><td>{row.total}</td><td>{row.newTickets}</td><td>{row.inProgress}</td><td>{row.resolved}</td><td>{row.reopened}</td>
          </tr>
        ))}</tbody>
      </table>
    </Card>
  );
}

function TicketList({ tickets, loading, onOpen, emptyLabel }: { tickets: SupportTicket[]; loading: boolean; onOpen: (ticket: SupportTicket) => void; emptyLabel: string }) {
  if (loading) return <Skeleton className="h-96" />;
  if (!tickets.length) return <Card className="grid min-h-56 place-items-center text-center text-slate-400">{emptyLabel}</Card>;
  return (
    <div className="grid gap-3">
      {tickets.map((ticket) => {
        const sla = slaLabel(ticket);
        return (
          <Card key={ticket.id} className="cursor-pointer" onClick={() => onOpen(ticket)}>
            <div className="grid gap-4 xl:grid-cols-[180px_1fr_220px] xl:items-center">
              <div><p className="font-semibold text-accent">{ticket.protocol}</p><p className="mt-1 text-xs text-slate-400">{dateLabel(ticket.createdAt)}</p></div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><PriorityBadge priority={ticket.priority} /><StatusBadge status={ticket.status} /><span className={cn("text-xs", sla.className)}>{sla.text}</span></div>
                <h2 className="mt-2 truncate font-semibold">{ticket.subject}</h2>
                <p className="mt-1 text-sm text-slate-400">{ticket.client?.name ?? "Cliente nao informado"} - {ticket.product?.name ?? "Sistema nao informado"} - {ticket.systemModule}</p>
              </div>
              <div className="text-sm text-slate-300">
                <p><UserCheck className="mr-2 inline" size={15} />{ticket.analyst?.name ?? "Sem responsavel"}</p>
                <p className="mt-1"><MessageSquare className="mr-2 inline" size={15} />{ticket.messages.at(-1)?.body.slice(0, 80) ?? "Sem interacao"}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function TicketDetail({ ticket, analysts, onClose, onReply, onAssign, onStatus }: {
  ticket: SupportTicket;
  analysts: UserAccount[];
  onClose: () => void;
  onReply: (input: Record<string, unknown>) => Promise<void>;
  onAssign: (analystId?: string | null) => Promise<void>;
  onStatus: (status: SupportTicketStatus, note?: string) => Promise<void>;
}) {
  const { session } = useAuth();
  const [files, setFiles] = useState<File[]>([]);
  const [statusAction, setStatusAction] = useState<SupportTicketStatus | null>(null);
  const [confirmClose, setConfirmClose] = useState<SupportTicketStatus | null>(null);
  const isTeam = session?.user.role === "ADMIN" || session?.user.role === "MANAGER";
  const canValidate = ticket.status === "RESOLVED" && ticket.requesterId === session?.user.id;
  const replyForm = useForm<ReplyFields>({ resolver: zodResolver(replySchema), defaultValues: { body: "", internal: false } });
  const resolutionForm = useForm<ResolutionFields>({ resolver: zodResolver(resolutionSchema), defaultValues: { note: "" } });

  const reply = async (values: ReplyFields): Promise<void> => {
    const attachments = await Promise.all(files.map(fileToPayload));
    await onReply({ ...values, attachments });
    replyForm.reset();
    setFiles([]);
  };

  const submitStatus = async (values: ResolutionFields): Promise<void> => {
    if (!statusAction) return;
    await onStatus(statusAction, values.note);
    setStatusAction(null);
    resolutionForm.reset();
  };

  return (
    <Dialog open title={`${ticket.protocol} - ${ticket.subject}`} onClose={onClose} className="max-w-[96vw] xl:max-w-7xl">
      <div className="space-y-5">
        <div className="flex flex-wrap items-center gap-2"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /><span className={cn("text-sm", slaLabel(ticket).className)}>{slaLabel(ticket).text}</span></div>
        {canValidate ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 p-4">
            <p className="font-semibold text-emerald-100">Seu chamado foi marcado como resolvido.</p>
            <div className="mt-3 flex flex-wrap gap-2"><Button onClick={() => setConfirmClose("CLOSED")}><CheckCircle2 size={17} /> Problema Resolvido</Button><Button variant="outline" onClick={() => setConfirmClose("REOPENED")}><AlertTriangle size={17} /> Problema Nao Resolvido</Button></div>
          </div>
        ) : null}
        <section className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Metric label="Cliente" value={ticket.client?.name ?? "-"} />
          <Metric label="Sistema" value={ticket.product?.name ?? "-"} />
          <Metric label="Usuario" value={ticket.requesterName} />
          <Metric label="Modulo" value={ticket.systemModule} />
          <Metric label="Analista" value={ticket.analyst?.name ?? "-"} />
          <Metric label="Abertura" value={dateLabel(ticket.createdAt)} />
        </section>
        {isTeam ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => onAssign(null)}><UserCheck size={17} /> Assumir chamado</Button>
            <select className={cn(selectClass, "w-auto min-w-60")} value={ticket.analystId ?? ""} onChange={(event) => void onAssign(event.target.value || null)}>
              <option value="">Sem responsavel</option>{analysts.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <Button variant="outline" onClick={() => setStatusAction("WAITING_USER")}>Solicitar informacoes</Button>
            <Button variant="outline" onClick={() => setStatusAction("DEVELOPMENT")}>Em desenvolvimento</Button>
            <Button variant="outline" onClick={() => setStatusAction("TESTING")}>Enviar para testes</Button>
            <Button onClick={() => setStatusAction("RESOLVED")}>Marcar como resolvido</Button>
            <Button variant="danger" onClick={() => setStatusAction("CANCELLED")}>Cancelar</Button>
          </div>
        ) : null}
        <section className="grid gap-5 xl:grid-cols-[1fr_360px]">
          <Card className="space-y-4">
            <CardTitle>Conversa</CardTitle>
            <div className="max-h-[520px] space-y-3 overflow-y-auto pr-2">
              {ticket.messages.map((message) => (
                <article key={message.id} className={cn("rounded-xl border p-4", message.internal ? "border-amber-400/25 bg-amber-500/10" : message.authorId === ticket.requesterId ? "border-slate-700 bg-sidebar" : "border-emerald-400/20 bg-emerald-500/10")}>
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-slate-400"><span>{message.internal ? "NOTA INTERNA - " : ""}{message.author.name} - {message.author.role}</span><span>{dateLabel(message.createdAt)}</span></div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{message.body}</p>
                  {message.attachments.length ? <AttachmentList attachments={message.attachments} /> : null}
                </article>
              ))}
            </div>
            <form className="space-y-3 border-t border-slate-700 pt-4" onSubmit={(event) => void replyForm.handleSubmit(reply)(event)}>
              <Textarea placeholder="Responder chamado" {...replyForm.register("body")} />
              {replyForm.formState.errors.body ? <small className="text-red-400">{replyForm.formState.errors.body.message}</small> : null}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" className="h-4 w-4 accent-amber-500" disabled={!isTeam} {...replyForm.register("internal")} /> Nota interna</label>
                <Input className="max-w-sm" type="file" multiple onChange={(event) => setFiles(Array.from(event.target.files ?? []))} />
                <Button disabled={replyForm.formState.isSubmitting}>Responder</Button>
              </div>
            </form>
          </Card>
          <aside className="space-y-4">
            <Card><CardTitle>Dados do Chamado</CardTitle><TicketFacts ticket={ticket} /></Card>
            <Card><CardTitle>Anexos</CardTitle><AttachmentList attachments={ticket.attachments} /></Card>
            <Card><CardTitle>Historico</CardTitle><HistoryList ticket={ticket} /></Card>
          </aside>
        </section>
      </div>
      <Dialog open={Boolean(statusAction)} title="Registrar andamento" onClose={() => setStatusAction(null)}>
        <form className="space-y-4" onSubmit={(event) => void resolutionForm.handleSubmit(submitStatus)(event)}>
          <Textarea placeholder="Descricao da solucao, justificativa ou solicitacao" {...resolutionForm.register("note")} />
          {resolutionForm.formState.errors.note ? <small className="text-red-400">{resolutionForm.formState.errors.note.message}</small> : null}
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setStatusAction(null)}>Cancelar</Button><Button>Salvar</Button></div>
        </form>
      </Dialog>
      <ConfirmDialog open={Boolean(confirmClose)} title="Validar solucao" description={confirmClose === "CLOSED" ? "Confirmar que o problema foi resolvido e encerrar o chamado?" : "Informar que o problema continua e reabrir o chamado?"} confirmLabel="Confirmar" onClose={() => setConfirmClose(null)} onConfirm={() => { if (confirmClose) void onStatus(confirmClose, confirmClose === "CLOSED" ? "Problema resolvido pelo usuario." : "Problema nao resolvido pelo usuario."); setConfirmClose(null); }} />
    </Dialog>
  );
}

function TicketFacts({ ticket }: { ticket: SupportTicket }) {
  const rows = [
    ["Tipo", typeLabels[ticket.type]],
    ["Categoria", ticket.category],
    ["Impacto", ticket.impact],
    ["Urgencia", ticket.urgency],
    ["O que estava sendo feito?", ticket.currentActivity ?? "-"],
    ["O que aconteceu?", ticket.happened ?? "-"],
    ["Resultado esperado", ticket.expectedResult ?? "-"],
    ["Resultado apresentado", ticket.actualResult ?? "-"],
    ["Passos para reproduzir", ticket.reproductionSteps ?? "-"],
    ["Solucao aplicada", ticket.solution ?? "-"]
  ];
  return <div className="space-y-3 text-sm">{rows.map(([label, value]) => <p key={label}><span className="block text-xs text-slate-500">{label}</span><span className="text-slate-200">{value}</span></p>)}</div>;
}

function AttachmentList({ attachments }: { attachments: Array<{ id: string; name: string; size: number; mimeType: string }> }) {
  if (!attachments.length) return <p className="text-sm text-slate-400">Nenhum anexo.</p>;
  return (
    <div className="mt-3 space-y-2">
      {attachments.map((attachment) => (
        <a key={attachment.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-sidebar p-3 text-sm hover:border-accent" href={`${API_URL}/support-tickets/attachments/${attachment.id}`} target="_blank" rel="noreferrer" onClick={(event) => {
          event.preventDefault();
          void fetch(`${API_URL}/support-tickets/attachments/${attachment.id}`, { headers: authHeaders() }).then(async (response) => {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = attachment.name;
            anchor.click();
            URL.revokeObjectURL(url);
          });
        }}>
          <span className="truncate">{attachment.name}</span><span className="flex items-center gap-2 text-xs text-slate-400"><Download size={14} />{Math.round(attachment.size / 1024)}KB</span>
        </a>
      ))}
    </div>
  );
}

function HistoryList({ ticket }: { ticket: SupportTicket }) {
  return (
    <div className="max-h-80 space-y-2 overflow-y-auto">
      {ticket.history.map((item) => (
        <article key={item.id} className="rounded-xl border border-slate-700 bg-sidebar p-3 text-xs">
          <p className="font-medium text-slate-200">{item.action}</p>
          <p className="mt-1 text-slate-400">{item.user.name} - {dateLabel(item.createdAt)}</p>
          {item.fromValue || item.toValue ? <p className="mt-1 text-slate-300">{item.fromValue ?? "-"} &gt; {item.toValue ?? "-"}</p> : null}
        </article>
      ))}
    </div>
  );
}

function FiltersBar({ filters, setFilters, clients, products }: { filters: TicketFilters; setFilters: (filters: TicketFilters) => void; clients: Client[]; products: ProductService[] }) {
  return (
    <Card>
      <div className="grid gap-3 lg:grid-cols-[1fr_repeat(6,160px)]">
        <label className="relative"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" placeholder="Protocolo, cliente, usuario ou assunto" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></label>
        <select className={selectClass} value={filters.scope} onChange={(event) => setFilters({ ...filters, scope: event.target.value as TicketFilters["scope"] })}><option value="all">Todos</option><option value="mine">Meus</option><option value="unassigned">Nao atribuidos</option></select>
        <select className={selectClass} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">Status</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={selectClass} value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">Prioridade</option>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        <select className={selectClass} value={filters.clientId} onChange={(event) => setFilters({ ...filters, clientId: event.target.value })}><option value="">Cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
        <select className={selectClass} value={filters.productId} onChange={(event) => setFilters({ ...filters, productId: event.target.value })}><option value="">Sistema</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
        <Button variant="outline" onClick={() => setFilters(defaultFilters)}><Filter size={17} /> Limpar</Button>
      </div>
    </Card>
  );
}

function KnowledgeBase({ articles, isTeam, onCreate }: { articles: KnowledgeBaseArticle[]; isTeam: boolean; onCreate: (input: Record<string, unknown>) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const form = useForm<ArticleFields>({ resolver: zodResolver(articleSchema), defaultValues: { title: "", category: "Suporte", systemModule: "", productName: "", content: "", published: true } });
  return (
    <div className="space-y-4">
      {isTeam ? <div className="flex justify-end"><Button onClick={() => setOpen(true)}><Plus size={17} /> Novo artigo</Button></div> : null}
      <section className="grid gap-4 xl:grid-cols-3">{articles.map((article) => <Card key={article.id}><p className="text-xs text-accent">{article.category}</p><h2 className="mt-2 font-semibold">{article.title}</h2><p className="mt-3 line-clamp-5 text-sm leading-6 text-slate-300">{article.content}</p></Card>)}</section>
      {!articles.length ? <Card className="text-center text-sm text-slate-400">Nenhum artigo publicado.</Card> : null}
      <Dialog open={open} title="Novo artigo" onClose={() => setOpen(false)}>
        <form className="grid gap-4" onSubmit={(event) => void form.handleSubmit((values) => onCreate(values).then(() => { setOpen(false); form.reset(); }))(event)}>
          <label>Titulo<Input {...form.register("title")} /></label>
          <label>Categoria<Input {...form.register("category")} /></label>
          <label>Modulo<Input {...form.register("systemModule")} /></label>
          <label>Sistema<Input {...form.register("productName")} /></label>
          <label>Conteudo<Textarea className="min-h-40" {...form.register("content")} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("published")} /> Publicado</label>
          <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button><Button>Salvar</Button></div>
        </form>
      </Dialog>
    </div>
  );
}

function SettingsView({ rules, products, onCreateSla, onDeleteSla }: { rules: SupportTicketSlaRule[]; products: ProductService[]; onCreateSla: (input: Record<string, unknown>) => Promise<void>; onDeleteSla: (id: string) => void }) {
  const form = useForm<SlaFields>({ resolver: zodResolver(slaSchema), defaultValues: { name: "", priority: "MEDIUM", category: "", productId: "", type: "", responseMinutes: 30, resolutionMinutes: 480, active: true } });
  return (
    <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
      <Card>
        <CardTitle>Nova regra de SLA</CardTitle>
        <form className="grid gap-3" onSubmit={(event) => void form.handleSubmit((values) => onCreateSla({ ...values, priority: values.priority || null, type: values.type || null, productId: values.productId || null, category: values.category || null }).then(() => form.reset()))(event)}>
          <label>Nome<Input {...form.register("name")} /></label>
          <label>Prioridade<select className={selectClass} {...form.register("priority")}><option value="">Todas</option><option value="URGENT">Critica</option><option value="HIGH">Alta</option><option value="MEDIUM">Media</option><option value="LOW">Baixa</option></select></label>
          <label>Categoria<Input {...form.register("category")} /></label>
          <label>Sistema<select className={selectClass} {...form.register("productId")}><option value="">Todos</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select></label>
          <label>Tipo<select className={selectClass} {...form.register("type")}><option value="">Todos</option>{Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Atendimento em minutos<Input type="number" {...form.register("responseMinutes")} /></label>
          <label>Resolucao em minutos<Input type="number" {...form.register("resolutionMinutes")} /></label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" {...form.register("active")} /> Ativa</label>
          <Button>Salvar SLA</Button>
        </form>
      </Card>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] text-left text-sm"><thead className="text-xs uppercase text-slate-400"><tr><th className="p-4">Regra</th><th>Prioridade</th><th>Categoria</th><th>Resposta</th><th>Resolucao</th><th /></tr></thead><tbody>{rules.map((rule) => <tr key={rule.id} className="border-t border-slate-700"><td className="p-4">{rule.name}</td><td>{rule.priority ? priorityLabels[rule.priority] : "Todas"}</td><td>{rule.category ?? "Todas"}</td><td>{minutesLabel(rule.responseMinutes)}</td><td>{minutesLabel(rule.resolutionMinutes)}</td><td><Button variant="danger" size="sm" onClick={() => onDeleteSla(rule.id)}>Excluir</Button></td></tr>)}</tbody></table>
      </Card>
    </section>
  );
}

const defaultFilters: TicketFilters = { search: "", scope: "all", status: "", priority: "", clientId: "", productId: "", category: "" };

export default function TechnicalSupportPage() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [filters, setFilters] = useState<TicketFilters>(defaultFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isTeam = session?.user.role === "ADMIN" || session?.user.role === "MANAGER";
  const activePath = tabRoutes.some((tab) => tab.path === location.pathname) ? location.pathname : "/atendimento";

  useEffect(() => {
    if (activePath === "/atendimento/central" || activePath === "/atendimento/fila") return;
    setFilters((current) => ({ ...current, scope: activePath === "/atendimento/meus" ? "mine" : current.scope }));
  }, [activePath]);

  const clientsQuery = useQuery({ queryKey: ["clients", "support"], queryFn: () => api.get<PageResult<Client>>("/clients?pageSize=200") });
  const productsQuery = useQuery({ queryKey: ["products", "support"], queryFn: () => api.get<PageResult<ProductService>>("/products?pageSize=200") });
  const ticketsQuery = useQuery({ queryKey: ["support-tickets", filters, activePath], queryFn: () => api.get<PageResult<SupportTicket>>(`/support-tickets?${ticketQuery(filters, activePath === "/atendimento/meus" ? "mine" : activePath === "/atendimento/fila" ? "unassigned" : undefined)}`), refetchInterval: 15000 });
  const dashboardQuery = useQuery({ queryKey: ["support-tickets", "dashboard", filters], queryFn: () => api.get<SupportTicketDashboard>(`/support-tickets/dashboard?${ticketQuery(filters)}`), refetchInterval: 30000 });
  const articlesQuery = useQuery({ queryKey: ["support-tickets", "articles"], queryFn: () => api.get<KnowledgeBaseArticle[]>("/support-tickets/articles") });
  const slaRulesQuery = useQuery({ queryKey: ["support-tickets", "sla-rules"], queryFn: () => api.get<SupportTicketSlaRule[]>("/support-tickets/sla-rules"), enabled: isTeam });
  const analystsQuery = useQuery({ queryKey: ["support-tickets", "analysts"], queryFn: () => api.get<UserAccount[]>("/support-tickets/analysts"), enabled: isTeam });
  const selectedTicketQuery = useQuery({ queryKey: ["support-tickets", selectedId], queryFn: () => api.get<SupportTicket>(`/support-tickets/${selectedId}`), enabled: Boolean(selectedId), refetchInterval: 10000 });
  const clients = clientsQuery.data?.data ?? [];
  const products = productsQuery.data?.data ?? [];
  const tickets = ticketsQuery.data?.data ?? [];
  const selectedTicket = selectedTicketQuery.data;

  const invalidateTickets = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["support-tickets"] });
  };

  const createTicket = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<SupportTicket>("/support-tickets", input),
    onSuccess: (ticket) => { invalidateTickets(); toast(`Chamado ${ticket.protocol} aberto.`); setSelectedId(ticket.id); navigate("/atendimento/meus"); },
    onError: (error) => toast(error.message, "error")
  });

  const replyTicket = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<SupportTicket>(`/support-tickets/${selectedId}/messages`, input),
    onSuccess: () => { invalidateTickets(); toast("Resposta registrada."); },
    onError: (error) => toast(error.message, "error")
  });

  const assignTicket = useMutation({
    mutationFn: (analystId?: string | null) => api.post<SupportTicket>(`/support-tickets/${selectedId}/assign`, { analystId }),
    onSuccess: () => { invalidateTickets(); toast("Responsavel atualizado."); },
    onError: (error) => toast(error.message, "error")
  });

  const statusTicket = useMutation({
    mutationFn: ({ status, note }: { status: SupportTicketStatus; note?: string }) => api.post<SupportTicket>(`/support-tickets/${selectedId}/status`, { status, note }),
    onSuccess: () => { invalidateTickets(); toast("Status atualizado."); },
    onError: (error) => toast(error.message, "error")
  });

  const createArticle = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<KnowledgeBaseArticle>("/support-tickets/articles", input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["support-tickets", "articles"] }); toast("Artigo publicado."); },
    onError: (error) => toast(error.message, "error")
  });

  const createSla = useMutation({
    mutationFn: (input: Record<string, unknown>) => api.post<SupportTicketSlaRule>("/support-tickets/sla-rules", input),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["support-tickets", "sla-rules"] }); toast("SLA salvo."); },
    onError: (error) => toast(error.message, "error")
  });

  const deleteSla = useMutation({
    mutationFn: (id: string) => api.delete(`/support-tickets/sla-rules/${id}`),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: ["support-tickets", "sla-rules"] }); toast("SLA removido."); },
    onError: (error) => toast(error.message, "error")
  });

  const content = activePath === "/atendimento/abrir"
    ? <TicketForm clients={clients} products={products} onSave={(input) => createTicket.mutateAsync(input).then(() => undefined)} />
    : activePath === "/atendimento/base"
      ? <KnowledgeBase articles={articlesQuery.data ?? []} isTeam={isTeam} onCreate={(input) => createArticle.mutateAsync(input).then(() => undefined)} />
      : activePath === "/atendimento/configuracoes"
        ? isTeam ? <SettingsView rules={slaRulesQuery.data ?? []} products={products} onCreateSla={(input) => createSla.mutateAsync(input).then(() => undefined)} onDeleteSla={(id) => deleteSla.mutate(id)} /> : <Card className="text-sm text-slate-400">Acesso restrito a gestores.</Card>
        : activePath === "/atendimento" || activePath === "/atendimento/relatorios"
          ? <DashboardView dashboard={dashboardQuery.data} loading={dashboardQuery.isLoading} />
          : <TicketList tickets={tickets} loading={ticketsQuery.isLoading} onOpen={(ticket) => setSelectedId(ticket.id)} emptyLabel="Nenhum chamado encontrado." />;

  return (
    <div className="space-y-5">
      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div><h2 className="text-lg font-semibold">Atendimento Tecnico</h2><p className="mt-1 text-sm text-slate-400">Central de suporte, desenvolvimento, SLA e historico de atendimento.</p></div>
          <Button variant="outline" onClick={() => { void ticketsQuery.refetch(); void dashboardQuery.refetch(); }}><RefreshCw size={17} /> Atualizar</Button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {tabRoutes.map(({ path: routePath, label, icon: Icon }) => (
            <button key={routePath} type="button" onClick={() => navigate(routePath)} className={cn("inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition", activePath === routePath ? "border-accent bg-accent/10 text-accent" : "border-slate-700 text-slate-300 hover:bg-white/5")}>
              <Icon size={16} />{label}
            </button>
          ))}
        </div>
      </Card>
      {(activePath === "/atendimento/central" || activePath === "/atendimento/fila" || activePath === "/atendimento/meus" || activePath === "/atendimento" || activePath === "/atendimento/relatorios") ? <FiltersBar filters={filters} setFilters={setFilters} clients={clients} products={products} /> : null}
      {content}
      {selectedTicket ? (
        <TicketDetail
          ticket={selectedTicket}
          analysts={analystsQuery.data ?? []}
          onClose={() => setSelectedId(null)}
          onReply={(input) => replyTicket.mutateAsync(input).then(() => undefined)}
          onAssign={(analystId) => assignTicket.mutateAsync(analystId).then(() => undefined)}
          onStatus={(status, note) => statusTicket.mutateAsync({ status, note }).then(() => undefined)}
        />
      ) : null}
    </div>
  );
}
