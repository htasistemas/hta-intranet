import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Edit3, Eye, Mail, MessageSquareText, Plus, Save, Search, Send, Trash2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Client, PageResult } from "@/types";
import type { CommunicationChannel, CommunicationMessage, CommunicationReport, CommunicationStatus, CommunicationTemplate } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";

const optionalText = z.string().trim().optional().nullable();
const templateSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  name: z.string().trim().min(2, "Informe o nome."),
  subject: optionalText,
  body: z.string().trim().min(2, "Informe a mensagem."),
  variablesText: z.string().trim().optional()
});
const sendSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateId: optionalText,
  clientId: optionalText,
  recipientName: optionalText,
  recipient: optionalText,
  subject: optionalText,
  body: z.string().trim().min(2, "Informe a mensagem.")
});

type TemplateForm = z.infer<typeof templateSchema>;
type SendForm = z.infer<typeof sendSchema>;
type SendMode = "single" | "selected" | "all";

interface SendPayload extends SendForm {
  recipient: string;
  variables: Record<string, string>;
}

interface BatchResult {
  sent: number;
  skipped: number;
}

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";
const statusLabels: Record<CommunicationStatus, string> = {
  DRAFT: "Rascunho",
  QUEUED: "Na fila",
  SENDING: "Enviando",
  SENT: "Enviada",
  DELIVERED: "Entregue",
  READ: "Visualizada",
  FAILED: "Falhou",
  CANCELLED: "Cancelada"
};
const statusClasses: Record<CommunicationStatus, string> = {
  DRAFT: "bg-slate-500/15 text-slate-300",
  QUEUED: "bg-blue-500/15 text-blue-200",
  SENDING: "bg-cyan-500/15 text-cyan-200",
  SENT: "bg-emerald-500/15 text-emerald-200",
  DELIVERED: "bg-teal-500/15 text-teal-200",
  READ: "bg-violet-500/15 text-violet-200",
  FAILED: "bg-red-500/15 text-red-200",
  CANCELLED: "bg-slate-500/15 text-slate-300"
};
const variableOptions = ["cliente", "empresa", "contato", "email", "whatsapp", "cidade", "responsavel"];

function variablesText(template: CommunicationTemplate): string {
  return template.variables.join(", ");
}

function templatePayload(input: TemplateForm): Omit<CommunicationTemplate, "id"> {
  return {
    channel: input.channel,
    name: input.name,
    subject: input.subject ?? null,
    body: input.body,
    variables: input.variablesText?.split(",").map((item) => item.trim()).filter(Boolean) ?? [],
    active: true
  };
}

function replaceVariables(value: string, client: Client | undefined): string {
  if (!client) return value;
  return Object.entries(clientVariables(client)).reduce((text, [key, variable]) => text.replaceAll(`{{${key}}}`, variable), value);
}

function clientVariables(client: Client): Record<string, string> {
  const contactName = client.responsible ?? "";
  return {
    cliente: client.name,
    empresa: client.tradeName ?? client.legalName ?? client.name,
    contato: contactName,
    email: client.email ?? "",
    whatsapp: client.whatsapp ?? "",
    cidade: client.city ?? "",
    responsavel: contactName
  };
}

function recipientFor(channel: CommunicationChannel, client: Client | undefined): string {
  if (!client) return "";
  return channel === "EMAIL" ? client.email ?? "" : client.whatsapp ?? client.phone ?? "";
}

function hasResponse(message: CommunicationMessage): boolean {
  return message.webhookEvents?.some((event) => {
    const payload = event.payload;
    return "reply" in payload || "response" in payload || "text" in payload || "message" in payload;
  }) ?? false;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function MessagesPage() {
  const [search, setSearch] = useState("");
  const [sendMode, setSendMode] = useState<SendMode>("single");
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<CommunicationTemplate | undefined>();
  const [templateToDelete, setTemplateToDelete] = useState<CommunicationTemplate | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const clients = useQuery({
    queryKey: ["message-clients", search],
    queryFn: () => api.get<PageResult<Client>>(`/clients?pageSize=500&search=${encodeURIComponent(search)}`),
    refetchOnMount: "always",
    staleTime: 0
  });
  const templates = useQuery({ queryKey: ["communication-templates"], queryFn: () => api.get<CommunicationTemplate[]>("/communication/templates") });
  const messages = useQuery({ queryKey: ["communication-messages"], queryFn: () => api.get<CommunicationMessage[]>("/communication/messages") });
  const report = useQuery({ queryKey: ["communication-report"], queryFn: () => api.get<CommunicationReport>("/communication/report") });

  const templateForm = useForm<TemplateForm>({
    resolver: zodResolver(templateSchema),
    defaultValues: { channel: "EMAIL", name: "", subject: "", body: "Ola {{cliente}}, tudo bem?", variablesText: "cliente,empresa,email,whatsapp" }
  });
  const sendForm = useForm<SendForm>({
    resolver: zodResolver(sendSchema),
    defaultValues: { channel: "EMAIL", recipient: "", subject: "", body: "Ola {{cliente}}, tudo bem?" }
  });
  const selectedClientId = useWatch({ control: sendForm.control, name: "clientId" });
  const selectedChannel = useWatch({ control: sendForm.control, name: "channel" });
  const selectedSendTemplateId = useWatch({ control: sendForm.control, name: "templateId" });
  const clientList = clients.data?.data ?? [];
  const selectedClient = clientList.find((client) => client.id === selectedClientId);
  const selectedClients = clientList.filter((client) => selectedClientIds.includes(client.id));

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["communication-templates"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-report"] });
  };

  const saveTemplate = useMutation({
    mutationFn: (input: TemplateForm) => selectedTemplate
      ? api.put<CommunicationTemplate>(`/communication/templates/${selectedTemplate.id}`, templatePayload(input))
      : api.post<CommunicationTemplate>("/communication/templates", templatePayload(input)),
    onSuccess: () => {
      templateForm.reset({ channel: "EMAIL", name: "", subject: "", body: "Ola {{cliente}}, tudo bem?", variablesText: "cliente,empresa,email,whatsapp" });
      setSelectedTemplate(undefined);
      invalidate();
      toast("Mensagem salva.");
    },
    onError: (error) => toast(error.message, "error")
  });
  const deleteTemplate = useMutation({
    mutationFn: (templateId: string) => api.delete(`/communication/templates/${templateId}`),
    onSuccess: () => {
      setTemplateToDelete(undefined);
      setSelectedTemplate(undefined);
      invalidate();
      toast("Mensagem excluida.");
    },
    onError: (error) => toast(error.message, "error")
  });
  const sendMessage = useMutation({
    mutationFn: (input: SendPayload) => api.post<CommunicationMessage>("/communication/send", input),
    onSuccess: () => {
      sendForm.reset({ channel: "EMAIL", recipient: "", subject: "", body: "Ola {{cliente}}, tudo bem?" });
      invalidate();
      toast("Mensagem enviada ou enfileirada.");
    },
    onError: (error) => toast(error.message, "error")
  });
  const sendBatchMessage = useMutation({
    mutationFn: async (input: SendForm): Promise<BatchResult> => {
      const targetClients = sendMode === "all" ? clientList : selectedClients;
      let sent = 0;
      let skipped = 0;
      for (const client of targetClients) {
        const recipient = recipientFor(input.channel, client);
        if (!recipient) {
          skipped += 1;
          continue;
        }
        await api.post<CommunicationMessage>("/communication/send", {
          channel: input.channel,
          templateId: input.templateId,
          recipientName: client.name,
          recipient,
          subject: replaceVariables(input.subject ?? "", client),
          body: replaceVariables(input.body, client),
          variables: clientVariables(client)
        });
        sent += 1;
      }
      return { sent, skipped };
    },
    onSuccess: (result) => {
      invalidate();
      toast(`${result.sent} mensagem(ns) enviada(s) ou enfileirada(s). ${result.skipped ? `${result.skipped} cliente(s) sem destinatario.` : ""}`.trim(), result.sent ? "success" : "error");
    },
    onError: (error) => toast(error.message, "error")
  });
  const processQueue = useMutation({
    mutationFn: () => api.post<{ processed: number }>("/communication/queue/process", {}),
    onSuccess: (result) => {
      invalidate();
      toast(`${result.processed} mensagem(ns) processada(s).`);
    },
    onError: (error) => toast(error.message, "error")
  });

  useEffect(() => {
    if (sendMode !== "single" || !selectedClient) return;
    sendForm.setValue("recipientName", selectedClient.name);
    sendForm.setValue("recipient", recipientFor(selectedChannel, selectedClient), { shouldValidate: true });
    sendForm.setValue("subject", replaceVariables(sendForm.getValues("subject") ?? "", selectedClient));
    sendForm.setValue("body", replaceVariables(sendForm.getValues("body"), selectedClient), { shouldValidate: true });
  }, [selectedChannel, selectedClient, sendForm, sendMode]);

  useEffect(() => {
    const template = templates.data?.find((item) => item.id === selectedSendTemplateId);
    if (!template) return;
    sendForm.setValue("channel", template.channel);
    sendForm.setValue("subject", replaceVariables(template.subject ?? "", selectedClient));
    sendForm.setValue("body", replaceVariables(template.body, selectedClient), { shouldValidate: true });
  }, [selectedClient, selectedSendTemplateId, sendForm, templates.data]);

  const stats = useMemo(() => {
    const items = messages.data ?? [];
    return {
      total: items.length,
      sent: items.filter((message) => ["SENT", "DELIVERED", "READ"].includes(message.status)).length,
      read: items.filter((message) => message.status === "READ" || message.readAt).length,
      delivered: items.filter((message) => ["DELIVERED", "READ"].includes(message.status) || message.deliveredAt).length,
      responses: items.filter(hasResponse).length,
      interactions: items.reduce((total, message) => total + (message.webhookEvents?.length ?? 0), 0)
    };
  }, [messages.data]);

  function editTemplate(template: CommunicationTemplate): void {
    setSelectedTemplate(template);
    templateForm.reset({ channel: template.channel, name: template.name, subject: template.subject ?? "", body: template.body, variablesText: variablesText(template) });
  }

  function useTemplate(template: CommunicationTemplate): void {
    sendForm.setValue("templateId", template.id);
    sendForm.setValue("channel", template.channel);
    sendForm.setValue("subject", replaceVariables(template.subject ?? "", selectedClient));
    sendForm.setValue("body", replaceVariables(template.body, selectedClient), { shouldValidate: true });
  }

  function insertVariable(variable: string): void {
    const body = templateForm.getValues("body");
    templateForm.setValue("body", `${body} {{${variable}}}`, { shouldValidate: true });
  }

  function handleInvalidTemplate(): void {
    toast("Informe o nome e a mensagem antes de incluir.", "error");
  }

  function toggleSelectedClient(clientId: string): void {
    setSelectedClientIds((current) => current.includes(clientId) ? current.filter((id) => id !== clientId) : [...current, clientId]);
  }

  async function submitSend(input: SendForm): Promise<void> {
    if (sendMode === "single") {
      const recipient = input.recipient?.trim() ?? "";
      if (!recipient) {
        toast("Informe o destinatario.", "error");
        return;
      }
      await sendMessage.mutateAsync({ ...input, recipient, variables: selectedClient ? clientVariables(selectedClient) : {} });
      return;
    }
    const targetCount = sendMode === "all" ? clientList.length : selectedClients.length;
    if (!targetCount) {
      toast(sendMode === "all" ? "Nenhum cliente carregado para envio." : "Selecione ao menos um cliente.", "error");
      return;
    }
    await sendBatchMessage.mutateAsync(input);
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card><p className="text-sm text-slate-400">Mensagens</p><strong className="mt-2 block text-3xl">{stats.total}</strong></Card>
        <Card><p className="text-sm text-slate-400">Enviadas</p><strong className="mt-2 block text-3xl">{stats.sent}</strong></Card>
        <Card><p className="text-sm text-slate-400">Visualizadas</p><strong className="mt-2 block text-3xl">{stats.read}</strong></Card>
        <Card><p className="text-sm text-slate-400">Respostas</p><strong className="mt-2 block text-3xl">{stats.responses}</strong></Card>
        <Card><p className="text-sm text-slate-400">Interacoes</p><strong className="mt-2 block text-3xl">{stats.interactions}</strong></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardTitle>{selectedTemplate ? "Editar mensagem criada" : "Criar mensagem"}</CardTitle>
          <form className="grid gap-3" onSubmit={(event) => void templateForm.handleSubmit((input) => saveTemplate.mutateAsync(input).then(() => undefined), handleInvalidTemplate)(event)}>
            <div className="grid gap-3 md:grid-cols-3">
              <label>
                <Input placeholder="Nome do modelo" {...templateForm.register("name")} />
                {templateForm.formState.errors.name ? <small className="text-red-400">{templateForm.formState.errors.name.message}</small> : null}
              </label>
              <select className={selectClass} {...templateForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select>
              <Input placeholder="Variaveis: cliente, empresa" {...templateForm.register("variablesText")} />
            </div>
            <Input placeholder="Assunto para e-mail" {...templateForm.register("subject")} />
            <label>
              <Textarea className="min-h-40" placeholder="Mensagem personalizada" {...templateForm.register("body")} />
              {templateForm.formState.errors.body ? <small className="text-red-400">{templateForm.formState.errors.body.message}</small> : null}
            </label>
            <div className="flex flex-wrap gap-2">
              {variableOptions.map((variable) => <Button key={variable} type="button" variant="outline" size="sm" onClick={() => insertVariable(variable)}><Plus size={14} /> {`{{${variable}}}`}</Button>)}
            </div>
            <div className="flex justify-between gap-3">
              <Button type="button" variant="ghost" onClick={() => { setSelectedTemplate(undefined); templateForm.reset(); }}>Limpar</Button>
              <Button type="submit" disabled={saveTemplate.isPending}><Save size={16} /> {selectedTemplate ? "Salvar edicao" : "Incluir mensagem"}</Button>
            </div>
          </form>
        </Card>

        <Card>
          <CardTitle>Mensagens criadas</CardTitle>
          <div className="space-y-2">
            {templates.isLoading ? <Skeleton className="h-32" /> : templates.data?.map((template) => (
              <div key={template.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-medium">{template.name}</p><p className="text-xs text-slate-400">{template.channel} - {template.variables.join(", ") || "sem variaveis"}</p></div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" onClick={() => useTemplate(template)} aria-label="Usar mensagem"><Copy size={16} /></Button>
                    <Button variant="ghost" size="icon" onClick={() => editTemplate(template)} aria-label="Editar mensagem"><Edit3 size={16} /></Button>
                    <Button variant="danger" size="icon" onClick={() => setTemplateToDelete(template)} aria-label="Excluir mensagem"><Trash2 size={16} /></Button>
                  </div>
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-300">{template.body}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardTitle>Enviar para cliente</CardTitle>
          <form className="grid gap-3" onSubmit={(event) => void sendForm.handleSubmit((input) => submitSend(input))(event)}>
            <div className="grid grid-cols-3 rounded-xl border border-slate-700 bg-sidebar p-1">
              {([
                ["single", "Um cliente"],
                ["selected", "Selecionados"],
                ["all", "Todos"]
              ] as Array<[SendMode, string]>).map(([mode, label]) => (
                <button key={mode} type="button" className={cn("h-10 rounded-lg px-2 text-sm text-slate-400 transition", sendMode === mode && "bg-accent/10 text-accent")} onClick={() => setSendMode(mode)} aria-pressed={sendMode === mode}>
                  {label}
                </button>
              ))}
            </div>
            <label className="relative">
              <Search className="absolute left-3 top-3 text-slate-500" size={18} />
              <Input className="pl-10" placeholder="Buscar cliente" value={search} onChange={(event) => setSearch(event.target.value)} />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              {sendMode === "single" ? <select className={selectClass} {...sendForm.register("clientId")}><option value="">Selecione o cliente</option>{clientList.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select> : null}
              <select className={selectClass} {...sendForm.register("templateId")}><option value="">Mensagem criada</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
              <select className={selectClass} {...sendForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select>
              {sendMode === "single" ? <Input placeholder="Destinatario" {...sendForm.register("recipient")} /> : null}
            </div>
            {sendMode === "single" ? <Input placeholder="Nome do destinatario" {...sendForm.register("recipientName")} /> : null}
            {sendMode === "selected" ? (
              <div className="max-h-52 overflow-y-auto rounded-xl border border-slate-700 bg-sidebar">
                {clientList.map((client) => (
                  <label key={client.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-700/60 px-3 py-3 last:border-0 hover:bg-white/[.03]">
                    <input type="checkbox" className="mt-1 h-4 w-4 rounded border-slate-600 bg-card accent-accent" checked={selectedClientIds.includes(client.id)} onChange={() => toggleSelectedClient(client.id)} />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{client.name}</span>
                      <span className="block text-xs text-slate-400">{selectedChannel === "EMAIL" ? client.email ?? "Sem e-mail" : client.whatsapp ?? client.phone ?? "Sem WhatsApp/telefone"}</span>
                    </span>
                  </label>
                ))}
              </div>
            ) : null}
            {sendMode === "all" ? <p className="rounded-xl border border-slate-700 bg-sidebar px-3 py-2 text-sm text-slate-300">Sera enviado para todos os {clientList.length} cliente(s) carregado(s) na busca atual.</p> : null}
            <Input placeholder="Assunto" {...sendForm.register("subject")} />
            <Textarea className="min-h-40" placeholder="Mensagem final personalizada" {...sendForm.register("body")} />
            <Button disabled={sendMessage.isPending || sendBatchMessage.isPending}><Send size={16} /> {sendMode === "single" ? "Enviar mensagem" : "Enviar mensagens"}</Button>
          </form>
        </Card>

        <Card>
          <CardTitle>Historico do cliente e envios</CardTitle>
          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl bg-sidebar p-3"><p className="text-xs text-slate-400">Entregues</p><strong>{stats.delivered}</strong></div>
            <div className="rounded-xl bg-sidebar p-3"><p className="text-xs text-slate-400">Visualizadas</p><strong>{stats.read}</strong></div>
            <div className="rounded-xl bg-sidebar p-3"><p className="text-xs text-slate-400">Campanhas</p><strong>{report.data?.campaigns ?? 0}</strong></div>
          </div>
          <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {messages.isLoading ? <Skeleton className="h-48" /> : messages.data?.map((message) => (
              <article key={message.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{message.recipientName ?? message.client?.name ?? message.lead?.name ?? message.recipient}</p>
                    <p className="text-xs text-slate-400">{message.channel} para {message.recipient} - {formatDate(message.createdAt)}</p>
                  </div>
                  <span className={cn("rounded-full px-3 py-1 text-xs", statusClasses[message.status])}>{statusLabels[message.status]}</span>
                </div>
                <p className="mt-3 text-sm text-slate-300">{message.subject ?? message.body.slice(0, 90)}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1"><Mail size={13} /> Envio: {formatDate(message.sentAt)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1"><Eye size={13} /> Leitura: {formatDate(message.readAt)}</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/5 px-2 py-1"><MessageSquareText size={13} /> Interacoes: {message.webhookEvents?.length ?? 0}</span>
                  {hasResponse(message) ? <span className="rounded-full bg-emerald-500/15 px-2 py-1 text-emerald-200">Houve resposta</span> : null}
                </div>
              </article>
            ))}
          </div>
          <Button className="mt-4" variant="outline" onClick={() => processQueue.mutate()} disabled={processQueue.isPending}>Processar fila</Button>
        </Card>
      </section>

      <ConfirmDialog
        open={Boolean(templateToDelete)}
        title="Excluir mensagem"
        description={`Deseja excluir a mensagem "${templateToDelete?.name ?? ""}"?`}
        confirmLabel="Excluir mensagem"
        loading={deleteTemplate.isPending}
        onClose={() => setTemplateToDelete(undefined)}
        onConfirm={() => { if (templateToDelete) deleteTemplate.mutate(templateToDelete.id); }}
      />
    </div>
  );
}
