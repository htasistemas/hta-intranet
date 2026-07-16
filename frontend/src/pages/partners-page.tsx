import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { HandCoins, Handshake, MessageSquarePlus, Plus, Search, Target, Trash2, UsersRound } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { CommissionModel, PageResult, Partner, PartnerInteractionType, PartnerStatus, PartnerType, Project } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";
import { currency } from "@/lib/utils";

const partnerSchema = z.object({
  name: z.string().trim().min(2, "Informe o parceiro."),
  company: z.string(),
  document: z.string(),
  type: z.enum(["REFERRAL", "RESELLER", "IMPLEMENTATION", "STRATEGIC", "AFFILIATE"]),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECTING", "SUSPENDED"]),
  contactName: z.string(),
  email: z.string().email("E-mail invalido.").or(z.literal("")),
  phone: z.string(),
  whatsapp: z.string(),
  website: z.string(),
  city: z.string(),
  state: z.string(),
  segment: z.string(),
  commissionModel: z.enum(["ONE_TIME", "RECURRING", "REVENUE_SHARE", "PROJECT_BASED", "HYBRID"]),
  commissionPercent: z.string(),
  recurringMonths: z.string(),
  fixedAmount: z.string(),
  closeBonus: z.string(),
  paymentTrigger: z.string(),
  contractStart: z.string(),
  contractEnd: z.string(),
  goals: z.string(),
  strengths: z.string(),
  rules: z.string(),
  notes: z.string(),
  projectIds: z.array(z.string())
});

const interactionSchema = z.object({
  type: z.enum(["CALL", "EMAIL", "MEETING", "WHATSAPP", "NOTE", "TRAINING", "PROPOSAL", "REVIEW"]),
  title: z.string().trim().min(2, "Informe o titulo."),
  description: z.string(),
  occurredAt: z.string(),
  nextStep: z.string()
});

type PartnerForm = z.infer<typeof partnerSchema>;
type InteractionForm = z.infer<typeof interactionSchema>;

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

const typeLabels: Record<PartnerType, string> = {
  REFERRAL: "Indicacao",
  RESELLER: "Revenda",
  IMPLEMENTATION: "Implantacao",
  STRATEGIC: "Estrategico",
  AFFILIATE: "Afiliado"
};

const statusLabels: Record<PartnerStatus, string> = {
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  PROSPECTING: "Em negociacao",
  SUSPENDED: "Suspenso"
};

const commissionLabels: Record<CommissionModel, string> = {
  ONE_TIME: "Comissao unica",
  RECURRING: "Recorrente",
  REVENUE_SHARE: "Divisao de receita",
  PROJECT_BASED: "Por projeto",
  HYBRID: "Hibrido"
};

const interactionLabels: Record<PartnerInteractionType, string> = {
  CALL: "Ligacao",
  EMAIL: "E-mail",
  MEETING: "Reuniao",
  WHATSAPP: "WhatsApp",
  NOTE: "Nota",
  TRAINING: "Treinamento",
  PROPOSAL: "Proposta",
  REVIEW: "Revisao"
};

function numberOrNull(value: string): number | null {
  const normalized = value.replace(/\./g, "").replace(",", ".").trim();
  return normalized ? Number(normalized) : null;
}

function dateOrNull(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

function partnerValues(partner?: Partner): PartnerForm {
  return {
    name: partner?.name ?? "",
    company: partner?.company ?? "",
    document: partner?.document ?? "",
    type: partner?.type ?? "REFERRAL",
    status: partner?.status ?? "PROSPECTING",
    contactName: partner?.contactName ?? "",
    email: partner?.email ?? "",
    phone: partner?.phone ?? "",
    whatsapp: partner?.whatsapp ?? "",
    website: partner?.website ?? "",
    city: partner?.city ?? "",
    state: partner?.state ?? "",
    segment: partner?.segment ?? "",
    commissionModel: partner?.commissionModel ?? "ONE_TIME",
    commissionPercent: partner?.commissionPercent ? String(partner.commissionPercent) : "10",
    recurringMonths: partner?.recurringMonths ? String(partner.recurringMonths) : "",
    fixedAmount: partner?.fixedAmount ? String(partner.fixedAmount) : "",
    closeBonus: partner?.closeBonus ? String(partner.closeBonus) : "",
    paymentTrigger: partner?.paymentTrigger ?? "Pagamento apos confirmacao do recebimento do cliente.",
    contractStart: partner?.contractStart?.slice(0, 10) ?? "",
    contractEnd: partner?.contractEnd?.slice(0, 10) ?? "",
    goals: partner?.goals ?? "",
    strengths: partner?.strengths ?? "",
    rules: partner?.rules ?? "",
    notes: partner?.notes ?? "",
    projectIds: partner?.projectLinks?.map((link) => link.project.id) ?? []
  };
}

function partnerPayload(values: PartnerForm): Record<string, unknown> {
  return {
    ...values,
    commissionPercent: numberOrNull(values.commissionPercent),
    recurringMonths: values.recurringMonths ? Number(values.recurringMonths) : null,
    fixedAmount: numberOrNull(values.fixedAmount),
    closeBonus: numberOrNull(values.closeBonus),
    contractStart: dateOrNull(values.contractStart),
    contractEnd: dateOrNull(values.contractEnd)
  };
}

function commissionSummary(partner: Partner): string {
  const percent = partner.commissionPercent ? `${Number(partner.commissionPercent).toLocaleString("pt-BR")}%` : "sem percentual";
  const fixed = partner.fixedAmount ? ` + ${currency(Number(partner.fixedAmount))}` : "";
  const bonus = partner.closeBonus ? ` + bonus ${currency(Number(partner.closeBonus))}` : "";
  return `${commissionLabels[partner.commissionModel]}: ${percent}${fixed}${bonus}`;
}

function monetaryValue(value: Project["budget"] | Partner["fixedAmount"] | Partner["closeBonus"]): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  return Number(String(value).replace(/\./g, "").replace(",", ".")) || 0;
}

function projectedCommission(partner: Partner): number {
  const percent = Number(partner.commissionPercent ?? 0);
  const linkedBudget = partner.projectLinks?.reduce((total, link) => total + monetaryValue(link.project.budget), 0) ?? 0;
  return (linkedBudget * percent / 100) + monetaryValue(partner.fixedAmount) + monetaryValue(partner.closeBonus);
}

function PartnerFormDialog({ open, partner, projects, onClose, onSave }: { open: boolean; partner?: Partner; projects: Project[]; onClose: () => void; onSave: (input: Record<string, unknown>) => Promise<void> }) {
  const { control, register, handleSubmit, formState: { errors, isSubmitting } } = useForm<PartnerForm>({
    resolver: zodResolver(partnerSchema),
    values: partnerValues(partner)
  });

  return (
    <Dialog open={open} title={partner ? "Editar parceiro" : "Novo parceiro"} onClose={onClose} className="max-w-[96vw] xl:max-w-7xl">
      <form className="grid gap-5" onSubmit={(event) => void handleSubmit((values) => onSave(partnerPayload(values)))(event)}>
        <section className="grid gap-4 md:grid-cols-4">
          <label className="md:col-span-2">Parceiro<Input {...register("name")} />{errors.name ? <small className="text-red-400">{errors.name.message}</small> : null}</label>
          <label>Empresa<Input {...register("company")} /></label>
          <label>Documento<Input {...register("document")} /></label>
          <label>Tipo<select className={selectClass} {...register("type")}><option value="REFERRAL">Indicacao</option><option value="RESELLER">Revenda</option><option value="IMPLEMENTATION">Implantacao</option><option value="STRATEGIC">Estrategico</option><option value="AFFILIATE">Afiliado</option></select></label>
          <label>Status<select className={selectClass} {...register("status")}><option value="PROSPECTING">Em negociacao</option><option value="ACTIVE">Ativo</option><option value="INACTIVE">Inativo</option><option value="SUSPENDED">Suspenso</option></select></label>
          <label>Contato<Input {...register("contactName")} /></label>
          <label>E-mail<Input type="email" {...register("email")} />{errors.email ? <small className="text-red-400">{errors.email.message}</small> : null}</label>
          <label>Telefone<Input {...register("phone")} /></label>
          <label>WhatsApp<Input {...register("whatsapp")} /></label>
          <label>Site<Input {...register("website")} /></label>
          <label>Cidade<Input {...register("city")} /></label>
          <label>UF<Input maxLength={2} {...register("state")} /></label>
          <label className="md:col-span-2">Segmento<Input placeholder="Contabilidade, consultoria, terceiro setor..." {...register("segment")} /></label>
        </section>

        <section className="grid gap-4 rounded-xl border border-slate-700 bg-sidebar p-4 md:grid-cols-5">
          <div className="md:col-span-5">
            <h3 className="text-sm font-semibold">Modelo comercial da parceria</h3>
            <p className="mt-1 text-xs text-slate-400">Use indicacao para lead pontual, revenda para venda ativa, implantacao para entrega tecnica e hibrido quando houver percentual mais bonus.</p>
          </div>
          <label>Modelo<select className={selectClass} {...register("commissionModel")}><option value="ONE_TIME">Comissao unica</option><option value="RECURRING">Recorrente</option><option value="REVENUE_SHARE">Divisao de receita</option><option value="PROJECT_BASED">Por projeto</option><option value="HYBRID">Hibrido</option></select></label>
          <label>% Comissao<Input placeholder="10" {...register("commissionPercent")} /></label>
          <label>Meses recorrentes<Input type="number" min={0} {...register("recurringMonths")} /></label>
          <label>Valor fixo<Input placeholder="0,00" {...register("fixedAmount")} /></label>
          <label>Bonus fechamento<Input placeholder="0,00" {...register("closeBonus")} /></label>
          <label className="md:col-span-3">Gatilho de pagamento<Input {...register("paymentTrigger")} /></label>
          <label>Inicio<Input type="date" {...register("contractStart")} /></label>
          <label>Fim<Input type="date" {...register("contractEnd")} /></label>
        </section>

        <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-xl border border-slate-700 bg-sidebar p-4">
            <h3 className="mb-3 text-sm font-semibold">Projetos vinculados</h3>
            <Controller control={control} name="projectIds" render={({ field }) => (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-700 bg-card">
                {projects.map((project) => (
                  <label key={project.id} className="flex cursor-pointer gap-3 border-b border-slate-700/60 px-3 py-3 last:border-0">
                    <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={field.value.includes(project.id)} onChange={() => field.onChange(field.value.includes(project.id) ? field.value.filter((id) => id !== project.id) : [...field.value, project.id])} />
                    <span><span className="block text-sm font-medium">{project.code} - {project.name}</span><span className="text-xs text-slate-400">{project.client?.name ?? "Sem cliente"} {project.product ? `- ${project.product.name}` : ""}</span></span>
                  </label>
                ))}
              </div>
            )} />
          </div>
          <div className="grid gap-3">
            <label>Metas da parceria<Textarea className="min-h-24" placeholder="Ex: gerar 5 indicacoes qualificadas por mes" {...register("goals")} /></label>
            <label>Forcas do parceiro<Textarea className="min-h-24" placeholder="Rede de contatos, influencia regional, capacidade tecnica..." {...register("strengths")} /></label>
            <label>Regras combinadas<Textarea className="min-h-24" placeholder="Exclusividade, SLA, prazo para pagamento, conflitos de canal..." {...register("rules")} /></label>
            <label>Observacoes<Textarea className="min-h-24" {...register("notes")} /></label>
          </div>
        </section>

        <footer className="flex justify-end gap-3 border-t border-slate-700 pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar parceiro"}</Button>
        </footer>
      </form>
    </Dialog>
  );
}

function InteractionForm({ partner, onSave }: { partner?: Partner; onSave: (partnerId: string, input: InteractionForm) => Promise<void> }) {
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<InteractionForm>({
    resolver: zodResolver(interactionSchema),
    defaultValues: { type: "NOTE", title: "", description: "", occurredAt: new Date().toISOString().slice(0, 10), nextStep: "" }
  });

  if (!partner) return <p className="text-sm text-slate-400">Selecione um parceiro para registrar interacoes.</p>;

  return (
    <form className="grid gap-3" onSubmit={(event) => void handleSubmit((values) => onSave(partner.id, { ...values, occurredAt: dateOrNull(values.occurredAt) ?? new Date().toISOString() }).then(() => reset()))(event)}>
      <div className="grid gap-3 md:grid-cols-3">
        <select className={selectClass} {...register("type")}><option value="NOTE">Nota</option><option value="CALL">Ligacao</option><option value="EMAIL">E-mail</option><option value="MEETING">Reuniao</option><option value="WHATSAPP">WhatsApp</option><option value="TRAINING">Treinamento</option><option value="PROPOSAL">Proposta</option><option value="REVIEW">Revisao</option></select>
        <label><Input placeholder="Titulo da interacao" {...register("title")} />{errors.title ? <small className="text-red-400">{errors.title.message}</small> : null}</label>
        <Input type="date" {...register("occurredAt")} />
      </div>
      <Textarea placeholder="Resumo do que foi combinado" {...register("description")} />
      <Input placeholder="Proximo passo" {...register("nextStep")} />
      <Button disabled={isSubmitting}><MessageSquarePlus size={16} /> Registrar interacao</Button>
    </form>
  );
}

export default function PartnersPage() {
  const { session } = useAuth();
  const [search, setSearch] = useState("");
  const [opened, setOpened] = useState(false);
  const [selected, setSelected] = useState<Partner | undefined>();
  const [partnerToDelete, setPartnerToDelete] = useState<Partner | undefined>();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isPartnerUser = session?.user.role === "PARTNER";
  const partners = useQuery({ queryKey: ["partners", search], queryFn: () => api.get<PageResult<Partner>>(`/partners?pageSize=100&search=${encodeURIComponent(search)}`) });
  const projects = useQuery({ queryKey: ["projects", "partners"], queryFn: () => api.get<PageResult<Project>>("/projects?pageSize=200"), enabled: !isPartnerUser });
  const partnerList = partners.data?.data ?? [];
  const projectList = projects.data?.data ?? [];

  const stats = useMemo(() => ({
    total: partnerList.length,
    active: partnerList.filter((partner) => partner.status === "ACTIVE").length,
    projects: partnerList.reduce((total, partner) => total + (partner._count?.projectLinks ?? partner.projectLinks?.length ?? 0), 0),
    recurring: partnerList.filter((partner) => partner.commissionModel === "RECURRING" || partner.commissionModel === "REVENUE_SHARE").length,
    clients: new Set(partnerList.flatMap((partner) => partner.projectLinks?.map((link) => link.project.client?.id ?? link.project.client?.name).filter(Boolean) ?? [])).size,
    commission: partnerList.reduce((total, partner) => total + projectedCommission(partner), 0)
  }), [partnerList]);

  useEffect(() => {
    if (!isPartnerUser || selected || partnerList.length === 0) return;
    setSelected(partnerList[0]);
  }, [isPartnerUser, partnerList, selected]);

  const invalidate = (): void => {
    void queryClient.invalidateQueries({ queryKey: ["partners"] });
  };

  const save = useMutation({
    mutationFn: (input: Record<string, unknown>) => selected ? api.put<Partner>(`/partners/${selected.id}`, input) : api.post<Partner>("/partners", input),
    onSuccess: () => {
      invalidate();
      setOpened(false);
      setSelected(undefined);
      toast("Parceiro salvo com sucesso.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const remove = useMutation({
    mutationFn: (partnerId: string) => api.delete(`/partners/${partnerId}`),
    onSuccess: () => {
      invalidate();
      setPartnerToDelete(undefined);
      toast("Parceiro excluido.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const createInteraction = useMutation({
    mutationFn: ({ partnerId, input }: { partnerId: string; input: InteractionForm }) => api.post(`/partners/${partnerId}/interactions`, input),
    onSuccess: () => {
      invalidate();
      toast("Interacao registrada.");
    },
    onError: (error) => toast(error.message, "error")
  });

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-slate-400">{isPartnerUser ? "Minha parceria" : "Parceiros"}</p><strong className="mt-2 block text-3xl">{stats.total}</strong></Card>
        <Card><p className="text-sm text-slate-400">Clientes vinculados</p><strong className="mt-2 block text-3xl">{stats.clients}</strong></Card>
        <Card><p className="text-sm text-slate-400">Vendas/projetos</p><strong className="mt-2 block text-3xl">{stats.projects}</strong></Card>
        <Card><p className="text-sm text-slate-400">Comissao projetada</p><strong className="mt-2 block text-3xl">{currency(stats.commission)}</strong></Card>
      </section>

      <Card>
        {isPartnerUser ? (
          <div className="mb-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm text-emerald-100">
            <p className="font-semibold">Carteira do parceiro</p>
            <p className="mt-1 text-emerald-100/80">Aqui ficam somente os clientes, vendas/projetos, interacoes e regras de comissao vinculados ao seu parceiro. Cadastros e regras comerciais sao mantidos pela administracao.</p>
          </div>
        ) : null}
        <div className="flex flex-col gap-3 lg:flex-row">
          <label className="relative flex-1">
            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
            <Input className="pl-10" placeholder="Buscar parceiro, empresa, contato ou segmento" value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          {!isPartnerUser ? <Button onClick={() => { setSelected(undefined); setOpened(true); }}><Plus size={17} /> Novo parceiro</Button> : null}
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
        <div className="grid gap-4">
          {partners.isLoading ? <Skeleton className="h-72" /> : partnerList.map((partner) => (
            <Card key={partner.id} className="cursor-pointer" onClick={() => setSelected(partner)}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold">{partner.name}</h2>
                    <span className="rounded-full bg-accent/10 px-3 py-1 text-xs text-accent">{typeLabels[partner.type]}</span>
                    <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs text-emerald-200">{statusLabels[partner.status]}</span>
                  </div>
                  <p className="mt-1 text-sm text-slate-400">{partner.company ?? partner.contactName ?? "Sem empresa informada"} - {partner.segment ?? "Segmento nao informado"}</p>
                  <p className="mt-3 text-sm text-slate-300"><HandCoins className="mr-2 inline" size={16} />{commissionSummary(partner)}</p>
                  {partner.users && partner.users.length > 0 ? (
                    <p className="mt-2 text-xs text-slate-400"><UsersRound className="mr-1 inline" size={14} />Usuarios vinculados: {partner.users.map((user) => user.name).join(", ")}</p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-300">
                    {(partner.projectLinks ?? []).slice(0, 4).map((link) => <span key={link.project.id} className="rounded-md border border-slate-700 px-2 py-1">{link.project.code} - {link.project.name}</span>)}
                    {(partner._count?.projectLinks ?? 0) > 4 ? <span className="rounded-md border border-slate-700 px-2 py-1">+{(partner._count?.projectLinks ?? 0) - 4}</span> : null}
                  </div>
                </div>
                {!isPartnerUser ? (
                  <div className="flex shrink-0 gap-2" onClick={(event) => event.stopPropagation()}>
                    <Button variant="outline" onClick={() => { setSelected(partner); setOpened(true); }}>Editar</Button>
                    <Button variant="danger" size="icon" onClick={() => setPartnerToDelete(partner)}><Trash2 size={17} /></Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))}
          {!partners.isLoading && partnerList.length === 0 ? <Card className="text-center text-sm text-slate-400">Nenhum parceiro encontrado para esta carteira.</Card> : null}
        </div>

        <aside className="space-y-4">
          <Card>
            <CardTitle>{isPartnerUser ? "Resumo comercial" : "Playbook de parceria"}</CardTitle>
            <div className="space-y-3 text-sm text-slate-300">
              {isPartnerUser ? (
                <>
                  <p><Handshake className="mr-2 inline text-accent" size={16} />Acompanhe a regra de comissao do parceiro selecionado e os projetos que compoem sua carteira.</p>
                  <p><UsersRound className="mr-2 inline text-sky-300" size={16} />Clientes vinculados aparecem dentro dos projetos/vendas associados ao parceiro.</p>
                  <p><Target className="mr-2 inline text-emerald-300" size={16} />Registre interacoes para manter historico de reunioes, proximos passos e combinados.</p>
                </>
              ) : (
                <>
                  <p><Handshake className="mr-2 inline text-accent" size={16} />Indicacao: 5-15% na primeira venda quando o parceiro so abre a porta.</p>
                  <p><UsersRound className="mr-2 inline text-sky-300" size={16} />Revenda: 15-30% com meta, pipeline ativo e responsabilidade comercial.</p>
                  <p><Target className="mr-2 inline text-emerald-300" size={16} />Implantacao: valor fixo por projeto ou hibrido quando o parceiro entrega onboarding/sucesso.</p>
                </>
              )}
            </div>
          </Card>
          {selected ? (
            <Card>
              <CardTitle>Clientes e vendas</CardTitle>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                {selected.projectLinks?.map((link) => (
                  <article key={link.project.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{link.project.code} - {link.project.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{link.project.client?.name ?? "Cliente nao informado"} {link.project.product ? `- ${link.project.product.name}` : ""}</p>
                      </div>
                      <span className="text-xs text-accent">{currency(monetaryValue(link.project.budget))}</span>
                    </div>
                  </article>
                ))}
                {(!selected.projectLinks || selected.projectLinks.length === 0) ? <p className="text-sm text-slate-400">Nenhum projeto/venda vinculado ainda.</p> : null}
              </div>
            </Card>
          ) : null}
          <Card>
            <CardTitle>{selected ? `Interacoes - ${selected.name}` : "Interacoes"}</CardTitle>
            <InteractionForm partner={selected} onSave={(partnerId, input) => createInteraction.mutateAsync({ partnerId, input }).then(() => undefined)} />
            <div className="mt-4 max-h-96 space-y-2 overflow-y-auto">
              {selected?.interactions?.map((interaction) => (
                <article key={interaction.id} className="rounded-xl border border-slate-700 bg-sidebar p-3">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{interaction.title}</p>
                    <span className="text-xs text-slate-400">{interactionLabels[interaction.type]}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{new Intl.DateTimeFormat("pt-BR").format(new Date(interaction.occurredAt))}</p>
                  {interaction.description ? <p className="mt-2 text-sm text-slate-300">{interaction.description}</p> : null}
                  {interaction.nextStep ? <p className="mt-2 text-xs text-accent">Proximo passo: {interaction.nextStep}</p> : null}
                </article>
              ))}
            </div>
          </Card>
        </aside>
      </section>

      <PartnerFormDialog open={opened} partner={selected} projects={projectList} onClose={() => setOpened(false)} onSave={(input) => save.mutateAsync(input).then(() => undefined)} />
      <ConfirmDialog
        open={Boolean(partnerToDelete)}
        title="Excluir parceiro"
        description={`Deseja excluir "${partnerToDelete?.name ?? ""}"?`}
        confirmLabel="Excluir parceiro"
        loading={remove.isPending}
        onClose={() => setPartnerToDelete(undefined)}
        onConfirm={() => { if (partnerToDelete) remove.mutate(partnerToDelete.id); }}
      />
    </div>
  );
}
