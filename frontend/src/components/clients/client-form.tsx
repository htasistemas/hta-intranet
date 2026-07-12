import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Controller, useForm, useWatch, type SubmitErrorHandler } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Category, Client, PageResult, ProductService, Project } from "@/types";
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
  projectIds: z.array(z.string()),
  productIds: z.array(z.string())
}).superRefine((fields, context) => {
  const documentDigits = onlyDigits(fields.document);
  if (documentDigits.length > 0) {
    const validDocument = fields.type === "COMPANY" ? isValidCnpj(documentDigits) : isValidCpf(documentDigits);
    if (!validDocument) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: fields.type === "COMPANY" ? "Informe um CNPJ valido." : "Informe um CPF valido.",
        path: ["document"]
      });
    }
  }

  const hasContact = Boolean(fields.email.trim() || onlyDigits(fields.phone) || onlyDigits(fields.whatsapp));
  if (!hasContact) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Informe email, telefone ou WhatsApp.",
      path: ["email"]
    });
  }
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
  status: "ACTIVE",
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
  projectIds: [],
  productIds: []
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

const fieldTabs: Partial<Record<keyof Fields, TabId>> = {
  name: "identity",
  document: "identity",
  type: "identity",
  internalCode: "identity",
  legalName: "identity",
  tradeName: "identity",
  stateRegistration: "identity",
  municipalRegistration: "identity",
  openingDate: "identity",
  birthDate: "identity",
  gender: "identity",
  phone: "contact",
  whatsapp: "contact",
  email: "contact",
  postalCode: "address",
  street: "address",
  number: "address",
  district: "address",
  city: "address",
  state: "address",
  observations: "commercial",
  status: "identity",
  source: "commercial",
  segment: "commercial",
  companySize: "identity",
  responsible: "commercial",
  priority: "identity",
  temperature: "identity",
  firstPurchaseAt: "commercial",
  lastPurchaseAt: "commercial",
  nextFollowUpAt: "commercial",
  categoryId: "commercial",
  expectedValue: "commercial",
  averageTicket: "commercial",
  purchasePotential: "commercial",
  creditLimit: "financial",
  paymentTerms: "financial",
  preferredPaymentMethod: "financial",
  billingDay: "financial",
  financialStatus: "financial",
  financialNotes: "financial",
  allowEmailMarketing: "lgpd",
  allowWhatsapp: "lgpd",
  allowCalls: "lgpd",
  consentDate: "lgpd",
  projectIds: "projects",
  productIds: "projects"
};

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isRepeatedDigits(value: string): boolean {
  return /^(\d)\1+$/.test(value);
}

function calculateCpfDigit(numbers: number[], factor: number): number {
  const total = numbers.reduce((sum, number) => sum + number * factor--, 0);
  const digit = 11 - (total % 11);
  return digit >= 10 ? 0 : digit;
}

function isValidCpf(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 11 || isRepeatedDigits(digits)) return false;
  const numbers = digits.split("").map(Number);
  const firstDigit = calculateCpfDigit(numbers.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit([...numbers.slice(0, 9), firstDigit], 11);
  return firstDigit === numbers[9] && secondDigit === numbers[10];
}

function calculateCnpjDigit(numbers: number[], factors: number[]): number {
  const total = numbers.reduce((sum, number, index) => sum + number * (factors[index] ?? 0), 0);
  const remainder = total % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

function isValidCnpj(value: string): boolean {
  const digits = onlyDigits(value);
  if (digits.length !== 14 || isRepeatedDigits(digits)) return false;
  const numbers = digits.split("").map(Number);
  const firstDigit = calculateCnpjDigit(numbers.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit([...numbers.slice(0, 12), firstDigit], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return firstDigit === numbers[12] && secondDigit === numbers[13];
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

const lowercaseTitleWords = new Set(["a", "as", "da", "das", "de", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "para", "por"]);

function collapseSpaces(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function capitalizePart(value: string): string {
  const lower = value.toLocaleLowerCase("pt-BR");
  return lower.replace(/^\p{L}/u, (letter) => letter.toLocaleUpperCase("pt-BR"));
}

function toTitleText(value: string): string {
  return collapseSpaces(value)
    .split(" ")
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && lowercaseTitleWords.has(lower)) return lower;
      return word.split("-").map(capitalizePart).join("-");
    })
    .join(" ");
}

function optionalTitle(value: string): string | null {
  const trimmed = collapseSpaces(value);
  return trimmed ? toTitleText(trimmed) : null;
}

function optionalUpper(value: string): string | null {
  const trimmed = collapseSpaces(value);
  return trimmed ? trimmed.toLocaleUpperCase("pt-BR") : null;
}

function optionalLower(value: string): string | null {
  const trimmed = collapseSpaces(value);
  return trimmed ? trimmed.toLocaleLowerCase("pt-BR") : null;
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
  if (digits.length !== 8) throw new Error("Informe um CEP completo.");
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
  if (digits.length !== 14) throw new Error("Informe um CNPJ completo.");
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
    projectIds: client.projectLinks?.map((link) => link.project.id) ?? [],
    productIds: client.products?.map((link) => link.product.id) ?? []
  };
}

function FieldError({ message }: { message?: string }) {
  return message ? <small className="text-red-400">{message}</small> : null;
}

function normalizeText(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function ProjectSelector({ projects, selectedIds, onChange }: { projects: Project[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [projectSearch, setProjectSearch] = useState("");
  const selectedProjects = projects.filter((project) => selectedIds.includes(project.id));
  const normalizedSearch = normalizeText(projectSearch);
  const filteredProjects = projects.filter((project) => normalizeText(`${project.code} ${project.name}`).includes(normalizedSearch));

  const toggleProject = (projectId: string): void => {
    if (selectedIds.includes(projectId)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== projectId));
      return;
    }
    onChange([...selectedIds, projectId]);
  };

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar projeto</span>
        <Search className="absolute left-3 top-3 text-slate-500" size={18} />
        <Input className="pl-10" value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="Buscar por codigo ou nome" />
      </label>
      {selectedProjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProjects.map((project) => (
            <button
              key={project.id}
              type="button"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs text-accent"
              onClick={() => toggleProject(project.id)}
            >
              <span className="truncate">{project.code} - {project.name}</span>
              <X size={14} aria-hidden="true" />
              <span className="sr-only">Remover projeto</span>
            </button>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-sidebar">
        {filteredProjects.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400">Nenhum projeto encontrado.</p>
        ) : filteredProjects.map((project) => (
          <label key={project.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-700/60 px-3 py-3 last:border-0 hover:bg-white/[.03]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-card accent-accent"
              checked={selectedIds.includes(project.id)}
              onChange={() => toggleProject(project.id)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{project.code} - {project.name}</span>
              <span className="block text-xs text-slate-400">{project.status}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function ProductSelector({ products, selectedIds, onChange }: { products: ProductService[]; selectedIds: string[]; onChange: (ids: string[]) => void }) {
  const [productSearch, setProductSearch] = useState("");
  const selectedProducts = products.filter((product) => selectedIds.includes(product.id));
  const normalizedSearch = normalizeText(productSearch);
  const filteredProducts = products.filter((product) => normalizeText(`${product.code} ${product.name} ${product.category ?? ""}`).includes(normalizedSearch));

  const toggleProduct = (productId: string): void => {
    if (selectedIds.includes(productId)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== productId));
      return;
    }
    onChange([...selectedIds, productId]);
  };

  return (
    <div className="space-y-3">
      <label className="relative block">
        <span className="sr-only">Buscar produto</span>
        <Search className="absolute left-3 top-3 text-slate-500" size={18} />
        <Input className="pl-10" value={productSearch} onChange={(event) => setProductSearch(event.target.value)} placeholder="Buscar por codigo, nome ou categoria" />
      </label>
      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedProducts.map((product) => (
            <button
              key={product.id}
              type="button"
              className="inline-flex max-w-full items-center gap-2 rounded-full border border-sky-400/30 bg-sky-400/10 px-3 py-1 text-xs text-sky-200"
              onClick={() => toggleProduct(product.id)}
            >
              <span className="truncate">{product.code} - {product.name}</span>
              <X size={14} aria-hidden="true" />
              <span className="sr-only">Remover produto</span>
            </button>
          ))}
        </div>
      )}
      <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-700 bg-sidebar">
        {filteredProducts.length === 0 ? (
          <p className="px-3 py-4 text-sm text-slate-400">Nenhum produto encontrado.</p>
        ) : filteredProducts.map((product) => (
          <label key={product.id} className="flex cursor-pointer items-start gap-3 border-b border-slate-700/60 px-3 py-3 last:border-0 hover:bg-white/[.03]">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-slate-600 bg-card accent-accent"
              checked={selectedIds.includes(product.id)}
              onChange={() => toggleProduct(product.id)}
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium">{product.code} - {product.name}</span>
              <span className="block text-xs text-slate-400">{[product.type, product.category].filter(Boolean).join(" / ")}</span>
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function ClientForm({ client, onSave, onCancel }: { client?: Client; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const [activeTab, setActiveTab] = useState<TabId>("identity");
  const { toast } = useToast();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: () => api.get<Category[]>("/categories") });
  const { data: projectsResult } = useQuery({ queryKey: ["projects", "client-form"], queryFn: () => api.get<PageResult<Project>>("/projects?pageSize=100") });
  const { data: productsResult } = useQuery({ queryKey: ["products", "client-form"], queryFn: () => api.get<PageResult<ProductService>>("/products?pageSize=100") });
  const projects = projectsResult?.data ?? [];
  const products = productsResult?.data ?? [];
  const values = useMemo(() => clientValues(client), [client]);
  const { register, control, handleSubmit, setValue, getValues, formState: { errors, isSubmitting } } = useForm<Fields>({ resolver: zodResolver(schema), values });
  const type = useWatch({ control, name: "type" });
  const isCompany = type === "COMPANY";

  const cepLookup = useMutation({
    mutationFn: lookupCep,
    onSuccess: (data) => {
      setValue("postalCode", maskCep(data.postalCode), { shouldValidate: true });
      setValue("street", data.street, { shouldValidate: true });
      setValue("district", data.district, { shouldValidate: true });
      setValue("city", data.city, { shouldValidate: true });
      setValue("state", data.state, { shouldValidate: true });
      toast("Endereco preenchido pelo CEP.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const cnpjLookup = useMutation({
    mutationFn: lookupCnpj,
    onSuccess: (data) => {
      setValue("document", maskCnpj(data.document), { shouldValidate: true });
      setValue("name", data.name || data.legalName, { shouldValidate: true });
      setValue("legalName", data.legalName, { shouldValidate: true });
      setValue("tradeName", data.name, { shouldValidate: true });
      setValue("email", data.email, { shouldValidate: true });
      setValue("phone", maskPhone(data.phone), { shouldValidate: true });
      setValue("postalCode", maskCep(data.postalCode), { shouldValidate: true });
      setValue("street", data.street, { shouldValidate: true });
      setValue("number", data.number, { shouldValidate: true });
      setValue("district", data.district, { shouldValidate: true });
      setValue("city", data.city, { shouldValidate: true });
      setValue("state", data.state, { shouldValidate: true });
      setValue("segment", data.segment, { shouldValidate: true });
      setValue("openingDate", data.openingDate, { shouldValidate: true });
      toast("Empresa preenchida pelo CNPJ.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const submit = async (fields: Fields): Promise<void> => {
    await onSave({
      ...fields,
      name: toTitleText(fields.name),
      internalCode: optionalUpper(fields.internalCode),
      legalName: optionalTitle(fields.legalName),
      tradeName: optionalTitle(fields.tradeName),
      stateRegistration: optionalUpper(fields.stateRegistration),
      municipalRegistration: optionalUpper(fields.municipalRegistration),
      email: optionalLower(fields.email),
      street: optionalTitle(fields.street),
      district: optionalTitle(fields.district),
      city: optionalTitle(fields.city),
      state: optionalUpper(fields.state),
      source: optionalTitle(fields.source),
      segment: optionalTitle(fields.segment),
      responsible: optionalTitle(fields.responsible),
      paymentTerms: optionalTitle(fields.paymentTerms),
      document: fields.document ? onlyDigits(fields.document) : null,
      phone: fields.phone ? onlyDigits(fields.phone) : null,
      whatsapp: fields.whatsapp ? onlyDigits(fields.whatsapp) : null,
      postalCode: fields.postalCode ? onlyDigits(fields.postalCode) : null,
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

  const handleInvalid: SubmitErrorHandler<Fields> = (validationErrors) => {
    const firstField = Object.keys(validationErrors)[0] as keyof Fields | undefined;
    if (firstField) setActiveTab(fieldTabs[firstField] ?? "identity");
    toast("Revise os campos destacados antes de salvar.", "error");
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(submit, handleInvalid)(event)}>
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

      <div className="grid gap-5 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav className="flex gap-2 overflow-x-auto border-b border-slate-700 pb-2 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pb-0 lg:pr-4">
          {tabs.map((tab) => (
            <button key={tab.id} type="button" className={cn("whitespace-nowrap rounded-xl px-3 py-2 text-left text-sm text-slate-400 transition hover:bg-white/5", activeTab === tab.id && "bg-accent/10 text-accent")} onClick={() => setActiveTab(tab.id)}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section className="min-w-0">
          {activeTab === "identity" && (
        <fieldset className="grid gap-4 md:grid-cols-3">
          <label>Tipo<select className={selectClass} {...register("type")}><option value="INDIVIDUAL">Pessoa fisica</option><option value="COMPANY">Empresa</option></select></label>
          <label>Codigo interno<Input placeholder="CLI-0001" {...register("internalCode")} /></label>
          <label>{isCompany ? "CNPJ" : "CPF"}<Controller control={control} name="document" render={({ field }) => <div className="flex gap-2"><Input value={isCompany ? maskCnpj(field.value) : maskCpf(field.value)} onChange={(event) => field.onChange(isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))} />{isCompany && <Button type="button" variant="outline" onClick={() => cnpjLookup.mutate(field.value)} disabled={cnpjLookup.isPending}>Buscar</Button>}</div>} /></label>
          <label className="md:col-span-2">{isCompany ? "Nome exibido" : "Nome completo"}<Input {...register("name")} /><FieldError message={errors.name?.message} /></label>
          {isCompany ? (
            <>
              <label className="md:col-span-2">Razao social<Input {...register("legalName")} /></label>
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
              <label>Nome do contato<Input {...register("responsible")} /></label>
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
            <fieldset className="grid gap-4 md:grid-cols-3 xl:grid-cols-4">
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
              <label className="md:col-span-3 xl:col-span-4">Observacoes<Textarea {...register("observations")} /></label>
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
            <fieldset className="grid gap-5 xl:grid-cols-2">
              <div>
                <span className="mb-2 block text-sm">Vincular a projetos</span>
                <Controller control={control} name="projectIds" render={({ field }) => <ProjectSelector projects={projects} selectedIds={field.value} onChange={field.onChange} />} />
              </div>
              <div>
                <span className="mb-2 block text-sm">Vincular a produtos</span>
                <Controller control={control} name="productIds" render={({ field }) => <ProductSelector products={products} selectedIds={field.value} onChange={field.onChange} />} />
              </div>
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
        </section>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-700 pt-4"><Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar cliente"}</Button></div>
    </form>
  );
}
