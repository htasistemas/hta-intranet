import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Send, Settings2, Target, Zap } from "lucide-react";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { currencyInputToNumber } from "@/lib/currency-input";
import type {
  CommunicationCampaign,
  CommunicationMessage,
  CommunicationProviderConfig,
  CommunicationReport,
  CommunicationTemplate,
  CrmClient,
  CrmGoal,
  CrmLead,
  CrmSlaRule
} from "@/types/crm";

const optionalText = z.string().trim().optional().nullable();
const optionalCurrency = z.string().transform((value) => currencyInputToNumber(value));

const providerSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  provider: z.enum(["SMTP", "SENDGRID", "RESEND", "META_WHATSAPP", "ZAPI", "EVOLUTION", "WEBHOOK"]),
  name: z.string().min(2),
  senderName: optionalText,
  senderAddress: optionalText,
  endpointUrl: optionalText,
  apiKey: optionalText,
  apiSecret: optionalText,
  defaultFrom: optionalText,
  active: z.boolean().default(true),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).default({})
});

type ProviderInput = z.infer<typeof providerSchema>;
type ProviderValues = z.input<typeof providerSchema>;

const templateSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  name: z.string().min(2),
  subject: optionalText,
  body: z.string().min(2),
  variablesText: z.string().optional()
});

type TemplateInput = z.infer<typeof templateSchema>;

const sendSchema = z.object({
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateId: optionalText,
  leadId: optionalText,
  clientId: optionalText,
  recipientName: optionalText,
  recipient: z.string().min(3),
  subject: optionalText,
  body: z.string().min(2)
});

type SendInput = z.infer<typeof sendSchema>;

const campaignSchema = z.object({
  name: z.string().min(2),
  channel: z.enum(["EMAIL", "WHATSAPP"]),
  templateId: z.string().min(1),
  status: z.enum(["DRAFT", "SCHEDULED", "RUNNING", "FINISHED", "CANCELLED"]),
  segment: optionalText,
  city: optionalText,
  state: optionalText
});

type CampaignInput = z.infer<typeof campaignSchema>;

const goalSchema = z.object({
  name: z.string().min(2),
  responsible: optionalText,
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  targetValue: optionalCurrency,
  targetCount: z.coerce.number().int().nonnegative().optional().nullable(),
  active: z.boolean().default(true)
});

type GoalInput = z.infer<typeof goalSchema>;
type GoalValues = z.input<typeof goalSchema>;

const slaSchema = z.object({
  name: z.string().min(2),
  stage: z.string().optional().nullable(),
  priority: z.string().optional().nullable(),
  maxHours: z.coerce.number().int().positive(),
  active: z.boolean().default(true)
});

type SlaInput = z.infer<typeof slaSchema>;
type SlaValues = z.input<typeof slaSchema>;

function templatePayload(input: TemplateInput) {
  const { variablesText, ...rest } = input;
  return { ...rest, variables: variablesText?.split(",").map((item) => item.trim()).filter(Boolean) ?? [], active: true };
}

function campaignPayload(input: CampaignInput) {
  const { segment, city, state, ...rest } = input;
  return { ...rest, filters: { segment, city, state }, scheduledAt: null };
}

export function CommunicationPanel({ leads, clients }: { leads: CrmLead[]; clients: CrmClient[] }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const providers = useQuery({ queryKey: ["communication-provider-configs"], queryFn: () => api.get<CommunicationProviderConfig[]>("/communication/provider-configs") });
  const templates = useQuery({ queryKey: ["communication-templates"], queryFn: () => api.get<CommunicationTemplate[]>("/communication/templates") });
  const messages = useQuery({ queryKey: ["communication-messages"], queryFn: () => api.get<CommunicationMessage[]>("/communication/messages") });
  const campaigns = useQuery({ queryKey: ["communication-campaigns"], queryFn: () => api.get<CommunicationCampaign[]>("/communication/campaigns") });
  const report = useQuery({ queryKey: ["communication-report"], queryFn: () => api.get<CommunicationReport>("/communication/report") });
  const goals = useQuery({ queryKey: ["crm-goals"], queryFn: () => api.get<CrmGoal[]>("/crm/goals") });
  const slaRules = useQuery({ queryKey: ["crm-sla-rules"], queryFn: () => api.get<CrmSlaRule[]>("/crm/sla-rules") });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["communication-provider-configs"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-templates"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-messages"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-campaigns"] });
    void queryClient.invalidateQueries({ queryKey: ["communication-report"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-goals"] });
    void queryClient.invalidateQueries({ queryKey: ["crm-sla-rules"] });
  };

  const providerForm = useForm<ProviderValues, unknown, ProviderInput>({ resolver: zodResolver(providerSchema), defaultValues: { channel: "EMAIL", provider: "WEBHOOK", name: "", active: true, metadata: {} } });
  const templateForm = useForm<TemplateInput>({ resolver: zodResolver(templateSchema), defaultValues: { channel: "EMAIL", name: "", subject: "", body: "Ola {{cliente}}, tudo bem?", variablesText: "cliente,empresa" } });
  const sendForm = useForm<SendInput>({ resolver: zodResolver(sendSchema), defaultValues: { channel: "EMAIL", recipient: "", body: "Ola {{cliente}}, tudo bem?" } });
  const campaignForm = useForm<CampaignInput>({ resolver: zodResolver(campaignSchema), defaultValues: { channel: "EMAIL", name: "", status: "DRAFT" } });
  const goalForm = useForm<GoalValues, unknown, GoalInput>({ resolver: zodResolver(goalSchema), defaultValues: { name: "", periodStart: new Date().toISOString().slice(0, 10), periodEnd: new Date().toISOString().slice(0, 10), active: true } });
  const slaForm = useForm<SlaValues, unknown, SlaInput>({ resolver: zodResolver(slaSchema), defaultValues: { name: "", maxHours: 24, active: true } });

  const saveProvider = useMutation({ mutationFn: (input: ProviderInput) => api.post("/communication/provider-configs", input), onSuccess: () => { providerForm.reset(); invalidate(); toast("Provider salvo."); }, onError: (error) => toast(error.message, "error") });
  const saveTemplate = useMutation({ mutationFn: (input: TemplateInput) => api.post("/communication/templates", templatePayload(input)), onSuccess: () => { templateForm.reset(); invalidate(); toast("Template salvo."); }, onError: (error) => toast(error.message, "error") });
  const sendMessage = useMutation({ mutationFn: (input: SendInput) => api.post("/communication/send", { ...input, variables: {} }), onSuccess: () => { sendForm.reset(); invalidate(); toast("Mensagem enviada ou enfileirada."); }, onError: (error) => toast(error.message, "error") });
  const saveCampaign = useMutation({ mutationFn: (input: CampaignInput) => api.post("/communication/campaigns", campaignPayload(input)), onSuccess: () => { campaignForm.reset(); invalidate(); toast("Campanha criada."); }, onError: (error) => toast(error.message, "error") });
  const processQueue = useMutation({ mutationFn: () => api.post("/communication/queue/process", {}), onSuccess: () => { invalidate(); toast("Fila processada."); }, onError: (error) => toast(error.message, "error") });
  const calculateScores = useMutation({ mutationFn: () => api.post("/crm/scores/calculate", {}), onSuccess: () => { invalidate(); toast("Scores recalculados."); }, onError: (error) => toast(error.message, "error") });
  const saveGoal = useMutation({ mutationFn: (input: GoalInput) => api.post("/crm/goals", { ...input, periodStart: new Date(input.periodStart).toISOString(), periodEnd: new Date(input.periodEnd).toISOString() }), onSuccess: () => { goalForm.reset(); invalidate(); toast("Meta salva."); }, onError: (error) => toast(error.message, "error") });
  const saveSla = useMutation({ mutationFn: (input: SlaInput) => api.post("/crm/sla-rules", input), onSuccess: () => { slaForm.reset(); invalidate(); toast("SLA salvo."); }, onError: (error) => toast(error.message, "error") });

  return (
    <div className="space-y-5">
      <section className="grid gap-4 xl:grid-cols-4">
        <Card><p className="text-sm text-slate-400">Mensagens</p><p className="mt-2 text-3xl font-semibold">{messages.data?.length ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-400">Campanhas</p><p className="mt-2 text-3xl font-semibold">{report.data?.campaigns ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-400">Score medio</p><p className="mt-2 text-3xl font-semibold">{report.data?.averageScore ?? 0}</p></Card>
        <Card><p className="text-sm text-slate-400">Alertas SLA</p><p className="mt-2 text-3xl font-semibold">{report.data?.slaAlerts.length ?? 0}</p></Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle><Settings2 className="inline-block text-accent" size={17} /> Provider de envio</CardTitle>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void providerForm.handleSubmit((input) => saveProvider.mutateAsync(input).then(() => undefined))(event)}>
            <Input placeholder="Nome" {...providerForm.register("name")} />
            <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...providerForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select>
            <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...providerForm.register("provider")}><option value="WEBHOOK">Webhook</option><option value="RESEND">Resend</option><option value="SENDGRID">SendGrid</option><option value="META_WHATSAPP">Meta WhatsApp</option><option value="ZAPI">Z-API</option><option value="EVOLUTION">Evolution</option></select>
            <Input placeholder="Endpoint URL" {...providerForm.register("endpointUrl")} />
            <Input placeholder="API Key" type="password" {...providerForm.register("apiKey")} />
            <Input placeholder="Remetente padrao" {...providerForm.register("defaultFrom")} />
            <Button className="md:col-span-2">Salvar provider</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Providers configurados</CardTitle>
          <div className="space-y-2">{providers.data?.map((provider) => <div key={provider.id} className="rounded-xl bg-sidebar p-3 text-sm">{provider.name} - {provider.channel} - {provider.provider}</div>)}</div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle>Template</CardTitle>
          <form className="grid gap-3" onSubmit={(event) => void templateForm.handleSubmit((input) => saveTemplate.mutateAsync(input).then(() => undefined))(event)}>
            <div className="grid gap-3 md:grid-cols-2"><Input placeholder="Nome" {...templateForm.register("name")} /><select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...templateForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select></div>
            <Input placeholder="Assunto" {...templateForm.register("subject")} />
            <Textarea placeholder="Mensagem com variaveis: {{cliente}}" {...templateForm.register("body")} />
            <Input placeholder="Variaveis separadas por virgula" {...templateForm.register("variablesText")} />
            <Button>Salvar template</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Envio manual</CardTitle>
          <form className="grid gap-3" onSubmit={(event) => void sendForm.handleSubmit((input) => sendMessage.mutateAsync(input).then(() => undefined))(event)}>
            <div className="grid gap-3 md:grid-cols-2">
              <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...sendForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select>
              <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...sendForm.register("templateId")}><option value="">Template opcional</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
              <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...sendForm.register("clientId")}><option value="">Cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
              <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...sendForm.register("leadId")}><option value="">Lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select>
              <Input placeholder="Destinatario" {...sendForm.register("recipient")} />
              <Input placeholder="Assunto" {...sendForm.register("subject")} />
            </div>
            <Textarea placeholder="Mensagem" {...sendForm.register("body")} />
            <Button><Send size={16} /> Enviar agora</Button>
          </form>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle><Zap className="inline-block text-accent" size={17} /> Campanha segmentada</CardTitle>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void campaignForm.handleSubmit((input) => saveCampaign.mutateAsync(input).then(() => undefined))(event)}>
            <Input placeholder="Nome" {...campaignForm.register("name")} />
            <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...campaignForm.register("channel")}><option value="EMAIL">E-mail</option><option value="WHATSAPP">WhatsApp</option></select>
            <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...campaignForm.register("templateId")}><option value="">Template</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
            <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...campaignForm.register("status")}><option value="DRAFT">Rascunho</option><option value="RUNNING">Executar agora</option><option value="SCHEDULED">Agendada</option></select>
            <Input placeholder="Segmento" {...campaignForm.register("segment")} />
            <Input placeholder="Cidade" {...campaignForm.register("city")} />
            <Input placeholder="Estado" {...campaignForm.register("state")} />
            <Button className="md:col-span-2">Criar campanha</Button>
          </form>
        </Card>
        <Card>
          <CardTitle>Campanhas e fila</CardTitle>
          <Button variant="outline" className="mb-3" onClick={() => processQueue.mutate()}>Processar fila</Button>
          <div className="space-y-2">{campaigns.data?.map((campaign) => <div key={campaign.id} className="rounded-xl bg-sidebar p-3 text-sm">{campaign.name} - {campaign.status} - {campaign.messages?.length ?? 0} mensagens</div>)}</div>
        </Card>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardTitle><Target className="inline-block text-accent" size={17} /> Metas e SLA</CardTitle>
          <form className="grid gap-3 md:grid-cols-2" onSubmit={(event) => void goalForm.handleSubmit((input) => saveGoal.mutateAsync(input).then(() => undefined))(event)}>
            <Input placeholder="Meta" {...goalForm.register("name")} />
            <Input placeholder="Responsavel" {...goalForm.register("responsible")} />
            <Input type="date" {...goalForm.register("periodStart")} />
            <Input type="date" {...goalForm.register("periodEnd")} />
            <Controller control={goalForm.control} name="targetValue" render={({ field }) => <CurrencyInput placeholder="Valor alvo" value={String(field.value ?? "")} onChange={field.onChange} />} />
            <Input type="number" placeholder="Quantidade alvo" {...goalForm.register("targetCount")} />
            <Button className="md:col-span-2">Salvar meta</Button>
          </form>
          <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={(event) => void slaForm.handleSubmit((input) => saveSla.mutateAsync(input).then(() => undefined))(event)}>
            <Input placeholder="Regra SLA" {...slaForm.register("name")} />
            <Input type="number" placeholder="Horas maximas" {...slaForm.register("maxHours")} />
            <Input placeholder="Etapa opcional" {...slaForm.register("stage")} />
            <Input placeholder="Prioridade opcional" {...slaForm.register("priority")} />
            <Button className="md:col-span-2">Salvar SLA</Button>
          </form>
          <Button variant="outline" className="mt-4" onClick={() => calculateScores.mutate()}>Recalcular scores</Button>
        </Card>
        <Card>
          <CardTitle>Historico e inteligencia</CardTitle>
          <div className="space-y-2">{messages.data?.slice(0, 8).map((message) => <div key={message.id} className="rounded-xl bg-sidebar p-3 text-sm"><div className="flex justify-between gap-3"><span>{message.recipientName ?? message.recipient}</span><span>{message.status}</span></div><p className="text-xs text-slate-400">{message.channel} - {message.subject ?? message.body.slice(0, 48)}</p></div>)}</div>
          <div className="mt-4 space-y-2">{goals.data?.map((goal) => <div key={goal.id} className="rounded-xl bg-sidebar p-3 text-sm">{goal.name} - {goal.achievedCount}/{goal.targetCount ?? "-"}</div>)}</div>
          <div className="mt-4 space-y-2">{slaRules.data?.map((rule) => <div key={rule.id} className="rounded-xl bg-sidebar p-3 text-sm">{rule.name} - {rule.maxHours}h</div>)}</div>
        </Card>
      </section>
    </div>
  );
}
