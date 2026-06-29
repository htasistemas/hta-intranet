import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useState } from "react";
import { Controller, useForm, type Path, type SubmitErrorHandler, type UseFormRegister } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";
import { cn } from "@/lib/utils";
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

function FormSection({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-700/70 bg-sidebar/60 p-4">
      <div className="mb-4 flex flex-col gap-1 border-b border-slate-700/60 pb-3">
        <h3 className="text-sm font-semibold text-slate-100">{title}</h3>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}

type LeadTabId = "identity" | "contact" | "address" | "commercial" | "notes";

const leadTabs: Array<{ id: LeadTabId; label: string }> = [
  { id: "identity", label: "Identificacao" },
  { id: "contact", label: "Contato" },
  { id: "address", label: "Endereco" },
  { id: "commercial", label: "Comercial" },
  { id: "notes", label: "Observacoes" }
];

const leadFieldTabs: Partial<Record<keyof LeadFormValues, LeadTabId>> = {
  name: "identity",
  company: "identity",
  document: "identity",
  segment: "identity",
  position: "commercial",
  email: "contact",
  phone: "contact",
  whatsapp: "contact",
  site: "contact",
  postalCode: "address",
  street: "address",
  number: "address",
  district: "address",
  city: "address",
  state: "address",
  source: "commercial",
  campaign: "commercial",
  responsible: "commercial",
  interest: "commercial",
  productInterest: "commercial",
  estimatedValue: "commercial",
  observations: "notes",
  score: "identity",
  priority: "identity",
  status: "identity",
  stage: "commercial",
  lostReason: "notes",
  lastInteractionAt: "commercial",
  nextFollowUpAt: "commercial"
};

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function maskCnpj(value: string): string {
  const digits = onlyDigits(value).slice(0, 14);
  return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
}

function maskCep(value: string): string {
  return onlyDigits(value).slice(0, 8).replace(/(\d{5})(\d)/, "$1-$2");
}

function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function dateInput(value: string | null | undefined): string {
  return value?.slice(0, 10) ?? "";
}

interface CepLookup {
  postalCode: string;
  street: string;
  district: string;
  city: string;
  state: string;
}

interface CnpjLookup extends CepLookup {
  document: string;
  name: string;
  legalName: string;
  email: string;
  phone: string;
  number: string;
  segment: string;
  openingDate: string;
}

async function lookupLeadCep(cep: string): Promise<CepLookup> {
  return api.get<CepLookup>(`/lookup/cep/${onlyDigits(cep)}`);
}

async function lookupLeadCnpj(cnpj: string): Promise<CnpjLookup> {
  return api.get<CnpjLookup>(`/lookup/cnpj/${onlyDigits(cnpj)}`);
}

export function LeadForm({ lead, onCancel, onSave }: { lead?: CrmLead; onCancel: () => void; onSave: (input: LeadFormInput) => Promise<void> }) {
  const [activeTab, setActiveTab] = useState<LeadTabId>("identity");
  const { toast } = useToast();
  const { register, control, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<LeadFormValues, unknown, LeadFormInput>({
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
      lastInteractionAt: dateInput(lead?.lastInteractionAt),
      nextFollowUpAt: dateInput(lead?.nextFollowUpAt)
    }
  });

  const cepLookup = useMutation({
    mutationFn: lookupLeadCep,
    onSuccess: (data) => {
      setValue("postalCode", maskCep(data.postalCode));
      setValue("street", data.street);
      setValue("district", data.district);
      setValue("city", data.city);
      setValue("state", data.state);
      toast("Endereco preenchido pelo CEP.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const cnpjLookup = useMutation({
    mutationFn: lookupLeadCnpj,
    onSuccess: (data) => {
      setValue("document", maskCnpj(data.document));
      setValue("name", data.name || data.legalName);
      setValue("company", data.legalName);
      setValue("email", data.email);
      setValue("phone", maskPhone(data.phone));
      setValue("postalCode", maskCep(data.postalCode));
      setValue("street", data.street);
      setValue("number", data.number);
      setValue("district", data.district);
      setValue("city", data.city);
      setValue("state", data.state);
      setValue("segment", data.segment);
      toast("Captacao preenchida pelo CNPJ.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const handleInvalid: SubmitErrorHandler<LeadFormValues> = (validationErrors) => {
    const firstField = Object.keys(validationErrors)[0] as keyof LeadFormValues | undefined;
    if (firstField) setActiveTab(leadFieldTabs[firstField] ?? "identity");
    toast("Revise os campos destacados antes de salvar.", "error");
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(onSave, handleInvalid)(event)}>
      <header className="rounded-xl border border-slate-700 bg-sidebar p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500">{lead ? "Edicao de captacao" : "Nova captacao"}</p>
            <h2 className="mt-1 text-lg font-semibold">{getValues("name") || "Possivel cliente"}</h2>
            <p className="mt-1 text-sm text-slate-400">{String(getValues("company") || "Cadastro comercial para prospeccao")}</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <SelectField label="Status" name="status" register={register} options={[{ value: "NEW", label: "Novo" }, { value: "IN_SERVICE", label: "Em Atendimento" }, { value: "QUALIFIED", label: "Qualificado" }, { value: "PROPOSAL_SENT", label: "Proposta Enviada" }, { value: "NEGOTIATION", label: "Negociacao" }, { value: "WON", label: "Fechado Ganho" }, { value: "LOST", label: "Fechado Perdido" }]} />
            <SelectField label="Temperatura" name="score" register={register} options={[{ value: "VERY_HOT", label: "Muito Quente" }, { value: "HOT", label: "Quente" }, { value: "WARM", label: "Morno" }, { value: "COLD", label: "Frio" }]} />
            <SelectField label="Prioridade" name="priority" register={register} options={[{ value: "LOW", label: "Baixa" }, { value: "MEDIUM", label: "Media" }, { value: "HIGH", label: "Alta" }, { value: "URGENT", label: "Urgente" }]} />
          </div>
        </div>
      </header>

      <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-700 pb-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
          {leadTabs.map((tab) => (
            <button key={tab.id} type="button" className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5", activeTab === tab.id && "bg-accent/10 text-accent")} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          {activeTab === "identity" && (
            <fieldset className="grid gap-4 md:grid-cols-3">
              <label className="md:col-span-2">Razao social<Input placeholder="Nome juridico da instituicao" {...register("company")} /></label>
              <label>Nome fantasia / Sigla<Input placeholder="Ex: AMPLIT" {...register("name")} /><FieldError message={errors.name?.message} /></label>
              <label>CNPJ<Controller control={control} name="document" render={({ field }) => <div className="flex gap-2"><Input value={maskCnpj(String(field.value ?? ""))} onChange={(event) => field.onChange(maskCnpj(event.target.value))} placeholder="00.000.000/0000-00" /><Button type="button" variant="outline" onClick={() => cnpjLookup.mutate(String(field.value ?? ""))} disabled={cnpjLookup.isPending}>Buscar</Button></div>} /></label>
              <label>Segmento / Area principal<Input placeholder="Assistencia social, educacao..." {...register("segment")} /></label>
            </fieldset>
          )}

          {activeTab === "contact" && (
            <fieldset className="grid gap-4 md:grid-cols-3">
              <label>E-mail<Input type="email" placeholder="contato@instituicao.org.br" {...register("email")} /><FieldError message={errors.email?.message} /></label>
              <Controller control={control} name="phone" render={({ field }) => <label>Telefone<Input value={maskPhone(String(field.value ?? ""))} onChange={(event) => field.onChange(maskPhone(event.target.value))} placeholder="(00) 0000-0000" /></label>} />
              <Controller control={control} name="whatsapp" render={({ field }) => <label>WhatsApp<Input value={maskPhone(String(field.value ?? ""))} onChange={(event) => field.onChange(maskPhone(event.target.value))} placeholder="(00) 00000-0000" /></label>} />
              <label className="md:col-span-3">Site / Instagram<Input placeholder="https://..." {...register("site")} /></label>
            </fieldset>
          )}

          {activeTab === "address" && (
            <fieldset className="grid gap-4 md:grid-cols-4">
              <Controller control={control} name="postalCode" render={({ field }) => <label>CEP<div className="flex gap-2"><Input value={maskCep(String(field.value ?? ""))} onChange={(event) => field.onChange(maskCep(event.target.value))} /><Button type="button" variant="outline" onClick={() => cepLookup.mutate(String(getValues("postalCode") ?? ""))} disabled={cepLookup.isPending}>Buscar</Button></div></label>} />
              <label className="md:col-span-2">Logradouro<Input {...register("street")} /></label>
              <label>Numero<Input {...register("number")} /></label>
              <label>Bairro<Input {...register("district")} /></label>
              <label className="md:col-span-2">Cidade<Input {...register("city")} /></label>
              <label>UF<Input maxLength={2} {...register("state")} /></label>
            </fieldset>
          )}

          {activeTab === "commercial" && (
            <fieldset className="grid gap-4 md:grid-cols-3">
              <label>Responsavel interno<Input placeholder="Consultor responsavel" {...register("responsible")} /><FieldError message={errors.responsible?.message} /></label>
              <label>Origem<Input placeholder="Mapa OSC, evento, indicacao..." {...register("source")} /></label>
              <label>Campanha<Input placeholder="OSC MG 2026" {...register("campaign")} /></label>
              <label>Contato decisor / Cargo<Input placeholder="Presidente, diretor, coordenador..." {...register("position")} /></label>
              <label>Dor / Interesse<Input placeholder="Gestao, captacao, portal, atendimento..." {...register("interest")} /></label>
              <label>Produto de interesse<Input placeholder="Sistema, consultoria, projeto..." {...register("productInterest")} /></label>
              <Controller control={control} name="estimatedValue" render={({ field }) => <label>Valor estimado<CurrencyInput value={String(field.value ?? "")} onChange={field.onChange} /></label>} />
              <label>Etapa<select className={selectClass} {...register("stage")}><option value="LEAD_RECEIVED">Lead recebido</option><option value="FIRST_CONTACT">Primeiro contato</option><option value="QUALIFICATION">Qualificacao</option><option value="DEMONSTRATION">Demonstracao</option><option value="PROPOSAL_SENT">Proposta enviada</option><option value="NEGOTIATION">Negociacao</option><option value="APPROVAL">Aprovacao</option><option value="IMPLEMENTATION">Implantacao</option><option value="SALE_COMPLETED">Venda concluida</option><option value="LOST">Perdido</option></select></label>
              <label>Ultima interacao<Input type="date" {...register("lastInteractionAt")} /></label>
              <label>Proximo follow-up<Input type="date" {...register("nextFollowUpAt")} /></label>
            </fieldset>
          )}

          {activeTab === "notes" && (
            <fieldset className="grid gap-4">
              <label>Motivo de perda<Input {...register("lostReason")} /></label>
              <label>Observacoes<Textarea className="min-h-56" {...register("observations")} /></label>
            </fieldset>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">{lead ? "Atualize os dados e salve a captacao." : "Preencha os dados principais para criar a captacao."}</p>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar captacao"}</Button>
        </div>
      </div>
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
