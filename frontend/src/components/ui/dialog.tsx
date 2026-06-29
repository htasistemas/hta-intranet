import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function Dialog({ open, title, children, onClose, className }: { open: boolean; title: string; children: ReactNode; onClose: () => void; className?: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation" onMouseDown={onClose}>
      <section className={cn("max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-700 bg-card p-6 shadow-2xl", className)} role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <header className="mb-5 flex items-center justify-between"><h2 className="text-lg font-semibold">{title}</h2><button onClick={onClose} aria-label="Fechar"><X /></button></header>
        {children}
      </section>
    </div>
  );
}
