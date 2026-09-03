import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail, Send } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/contexts/toast-context";
import { api } from "@/services/api";
import type { CommunicationMessage, CommunicationTemplate, CrmLead } from "@/types/crm";

const emailSchema = z.object({
  templateId: z.string().optional(),
  subject: z.string().trim().min(3, "Informe um assunto com pelo menos 3 caracteres."),
  body: z.string().trim().min(10, "Escreva uma mensagem com pelo menos 10 caracteres.")
});

type EmailInput = z.infer<typeof emailSchema>;

const statusLabels: Record<CommunicationMessage["status"], string> = {
  DRAFT: "Rascunho",
  QUEUED: "Na fila",
  SENDING: "Enviando",
  SENT: "Enviado",
  DELIVERED: "Entregue",
  READ: "Aberto",
  FAILED: "Falhou",
  CANCELLED: "Cancelado"
};

function defaultBody(lead: CrmLead): string {
  return `Olá ${lead.name},\n\nGostaríamos de apresentar as soluções da Torresoft e entender como podemos apoiar sua empresa.\n\nPodemos agendar uma conversa?\n\nAtenciosamente,\nTorresoft`;
}

export function LeadEmailDialog({ lead, onClose }: { lead?: CrmLead; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const templates = useQuery({
    queryKey: ["communication-templates", "email"],
    queryFn: () => api.get<CommunicationTemplate[]>("/communication/templates"),
    enabled: Boolean(lead)
  });
  const messages = useQuery({
    queryKey: ["communication-messages", "lead", lead?.id],
    queryFn: () => api.get<CommunicationMessage[]>(`/communication/messages?leadId=${encodeURIComponent(lead?.id ?? "")}`),
    enabled: Boolean(lead)
  });
  const form = useForm<EmailInput>({
    resolver: zodResolver(emailSchema),
    defaultValues: { templateId: "", subject: "Apresentação comercial - Torresoft", body: "" }
  });

  useEffect(() => {
    if (!lead) return;
    form.reset({ templateId: "", subject: "Apresentação comercial - Torresoft", body: defaultBody(lead) });
  }, [form, lead]);

  const send = useMutation({
    mutationFn: async (input: EmailInput) => {
      if (!lead?.email) throw new Error("Esta captação não possui um e-mail válido.");
      const contactName = lead.responsible.trim() && lead.responsible.toLowerCase() !== "nao informado" ? lead.responsible.trim() : lead.name;
      const message = await api.post<CommunicationMessage>("/communication/send", {
        channel: "EMAIL",
        leadId: lead.id,
        recipientName: lead.name,
        recipient: lead.email,
        templateId: input.templateId || null,
        subject: input.subject,
        body: input.body,
        variables: {
          cliente: lead.name,
          lead: lead.name,
          contato: contactName,
          empresa: lead.company ?? lead.name,
          email: lead.email,
          whatsapp: lead.whatsapp,
          cidade: lead.city,
          responsavel: lead.responsible
        }
      });
      if (message.status === "FAILED") throw new Error(message.errorMessage ?? "Não foi possível enviar o e-mail.");
      return message;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
      toast("E-mail enviado para a captação.");
      onClose();
    },
    onError: (error) => toast(error.message, "error")
  });

  const emailTemplates = templates.data?.filter((template) => template.channel === "EMAIL" && template.active) ?? [];
  const selectTemplate = (templateId: string): void => {
    form.setValue("templateId", templateId);
    const template = emailTemplates.find((item) => item.id === templateId);
    if (!template) return;
    form.setValue("subject", template.subject ?? "Contato comercial - Torresoft", { shouldValidate: true });
    form.setValue("body", template.body, { shouldValidate: true });
  };

  return (
    <Dialog open={Boolean(lead)} title="Enviar e-mail para captação" onClose={onClose} className="max-w-4xl">
      {lead ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <form className="space-y-4" onSubmit={(event) => void form.handleSubmit((input) => send.mutateAsync(input).then(() => undefined))(event)}>
            <div className="rounded-xl border border-slate-700 bg-sidebar p-4">
              <p className="font-medium">{lead.name}</p>
              <p className="mt-1 text-sm text-slate-400">{lead.email ?? "E-mail não informado"}</p>
            </div>
            <label className="block text-sm text-slate-300">
              Template opcional
              <select className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" value={form.watch("templateId") ?? ""} onChange={(event) => selectTemplate(event.target.value)}>
                <option value="">Mensagem personalizada</option>
                {emailTemplates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label className="block text-sm text-slate-300">
              Assunto
              <Input className="mt-2" {...form.register("subject")} />
              {form.formState.errors.subject ? <small className="text-red-400">{form.formState.errors.subject.message}</small> : null}
            </label>
            <label className="block text-sm text-slate-300">
              Mensagem
              <Textarea className="mt-2 min-h-64" {...form.register("body")} />
              {form.formState.errors.body ? <small className="text-red-400">{form.formState.errors.body.message}</small> : null}
            </label>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
              <Button type="submit" disabled={send.isPending || !lead.email}>
                <Send size={17} /> {send.isPending ? "Enviando..." : "Enviar e-mail"}
              </Button>
            </div>
          </form>
          <aside>
            <h3 className="flex items-center gap-2 font-medium"><Mail size={17} className="text-accent" /> Histórico</h3>
            <div className="mt-3 max-h-[520px] space-y-2 overflow-y-auto">
              {messages.isLoading ? <Skeleton className="h-28" /> : null}
              {messages.data?.filter((message) => message.channel === "EMAIL").map((message) => (
                <div key={message.id} className="rounded-xl bg-sidebar p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="line-clamp-2 font-medium">{message.subject ?? "Sem assunto"}</p>
                    <span className="shrink-0 text-xs text-accent">{statusLabels[message.status]}</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(message.createdAt))}</p>
                  {message.errorMessage ? <p className="mt-2 text-xs text-red-400">{message.errorMessage}</p> : null}
                </div>
              ))}
              {!messages.isLoading && !messages.data?.some((message) => message.channel === "EMAIL") ? <p className="text-sm text-slate-400">Nenhum e-mail enviado para esta captação.</p> : null}
            </div>
          </aside>
        </div>
      ) : null}
    </Dialog>
  );
}
