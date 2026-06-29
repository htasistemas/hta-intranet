import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, DatabaseBackup, FileArchive, HardDriveDownload, RotateCcw, ShieldCheck, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { api, authenticatedFetch } from "@/services/api";
import { useToast } from "@/contexts/toast-context";
import { cn } from "@/lib/utils";

const environmentOptions = [
  { value: "development", label: "Desenvolvimento", description: "Usa docker-compose.yml" },
  { value: "production", label: "Producao", description: "Usa docker-compose.prod.yml e .env.production" }
] as const;

const backupFormSchema = z.object({
  environment: z.enum(["development", "production"])
});

const restoreFormSchema = z.object({
  environment: z.enum(["development", "production"]),
  confirmation: z.string().trim().refine((value) => value === "RESTAURAR", "Digite RESTAURAR para liberar a restauracao.")
});

type EnvironmentValue = (typeof environmentOptions)[number]["value"];
type BackupForm = z.input<typeof backupFormSchema>;
type RestoreForm = z.input<typeof restoreFormSchema>;

interface EnvironmentSelectorProps {
  value: EnvironmentValue;
  onChange: (value: EnvironmentValue) => void;
  tone?: "default" | "danger";
}

async function restoreBackup(environment: EnvironmentValue, file: File): Promise<void> {
  const response = await authenticatedFetch(`/backups/restore?environment=${environment}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Backup-Filename": file.name,
      "X-Restore-Confirmation": "RESTAURAR"
    },
    body: await file.arrayBuffer()
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({ message: "Nao foi possivel restaurar o backup." })) as { message?: string };
    throw new Error(result.message ?? "Nao foi possivel restaurar o backup.");
  }
}

function EnvironmentSelector({ value, onChange, tone = "default" }: EnvironmentSelectorProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {environmentOptions.map((option) => {
        const active = option.value === value;
        return (
          <button
            type="button"
            key={option.value}
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-xl border p-4 text-left transition hover:border-accent/70",
              active && tone === "default" && "border-accent bg-accent/10",
              active && tone === "danger" && "border-red-300 bg-red-500/10",
              !active && "border-slate-700 bg-sidebar/60"
            )}
          >
            <span className="block text-sm font-semibold">{option.label}</span>
            <span className="mt-1 block text-xs text-slate-400">{option.description}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function BackupRestorePage() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const backupForm = useForm<BackupForm>({
    resolver: zodResolver(backupFormSchema),
    defaultValues: { environment: "development" }
  });
  const restoreForm = useForm<RestoreForm>({
    resolver: zodResolver(restoreFormSchema),
    mode: "onChange",
    defaultValues: { environment: "development", confirmation: "" }
  });

  const backupEnvironment = backupForm.watch("environment");
  const restoreEnvironment = restoreForm.watch("environment");
  const restoreConfirmation = restoreForm.watch("confirmation");

  const createBackup = useMutation({
    mutationFn: (values: BackupForm) => api.downloadPost("/backups", values, "backup.dump"),
    onSuccess: () => toast("Backup criado e baixado com sucesso."),
    onError: (error) => toast(error instanceof Error ? error.message : "Falha ao criar backup.", "error")
  });

  const restore = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("Selecione um arquivo .dump.");
      const values = restoreFormSchema.parse(restoreForm.getValues());
      await restoreBackup(values.environment, selectedFile);
    },
    onSuccess: () => {
      toast("Backup restaurado com sucesso.");
      setConfirmOpen(false);
      setSelectedFile(null);
      restoreForm.reset({ environment: restoreEnvironment, confirmation: "" });
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    onError: (error) => toast(error instanceof Error ? error.message : "Falha ao restaurar backup.", "error")
  });

  function handleFileChange(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    if (file && !file.name.endsWith(".dump")) {
      toast("Selecione um arquivo .dump.", "error");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    setSelectedFile(file);
  }

  function openRestoreConfirmation() {
    const validation = restoreFormSchema.safeParse(restoreForm.getValues());
    if (!selectedFile) {
      toast("Selecione um arquivo .dump para restaurar.", "error");
      return;
    }
    if (!validation.success) {
      toast(validation.error.errors[0]?.message ?? "Confirme a restauracao.", "error");
      return;
    }
    setConfirmOpen(true);
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardTitle className="flex items-center gap-2"><DatabaseBackup size={18} className="text-accent" /> Backup direto</CardTitle>
          <p className="text-sm leading-6 text-slate-400">O botao executa a rotina no servidor e baixa o arquivo <code>.dump</code> gerado pelo PostgreSQL.</p>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2"><ShieldCheck size={18} className="text-emerald-300" /> Acesso admin</CardTitle>
          <p className="text-sm leading-6 text-slate-400">As acoes usam endpoints protegidos e exigem usuario administrador autenticado.</p>
        </Card>
        <Card>
          <CardTitle className="flex items-center gap-2"><FileArchive size={18} className="text-blue-300" /> Restauracao</CardTitle>
          <p className="text-sm leading-6 text-slate-400">Selecione um arquivo <code>.dump</code>, digite <code>RESTAURAR</code> e confirme a operacao.</p>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardTitle className="flex items-center gap-2"><HardDriveDownload size={18} className="text-accent" /> Criar backup</CardTitle>
          <form className="space-y-5" onSubmit={backupForm.handleSubmit((values) => createBackup.mutate(values))}>
            <EnvironmentSelector
              value={backupEnvironment}
              onChange={(environment) => backupForm.setValue("environment", environment, { shouldValidate: true })}
            />
            <Button type="submit" disabled={createBackup.isPending} className="w-full sm:w-auto">
              {createBackup.isPending ? <RotateCcw className="animate-spin" size={17} /> : <HardDriveDownload size={17} />}
              {createBackup.isPending ? "Criando backup..." : "Criar backup agora"}
            </Button>
          </form>
        </Card>

        <Card>
          <CardTitle className="flex items-center gap-2"><RotateCcw size={18} className="text-red-300" /> Restaurar backup</CardTitle>
          <form className="space-y-5" onSubmit={(event) => event.preventDefault()}>
            <EnvironmentSelector
              value={restoreEnvironment}
              tone="danger"
              onChange={(environment) => restoreForm.setValue("environment", environment, { shouldValidate: true })}
            />
            <label className="block text-sm font-medium">
              Arquivo de backup
              <input
                ref={fileInputRef}
                className="mt-2 h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 py-2 text-sm text-foreground outline-none transition file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white focus:border-accent"
                type="file"
                accept=".dump"
                onChange={(event) => handleFileChange(event.target.files)}
              />
            </label>
            {selectedFile && (
              <div className="flex items-center gap-2 rounded-xl border border-slate-700 bg-sidebar/60 p-3 text-sm text-slate-300">
                <CheckCircle2 size={17} className="text-emerald-300" />
                {selectedFile.name}
              </div>
            )}
            <label className="block text-sm font-medium">
              Confirmacao
              <Input className="mt-2" placeholder="RESTAURAR" {...restoreForm.register("confirmation")} />
            </label>
            <p className="flex gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
              <AlertTriangle className="mt-0.5 shrink-0" size={18} />
              A restauracao substitui dados existentes no banco de destino. Crie um backup recente antes de continuar.
            </p>
            <Button type="button" variant="danger" disabled={restore.isPending || restoreConfirmation !== "RESTAURAR"} onClick={openRestoreConfirmation}>
              {restore.isPending ? <RotateCcw className="animate-spin" size={17} /> : <Upload size={17} />}
              {restore.isPending ? "Restaurando..." : "Restaurar backup"}
            </Button>
          </form>
        </Card>
      </section>

      <ConfirmDialog
        open={confirmOpen}
        title="Confirmar restauracao"
        description="Esta acao pode apagar ou substituir dados existentes. Confirme somente se o arquivo selecionado foi validado."
        confirmLabel="Restaurar agora"
        loading={restore.isPending}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => restore.mutate()}
      />
    </div>
  );
}
