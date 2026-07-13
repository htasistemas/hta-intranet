import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, KeyRound, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { useForm } from "react-hook-form";
import { Navigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { useToast } from "@/contexts/toast-context";

const loginSchema = z.object({ email: z.string().email("Informe um email valido."), password: z.string().min(6, "Minimo de 6 caracteres.") });
const forgotSchema = z.object({ email: z.string().email("Informe um email valido.") });
const resetSchema = z.object({
  token: z.string().min(32, "Token invalido."),
  password: z.string().min(6, "Minimo de 6 caracteres."),
  confirmPassword: z.string().min(6, "Confirme a senha.")
}).refine((fields) => fields.password === fields.confirmPassword, { message: "As senhas nao conferem.", path: ["confirmPassword"] });

type LoginFields = z.infer<typeof loginSchema>;
type ForgotFields = z.infer<typeof forgotSchema>;
type ResetFields = z.infer<typeof resetSchema>;
type LoginMode = "login" | "forgot" | "reset";

interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccounts {
  id: {
    initialize: (input: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
    renderButton: (element: HTMLElement, options: { theme: "outline" | "filled_blue" | "filled_black"; size: "large"; width?: number; text?: "signin_with" | "continue_with" }) => void;
  };
}

declare global {
  interface Window {
    google?: { accounts: GoogleAccounts };
  }
}

const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

export default function LoginPage() {
  const [params] = useSearchParams();
  const resetToken = params.get("resetToken") ?? "";
  const initialMode = useMemo<LoginMode>(() => resetToken ? "reset" : "login", [resetToken]);
  const [mode, setMode] = useState<LoginMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const { session, login, loginWithGoogle, requestPasswordReset, resetPassword } = useAuth();
  const { toast } = useToast();

  const loginForm = useForm<LoginFields>({ resolver: zodResolver(loginSchema), defaultValues: { email: "", password: "" } });
  const forgotForm = useForm<ForgotFields>({ resolver: zodResolver(forgotSchema), defaultValues: { email: "" } });
  const resetForm = useForm<ResetFields>({ resolver: zodResolver(resetSchema), defaultValues: { token: resetToken, password: "", confirmPassword: "" } });

  useEffect(() => {
    if (!googleClientId || mode !== "login") return;
    const scriptId = "google-identity-services";
    const renderGoogle = () => {
      const container = document.getElementById("google-login-button");
      if (!container || !window.google) return;
      container.innerHTML = "";
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            toast("Nao foi possivel autenticar com Google.", "error");
            return;
          }
          void loginWithGoogle(response.credential).catch((error: unknown) => toast(error instanceof Error ? error.message : "Erro no login com Google.", "error"));
        }
      });
      window.google.accounts.id.renderButton(container, { theme: "outline", size: "large", width: 360, text: "continue_with" });
    };
    const existing = document.getElementById(scriptId);
    if (existing) {
      renderGoogle();
      return;
    }
    const script = document.createElement("script");
    script.id = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = renderGoogle;
    document.head.appendChild(script);
  }, [loginWithGoogle, mode, toast]);

  if (session) return <Navigate to="/" replace />;

  const submitLogin = async (values: LoginFields): Promise<void> => {
    try {
      await login(values.email, values.password);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Erro no login.", "error");
    }
  };

  const submitForgot = async (values: ForgotFields): Promise<void> => {
    try {
      await requestPasswordReset(values.email);
      toast("Se o e-mail estiver cadastrado, enviaremos um link de redefinicao.");
      setMode("login");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Nao foi possivel solicitar a redefinicao.", "error");
    }
  };

  const submitReset = async (values: ResetFields): Promise<void> => {
    try {
      await resetPassword(values.token, values.password);
      toast("Senha redefinida. Entre com a nova senha.");
      setMode("login");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Nao foi possivel redefinir a senha.", "error");
    }
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

          {mode === "login" ? (
            <form className="space-y-5" onSubmit={(event) => void loginForm.handleSubmit(submitLogin)(event)}>
              <label className="block text-sm text-slate-300">Email<Input className="mt-2" type="email" autoComplete="username" {...loginForm.register("email")} />{loginForm.formState.errors.email && <small className="text-red-400">{loginForm.formState.errors.email.message}</small>}</label>
              <label className="block text-sm text-slate-300">
                Senha
                <div className="relative mt-2">
                  <Input type={showPassword ? "text" : "password"} autoComplete="current-password" className="pr-11" {...loginForm.register("password")} />
                  <button type="button" className="absolute right-3 top-3 text-slate-400 hover:text-white" onClick={() => setShowPassword((current) => !current)} aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {loginForm.formState.errors.password && <small className="text-red-400">{loginForm.formState.errors.password.message}</small>}
              </label>
              <Button className="w-full" disabled={loginForm.formState.isSubmitting}>{loginForm.formState.isSubmitting ? "Entrando..." : "Entrar"}</Button>
              {googleClientId ? <div id="google-login-button" className="flex justify-center" /> : null}
              <button type="button" className="flex w-full items-center justify-center gap-2 text-sm text-slate-400 transition hover:text-accent" onClick={() => setMode("forgot")}>
                <KeyRound size={16} /> Esqueci minha senha
              </button>
            </form>
          ) : null}

          {mode === "forgot" ? (
            <form className="space-y-5" onSubmit={(event) => void forgotForm.handleSubmit(submitForgot)(event)}>
              <div className="rounded-xl border border-slate-700 bg-sidebar p-4 text-sm text-slate-300">
                <Mail className="mb-2 text-accent" size={20} />
                Informe seu e-mail. Se ele estiver cadastrado, enviaremos um link para redefinir a senha.
              </div>
              <label className="block text-sm text-slate-300">Email<Input className="mt-2" type="email" {...forgotForm.register("email")} />{forgotForm.formState.errors.email && <small className="text-red-400">{forgotForm.formState.errors.email.message}</small>}</label>
              <Button className="w-full" disabled={forgotForm.formState.isSubmitting}>{forgotForm.formState.isSubmitting ? "Enviando..." : "Enviar link de redefinicao"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>Voltar ao login</Button>
            </form>
          ) : null}

          {mode === "reset" ? (
            <form className="space-y-5" onSubmit={(event) => void resetForm.handleSubmit(submitReset)(event)}>
              <div className="rounded-xl border border-slate-700 bg-sidebar p-4 text-sm text-slate-300">
                <ShieldCheck className="mb-2 text-accent" size={20} />
                Cadastre uma nova senha para sua conta.
              </div>
              <Input type="hidden" {...resetForm.register("token")} />
              <label className="block text-sm text-slate-300">Nova senha<Input className="mt-2" type="password" autoComplete="new-password" {...resetForm.register("password")} />{resetForm.formState.errors.password && <small className="text-red-400">{resetForm.formState.errors.password.message}</small>}</label>
              <label className="block text-sm text-slate-300">Confirmar senha<Input className="mt-2" type="password" autoComplete="new-password" {...resetForm.register("confirmPassword")} />{resetForm.formState.errors.confirmPassword && <small className="text-red-400">{resetForm.formState.errors.confirmPassword.message}</small>}</label>
              <Button className="w-full" disabled={resetForm.formState.isSubmitting}>{resetForm.formState.isSubmitting ? "Redefinindo..." : "Redefinir senha"}</Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setMode("login")}>Voltar ao login</Button>
            </form>
          ) : null}
        </div>
        <img className="hidden h-full min-h-[560px] w-full object-cover object-center opacity-90 lg:block" src="/assets/login-hero.png" alt="" aria-hidden="true" />
      </Card>
    </div>
  );
}
