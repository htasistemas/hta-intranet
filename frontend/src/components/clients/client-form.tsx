import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Category, Client, PageResult, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  document: z.string(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
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
  categoryId: z.string(),
  expectedValue: z.string(),
  projectIds: z.array(z.string())
});

type Fields = z.infer<typeof schema>;

const defaults: Fields = {
  name: "",
  document: "",
  type: "INDIVIDUAL",
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
  categoryId: "",
  expectedValue: "",
  projectIds: []
};

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
      segment: data.cnae_fiscal_descricao ?? ""
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
    email: client.email ?? "",
    phone: client.phone ?? "",
    whatsapp: client.whatsapp ?? "",
    city: client.city ?? "",
    state: client.state ?? "",
    observations: client.observations ?? "",
    status: client.status,
    categoryId: client.category?.id ?? "",
    expectedValue: numberToCurrencyInput(client.expectedValue),
    birthDate: client.birthDate?.slice(0, 10) ?? "",
    projectIds: client.projectLinks?.map((link) => link.project.id) ?? []
  };
}

export function ClientForm({ client, onSave, onCancel }: { client?: Client; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
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
      setValue("email", data.email);
      setValue("phone", maskPhone(data.phone));
      setValue("postalCode", maskCep(data.postalCode));
      setValue("street", data.street);
      setValue("number", data.number);
      setValue("district", data.district);
      setValue("city", data.city);
      setValue("state", data.state);
      toast("Empresa preenchida pelo CNPJ.");
    },
    onError: (error) => toast(error.message, "error")
  });
  const submit = async (fields: Fields): Promise<void> => {
    await onSave({
      ...fields,
      birthDate: isCompany || !fields.birthDate ? null : fields.birthDate,
      gender: isCompany ? null : fields.gender,
      expectedValue: currencyInputToNumber(fields.expectedValue),
      tagIds: []
    });
  };

  return (
    <form className="space-y-6" onSubmit={(event) => void handleSubmit(submit)(event)}>
      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="col-span-full mb-2 text-sm font-medium text-accent">{isCompany ? "Dados da empresa" : "Dados da pessoa fisica"}</legend>
        <label>Tipo<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("type")}><option value="INDIVIDUAL">Pessoa fisica</option><option value="COMPANY">Empresa</option></select></label>
        <label className="md:col-span-2">{isCompany ? "Razao social / Nome fantasia" : "Nome completo"}<Input {...register("name")} />{errors.name && <small className="text-red-400">{errors.name.message}</small>}</label>
        <Controller control={control} name="document" render={({ field }) => <label>{isCompany ? "CNPJ" : "CPF"}<div className="flex gap-2"><Input value={isCompany ? maskCnpj(field.value) : maskCpf(field.value)} onChange={(event) => field.onChange(isCompany ? maskCnpj(event.target.value) : maskCpf(event.target.value))} />{isCompany && <Button type="button" variant="outline" onClick={() => cnpjLookup.mutate(field.value)} disabled={cnpjLookup.isPending}>Buscar</Button>}</div></label>} />
        {!isCompany && (
          <>
            <label>Nascimento<Input type="date" {...register("birthDate")} /></label>
            <label>Sexo<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("gender")}><option value="">Selecione</option><option value="FEMALE">Feminino</option><option value="MALE">Masculino</option><option value="NON_BINARY">Nao binario</option><option value="NOT_INFORMED">Prefiro nao informar</option></select></label>
          </>
        )}
        {isCompany && (
          <>
            <label>Inscricao estadual<Input placeholder="Opcional" /></label>
            <label>Responsavel legal<Input placeholder="Opcional" /></label>
          </>
        )}
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="col-span-full mb-2 text-sm font-medium text-accent">Contato</legend>
        <Controller control={control} name="phone" render={({ field }) => <label>Telefone<Input value={maskPhone(field.value)} onChange={(event) => field.onChange(maskPhone(event.target.value))} /></label>} />
        <Controller control={control} name="whatsapp" render={({ field }) => <label>WhatsApp<Input value={maskPhone(field.value)} onChange={(event) => field.onChange(maskPhone(event.target.value))} /></label>} />
        <label>Email<Input type="email" {...register("email")} />{errors.email && <small className="text-red-400">{errors.email.message}</small>}</label>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-4">
        <legend className="col-span-full mb-2 text-sm font-medium text-accent">Endereco</legend>
        <Controller control={control} name="postalCode" render={({ field }) => <label>CEP<div className="flex gap-2"><Input value={maskCep(field.value)} onChange={(event) => field.onChange(maskCep(event.target.value))} /><Button type="button" variant="outline" onClick={() => cepLookup.mutate(getValues("postalCode"))} disabled={cepLookup.isPending}>Buscar</Button></div></label>} />
        <label className="md:col-span-2">Logradouro<Input {...register("street")} /></label>
        <label>Numero<Input {...register("number")} /></label>
        <label>Bairro<Input {...register("district")} /></label>
        <label className="md:col-span-2">Cidade<Input {...register("city")} /></label>
        <label>Estado<Input maxLength={2} {...register("state")} /></label>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="col-span-full mb-2 text-sm font-medium text-accent">Informacoes adicionais</legend>
        <label>Status<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("status")}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="PROSPECT">Prospect</option></select></label>
        <label>Categoria<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("categoryId")}><option value="">Sem categoria</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <Controller control={control} name="expectedValue" render={({ field }) => <label>Receita prevista<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
        <label className="md:col-span-3">Vincular a projetos<select multiple className="min-h-28 w-full rounded-xl border border-slate-700 bg-sidebar px-3 py-2" {...register("projectIds")}>{projects.map((project) => <option key={project.id} value={project.id}>{project.code} - {project.name}</option>)}</select></label>
        <label className="md:col-span-3">Observacoes<Textarea {...register("observations")} /></label>
      </fieldset>

      <div className="flex justify-end gap-3"><Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar cliente"}</Button></div>
    </form>
  );
}
