import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { api } from "@/services/api";
import type { ClientImportResult, ClientStatus } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { csvSeparator, downloadCsv, emptyCsvCellToNull, normalizeCsvHeader, splitCsvLine } from "@/lib/csv-import";

const formSchema = z.object({
  fileName: z.string().min(1, "Selecione um arquivo CSV.")
});

const rowSchema = z.object({
  name: z.string().min(2, "Informe o nome do cliente."),
  document: z.string().nullable(),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  legalName: z.string().nullable(),
  tradeName: z.string().nullable(),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  email: z.string().email("Email invalido.").nullable().or(z.literal("")),
  postalCode: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  responsible: z.string().nullable(),
  segment: z.string().nullable(),
  source: z.string().nullable(),
  observations: z.string().nullable(),
  status: z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]),
  tagIds: z.array(z.string()),
  projectIds: z.array(z.string())
});

type FormFields = z.infer<typeof formSchema>;
type ImportRow = z.infer<typeof rowSchema>;

interface ParsedImport {
  rows: ImportRow[];
  errors: Array<{ row: number; message: string }>;
}

const templateHeaders = [
  "nome",
  "documento",
  "tipo",
  "telefone",
  "whatsapp",
  "email",
  "cep",
  "logradouro",
  "numero",
  "bairro",
  "cidade",
  "estado",
  "responsavel",
  "segmento",
  "origem",
  "observacoes",
  "status"
];

const headerAliases: Record<string, keyof ImportRow> = {
  nome: "name",
  "nome completo": "name",
  cliente: "name",
  documento: "document",
  cpf: "document",
  cnpj: "document",
  tipo: "type",
  "razao social": "legalName",
  razaosocial: "legalName",
  "nome fantasia": "tradeName",
  telefone: "phone",
  celular: "phone",
  whatsapp: "whatsapp",
  email: "email",
  "e-mail": "email",
  cep: "postalCode",
  endereco: "street",
  "endereco completo": "street",
  logradouro: "street",
  rua: "street",
  numero: "number",
  bairro: "district",
  cidade: "city",
  estado: "state",
  uf: "state",
  responsavel: "responsible",
  "nome do responsavel": "responsible",
  segmento: "segment",
  seguimento: "segment",
  origem: "source",
  observacoes: "observations",
  status: "status"
};

function normalizeType(value: string | undefined): "INDIVIDUAL" | "COMPANY" {
  const text = normalizeCsvHeader(value ?? "");
  return ["empresa", "company", "pj", "juridica", "pessoa juridica"].includes(text) ? "COMPANY" : "INDIVIDUAL";
}

function normalizeStatus(value: string | undefined): ClientStatus {
  const text = normalizeCsvHeader(value ?? "");
  if (["ativo", "active"].includes(text)) return "ACTIVE";
  if (["inativo", "inactive"].includes(text)) return "INACTIVE";
  return "ACTIVE";
}

function parseCsv(text: string): ParsedImport {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const [headerLine, ...dataLines] = lines;
  if (!headerLine) return { rows: [], errors: [{ row: 1, message: "Arquivo vazio." }] };

  const separator = csvSeparator(headerLine);
  const headers = splitCsvLine(headerLine, separator).map((header) => headerAliases[normalizeCsvHeader(header)]);
  const rows: ImportRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  dataLines.forEach((line, index) => {
    const cells = splitCsvLine(line, separator);
    const raw: Partial<Record<keyof ImportRow, string>> = {};
    headers.forEach((field, cellIndex) => {
      if (field) raw[field] = cells[cellIndex] ?? "";
    });

    const parsed = rowSchema.safeParse({
      name: raw.name?.trim() ?? "",
      document: emptyCsvCellToNull(raw.document),
      type: normalizeType(raw.type),
      legalName: emptyCsvCellToNull(raw.legalName),
      tradeName: emptyCsvCellToNull(raw.tradeName),
      phone: emptyCsvCellToNull(raw.phone),
      whatsapp: emptyCsvCellToNull(raw.whatsapp),
      email: emptyCsvCellToNull(raw.email) ?? "",
      postalCode: emptyCsvCellToNull(raw.postalCode),
      street: emptyCsvCellToNull(raw.street),
      number: emptyCsvCellToNull(raw.number),
      district: emptyCsvCellToNull(raw.district),
      city: emptyCsvCellToNull(raw.city),
      state: emptyCsvCellToNull(raw.state),
      responsible: emptyCsvCellToNull(raw.responsible),
      segment: emptyCsvCellToNull(raw.segment),
      source: emptyCsvCellToNull(raw.source),
      observations: emptyCsvCellToNull(raw.observations),
      status: normalizeStatus(raw.status),
      tagIds: [],
      projectIds: []
    });

    if (parsed.success) rows.push(parsed.data);
    else errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
  });

  return { rows, errors };
}

function downloadTemplate(): void {
  downloadCsv("modelo-importacao-clientes.csv", [
    templateHeaders.join(";"),
    "Maria Silva;12345678901;Pessoa fisica;(11) 99999-9999;(11) 99999-9999;maria@empresa.com;01001-000;Praca da Se;100;Centro;Sao Paulo;SP;Ana Souza;Varejo;Indicacao;Cliente importado;Ativo"
  ]);
}

export function ClientImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (result: ClientImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport>({ rows: [], errors: [] });
  const [importResult, setImportResult] = useState<ClientImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormFields>({ resolver: zodResolver(formSchema), defaultValues: { fileName: "" } });
  const preview = useMemo(() => parsed.rows.slice(0, 5), [parsed.rows]);

  const selectFile = async (selectedFile: File | undefined): Promise<void> => {
    setFile(selectedFile ?? null);
    setValue("fileName", selectedFile?.name ?? "", { shouldValidate: true });
    if (!selectedFile) {
      setParsed({ rows: [], errors: [] });
      setImportResult(null);
      return;
    }
    const content = await selectedFile.text();
    setParsed(parseCsv(content));
    setImportResult(null);
  };

  const submit = async (): Promise<void> => {
    if (!file) return;
    if (!parsed.rows.length) {
      toast("Nenhum cliente valido encontrado no arquivo.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await api.post<ClientImportResult>("/clients/import", { rows: parsed.rows });
      setImportResult(result);
      onImported(result);
      if (!result.failed) onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Falha na importacao.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} title="Importar clientes" onClose={onClose}>
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(submit)(event)}>
        <div className="rounded-xl border border-slate-700 bg-sidebar p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Arquivo CSV</p>
              <p className="mt-1 text-xs text-slate-400">Use cabecalhos como nome, endereco, telefone, email, responsavel e segmento.</p>
            </div>
            <Button type="button" variant="outline" onClick={downloadTemplate}><Download size={16} /> Baixar modelo</Button>
          </div>
        </div>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Selecionar arquivo</span>
          <Input type="file" accept=".csv,text/csv" onChange={(event) => void selectFile(event.target.files?.[0])} />
          <input type="hidden" {...register("fileName")} />
          {errors.fileName?.message && <small className="text-red-400">{errors.fileName.message}</small>}
        </label>

        {parsed.errors.length > 0 && (
          <div className="max-h-32 overflow-y-auto rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
            {parsed.errors.map((error) => <p key={`${error.row}-${error.message}`}>Linha {error.row}: {error.message}</p>)}
          </div>
        )}

        {importResult && importResult.errors.length > 0 && (
          <div className="max-h-36 overflow-y-auto rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
            <p className="mb-2 font-medium">{importResult.created} cliente(s) importado(s). Corrija as linhas abaixo e envie novamente.</p>
            {importResult.errors.map((error) => <p key={`${error.row}-${error.message}`}>Linha {error.row}{error.name ? ` (${error.name})` : ""}: {error.message}</p>)}
          </div>
        )}

        {preview.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400"><tr><th className="p-3">Cliente</th><th>Email</th><th>Telefone</th><th>Localidade</th><th>Responsavel</th><th>Segmento</th></tr></thead>
              <tbody>{preview.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-slate-700/50">
                  <td className="p-3">{row.name}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.phone ?? "-"}</td>
                  <td>{[row.city, row.state].filter(Boolean).join(" / ") || "-"}</td>
                  <td>{row.responsible ?? "-"}</td>
                  <td>{row.segment ?? "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">{parsed.rows.length} cliente(s) validos para importar.</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button disabled={loading}><Upload size={16} /> {loading ? "Importando..." : "Importar clientes"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
