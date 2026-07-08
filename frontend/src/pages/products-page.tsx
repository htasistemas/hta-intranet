import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit3, PackagePlus, Plus, Search, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { Client, ClientProduct, PageResult, ProductService } from "@/types";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/contexts/toast-context";
import { currencyInputToNumber, numberToCurrencyInput } from "@/lib/currency-input";
import { currency } from "@/lib/utils";

interface ProductInsights {
  totalProducts: number;
  activeProducts: number;
  contractedProducts: number;
  activeContracts: number;
  upcomingRenewals: number;
  contractedRevenue: number;
  byType: Record<string, number>;
  renewals: ClientProduct[];
}

const productSchema = z.object({
  code: z.string().min(2, "Informe o codigo."),
  name: z.string().min(2, "Informe o nome."),
  type: z.enum(["PRODUCT", "SERVICE", "SUBSCRIPTION", "LICENSE", "PROJECT"]),
  category: z.string(),
  commercialDescription: z.string(),
  technicalDescription: z.string(),
  unit: z.string(),
  price: z.string(),
  cost: z.string(),
  margin: z.string(),
  status: z.enum(["ACTIVE", "INACTIVE"]),
  sla: z.string(),
  deliveryTime: z.string(),
  technicalOwner: z.string(),
  fiscalNotes: z.string()
});

type ProductFields = z.infer<typeof productSchema>;

const productDefaults: ProductFields = {
  code: "",
  name: "",
  type: "SERVICE",
  category: "",
  commercialDescription: "",
  technicalDescription: "",
  unit: "",
  price: "",
  cost: "",
  margin: "",
  status: "ACTIVE",
  sla: "",
  deliveryTime: "",
  technicalOwner: "",
  fiscalNotes: ""
};

const contractSchema = z.object({
  clientId: z.string().min(1),
  productId: z.string().min(1),
  startDate: z.string(),
  renewalDate: z.string(),
  contractedValue: z.string(),
  status: z.enum(["ACTIVE", "SUSPENDED", "CANCELLED", "EXPIRED"]),
  responsible: z.string(),
  notes: z.string()
});

type ContractFields = z.infer<typeof contractSchema>;

const contractDefaults: ContractFields = {
  clientId: "",
  productId: "",
  startDate: "",
  renewalDate: "",
  contractedValue: "",
  status: "ACTIVE",
  responsible: "",
  notes: ""
};

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

function productValues(product?: ProductService): ProductFields {
  if (!product) return productDefaults;
  return {
    code: product.code,
    name: product.name,
    type: product.type,
    category: product.category ?? "",
    commercialDescription: product.commercialDescription ?? "",
    technicalDescription: product.technicalDescription ?? "",
    unit: product.unit ?? "",
    price: numberToCurrencyInput(product.price),
    cost: numberToCurrencyInput(product.cost),
    margin: product.margin ? String(product.margin) : "",
    status: product.status,
    sla: product.sla ?? "",
    deliveryTime: product.deliveryTime ?? "",
    technicalOwner: product.technicalOwner ?? "",
    fiscalNotes: product.fiscalNotes ?? ""
  };
}

function contractValues(contract?: ClientProduct): ContractFields {
  if (!contract) return contractDefaults;
  return {
    clientId: contract.client.id,
    productId: contract.product.id,
    startDate: contract.startDate?.slice(0, 10) ?? "",
    renewalDate: contract.renewalDate?.slice(0, 10) ?? "",
    contractedValue: numberToCurrencyInput(contract.contractedValue),
    status: contract.status,
    responsible: contract.responsible ?? "",
    notes: contract.notes ?? ""
  };
}

function dateOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function ProductForm({ product, onSave, onCancel }: { product?: ProductService; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const values = useMemo(() => productValues(product), [product]);
  const { register, control, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProductFields>({ resolver: zodResolver(productSchema), values });
  const submit = (fields: ProductFields) => onSave({
    ...fields,
    code: fields.code.toUpperCase(),
    price: currencyInputToNumber(fields.price),
    cost: currencyInputToNumber(fields.cost),
    margin: fields.margin ? Number(fields.margin) : null
  });
  return (
    <form className="grid gap-4 md:grid-cols-3 xl:grid-cols-4" onSubmit={handleSubmit(submit)}>
      <label>Codigo<Input {...register("code")} />{errors.code && <small className="text-red-400">{errors.code.message}</small>}</label>
      <label className="md:col-span-2 xl:col-span-3">Nome<Input {...register("name")} />{errors.name && <small className="text-red-400">{errors.name.message}</small>}</label>
      <label>Tipo<select className={selectClass} {...register("type")}><option value="PRODUCT">Produto</option><option value="SERVICE">Servico</option><option value="SUBSCRIPTION">Assinatura</option><option value="LICENSE">Licenca</option><option value="PROJECT">Projeto</option></select></label>
      <label>Categoria<Input {...register("category")} /></label>
      <label>Status<select className={selectClass} {...register("status")}><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option></select></label>
      <Controller control={control} name="price" render={({ field }) => <label>Preco padrao<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
      <Controller control={control} name="cost" render={({ field }) => <label>Custo<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
      <label>Margem (%)<Input type="number" min="0" step="0.01" {...register("margin")} /></label>
      <label>Unidade<Input placeholder="mensal, hora, unidade..." {...register("unit")} /></label>
      <label>SLA padrao<Input {...register("sla")} /></label>
      <label>Prazo de entrega<Input {...register("deliveryTime")} /></label>
      <label>Responsavel tecnico<Input {...register("technicalOwner")} /></label>
      <label className="md:col-span-3 xl:col-span-2">Descricao comercial<Textarea {...register("commercialDescription")} /></label>
      <label className="md:col-span-3 xl:col-span-2">Descricao tecnica<Textarea {...register("technicalDescription")} /></label>
      <label className="md:col-span-3 xl:col-span-4">Observacoes fiscais<Textarea {...register("fiscalNotes")} /></label>
      <div className="flex justify-end gap-3 md:col-span-3 xl:col-span-4"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar produto"}</Button></div>
    </form>
  );
}

function ContractForm({ contract, products, clients, onSave, onCancel }: { contract?: ClientProduct; products: ProductService[]; clients: Client[]; onSave: (input: Record<string, unknown>) => Promise<void>; onCancel: () => void }) {
  const values = useMemo(() => contractValues(contract), [contract]);
  const { register, control, handleSubmit, formState: { isSubmitting } } = useForm<ContractFields>({ resolver: zodResolver(contractSchema), values });
  const submit = (fields: ContractFields) => onSave({
    ...fields,
    startDate: dateOrNull(fields.startDate),
    renewalDate: dateOrNull(fields.renewalDate),
    contractedValue: currencyInputToNumber(fields.contractedValue)
  });
  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submit)}>
      <label>Cliente<select className={selectClass} {...register("clientId")}><option value="">Selecione</option>{clients.map((client) => <option key={client.id} value={client.id}>{client.name}</option>)}</select></label>
      <label>Produto/servico<select className={selectClass} {...register("productId")}><option value="">Selecione</option>{products.map((product) => <option key={product.id} value={product.id}>{product.code} - {product.name}</option>)}</select></label>
      <label>Inicio<Input type="date" {...register("startDate")} /></label>
      <label>Renovacao<Input type="date" {...register("renewalDate")} /></label>
      <Controller control={control} name="contractedValue" render={({ field }) => <label>Valor contratado<CurrencyInput value={field.value} onChange={field.onChange} /></label>} />
      <label>Status<select className={selectClass} {...register("status")}><option value="ACTIVE">Ativo</option><option value="SUSPENDED">Suspenso</option><option value="CANCELLED">Cancelado</option><option value="EXPIRED">Expirado</option></select></label>
      <label className="md:col-span-2">Responsavel<Input {...register("responsible")} /></label>
      <label className="md:col-span-2">Observacoes<Textarea {...register("notes")} /></label>
      <div className="flex justify-end gap-3 md:col-span-2"><Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button><Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar contrato"}</Button></div>
    </form>
  );
}

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [contractSearch] = useState("");
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [contractDialogOpen, setContractDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductService | undefined>();
  const [selectedContract, setSelectedContract] = useState<ClientProduct | undefined>();
  const [productToDelete, setProductToDelete] = useState<ProductService | undefined>();
  const [contractToDelete, setContractToDelete] = useState<ClientProduct | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const productsQuery = useQuery({ queryKey: ["products", search], queryFn: () => api.get<PageResult<ProductService>>(`/products?pageSize=100&search=${encodeURIComponent(search)}`) });
  const insightsQuery = useQuery({ queryKey: ["products", "insights"], queryFn: () => api.get<ProductInsights>("/products/insights") });
  const clientsQuery = useQuery({ queryKey: ["clients", "product-selector"], queryFn: () => api.get<PageResult<Client>>("/clients?pageSize=200") });
  const contractsQuery = useQuery({ queryKey: ["client-products", contractSearch], queryFn: () => api.get<PageResult<ClientProduct>>(`/client-products?pageSize=100&search=${encodeURIComponent(contractSearch)}`) });
  const products = productsQuery.data?.data ?? [];
  const clients = clientsQuery.data?.data ?? [];
  const contracts = contractsQuery.data?.data ?? [];

  const metrics = useMemo(() => ({
    activeProducts: insightsQuery.data?.activeProducts ?? products.filter((product) => product.status === "ACTIVE").length,
    subscriptions: insightsQuery.data?.byType.SUBSCRIPTION ?? products.filter((product) => product.type === "SUBSCRIPTION").length,
    activeContracts: insightsQuery.data?.activeContracts ?? contracts.filter((contract) => contract.status === "ACTIVE").length,
    upcomingRenewals: insightsQuery.data?.upcomingRenewals ?? 0,
    contractedRevenue: insightsQuery.data?.contractedRevenue ?? 0
  }), [products, contracts, insightsQuery.data]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["products"] });
    void queryClient.invalidateQueries({ queryKey: ["client-products"] });
    void queryClient.invalidateQueries({ queryKey: ["products", "insights"] });
  };

  const saveProduct = useMutation({
    mutationFn: (input: Record<string, unknown>) => selectedProduct ? api.put<ProductService>(`/products/${selectedProduct.id}`, input) : api.post<ProductService>("/products", input),
    onSuccess: () => { invalidate(); setProductDialogOpen(false); setSelectedProduct(undefined); toast("Produto salvo."); },
    onError: (error) => toast(error.message, "error")
  });
  const removeProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/products/${id}`),
    onSuccess: () => { invalidate(); setProductToDelete(undefined); toast("Produto excluido."); },
    onError: (error) => toast(error.message, "error")
  });
  const saveContract = useMutation({
    mutationFn: (input: Record<string, unknown>) => selectedContract ? api.put<ClientProduct>(`/client-products/${selectedContract.id}`, input) : api.post<ClientProduct>("/client-products", input),
    onSuccess: () => { invalidate(); setContractDialogOpen(false); setSelectedContract(undefined); toast("Produto vinculado ao cliente."); },
    onError: (error) => toast(error.message, "error")
  });
  const removeContract = useMutation({
    mutationFn: (id: string) => api.delete(`/client-products/${id}`),
    onSuccess: () => { invalidate(); setContractToDelete(undefined); toast("Vinculo removido."); },
    onError: (error) => toast(error.message, "error")
  });
  const openProductForm = (product: ProductService): void => {
    setSelectedProduct(product);
    setProductDialogOpen(true);
  };
  const closeProductForm = (): void => {
    setProductDialogOpen(false);
    setSelectedProduct(undefined);
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-5">
        <Card><p className="text-sm text-slate-400">Produtos ativos</p><p className="mt-3 text-3xl font-semibold">{metrics.activeProducts}</p></Card>
        <Card><p className="text-sm text-slate-400">Assinaturas</p><p className="mt-3 text-3xl font-semibold">{metrics.subscriptions}</p></Card>
        <Card><p className="text-sm text-slate-400">Produtos contratados</p><p className="mt-3 text-3xl font-semibold">{metrics.activeContracts}</p></Card>
        <Card><p className="text-sm text-slate-400">Renovacoes 30 dias</p><p className="mt-3 text-3xl font-semibold">{metrics.upcomingRenewals}</p></Card>
        <Card><p className="text-sm text-slate-400">Receita contratada</p><p className="mt-3 text-2xl font-semibold">{currency(metrics.contractedRevenue)}</p></Card>
      </section>
      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-3 text-slate-500" size={18} /><Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar produto, codigo ou categoria" /></label>
        <Button variant="outline" onClick={() => { setSelectedContract(undefined); setContractDialogOpen(true); }}><PackagePlus size={17} /> Vincular cliente</Button>
        <Button onClick={() => { setSelectedProduct(undefined); setProductDialogOpen(true); }}><Plus size={17} /> Novo produto</Button>
      </div>
      <section className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <Card className="overflow-x-auto p-0">
          {productsQuery.isLoading ? <Skeleton className="m-5 h-72" /> : (
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400"><tr><th className="p-5">Produto/servico</th><th>Tipo</th><th>Preco</th><th>Status</th><th /></tr></thead>
              <tbody>{products.map((product) => (
                <tr key={product.id} className="border-b border-slate-700/50">
                  <td className="p-5">
                    <button type="button" className="text-left font-medium transition hover:text-accent" onClick={() => openProductForm(product)}>
                      {product.code} - {product.name}
                    </button>
                    <p className="text-xs text-slate-400">{product.category ?? "Sem categoria"}</p>
                  </td>
                  <td>{product.type}</td>
                  <td>{currency(Number(product.price ?? 0))}</td>
                  <td><span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{product.status}</span></td>
                  <td><div className="flex justify-end gap-1 pr-3"><Button variant="ghost" size="sm" onClick={() => openProductForm(product)} aria-label="Editar produto"><Edit3 size={17} /> Editar</Button><Button variant="danger" size="icon" onClick={() => setProductToDelete(product)} aria-label="Excluir produto"><Trash2 size={17} /></Button></div></td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
        <Card className="space-y-4">
          <div className="flex items-center justify-between gap-3"><h2 className="font-semibold">Produtos por cliente</h2><Button size="sm" variant="outline" onClick={() => { setSelectedContract(undefined); setContractDialogOpen(true); }}>Adicionar</Button></div>
          {Boolean(insightsQuery.data?.renewals.length) && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="mb-2 text-sm font-medium text-amber-200">Renovacoes proximas</p>
              <div className="space-y-2">
                {insightsQuery.data?.renewals.map((renewal) => (
                  <div key={renewal.id} className="flex justify-between gap-3 text-xs text-amber-100/90">
                    <span>{renewal.client.name} - {renewal.product.name}</span>
                    <span>{renewal.renewalDate?.slice(0, 10)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {contractsQuery.isLoading ? <Skeleton className="h-60" /> : contracts.map((contract) => (
            <article key={contract.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
              <div className="flex items-start justify-between gap-3">
                <div><p className="font-medium">{contract.client.name}</p><p className="text-sm text-slate-400">{contract.product.code} - {contract.product.name}</p></div>
                <span className="rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-300">{contract.status}</span>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400"><span>{currency(Number(contract.contractedValue ?? 0))}</span><span>{contract.renewalDate ? `Renova ${contract.renewalDate.slice(0, 10)}` : "Sem renovacao"}</span></div>
              <div className="mt-3 flex justify-end gap-1"><Button variant="ghost" size="sm" onClick={() => { setSelectedContract(contract); setContractDialogOpen(true); }}>Editar</Button><Button variant="danger" size="sm" onClick={() => setContractToDelete(contract)}>Remover</Button></div>
            </article>
          ))}
        </Card>
      </section>
      <Dialog open={productDialogOpen} title={selectedProduct ? "Editar produto/servico" : "Novo produto/servico"} onClose={closeProductForm} className="max-w-[96vw] xl:max-w-6xl">
        <ProductForm product={selectedProduct} onCancel={closeProductForm} onSave={(input) => saveProduct.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <Dialog open={contractDialogOpen} title={selectedContract ? "Editar produto contratado" : "Vincular produto ao cliente"} onClose={() => setContractDialogOpen(false)}>
        <ContractForm contract={selectedContract} products={products} clients={clients} onCancel={() => setContractDialogOpen(false)} onSave={(input) => saveContract.mutateAsync(input).then(() => undefined)} />
      </Dialog>
      <ConfirmDialog open={Boolean(productToDelete)} title="Excluir produto" description={`Deseja excluir "${productToDelete?.name ?? ""}"?`} confirmLabel="Excluir" loading={removeProduct.isPending} onClose={() => setProductToDelete(undefined)} onConfirm={() => { if (productToDelete) removeProduct.mutate(productToDelete.id); }} />
      <ConfirmDialog open={Boolean(contractToDelete)} title="Remover vinculo" description={`Deseja remover o produto do cliente "${contractToDelete?.client.name ?? ""}"?`} confirmLabel="Remover" loading={removeContract.isPending} onClose={() => setContractToDelete(undefined)} onConfirm={() => { if (contractToDelete) removeContract.mutate(contractToDelete.id); }} />
    </div>
  );
}
