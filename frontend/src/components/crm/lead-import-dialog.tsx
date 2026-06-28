import { zodResolver } from "@hookform/resolvers/zod";
import { Download, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { read, utils } from "xlsx";
import { z } from "zod";
import { api } from "@/services/api";
import type { Priority } from "@/types";
import type { CrmLeadImportResult, CrmLeadScore, CrmLeadStatus, CrmPipelineStage } from "@/types/crm";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/contexts/toast-context";
import { csvSeparator, downloadCsv, emptyCsvCellToNull, normalizeCsvHeader, splitCsvLine } from "@/lib/csv-import";

const formSchema = z.object({
  fileName: z.string().min(1, "Selecione um arquivo CSV ou XLSX."),
  defaultSegment: z.string().trim(),
  defaultResponsible: z.string().trim()
});

const leadRowSchema = z.object({
  name: z.string().min(2, "Informe o nome."),
  company: z.string().nullable(),
  document: z.string().nullable(),
  segment: z.string().nullable(),
  position: z.string().nullable(),
  email: z.string().email("E-mail invalido.").nullable().or(z.literal("")),
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  site: z.string().nullable(),
  postalCode: z.string().nullable(),
  street: z.string().nullable(),
  number: z.string().nullable(),
  district: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  source: z.string().nullable(),
  campaign: z.string().nullable(),
  responsible: z.string().min(2, "Informe o responsavel."),
  interest: z.string().nullable(),
  productInterest: z.string().nullable(),
  estimatedValue: z.number().nonnegative().nullable(),
  observations: z.string().nullable(),
  score: z.enum(["VERY_HOT", "HOT", "WARM", "COLD"]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]),
  status: z.enum(["NEW", "IN_SERVICE", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON", "LOST"]),
  stage: z.enum(["LEAD_RECEIVED", "FIRST_CONTACT", "QUALIFICATION", "DEMONSTRATION", "PROPOSAL_SENT", "NEGOTIATION", "APPROVAL", "IMPLEMENTATION", "SALE_COMPLETED", "LOST"]),
  lostReason: z.string().nullable(),
  lastInteractionAt: z.string().nullable(),
  nextFollowUpAt: z.string().nullable()
});

type FormFields = z.infer<typeof formSchema>;
type LeadImportRow = z.infer<typeof leadRowSchema>;
type CsvLeadField = keyof LeadImportRow | "foundationDate" | "situation" | "sources";

interface ParseDefaults {
  segment: string;
  responsible: string;
}

interface ParsedImport {
  rows: LeadImportRow[];
  errors: Array<{ row: number; message: string }>;
}

const importChunkSize = 1000;

const templateHeaders = [
  "cidade",
  "uf",
  "cnpj",
  "razao social",
  "nome fantasia",
  "situacao",
  "data da fundacao",
  "endereco completo",
  "seguimento"
];

const headerAliases: Record<string, CsvLeadField> = {
  nome: "name",
  cliente: "name",
  lead: "name",
  instituicao: "company",
  "instituição": "company",
  empresa: "company",
  organizacao: "company",
  "razao social": "company",
  razaosocial: "company",
  "nome fantasia": "name",
  nomefantasia: "name",
  "nome fantasia/sigla": "name",
  "nome fantasia sigla": "name",
  documento: "document",
  cnpj: "document",
  cpf: "document",
  segmento: "segment",
  seguimento: "segment",
  "segmento da captacao": "segment",
  "area principal": "segment",
  "cnae principal": "segment",
  "subareas marcadas": "segment",
  "area de atuacao": "segment",
  "área de atuação": "segment",
  areadeatuacao: "segment",
  cargo: "position",
  email: "email",
  "e-mail": "email",
  telefone: "phone",
  celular: "phone",
  whatsapp: "whatsapp",
  "telefone/whatsapp": "phone",
  "telefone whatsapp": "phone",
  site: "site",
  instagram: "site",
  "site/instagram": "site",
  "site instagram": "site",
  cep: "postalCode",
  logradouro: "street",
  endereco: "street",
  "endereco completo": "street",
  enderecocompleto: "street",
  rua: "street",
  numero: "number",
  bairro: "district",
  cidade: "city",
  estado: "state",
  uf: "state",
  situacao: "situation",
  "situacao cadastral": "situation",
  "situação": "situation",
  "data da fundacao": "foundationDate",
  "data da fundação": "foundationDate",
  datafundacao: "foundationDate",
  "data fundacao": "foundationDate",
  origem: "source",
  campanha: "campaign",
  responsavel: "responsible",
  "responsável": "responsible",
  "presidente/diretor/responsavel": "responsible",
  "presidente diretor responsavel": "responsible",
  "presidente/diretor/responsável": "responsible",
  interesse: "interest",
  produto: "productInterest",
  produto_interesse: "productInterest",
  "produto interesse": "productInterest",
  valor: "estimatedValue",
  valor_estimado: "estimatedValue",
  "valor estimado": "estimatedValue",
  observacoes: "observations",
  "observações": "observations",
  "fonte(s)": "sources",
  fontes: "sources",
  fonte: "sources",
  temperatura: "score",
  score: "score",
  prioridade: "priority",
  "prioridade comercial": "priority",
  status: "status"
};

function normalizeMoney(value: string | undefined): number | null {
  const text = value?.trim();
  if (!text) return null;
  const normalized = text.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(?:\D|$))/g, "").replace(",", ".");
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function normalizeScore(value: string | undefined): CrmLeadScore {
  const text = normalizeCsvHeader(value ?? "");
  if (["muito quente", "very hot", "very_hot"].includes(text)) return "VERY_HOT";
  if (["quente", "hot"].includes(text)) return "HOT";
  if (["frio", "cold"].includes(text)) return "COLD";
  return "WARM";
}

function normalizePriority(value: string | undefined): Priority {
  const text = normalizeCsvHeader(value ?? "");
  if (["alta", "high"].includes(text)) return "HIGH";
  if (["urgente", "urgent"].includes(text)) return "URGENT";
  if (["baixa", "low"].includes(text)) return "LOW";
  return "MEDIUM";
}

function normalizeStatus(value: string | undefined): CrmLeadStatus {
  const text = normalizeCsvHeader(value ?? "");
  if (["em atendimento", "atendimento", "in_service"].includes(text)) return "IN_SERVICE";
  if (["qualificado", "qualified"].includes(text)) return "QUALIFIED";
  if (["proposta", "proposta enviada", "proposal_sent"].includes(text)) return "PROPOSAL_SENT";
  if (["negociacao", "negociação", "negotiation"].includes(text)) return "NEGOTIATION";
  if (["ganho", "won"].includes(text)) return "WON";
  if (["perdido", "lost"].includes(text)) return "LOST";
  return "NEW";
}

function normalizeStatusFromSituation(value: string | undefined): CrmLeadStatus {
  const text = normalizeCsvHeader(value ?? "");
  if (["inativa", "inativo", "baixada", "suspensa", "inapta"].some((term) => text.includes(term))) return "LOST";
  return "NEW";
}

function stageFromStatus(status: CrmLeadStatus): CrmPipelineStage {
  const map: Record<CrmLeadStatus, CrmPipelineStage> = {
    NEW: "LEAD_RECEIVED",
    IN_SERVICE: "FIRST_CONTACT",
    QUALIFIED: "QUALIFICATION",
    PROPOSAL_SENT: "PROPOSAL_SENT",
    NEGOTIATION: "NEGOTIATION",
    WON: "SALE_COMPLETED",
    LOST: "LOST"
  };
  return map[status];
}

function joinObservations(values: Array<string | null>): string | null {
  const text = values.filter((value): value is string => Boolean(value && value.trim())).join(" | ");
  return text || null;
}

function parseRows(table: string[][], defaults: ParseDefaults): ParsedImport {
  const [headerCells, ...dataRows] = table.filter((row) => row.some((cell) => cell.trim()));
  if (!headerCells) return { rows: [], errors: [{ row: 1, message: "Arquivo vazio." }] };

  const headers = headerCells.map((header) => headerAliases[normalizeCsvHeader(header)]);
  const rows: LeadImportRow[] = [];
  const errors: Array<{ row: number; message: string }> = [];

  dataRows.forEach((cells, index) => {
    const raw: Partial<Record<CsvLeadField, string>> = {};
    headers.forEach((field, cellIndex) => {
      if (field) raw[field] = cells[cellIndex] ?? "";
    });

    const status = raw.status ? normalizeStatus(raw.status) : normalizeStatusFromSituation(raw.situation);
    const company = emptyCsvCellToNull(raw.company);
    const name = raw.name?.trim() || company || "";
    const situation = emptyCsvCellToNull(raw.situation);
    const foundationDate = emptyCsvCellToNull(raw.foundationDate);
    const originalObservations = emptyCsvCellToNull(raw.observations);
    const sources = emptyCsvCellToNull(raw.sources);
    const parsed = leadRowSchema.safeParse({
      name,
      company,
      document: emptyCsvCellToNull(raw.document),
      segment: emptyCsvCellToNull(raw.segment) ?? emptyCsvCellToNull(defaults.segment),
      position: emptyCsvCellToNull(raw.position),
      email: emptyCsvCellToNull(raw.email) ?? "",
      phone: emptyCsvCellToNull(raw.phone),
      whatsapp: emptyCsvCellToNull(raw.whatsapp),
      site: emptyCsvCellToNull(raw.site),
      postalCode: emptyCsvCellToNull(raw.postalCode),
      street: emptyCsvCellToNull(raw.street),
      number: emptyCsvCellToNull(raw.number),
      district: emptyCsvCellToNull(raw.district),
      city: emptyCsvCellToNull(raw.city),
      state: emptyCsvCellToNull(raw.state),
      source: emptyCsvCellToNull(raw.source),
      campaign: emptyCsvCellToNull(raw.campaign),
      responsible: emptyCsvCellToNull(raw.responsible) ?? emptyCsvCellToNull(defaults.responsible) ?? "Nao informado",
      interest: emptyCsvCellToNull(raw.interest),
      productInterest: emptyCsvCellToNull(raw.productInterest),
      estimatedValue: normalizeMoney(raw.estimatedValue),
      observations: joinObservations([
        situation ? `Situacao: ${situation}` : null,
        foundationDate ? `Data da fundacao: ${foundationDate}` : null,
        sources ? `Fontes: ${sources}` : null,
        originalObservations
      ]),
      score: normalizeScore(raw.score),
      priority: normalizePriority(raw.priority),
      status,
      stage: stageFromStatus(status),
      lostReason: null,
      lastInteractionAt: null,
      nextFollowUpAt: null
    });

    if (parsed.success) rows.push(parsed.data);
    else errors.push({ row: index + 2, message: parsed.error.issues.map((issue) => issue.message).join("; ") });
  });

  return { rows, errors };
}

function parseCsv(text: string, defaults: ParseDefaults): ParsedImport {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  const [headerLine] = lines;
  if (!headerLine) return { rows: [], errors: [{ row: 1, message: "Arquivo vazio." }] };
  const separator = csvSeparator(headerLine);
  return parseRows(lines.map((line) => splitCsvLine(line, separator)), defaults);
}

async function parseSpreadsheet(file: File, defaults: ParseDefaults): Promise<ParsedImport> {
  if (!file.name.toLowerCase().endsWith(".xlsx")) return parseCsv(await file.text(), defaults);
  const workbook = read(await file.arrayBuffer(), { type: "array", cellDates: false });
  const [firstSheetName] = workbook.SheetNames;
  if (!firstSheetName) return { rows: [], errors: [{ row: 1, message: "Planilha vazia." }] };
  const sheet = workbook.Sheets[firstSheetName];
  if (!sheet) return { rows: [], errors: [{ row: 1, message: "Planilha vazia." }] };
  const table = utils.sheet_to_json<string[]>(sheet, { header: 1, defval: "", raw: false });
  return parseRows(table.map((row) => row.map((cell) => String(cell).trim())), defaults);
}

function downloadTemplate(): void {
  downloadCsv("modelo-importacao-captacao.csv", [
    templateHeaders.join(";")
  ]);
}

export function LeadImportDialog({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: (result: CrmLeadImportResult) => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [parsed, setParsed] = useState<ParsedImport>({ rows: [], errors: [] });
  const [importResult, setImportResult] = useState<CrmLeadImportResult | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { register, handleSubmit, setValue, getValues, formState: { errors } } = useForm<FormFields>({
    resolver: zodResolver(formSchema),
    defaultValues: { fileName: "", defaultSegment: "", defaultResponsible: "" }
  });
  const preview = useMemo(() => parsed.rows.slice(0, 5), [parsed.rows]);

  const reparseSelectedFile = async (selectedFile: File | null): Promise<void> => {
    if (!selectedFile) {
      setParsed({ rows: [], errors: [] });
      return;
    }
    const values = formSchema.safeParse(getValues());
    if (!values.success) return;
    setParsed(await parseSpreadsheet(selectedFile, { segment: values.data.defaultSegment, responsible: values.data.defaultResponsible }));
    setImportResult(null);
  };

  const selectFile = async (selectedFile: File | undefined): Promise<void> => {
    setFile(selectedFile ?? null);
    setValue("fileName", selectedFile?.name ?? "", { shouldValidate: true });
    await reparseSelectedFile(selectedFile ?? null);
  };

  const submit = async (fields: FormFields): Promise<void> => {
    if (!file) return;
    const currentParsed = await parseSpreadsheet(file, { segment: fields.defaultSegment, responsible: fields.defaultResponsible });
    setParsed(currentParsed);
    if (!currentParsed.rows.length) {
      toast("Nenhuma captacao valida encontrada no arquivo.", "error");
      return;
    }
    setLoading(true);
    try {
      const result: CrmLeadImportResult = { created: 0, failed: 0, errors: [] };
      for (let index = 0; index < currentParsed.rows.length; index += importChunkSize) {
        const chunk = currentParsed.rows.slice(index, index + importChunkSize);
        const chunkResult = await api.post<CrmLeadImportResult>("/crm/leads/import", { rows: chunk });
        result.created += chunkResult.created;
        result.failed += chunkResult.failed;
        result.errors.push(...chunkResult.errors.map((error) => ({ ...error, row: error.row + index })));
      }
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
    <Dialog open={open} title="Importar captacao" onClose={onClose}>
      <form className="space-y-5" onSubmit={(event) => void handleSubmit(submit)(event)}>
        <div className="rounded-xl border border-slate-700 bg-sidebar p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Arquivo CSV ou XLSX de possiveis clientes</p>
              <p className="mt-1 text-xs text-slate-400">Importe CSV ou XLSX com cidade, UF, CNPJ, razao social, nome fantasia, situacao, data da fundacao, endereco e seguimento.</p>
            </div>
            <Button type="button" variant="outline" onClick={downloadTemplate}><Download size={16} /> Baixar modelo</Button>
          </div>
        </div>

        <section className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 text-sm text-slate-300">
            <span>Segmento da captacao</span>
            <Input placeholder="Opcional: ONGs / Terceiro setor" {...register("defaultSegment", { onBlur: () => void reparseSelectedFile(file) })} />
            {errors.defaultSegment?.message && <small className="text-red-400">{errors.defaultSegment.message}</small>}
          </label>
          <label className="space-y-1 text-sm text-slate-300">
            <span>Responsavel padrao</span>
            <Input placeholder="Opcional: Ana Souza" {...register("defaultResponsible", { onBlur: () => void reparseSelectedFile(file) })} />
            {errors.defaultResponsible?.message && <small className="text-red-400">{errors.defaultResponsible.message}</small>}
          </label>
        </section>

        <label className="block">
          <span className="mb-2 block text-sm text-slate-300">Selecionar arquivo</span>
          <Input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => void selectFile(event.target.files?.[0])} />
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
            <p className="mb-2 font-medium">{importResult.created} captacao(oes) importada(s). Corrija as linhas abaixo e envie novamente.</p>
            {importResult.errors.map((error) => <p key={`${error.row}-${error.message}`}>Linha {error.row}{error.name ? ` (${error.name})` : ""}: {error.message}</p>)}
          </div>
        )}

        {preview.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-700">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-700 text-xs uppercase text-slate-400"><tr><th className="p-3">Possivel cliente</th><th>Empresa</th><th>Segmento</th><th>Email</th><th>Responsavel</th><th>Valor</th></tr></thead>
              <tbody>{preview.map((row, index) => (
                <tr key={`${row.name}-${index}`} className="border-b border-slate-700/50">
                  <td className="p-3">{row.name}</td>
                  <td>{row.company ?? "-"}</td>
                  <td>{row.segment ?? "-"}</td>
                  <td>{row.email || "-"}</td>
                  <td>{row.responsible}</td>
                  <td>{row.estimatedValue ?? "-"}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-700 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-400">{parsed.rows.length} captacao(oes) validas para importar.</p>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button disabled={loading}><Upload size={16} /> {loading ? "Importando..." : "Importar captacao"}</Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
