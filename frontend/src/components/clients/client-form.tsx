import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Category, Client, PageResult, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";
import { cn } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  document: z.string(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  internalCode: z.string(),
  legalName: z.string(),
  tradeName: z.string(),
  stateRegistration: z.string(),
  municipalRegistration: z.string(),
  openingDate: z.string(),
  birthDate: z.string(),
  gender: z.string(),
  phone: z.string(),
  whatsapp: z.string(),
  email: z.string().email("Email invalido.").or(z.literal("")),
  postalCode: z.string(),
  street: z.string(),
  number: z.string(),
  district: z.string(),
  city: z.string(),
  state: z.string(),
  observations: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]),
  source: z.string(),
  segment: z.string(),
  companySize: z.string(),
  responsible: z.string(),
  priority: z.string(),
  temperature: z.string(),
  firstPurchaseAt: z.string(),
  lastPurchaseAt: z.string(),
  nextFollowUpAt: z.string(),
  categoryId: z.string(),
  expectedValue: z.string(),
  averageTicket: z.string(),
  purchasePotential: z.string(),
  creditLimit: z.string(),
  paymentTerms: z.string(),
  preferredPaymentMethod: z.string(),
  billingDay: z.string(),
  financialStatus: z.string(),
  financialNotes: z.string(),
  allowEmailMarketing: z.boolean(),
  allowWhatsapp: z.boolean(),
  allowCalls: z.boolean(),
  consentDate: z.string(),
  projectIds: z.array(z.string())
});

type Fields = z.infer<typeof schema>;
type TabId = "identity" | "contact" | "address" | "commercial" | "financial" | "projects" | "lgpd";

const defaults: Fields = {
  name: "",
  document: "",
  type: "INDIVIDUAL",
  internalCode: "",
  legalName: "",
  tradeName: "",
  stateRegistration: "",
  municipalRegistration: "",
  openingDate: "",
  birthDate: "",
  gender: "",
  phone: "",
  whatsapp: "",
  email: "",
  postalCode: "",
  street: "",
  number: "",
  district: "",
  city: "",
  state: "",
  observations: "",
  status: "PROSPECT",
  source: "",
  segment: "",
  companySize: "",
  responsible: "",
  priority: "MEDIUM",
  temperature: "WARM",
  firstPurchaseAt: "",
  lastPurchaseAt: "",
  nextFollowUpAt: "",
  categoryId: "",
  expectedValue: "",
  averageTicket: "",
  purchasePotential: "",
  creditLimit: "",
  paymentTerms: "",
  preferredPaymentMethod: "",
  billingDay: "",
  financialStatus: "REGULAR",
  financialNotes: "",
  allowEmailMarketing: false,
  allowWhatsapp: false,
  allowCalls: false,
  consentDate: "",
  projectIds: []
};

const tabs: Array<{ id: TabId; label: string }> = [
  { id: "identity", label: "Identificacao" },
  { id: "contact", label: "Contato" },
  { id: "address", label: "Endereco" },
  { id: "commercial", label: "Comercial" },
  { id: "financial", label: "Financeiro" },
  { id: "projects", label: "Projetos" },
  { id: "lgpd", label: "LGPD" }
];

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function maskCpf(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  return digits.replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d)/, "$1.$2").replace(/(\d{3})(\d{1,2})$/, "$1-$2");
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

function dateOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
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

interface ViaCepResponse {
  cep: string;
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
}

interface BrasilApiCnpjResponse {
  cnpj: string;
  razao_social?: string;
  nome_fantasia?: string;
  descricao_tipo_logradouro?: string;
  logradouro?: string;
  numero?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cep?: string;
  email?: string;
  ddd_telefone_1?: string;
  cnae_fiscal_descricao?: string;
  data_inicio_atividade?: string;
}

async function fetchWithTimeout<T>(url: string): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error("Consulta externa indisponivel.");
    return await response.json() as T;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function lookupCep(cep: string): Promise<CepLookup> {
  const digits = onlyDigits(cep);
  try {
    return await api.get<CepLookup>(`/lookup/cep/${digits}`);
  } catch {
    const data = await fetchWithTimeout<ViaCepResponse>(`https://viacep.com.br/ws/${digits}/json/`);
    if (data.erro) throw new Error("CEP nao encontrado.");
    return {
      postalCode: data.cep,
      street: data.logradouro ?? "",
      district: data.bairro ?? "",
      city: data.localidade ?? "",
      state: data.uf ?? ""
    };
  }
}

async function lookupCnpj(cnpj: string): Promise<CnpjLookup> {
  const digits = onlyDigits(cnpj);
  try {
    return await api.get<CnpjLookup>(`/lookup/cnpj/${digits}`);
  } catch {
    const data = await fetchWithTimeout<BrasilApiCnpjResponse>(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
    return {
      document: data.cnpj,
      name: data.nome_fantasia || data.razao_social || "",
      legalName: data.razao_social ?? "",
      email: data.email ?? "",
      phone: data.ddd_telefone_1 ?? "",
      postalCode: data.cep ?? "",
      street: [data.descricao_tipo_logradouro, data.logradouro].filter(Boolean).join(" "),
      number: data.numero ?? "",
      district: data.bairro ?? "",
      city: data.municipio ?? "",
      state: data.uf ?? "",
      segment: data.cnae_fiscal_descricao ?? "",
      openingDate: data.data_inicio_atividade ?? ""
    };
  }
}

function clientValues(client?: Client): Fields {
  if (!client) return defaults;
  return {
    ...defaults,
    name: client.name,
    document: client.document ?? "",
    type: client.type,
    internalCode: client.internalCode ?? "",
    legalName: client.legalName ?? "",
    tradeName: client.tradeName ?? "",
    stateRegistration: client.stateRegistration ?? "",
    municipalRegistration: client.municipalRegistration ?? "",
    openingDate: client.openingDate?.slice(0, 10) ?? "",
    birthDate: client.birthDate?.slice(0, 10) ?? "",
    gender: client.gender ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    whatsapp: client.whatsapp ?? "",
    postalCode: client.postalCode ?? "",
    street: client.street ?? "",
    number: client.number ?? "",
    district: client.district ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    observations: client.observations ?? "",
    status: client.status,
    source: client.source ?? "",
    segment: client.segment ?? "",
    companySize: client.companySize ?? "",
    responsible: client.responsible ?? "",
    priority: client.priority ?? "MEDIUM",
    temperature: client.temperature ?? "WARM",
    firstPurchaseAt: client.firstPurchaseAt?.slice(0, 10) ?? "",
    lastPurchaseAt: client.lastPurchaseAt?.slice(0, 10) ?? "",
    nextFollowUpAt: client.nextFollowUpAt?.slice(0, 10) ?? "",
    categoryId: client.category?.id ?? "",
    expectedValue: numberToCurrencyInput(client.expectedValue),
    averageTicket: numberToCurrencyInput(client.averageTicket),
    purchasePotential: numberToCurrencyInput(client.purchasePotential),
    creditLimit: numberToCurrencyInput(client.creditLimit),
    paymentTerms: client.paymentTerms ?? "",
    preferredPaymentMethod: client.preferredPaymentMethod ?? "",
    billingDay: client.billingDay ? String(client.billingDay) : "",
    financialStatus: client.financialStatus ?? "REGULAR",
    financialNotes: client.financialNotes ?? "",
    allowEmailMarketing: client.allowEmailMarketing ?? false,
    allowWhatsapp: client.allowWhatsapp ?? false,
    allowCalls: client.allowCalls ?? false,
    consentDate: client.consentDate?.slice(0, 10) ?? "",
    projectIds: client.projectLinks?.map((link) => link.project.id) ?? []
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="text-red-400">{message}</small> : null;
}

export function ClientForm({ client, onSave, onCancel }: { client?: Client; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const { toast } = useToast();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
  const { data: projectsResult } = useQuery({ queryKey: ["projects", "client-form"], queryFn: () => api.get<PageResult<Project>>("/projects?pageSize=100") });
  const projects = projectsResult?.data ?? [];
  const values = useMemo(() => clientValues(client), [client]);
  const { register, control, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<Fields>({ resolver: zodResolver(schema), values });
  const type = useWatch({ control, name: "type" });
  const isCompany = type === "COMPANY";

  const cepLookup = useMutation({
    mutationFn: lookupCep,
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
    mutationFn: lookupCnpj,
    onSuccess: (data) => {
      setValue("document", maskCnpj(data.document));
      setValue("name", data.name || data.legalName);
      setValue("legalName", data.legalName);
      setValue("tradeName", data.name);
      setValue("email", data.email);
      setValue("phone", maskPhone(data.phone));
      setValue("postalCode", maskCep(data.postalCode));
      setValue("street", data.street);
      setValue("number", data.number);
      setValue("district", data.district);
      setValue("city", data.city);
      setValue("state", data.state);
      setValue("segment", data.segment);
      setValue("openingDate", data.openingDate);
      toast("Empresa preenchida pelo CNPJ.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const submit = async (fields: Fields): Promise<void> => {
    await onSave({
      ...fields,
      birthDate: isCompany ? null : dateOrNull(fields.birthDate),
      openingDate: isCompany ? dateOrNull(fields.openingDate) : null,
      gender: isCompany ? null : fields.gender,
      firstPurchaseAt: dateOrNull(fields.firstPurchaseAt),
      lastPurchaseAt: dateOrNull(fields.lastPurchaseAt),
      nextFollowUpAt: dateOrNull(fields.nextFollowUpAt),
      consentDate: dateOrNull(fields.consentDate),
      expectedValue: currencyInputToNumber(fields.expectedValue),
      averageTicket: currencyInputToNumber(fields.averageTicket),
      purchasePotential: currencyInputToNumber(fields.purchasePotential),
      creditLimit: currencyInputToNumber(fields.creditLimit),
      billingDay: fields.billingDay ? Number(fields.billingDay) : null,
      tagIds: []
    });
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(submit)(event)}>
      <header className="rounded-xl border border-slate-700 bg-sidebar p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase text-slate-500">{isCompany ? "Empresa" : "Pessoa fisica"}</p>
            <h2 className="mt-1 text-lg font-semibold">{getValues("name") || "Novo cliente"}</h2>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <label className="text-xs text-slate-400">Status<select className={selectClass} {...register("status")}><option value="PROSPECT">Prospect</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></label>
            <label className="text-xs text-slate-400">Prioridade<select className={selectClass} {...register("priority")}><option value="LOW">Baixa</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
            <label className="text-xs text-slate-400">Temperatura<select className={selectClass} {...register("temperature")}><option value="COLD">Frio</option><option value="WARM">Morno</option><option value="HOT">Quente</option><option value="VERY_HOT">Muito quente</option></select></label>
          </div>
        </div>
      </header>

      <nav className="flex gap-2 overflow-x-auto border-b border-slate-700 pb-2">
        {tabs.map((tab) => (
          <button key={tab.id} type="button" className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-sm text-slate-400 transition hover:bg-white/5", activeTab === tab.id && "bg-accent/10 text-accent")} onClick={() => setActiveTab(tab.id)}>
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === "identity" && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <label>Tipo<select className={selectClass} {...register("type")}><option value="INDIVIDUAL">Pessoa fisica</option><option value="COMPANY">Empresa</option></select></label>
          <label>Codigo interno<Input placeholder="CLI-0001" {...register("internalCode")} /></label>
          <label>{isCompany ? "CNPJ" : "CPF"}<Controller control={control} name="document" render={({ field }) => <div className="flex gap-2"><Input value={isCompany ? maskCnpj(field.value) : maskCpf(field.value)} onChange={(event) => field.onChange(isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))} />{isCompany && <Button type="button" variant="outline" onClick={() => cnpjLookup.mutate(field.value)} disabled={cnpjLookup.isPending}>Buscar</Button>}</div>} /></label>
          <label className="md:col-span-2">{isCompany ? "Nome fantasia / Nome exibido" : "Nome completo"}<Input {...register("name")} /><FieldError message={errors.name?.message} /></label>
          {isCompany ? (
            <>
              <label>Razao social<Input {...register("legalName")} /></label>
              <label>Nome fantasia<Input {...register("tradeName")} /></label>
              <label>Data de abertura<Input type="date" {...register("openingDate")} /></label>
              <label>Inscricao estadual<Input {...register("stateRegistration")} /></label>
              <label>Inscricao municipal<Input {...register("municipalRegistration")} /></label>
              <label>Porte<select className={selectClass} {...register("companySize")}><option value="">Selecione</option><option value="MEI">MEI</option><option value="MICRO">Microempresa</option><option value="SMALL">Pequena empresa</option><option value="MEDIUM">Media empresa</option><option value="LARGE">Grande empresa</option></select></label>
            </>
          ) : (
            <>
              <label>Nascimento<Input type="date" {...register("birthDate")} /></label>
              <label>Sexo<select className={selectClass} {...register("gender")}><option value="">Selecione</option><option value="FEMALE">Feminino</option><option value="MALE">Masculino</option><option value="NON_BINARY">Nao binario</option><option value="NOT_INFORMED">Prefiro nao informar</option></select></label>
            </>
          )}
        </fieldset>
      )}

      {activeTab === "contact" && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <Controller control={control} name="phone" render={({ field }) => <label>Telefone<Input value={maskPhone(field.value)} onChange={(event) => field.onChange(maskPhone(event.target.value))} /></label>} />
          <Controller control={control} name="whatsapp" render={({ field }) => <label>WhatsApp<Input value={maskPhone(field.value)} onChange={(event) => field.onChange(maskPhone(event.target.value))} /></label>} />
          <label>Email<Input type="email" {...register("email")} /><FieldError message={errors.email?.message} /></label>
        </fieldset>
      )}

      {activeTab === "address" && (
        <fieldset className="grid gap-4 md:grid-cols-4">
          <Controller control={control} name="postalCode" render={({ field }) => <label>CEP<div className="flex gap-2"><Input value={maskCep(field.value)} onChange={(event) => field.onChange(maskCep(event.target.value))} /><Button type="button" variant="outline" onClick={() => cepLookup.mutate(getValues("postalCode"))} disabled={cepLookup.isPending}>Buscar</Button></div></label>} />
          <label className="md:col-span-2">Logradouro<Input {...register("street")} /></label>
          <label>Numero<Input {...register("number")} /></label>
          <label>Bairro<Input {...register("district")} /></label>
          <label className="md:col-span-2">Cidade<Input {...register("city")} /></label>
          <label>Estado<Input maxLength={2} {...register("state")} /></label>
        </fieldset>
      )}

      {activeTab === "commercial" && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <label>Categoria<select className={selectClass} {...register("categoryId")}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
          <label>Origem<Input placeholder="Site, indicacao, campanha..." {...register("source")} /></label>
          <label>Responsavel<Input {...register("responsible")} /></label>
          <label>Segmento<Input {...register("segment")} /></label>
          <Controller control={control} name="expectedValue" render={({ field }) => <label>Receita prevista<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
          <Controller control={control} name="averageTicket" render={({ field }) => <label>Ticket medio<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
          <Controller control={control} name="purchasePotential" render={({ field }) => <label>Potencial de compra<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
          <label>Primeira compra<Input type="date" {...register("firstPurchaseAt")} /></label>
          <label>Ultima compra<Input type="date" {...register("lastPurchaseAt")} /></label>
          <label>Proximo follow-up<Input type="date" {...register("nextFollowUpAt")} /></label>
          <label className="md:col-span-3">Observacoes<Textarea {...register("observations")} /></label>
        </fieldset>
      )}

      {activeTab === "financial" && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <Controller control={control} name="creditLimit" render={({ field }) => <label>Limite de credito<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
          <label>Condicao de pagamento<Input placeholder="Ex: 30 dias, 2x boleto" {...register("paymentTerms")} /></label>
          <label>Forma preferencial<select className={selectClass} {...register("preferredPaymentMethod")}><option value="">Selecione</option><option value="PIX">PIX</option><option value="BOLETO">Boleto</option><option value="CREDIT_CARD">Cartao de credito</option><option value="TRANSFER">Transferencia</option></select></label>
          <label>Dia de vencimento<Input type="number" min={1} max={31} {...register("billingDay")} /></label>
          <label>Status financeiro<select className={selectClass} {...register("financialStatus")}><option value="REGULAR">Regular</option><option value="OVERDUE">Em atraso</option><option value="BLOCKED">Bloqueado</option><option value="REVIEW">Em analise</option></select></label>
          <label className="md:col-span-3">Observacoes financeiras<Textarea {...register("financialNotes")} /></label>
        </fieldset>
      )}

      {activeTab === "projects" && (
        <fieldset className="grid gap-4">
          <label>Vincular a projetos<select multiple className="min-h-56 w-full rounded-xl border border-slate-700 bg-sidebar px-3 py-2 text-sm" {...register("projectIds")}>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}</select></label>
        </fieldset>
      )}

      {activeTab === "lgpd" && (
        <fieldset className="grid gap-4 md:grid-cols-2">
          <label>Data do consentimento<Input type="date" {...register("consentDate")} /></label>
          <div className="rounded-xl border border-slate-700 bg-sidebar p-4">
            <p className="mb-3 text-sm font-medium">Preferencias de comunicacao</p>
            <label className="mb-3 flex items-center gap-3 text-sm"><input type="checkbox" {...register("allowEmailMarketing")} /> Permite e-mail marketing</label>
            <label className="mb-3 flex items-center gap-3 text-sm"><input type="checkbox" {...register("allowWhatsapp")} /> Permite WhatsApp</label>
            <label className="flex items-center gap-3 text-sm"><input type="checkbox" {...register("allowCalls")} /> Permite ligacao</label>
          </div>
        </fieldset>
      )}

      <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar cliente"}</Button></div>
    </form>
  );
}
