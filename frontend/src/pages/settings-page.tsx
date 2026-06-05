import { useMutation, useQuery } from "@tanstack/react-query";
import { Bell, LockKeyhole, MoonStar, UserRound } from "lucide-react";
import { useForm } from "react-hook-form";
import { api } from "@/services/api";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/contexts/toast-context";

interface Profile { name: string; email: string; role: string; theme: "dark" | "light"; notifications: boolean; }

export default function SettingsPage() {
  const { toast } = useToast();
  const { data } = useQuery({ queryKey: ["profile"], queryFn: () => api.get<Profile>("/users/me") });
  const { register, handleSubmit } = useForm<{ name: string; theme: "dark" | "light"; notifications: boolean }>({ values: { name: data?.name ?? "", theme: data?.theme ?? "dark", notifications: data?.notifications ?? true } });
  const update = useMutation({ mutationFn: (input: { name: string; theme: "dark" | "light"; notifications: boolean }) => api.put<Profile>("/users/me", input), onSuccess: () => toast("Configuracoes atualizadas."), onError: (error) => toast(error.message, "error") });
  return (
    <form className="grid gap-5 xl:grid-cols-2" onSubmit={handleSubmit((values) => update.mutate(values))}>
      <Card><CardTitle><span className="flex items-center gap-2"><UserRound size={18} className="text-accent" /> Perfil</span></CardTitle><label>Nome<Input className="mt-2" {...register("name")} /></label><label className="mt-4 block">Email<Input className="mt-2" value={data?.email ?? ""} disabled /></label></Card>
      <Card><CardTitle><span className="flex items-center gap-2"><MoonStar size={18} className="text-accent" /> Aparencia</span></CardTitle><label>Tema<select className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3" {...register("theme")}><option value="dark">Escuro nativo</option><option value="light">Claro</option></select></label><label className="mt-5 flex items-center gap-3"><input type="checkbox" {...register("notifications")} /><Bell size={16} /> Receber notificacoes</label></Card>
      <Card><CardTitle><span className="flex items-center gap-2"><LockKeyhole size={18} className="text-accent" /> Seguranca</span></CardTitle><p className="text-sm text-slate-400">Sessao protegida com JWT de curta duracao e rotacao de refresh token.</p></Card>
      <div className="flex items-end justify-end"><Button disabled={update.isPending}>{update.isPending ? "Salvando..." : "Salvar configuracoes"}</Button></div>
    </form>
  );
}
