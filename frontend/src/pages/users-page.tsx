import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Handshake, Edit3, KeyRound, Plus, Search, ShieldCheck, Trash2, UserPlus, UsersRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { PageResult, Partner, UserAccount, UserRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";

const selectClass = "h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none focus:border-accent";

const roleLabels: Record<UserRole, string> = {
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  USER: "Usuario",
  PARTNER: "Parceiro"
};

const userFormSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome."),
  email: z.string().trim().email("Informe um e-mail valido."),
  password: z.string(),
  role: z.enum(["ADMIN", "MANAGER", "USER", "PARTNER"]),
  partnerId: z.string().optional().nullable(),
  theme: z.enum(["dark", "light"]),
  notifications: z.boolean()
}).refine((data) => data.role !== "PARTNER" || Boolean(data.partnerId), {
  message: "Selecione o parceiro vinculado.",
  path: ["partnerId"]
});

type UserFormFields = z.infer<typeof userFormSchema>;

interface UserPayload {
  name: string;
  email: string;
  role: UserRole;
  partnerId?: string | null;
  theme: "dark" | "light";
  notifications: boolean;
  password?: string;
}

interface SaveUserInput {
  id?: string;
  data: UserPayload;
}

const emptyUserForm: UserFormFields = {
  name: "",
  email: "",
  password: "",
  role: "USER",
  partnerId: "",
  theme: "dark",
  notifications: true
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function formValues(user?: UserAccount): UserFormFields {
  if (!user) return emptyUserForm;
  return {
    name: user.name,
    email: user.email,
    password: "",
    role: user.role,
    partnerId: user.partnerId ?? "",
    theme: user.theme,
    notifications: user.notifications
  };
}

function UserForm({ user, partners, onCancel, onSave }: { user?: UserAccount; partners: Partner[]; onCancel: () => void; onSave: (input: UserPayload) => Promise<void> }) {
  const { toast } = useToast();
  const values = useMemo(() => formValues(user), [user]);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<UserFormFields>({
    resolver: zodResolver(userFormSchema),
    values
  });
  const selectedRole = watch("role");

  const submit = async (fields: UserFormFields) => {
    const password = fields.password.trim();
    if (!user && password.length < 6) {
      toast("Informe uma senha com pelo menos 6 caracteres.", "error");
      return;
    }
    if (password && password.length < 6) {
      toast("A nova senha deve ter pelo menos 6 caracteres.", "error");
      return;
    }
    const payload: UserPayload = {
      name: fields.name.trim(),
      email: fields.email.trim().toLowerCase(),
      role: fields.role,
      partnerId: fields.role === "PARTNER" ? fields.partnerId ?? null : null,
      theme: fields.theme,
      notifications: fields.notifications
    };
    if (password) payload.password = password;
    await onSave(payload);
  };

  return (
    <form className="grid gap-4 md:grid-cols-2" onSubmit={handleSubmit(submit)}>
      <label className="md:col-span-2">
        Nome
        <Input className="mt-2" {...register("name")} />
        {errors.name && <small className="text-red-400">{errors.name.message}</small>}
      </label>
      <label>
        E-mail
        <Input className="mt-2" type="email" autoComplete="email" {...register("email")} />
        {errors.email && <small className="text-red-400">{errors.email.message}</small>}
      </label>
      <label>
        Senha
        <Input className="mt-2" type="password" autoComplete="new-password" placeholder={user ? "Manter senha atual" : "Minimo 6 caracteres"} {...register("password")} />
      </label>
      <label>
        Permissao
        <select className={`mt-2 ${selectClass}`} {...register("role")}>
          <option value="USER">Usuario</option>
          <option value="PARTNER">Parceiro</option>
          <option value="MANAGER">Gestor</option>
          <option value="ADMIN">Administrador</option>
        </select>
        {errors.role && <small className="text-red-400">{errors.role.message}</small>}
      </label>
      {selectedRole === "PARTNER" && (
        <label>
          Parceiro vinculado
          <select className={`mt-2 ${selectClass}`} {...register("partnerId")}>
            <option value="">Selecione o parceiro</option>
            {partners.map((partner) => <option key={partner.id} value={partner.id}>{partner.name} {partner.company ? `- ${partner.company}` : ""}</option>)}
          </select>
          {errors.partnerId && <small className="text-red-400">{errors.partnerId.message}</small>}
        </label>
      )}
      <label>
        Tema
        <select className={`mt-2 ${selectClass}`} {...register("theme")}>
          <option value="dark">Escuro nativo</option>
          <option value="light">Claro</option>
        </select>
      </label>
      <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-sidebar p-3 md:col-span-2">
        <input type="checkbox" {...register("notifications")} />
        <Bell size={17} className="text-accent" />
        Receber notificacoes do sistema
      </label>
      {selectedRole === "PARTNER" && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-100 md:col-span-2">
          <p className="font-semibold">Acesso de parceiro</p>
          <p className="mt-1 text-emerald-100/80">Este usuario acessa a gestao do parceiro vinculado, acompanhando clientes/projetos relacionados, vendas realizadas por ele e regras de comissao.</p>
        </div>
      )}
      <div className="flex justify-end gap-3 md:col-span-2">
        <Button type="button" variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button disabled={isSubmitting}>{isSubmitting ? "Salvando..." : "Salvar usuario"}</Button>
      </div>
    </form>
  );
}

export default function UsersPage() {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserAccount | undefined>();
  const [userToDelete, setUserToDelete] = useState<UserAccount | undefined>();
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.get<UserAccount[]>("/users"),
    enabled: session?.user.role === "ADMIN"
  });
  const partnersQuery = useQuery({
    queryKey: ["partners", "user-form"],
    queryFn: () => api.get<PageResult<Partner>>("/partners?pageSize=200"),
    enabled: session?.user.role === "ADMIN"
  });

  const users = usersQuery.data ?? [];
  const partners = partnersQuery.data?.data ?? [];
  const filteredUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) => [user.name, user.email, roleLabels[user.role], user.partner?.name ?? ""].some((field) => field.toLowerCase().includes(term)));
  }, [search, users]);

  const metrics = useMemo(() => ({
    total: users.length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    managers: users.filter((user) => user.role === "MANAGER").length,
    partners: users.filter((user) => user.role === "PARTNER").length,
    notifications: users.filter((user) => user.notifications).length
  }), [users]);

  const saveUser = useMutation({
    mutationFn: ({ id, data }: SaveUserInput) => id ? api.put<UserAccount>(`/users/${id}`, data) : api.post<UserAccount>("/users", data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setDialogOpen(false);
      setSelectedUser(undefined);
      toast("Usuario salvo.");
    },
    onError: (error) => toast(error.message, "error")
  });

  const removeUser = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["users"] });
      setUserToDelete(undefined);
      toast("Usuario excluido.");
    },
    onError: (error) => toast(error.message, "error")
  });

  if (session?.user.role !== "ADMIN") {
    return (
      <Card className="mx-auto max-w-xl text-center">
        <ShieldCheck className="mx-auto mb-4 text-accent" size={36} />
        <CardTitle>Acesso administrativo</CardTitle>
        <p className="mt-3 text-sm leading-6 text-slate-400">Somente administradores podem cadastrar, editar e excluir usuarios do sistema.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="grid gap-4 md:grid-cols-4">
        <Card><p className="text-sm text-slate-400">Usuarios cadastrados</p><p className="mt-3 text-3xl font-semibold">{metrics.total}</p></Card>
        <Card><p className="text-sm text-slate-400">Administradores</p><p className="mt-3 text-3xl font-semibold">{metrics.admins}</p></Card>
        <Card><p className="text-sm text-slate-400">Gestores</p><p className="mt-3 text-3xl font-semibold">{metrics.managers}</p></Card>
        <Card><p className="text-sm text-slate-400">Usuarios parceiros</p><p className="mt-3 text-3xl font-semibold">{metrics.partners}</p></Card>
      </section>

      <div className="flex flex-col gap-3 lg:flex-row">
        <label className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-500" size={18} />
          <Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, e-mail ou permissao" />
        </label>
        <Button onClick={() => { setSelectedUser(undefined); setDialogOpen(true); }}>
          <Plus size={17} /> Novo usuario
        </Button>
      </div>

      <Card className="overflow-x-auto p-0">
        {usersQuery.isLoading ? <Skeleton className="m-5 h-72" /> : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-slate-700 text-xs uppercase text-slate-400">
              <tr><th className="p-5">Usuario</th><th>Permissao</th><th>Parceiro</th><th>Notificacoes</th><th>Criado em</th><th /></tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isCurrentUser = user.id === session.user.id;
                return (
                  <tr key={user.id} className="border-b border-slate-700/50">
                    <td className="p-5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent"><UsersRound size={18} /></span>
                        <div><p className="font-medium">{user.name}</p><p className="text-xs text-slate-400">{user.email}</p></div>
                      </div>
                    </td>
                    <td><span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs text-blue-300">{roleLabels[user.role]}</span></td>
                    <td>{user.partner ? <span className="inline-flex items-center gap-2 text-slate-200"><Handshake size={15} className="text-accent" /> {user.partner.name}</span> : "-"}</td>
                    <td>{user.notifications ? "Ativas" : "Inativas"}</td>
                    <td>{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="flex justify-end gap-1 pr-3">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedUser(user); setDialogOpen(true); }} aria-label="Editar usuario"><Edit3 size={17} /></Button>
                        <Button variant="danger" size="icon" disabled={isCurrentUser} onClick={() => setUserToDelete(user)} aria-label="Excluir usuario"><Trash2 size={17} /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!usersQuery.isLoading && filteredUsers.length === 0 && <div className="p-8 text-center text-sm text-slate-400">Nenhum usuario encontrado.</div>}
      </Card>

      <Dialog open={dialogOpen} title={selectedUser ? "Editar usuario" : "Novo usuario"} onClose={() => setDialogOpen(false)}>
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-slate-700 bg-sidebar p-3 text-sm text-slate-300">
          {selectedUser ? <KeyRound className="mt-0.5 text-accent" size={18} /> : <UserPlus className="mt-0.5 text-accent" size={18} />}
          <span>{selectedUser ? "Preencha a senha somente quando desejar troca-la." : "O usuario sera criado no banco com senha criptografada."}</span>
        </div>
        <UserForm
          user={selectedUser}
          partners={partners}
          onCancel={() => setDialogOpen(false)}
          onSave={(data) => saveUser.mutateAsync({ id: selectedUser?.id, data }).then(() => undefined)}
        />
      </Dialog>

      <ConfirmDialog
        open={Boolean(userToDelete)}
        title="Excluir usuario"
        description={`Deseja excluir "${userToDelete?.name ?? ""}"? Essa acao remove o acesso ao sistema.`}
        confirmLabel="Excluir"
        loading={removeUser.isPending}
        onClose={() => setUserToDelete(undefined)}
        onConfirm={() => { if (userToDelete) removeUser.mutate(userToDelete.id); }}
      />
    </div>
  );
}
