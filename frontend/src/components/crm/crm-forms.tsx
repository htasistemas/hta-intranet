import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm, type Path, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";
import type { CrmActivity, CrmAutomation, CrmLead, CrmProject, CrmProposal } from "@/types/crm";

const emptyToNull = (value: unknown): unknown => value === "" ? null : value;
const optionalText = z.preprocess(emptyToNull, z.string().trim().optional().nullable());
const optionalNumber = z.preprocess(emptyToNull, z.coerce.number().nonnegative().optional().nullable());
const optionalCurrency = z.string().transform((value) => currencyInputToNumber(value));
const requiredCurrency = z.string().min(1, "Informe o valor.").transform((value) => currencyInputToNumber(value) ?? 0).pipe(z.number().nonnegative());
const zeroCurrency = z.string().transform((value) => currencyInputToNumber(value) ?? 0).pipe(z.number().nonnegative());

export const leadFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  company: optionalText,
  document: optionalText,
  segment: optionalText,
  position: optionalText,
  email: z.preprocess(emptyToNull, z.string().email("E-mail invalido.").optional().nullable()),
  phone: optionalText,
  whatsapp: optionalText,
  site: optionalText,
  postalCode: optionalText,
  street: optionalText,
  number: optionalText,
  district: optionalText,
  city: optionalText,
  state: optionalText,
  source: optionalText,
  campaign: optionalText,
  responsible: z.string().trim().min(2, "Informe o responsavel."),
  interest: optionalText,
  productInterest: optionalText,
  estimatedValue: optionalCurrency,
  observations: optionalText,
  score: z.enum(["VERY_HOT", "HOT", "WARM", "COLD"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["NEW", "IN_SERVICE", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]),
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"]),
  lostReason: optionalText,
  lastInteractionAt: optionalText,
  nextFollowUpAt: optionalText
});

export type LeadFormInput = z.infer<typeof leadFormSchema>;
type LeadFormValues = z.input<typeof leadFormSchema>;

const activityFormSchema = z.object({
  leadId: optionalText,
  clientId: optionalText,
  projectId: optionalText,
  type: z.enum(["CALL", "EMAIL", "WHATSAPP", "MEETING", "STATUS_CHANGE", "PROPOSAL", "CONTRACT", "TASK", "NOTE", "VISIT", "DEMONSTRATION", "FOLLOW_UP", "IMPLEMENTATION", "TRAINING"]),
  status: z.enum(["PENDING", "COMPLETED", "CANCELLED"]),
  title: z.string().trim().min(2),
  description: optionalText,
  responsible: z.string().trim().min(2),
  scheduledAt: optionalText,
  completedAt: optionalText
});

export type ActivityFormInput = z.infer<typeof activityFormSchema>;
type ActivityFormValues = z.input<typeof activityFormSchema>;

const proposalFormSchema = z.object({
  leadId: optionalText,
  clientId: optionalText,
  number: z.string().trim().min(2),
  product: z.string().trim().min(2),
  value: requiredCurrency,
  discount: zeroCurrency,
  paymentTerms: optionalText,
  deadline: optionalText,
  observations: optionalText,
  status: z.enum(["DRAFT", "SENT", "APPROVED", "REJECTED"])
});

export type ProposalFormInput = z.infer<typeof proposalFormSchema>;
type ProposalFormValues = z.input<typeof proposalFormSchema>;

const projectFormSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(2),
  responsible: z.string().trim().min(2),
  teamText: z.string().optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["NOT_STARTED", "PLANNING", "IN_DEVELOPMENT", "IN_TESTS", "IN_APPROVAL", "IN_DEPLOYMENT", "IN_TRAINING", "COMPLETED", "CANCELLED"]),
  startDate: optionalText,
  endDate: optionalText,
  budget: optionalCurrency,
  plannedHours: optionalNumber,
  executedHours: z.coerce.number().nonnegative().default(0),
  progress: z.coerce.number().int().min(0).max(100),
  observations: optionalText
});

export type ProjectFormInput = z.infer<typeof projectFormSchema>;
type ProjectFormValues = z.input<typeof projectFormSchema>;

const automationFormSchema = z.object({
  name: z.string().trim().min(2),
  trigger: z.enum(["LEAD_CREATED", "PROPOSAL_SENT", "SALE_COMPLETED", "PROJECT_COMPLETED", "LEAD_IDLE"]),
  action: z.enum(["CREATE_TASK", "CREATE_FOLLOW_UP", "CREATE_PROJECT", "REQUEST_SURVEY", "CREATE_ALERT"]),
  active: z.boolean(),
  parameterKey: z.string().optional(),
  parameterValue: z.string().optional()
});

export type AutomationFormInput = z.infer<typeof automationFormSchema>;
type AutomationFormValues = z.input<typeof automationFormSchema>;

function FieldError({ message }: { message?: string }) {
  return message ? <span className="text-xs text-red-300">{message}</span> : null;
}

function SelectField({ label, name, register, options }: { label: string; name: Path<LeadFormValues>; register: UseFormRegister<LeadFormValues>; options: Array<{ value: string; label: string }> }) {
  return (
    <label className="space-y-1 text-sm text-slate-300">
      <span>{label}</span>
      <select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm outline-none focus:border-accent" {...register(name)}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

export function LeadForm({ lead, onCancel, onSave }: { lead?: CrmLead; onCancel: () => void; onSave: (input: LeadFormInput) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<LeadFormValues, unknown, LeadFormInput>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      name: lead?.name ?? "",
      company: lead?.company ?? "",
      document: lead?.document ?? "",
      segment: lead?.segment ?? "",
      position: lead?.position ?? "",
      email: lead?.email ?? "",
      phone: lead?.phone ?? "",
      whatsapp: lead?.whatsapp ?? "",
      site: lead?.site ?? "",
      postalCode: lead?.postalCode ?? "",
      street: lead?.street ?? "",
      number: lead?.number ?? "",
      district: lead?.district ?? "",
      city: lead?.city ?? "",
      state: lead?.state ?? "",
      source: lead?.source ?? "",
      campaign: lead?.campaign ?? "",
      responsible: lead?.responsible ?? "",
      interest: lead?.interest ?? "",
      productInterest: lead?.productInterest ?? "",
      estimatedValue: numberToCurrencyInput(lead?.estimatedValue),
      observations: lead?.observations ?? "",
      score: lead?.score ?? "WARM",
      priority: lead?.priority ?? "MEDIUM",
      status: lead?.status ?? "NEW",
      stage: lead?.stage ?? "LEAD_RECEIVED",
      lostReason: lead?.lostReason ?? "",
      lastInteractionAt: lead?.lastInteractionAt ?? "",
      nextFollowUpAt: lead?.nextFollowUpAt ?? ""
    }
  });
  return (
    <form className="space-y-5" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <section className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-300"><span>Nome</span><Input {...register("name")} /><FieldError message={errors.name?.message} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Empresa</span><Input {...register("company")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>CNPJ</span><Input {...register("document")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Segmento</span><Input {...register("segment")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Cargo</span><Input {...register("position")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>E-mail</span><Input {...register("email")} /><FieldError message={errors.email?.message} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Telefone</span><Input {...register("phone")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>WhatsApp</span><Input {...register("whatsapp")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Site</span><Input {...register("site")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>CEP</span><Input {...register("postalCode")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Logradouro</span><Input {...register("street")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Numero</span><Input {...register("number")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Bairro</span><Input {...register("district")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Cidade</span><Input {...register("city")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Estado</span><Input {...register("state")} /></label>
      </section>
      <section className="grid gap-3 md:grid-cols-3">
        <label className="space-y-1 text-sm text-slate-300"><span>Origem</span><Input {...register("source")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Campanha</span><Input {...register("campaign")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Responsavel</span><Input {...register("responsible")} /><FieldError message={errors.responsible?.message} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Interesse</span><Input {...register("interest")} /></label>
        <label className="space-y-1 text-sm text-slate-300"><span>Produto</span><Input {...register("productInterest")} /></label>
        <Controller control={control} name="estimatedValue" render={({ field }) => <label className="space-y-1 text-sm text-slate-300"><span>Valor estimado</span><CurrencyInput value={String(field.value ?? "")} onChange={field.onChange} /></label>} />
        <SelectField label="Score" name="score" register={register} options={[{ value: "VERY_HOT", label: "Muito Quente" }, { value: "HOT", label: "Quente" }, { value: "WARM", label: "Morno" }, { value: "COLD", label: "Frio" }]} />
        <SelectField label="Prioridade" name="priority" register={register} options={[{ value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Media" }, { value: "HIGH", label: "Alta" }, { value: "URGENT", label: "Urgente" }]} />
        <SelectField label="Status" name="status" register={register} options={[{ value: "NEW", label: "Novo" }, { value: "IN_SERVICE", label: "Em Atendimento" }, { value: "QUALIFIED", label: "Qualificado" }, { value: "PROPOSAL_SENT", label: "Proposta Enviada" }, { value: "NEGOTIATION", label: "Negociacao" }, { value: "WON", label: "Fechado Ganho" }, { value: "LOST", label: "Fechado Perdido" }]} />
      </section>
      <label className="block space-y-1 text-sm text-slate-300"><span>Observacoes</span><Textarea {...register("observations")} /></label>
      <div className="flex justify-end gap-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar lead"}</Button></div>
    </form>
  );
}

export function ActivityForm({ leadId, onSave }: { leadId?: string; onSave: (input: ActivityFormInput) => Promise<void> }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<ActivityFormValues, unknown, ActivityFormInput>({ resolver: zodResolver(activityFormSchema), defaultValues: { leadId: leadId ?? "", type: "FOLLOW_UP", status: "PENDING", responsible: "", title: "" } });
  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <Input placeholder="Titulo" {...register("title")} />
      <Input placeholder="Responsavel" {...register("responsible")} />
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("type")}><option value="CALL">Ligacao</option><option value="MEETING">Reuniao</option><option value="VISIT">Visita</option><option value="DEMONSTRATION">Demonstracao</option><option value="FOLLOW_UP">Follow-up</option><option value="IMPLEMENTATION">Implantacao</option><option value="TRAINING">Treinamento</option><option value="WHATSAPP">WhatsApp</option><option value="EMAIL">E-mail</option><option value="NOTE">Observacao</option></select>
      <Button disabled={isSubmitting}>Criar atividade</Button>
    </form>
  );
}

export function ProposalForm({ leads, clients, onSave }: { leads: CrmLead[]; clients: Array<{ id: string; name: string }>; onSave: (input: ProposalFormInput) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<ProposalFormValues, unknown, ProposalFormInput>({ resolver: zodResolver(proposalFormSchema), defaultValues: { number: "", product: "", value: "", discount: "", status: "DRAFT" } });
  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <Input placeholder="Numero" {...register("number")} />
      <Input placeholder="Produto" {...register("product")} />
      <Controller control={control} name="value" render={({ field }) => <CurrencyInput placeholder="Valor" value={String(field.value ?? "")} onChange={field.onChange} />} />
      <Controller control={control} name="discount" render={({ field }) => <CurrencyInput placeholder="Desconto" value={String(field.value ?? "")} onChange={field.onChange} />} />
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("leadId")}><option value="">Lead</option>{leads.map((lead) => <option key={lead.id} value={lead.id}>{lead.name}</option>)}</select>
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("clientId")}><option value="">Cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("status")}><option value="DRAFT">Rascunho</option><option value="SENT">Enviada</option><option value="APPROVED">Aprovada</option><option value="REJECTED">Rejeitada</option></select>
      <Button disabled={isSubmitting}>Salvar proposta</Button>
    </form>
  );
}

export function ProjectForm({ clients, project, onSave }: { clients: Array<{ id: string; name: string }>; project?: CrmProject; onSave: (input: ProjectFormInput) => Promise<void> }) {
  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<ProjectFormValues, unknown, ProjectFormInput>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: { clientId: project?.client.id ?? "", name: project?.name ?? "", responsible: project?.responsible ?? "", teamText: project?.team.join(", ") ?? "", priority: project?.priority ?? "MEDIUM", status: project?.status ?? "NOT_STARTED", budget: numberToCurrencyInput(project?.budget), progress: project?.progress ?? 0, executedHours: Number(project?.executedHours ?? 0) }
  });
  return (
    <form className="grid gap-3 md:grid-cols-4" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("clientId")}><option value="">Cliente</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <Input placeholder="Projeto" {...register("name")} />
      <Input placeholder="Responsavel" {...register("responsible")} />
      <Input placeholder="Equipe separada por virgula" {...register("teamText")} />
      <Controller control={control} name="budget" render={({ field }) => <CurrencyInput placeholder="Orcamento" value={String(field.value ?? "")} onChange={field.onChange} />} />
      <Input type="number" step="0.01" placeholder="Horas previstas" {...register("plannedHours")} />
      <Input type="number" step="0.01" placeholder="Horas executadas" {...register("executedHours")} />
      <Input type="number" min={0} max={100} placeholder="Progresso" {...register("progress")} />
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("status")}><option value="NOT_STARTED">Nao Iniciado</option><option value="PLANNING">Planejamento</option><option value="IN_DEVELOPMENT">Em Desenvolvimento</option><option value="IN_TESTS">Em Testes</option><option value="IN_APPROVAL">Em Homologacao</option><option value="IN_DEPLOYMENT">Em Implantacao</option><option value="IN_TRAINING">Em Treinamento</option><option value="COMPLETED">Concluido</option><option value="CANCELLED">Cancelado</option></select>
      <Button disabled={isSubmitting}>Salvar projeto</Button>
    </form>
  );
}

export function AutomationForm({ onSave }: { onSave: (input: AutomationFormInput) => Promise<void> }) {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm<AutomationFormValues, unknown, AutomationFormInput>({ resolver: zodResolver(automationFormSchema), defaultValues: { name: "", trigger: "LEAD_CREATED", action: "CREATE_TASK", active: true } });
  return (
    <form className="grid gap-3 md:grid-cols-5" onSubmit={(event) => void handleSubmit(onSave)(event)}>
      <Input placeholder="Nome" {...register("name")} />
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("trigger")}><option value="LEAD_CREATED">Lead novo</option><option value="PROPOSAL_SENT">Proposta enviada</option><option value="SALE_COMPLETED">Venda concluida</option><option value="PROJECT_COMPLETED">Projeto concluido</option><option value="LEAD_IDLE">Lead parado</option></select>
      <select className="h-11 rounded-xl border border-slate-700 bg-sidebar px-3 text-sm" {...register("action")}><option value="CREATE_TASK">Criar tarefa</option><option value="CREATE_FOLLOW_UP">Criar follow-up</option><option value="CREATE_PROJECT">Criar projeto</option><option value="REQUEST_SURVEY">Solicitar pesquisa</option><option value="CREATE_ALERT">Criar alerta</option></select>
      <Input placeholder="Parametro" {...register("parameterKey")} />
      <Button disabled={isSubmitting}>Salvar automacao</Button>
    </form>
  );
}

export function CompactActivityList({ activities }: { activities: CrmActivity[] }) {
  return (
    <div className="space-y-3">
      {activities.map((activity) => (
        <article key={activity.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-sm font-medium">{activity.title}</p><p className="text-xs text-slate-400">{activity.responsible} - {activity.type}</p></div>
            <span className="rounded-full bg-blue-500/15 px-2 py-1 text-[11px] text-blue-300">{activity.status}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ProposalList({ proposals }: { proposals: CrmProposal[] }) {
  return <div className="space-y-3">{proposals.map((proposal) => <article key={proposal.id} className="rounded-xl border border-slate-700 bg-sidebar p-3"><p className="font-medium">{proposal.number} - {proposal.product}</p><p className="text-sm text-slate-400">{proposal.status} - versao {proposal.version}</p></article>)}</div>;
}

export function AutomationList({ automations }: { automations: CrmAutomation[] }) {
  return <div className="space-y-3">{automations.map((automation) => <article key={automation.id} className="rounded-xl border border-slate-700 bg-sidebar p-3"><p className="font-medium">{automation.name}</p><p className="text-sm text-slate-400">{automation.trigger} - {automation.action} - {automation.active ? "Ativa" : "Inativa"}</p></article>)}</div>;
}
