import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Navigate } from "react-router-dom";
import { z } from "zod";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";

const schema = z.object({ email: z.string().email("Informe um email valido."), password: z.string().min(6, "Minimo de 6 caracteres.") });
type LoginFields = z.infer<typeof schema>;

export default function LoginPage() {
  const { session, login } = useAuth();
  const { toast } = useToast();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<LoginFields>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  if (session) return <Navigate to="/" replace />;
  const onSubmit = async (values: LoginFields): Promise<void> => {
    try { await login(values.email, values.password); }
    catch (error) { toast(error instanceof Error ? error.message : "Erro no login.", "error"); }
  };
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-background p-5">
      <div className="absolute inset-0 -z-0 bg-[radial-gradient(circle_at_30%_20%,rgba(45,212,191,.13),transparent_30%),radial-gradient(circle_at_70%_50%,rgba(59,130,246,.17),transparent_32%)]" />
      <Card className="relative z-10 grid w-full max-w-5xl overflow-hidden p-0 lg:grid-cols-2">
        <div className="p-8">
          <div className="mb-8 flex items-center gap-3">
            <span className="gradient-fill grid h-12 w-12 place-items-center rounded-2xl"><Sparkles /></span>
            <div><h1 className="text-xl font-bold">HTA <span className="gradient-text">Sistemas</span></h1><p className="text-sm text-slate-400">Entre na sua central de gestao</p></div>
          </div>
          <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} autoComplete="off">
            <label className="block text-sm text-slate-300">Email<Input className="mt-2" type="email" autoComplete="off" {...register("email")} />{errors.email && <small className="text-red-400">{errors.email.message}</small>}</label>
            <label className="block text-sm text-slate-300">Senha<Input className="mt-2" type="password" autoComplete="new-password" {...register("password")} />{errors.password && <small className="text-red-400">{errors.password.message}</small>}</label>
            <Button className="w-full" disabled={isSubmitting}>{isSubmitting ? "Entrando..." : "Entrar"}</Button>
          </form>
        </div>
        <img className="hidden h-full min-h-[520px] w-full object-cover object-center opacity-90 lg:block" src="/assets/login-hero.png" alt="" aria-hidden="true" />
      </Card>
    </div>
  );
}
