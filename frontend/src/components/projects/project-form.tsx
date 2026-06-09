import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Client, PageResult, ProductService, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Input, Textarea } from "@/components/ui/input";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";

const schema = z.object({
  name: z.string().min(2, "Informe o nome."),
  code: z.string().min(2, "Informe o codigo."),
  clientId: z.string(),
  productId: z.string(),
  description: z.string(),
  status: z.enum(["PLANNING", "ACTIVE", "ON_HOLD", "COMPLETED", "CANCELLED"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  startDate: z.string(),
  dueDate: z.string(),
  budget: z.string(),
  progress: z.coerce.number().min(0).max(100),
  color: z.string()
});
type Fields = z.infer<typeof schema>;

const defaults: Fields = {
  name: "",
  code: "",
  clientId: "",
  productId: "",
  description: "",
  status: "PLANNING",
  priority: "MEDIUM",
  startDate: "",
  dueDate: "",
  budget: "",
  progress: 0,
  color: "#3B82F6"
};

export function ProjectForm({ project, onSave, onCancel }: { project?: Project; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const { data } = useQuery({ queryKey: ["clients", "project-selector"], queryFn: () => api.get<PageResult<Client>>("/clients?pageSize=100") });
  const { data: productsResult } = useQuery({ queryKey: ["products", "project-selector"], queryFn: () => api.get<PageResult<ProductService>>("/products?pageSize=100") });
  const products = productsResult?.data ?? [];
  const values: Fields = project ? {
    ...defaults,
    name: project.name,
    code: project.code,
    clientId: project.client?.id ?? "",
    productId: project.product?.id ?? "",
    description: project.description ?? "",
    status: project.status,
    priority: project.priority,
    startDate: project.startDate?.slice(0, 10) ?? "",
    dueDate: project.dueDate?.slice(0, 10) ?? "",
    budget: numberToCurrencyInput(project.budget),
    progress: project.progress,
    color: project.color
  } : defaults;
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Fields>({ resolver: zodResolver(schema), values });
  const submit = (fields: Fields) => onSave({
    ...fields,
    code: fields.code.toUpperCase(),
    clientId: fields.clientId || null,
    productId: fields.productId || null,
    startDate: fields.startDate ? new Date(fields.startDate).toISOString() : null,
    dueDate: fields.dueDate ? new Date(fields.dueDate).toISOString() : null,
    budget: currencyInputToNumber(fields.budget)
  });
  return (
    <form className="space-y-5" onSubmit={handleSubmit(submit)}>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="md:col-span-2">Nome do projeto<Input {...register("name")} />{errors.name && <small className="text-red-400">{errors.name.message}</small>}</label>
        <label>Codigo<Input placeholder="PRJ-001" {...register("code")} /></label>
        <label className="md:col-span-2">Cliente
          <select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("clientId")}>
            <option value="">Sem cliente vinculado</option>
            {data?.data.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}
          </select>
        </label>
        <label>Produto/servico
          <select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("productId")}>
            <option value="">Sem produto vinculado</option>
            {products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}
          </select>
        </label>
        <label>Cor<Input type="color" {...register("color")} /></label>
        <label>Status<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("status")}><option value="PLANNING">Planejamento</option><option value="ACTIVE">Ativo</option><option value="ON_HOLD">Pausado</option><option value="COMPLETED">Concluido</option><option value="CANCELLED">Cancelado</option></select></label>
        <label>Prioridade<select className="h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("priority")}><option value="LOW">Baixa</option><option value="MEDIUM">Media</option><option value="HIGH">Alta</option><option value="URGENT">Urgente</option></select></label>
        <label>Progresso (%)<Input type="number" min="0" max="100" {...register("progress")} /></label>
        <label>Inicio<Input type="date" {...register("startDate")} /></label>
        <label>Prazo final<Input type="date" {...register("dueDate")} /></label>
        <Controller control={control} name="budget" render={({ field }) => <label>Orcamento<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
        <label className="md:col-span-3">Descricao<Textarea {...register("description")} /></label>
      </div>
      <div className="flex justify-end gap-3"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar projeto"}</Button></div>
    </form>
  );
}
