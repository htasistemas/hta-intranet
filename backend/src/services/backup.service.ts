import { execFile, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { ApiError } from "../utils/api-error.js";
import { env } from "../utils/env.js";

const execFileAsync = promisify(execFile);

export type BackupEnvironment = "development" | "production";

interface BackupEnvironmentConfig {
  composeFile: string;
  envFile?: string;
  label: string;
}

interface CommandResult {
  stdout: string;
  stderr: string;
}

export type RestoreProgressType = "info" | "error" | "success";

export interface RestoreProgressEvent {
  type: RestoreProgressType;
  message: string;
}

export interface BackupFileResult {
  filePath: string;
  fileName: string;
}

const environmentConfigs: Record<BackupEnvironment, BackupEnvironmentConfig> = {
  development: { composeFile: "docker-compose.yml", label: "backup-dev" },
  production: { composeFile: "docker-compose.prod.yml", envFile: ".env.production", label: "backup-producao" }
};

function repoRoot(): string {
  const current = process.cwd();
  if (existsSync(path.join(current, "scripts"))) return current;
  return path.resolve(current, "..");
}

function commandErrorMessage(error: unknown): string {
  if (error instanceof Error && "stderr" in error && typeof error.stderr === "string" && error.stderr.trim()) {
    return error.stderr.trim();
  }
  if (error instanceof Error && error.message) return error.message;
  return "Falha ao executar rotina de backup.";
}

function postgresToolDatabaseUrl(): string {
  const databaseUrl = new URL(env.DATABASE_URL);
  databaseUrl.searchParams.delete("schema");
  return databaseUrl.toString();
}

function postgresTargetLabel(): string {
  const databaseUrl = new URL(env.DATABASE_URL);
  return `${databaseUrl.hostname}:${databaseUrl.port || "5432"}${databaseUrl.pathname}`;
}

async function runCommand(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv = {}): Promise<CommandResult> {
  try {
    return await execFileAsync(command, args, {
      cwd,
      env: { ...process.env, ...env },
      maxBuffer: 1024 * 1024 * 5,
      timeout: 1000 * 60 * 10
    });
  } catch (error) {
    throw new ApiError(500, commandErrorMessage(error));
  }
}

async function runCommandWithProgress(
  command: string,
  args: string[],
  cwd: string,
  onProgress: (event: RestoreProgressEvent) => void,
  env: NodeJS.ProcessEnv = {}
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      windowsHide: true
    });

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      chunk.split(/\r?\n/).filter(Boolean).forEach((message) => onProgress({ type: "info", message }));
    });
    child.stderr.on("data", (chunk: string) => {
      chunk.split(/\r?\n/).filter(Boolean).forEach((message) => onProgress({ type: "info", message }));
    });
    child.on("error", (error) => reject(new ApiError(500, error.message)));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new ApiError(500, `Restauracao finalizada com erro. Codigo de saida: ${code ?? "desconhecido"}.`));
    });
  });
}

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["--version"], { timeout: 10000 });
    return true;
  } catch {
    return false;
  }
}

async function resolvePgTool(tool: "pg_dump" | "pg_restore"): Promise<string> {
  if (await commandAvailable(tool)) return tool;

  if (process.platform === "win32") {
    const executable = `${tool}.exe`;
    const candidates = ["17", "16", "15", "14"].map((version) => path.join("C:\\Program Files\\PostgreSQL", version, "bin", executable));
    const found = candidates.find((candidate) => existsSync(candidate));
    if (found) return found;
  }

  throw new ApiError(500, `${tool} nao foi encontrado. Instale o PostgreSQL client tools ou adicione o binario ao PATH.`);
}

export class BackupService {
  public async createBackup(environment: BackupEnvironment): Promise<BackupFileResult> {
    const root = repoRoot();
    const config = environmentConfigs[environment];
    const outputDir = path.join(root, "backups", "api");
    const fileName = `${config.label}-${new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-")}.dump`;
    const filePath = path.join(outputDir, fileName);

    await mkdir(outputDir, { recursive: true });

    if (!(await commandAvailable("docker"))) {
      const pgDump = await resolvePgTool("pg_dump");
      await runCommand(pgDump, ["-d", postgresToolDatabaseUrl(), "-F", "c", "-f", filePath], root);
      return { filePath, fileName };
    }

    const before = existsSync(outputDir) ? await readdir(outputDir) : [];

    if (process.platform === "win32") {
      const args = [
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        path.join(root, "scripts", "db-backup.ps1"),
        "-ComposeFile",
        config.composeFile
      ];
      if (config.envFile) args.push("-EnvFile", config.envFile);
      args.push("-Service", "postgres", "-OutputDir", outputDir, "-Label", config.label);
      await runCommand("powershell.exe", args, root);
    } else {
      await runCommand("sh", [path.join(root, "scripts", "db-backup.sh")], root, {
        COMPOSE_FILE: config.composeFile,
        ENV_FILE: config.envFile ?? "",
        SERVICE: "postgres",
        OUTPUT_DIR: outputDir,
        LABEL: config.label
      });
    }

    const after = await readdir(outputDir);
    const created = after.filter((fileName) => fileName.endsWith(".dump") && !before.includes(fileName)).sort().at(-1);
    if (!created) throw new ApiError(500, "Backup executado, mas o arquivo gerado nao foi encontrado.");
    return { filePath: path.join(outputDir, created), fileName: created };
  }

  public async restoreBackup(environment: BackupEnvironment, fileName: string, file: Buffer): Promise<void> {
    await this.restoreBackupWithProgress(environment, fileName, file, () => undefined);
  }

  public async restoreBackupWithProgress(
    environment: BackupEnvironment,
    fileName: string,
    file: Buffer,
    onProgress: (event: RestoreProgressEvent) => void
  ): Promise<void> {
    if (!file.length) throw new ApiError(422, "Arquivo de backup vazio.");
    if (!fileName.endsWith(".dump")) throw new ApiError(422, "Envie um arquivo .dump.");

    const root = repoRoot();
    const config = environmentConfigs[environment];
    const tempDir = await mkdtemp(path.join(tmpdir(), "hta-restore-"));
    const safeFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, "-");
    const backupPath = path.join(tempDir, safeFileName);

    try {
      onProgress({ type: "info", message: "Arquivo recebido. Preparando restauracao..." });
      await writeFile(backupPath, file);
      if (!(await commandAvailable("docker"))) {
        const pgRestore = await resolvePgTool("pg_restore");
        onProgress({ type: "info", message: "Docker nao encontrado. Usando pg_restore local." });
        onProgress({ type: "info", message: `Banco de destino: ${postgresTargetLabel()}` });
        await runCommandWithProgress(
          pgRestore,
          ["-d", postgresToolDatabaseUrl(), "--clean", "--if-exists", "--no-owner", "--no-privileges", "--verbose", "--exit-on-error", "--single-transaction", backupPath],
          root,
          onProgress
        );
        onProgress({ type: "success", message: "Restauracao concluida com sucesso." });
        return;
      }

      onProgress({ type: "info", message: "Docker encontrado. Executando rotina de restauracao no container." });
      if (process.platform === "win32") {
        const args = [
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          path.join(root, "scripts", "db-restore.ps1"),
          "-BackupFile",
          backupPath,
          "-ComposeFile",
          config.composeFile
        ];
        if (config.envFile) args.push("-EnvFile", config.envFile);
        args.push("-Service", "postgres", "-Yes");
        await runCommandWithProgress("powershell.exe", args, root, onProgress);
      } else {
        await runCommandWithProgress(
          "sh",
          [path.join(root, "scripts", "db-restore.sh"), backupPath],
          root,
          onProgress,
          {
            COMPOSE_FILE: config.composeFile,
            ENV_FILE: config.envFile ?? "",
            SERVICE: "postgres",
            YES: "1"
          }
        );
      }
      onProgress({ type: "success", message: "Restauracao concluida com sucesso." });
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
