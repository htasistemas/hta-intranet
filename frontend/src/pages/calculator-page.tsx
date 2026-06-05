import { Calculator } from "lucide-react";
import { CalculatorPanel } from "@/components/personal/calculator-panel";

export default function CalculatorPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-700/50 bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="gradient-fill grid h-11 w-11 place-items-center rounded-xl text-white">
            <Calculator size={22} />
          </span>
          <div>
            <h2 className="text-lg font-semibold">Calculadora</h2>
            <p className="text-sm text-slate-400">Operações rápidas com suporte ao teclado e histórico recente.</p>
          </div>
        </div>
      </section>
      <CalculatorPanel />
    </div>
  );
}
