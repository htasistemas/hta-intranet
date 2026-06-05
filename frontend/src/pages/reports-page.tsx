import { Download, FileSpreadsheet, FileText, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/services/api";
import { useToast } from "@/contexts/toast-context";

export default function ReportsPage() {
  const { toast } = useToast();
  const download = async (type: "pdf" | "csv") => {
    try { await api.download(`/reports/clients.${type}`, `amtbrasil-clientes.${type}`); toast("Arquivo gerado com sucesso."); }
    catch (error) { toast(error instanceof Error ? error.message : "Falha no relatorio.", "error"); }
  };
  return (
    <div className="space-y-6">
      <Card>
        <CardTitle><span className="flex items-center gap-2"><SlidersHorizontal size={18} className="text-accent" /> Filtros avancados</span></CardTitle>
        <div className="grid gap-4 md:grid-cols-4"><Input placeholder="Cliente ou categoria" /><Input type="date" /><Input type="date" /><Button variant="outline">Aplicar filtros</Button></div>
      </Card>
      <div className="grid gap-5 md:grid-cols-2">
        <Card><FileText className="mb-5 text-accent" size={34} /><h2 className="text-lg font-semibold">Relatorio PDF</h2><p className="mb-6 mt-2 text-sm text-slate-400">Lista formatada de clientes e status para apresentacao.</p><Button onClick={() => void download("pdf")}><Download size={17} /> Exportar PDF</Button></Card>
        <Card><FileSpreadsheet className="mb-5 text-blue-400" size={34} /><h2 className="text-lg font-semibold">Planilha Excel</h2><p className="mb-6 mt-2 text-sm text-slate-400">Arquivo CSV compativel com Excel para analises.</p><Button onClick={() => void download("csv")}><Download size={17} /> Exportar Excel</Button></Card>
      </div>
    </div>
  );
}
