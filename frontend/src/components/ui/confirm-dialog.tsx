import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({ open, title, description, confirmLabel, cancelLabel = "Cancelar", loading = false, onConfirm, onClose }: ConfirmDialogProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4" role="presentation" onMouseDown={onClose}>
      <section className="w-full max-w-4xl rounded-2xl border border-slate-700 bg-card p-6 shadow-2xl" role="alertdialog" aria-modal="true" aria-labelledby="confirm-dialog-title" aria-describedby="confirm-dialog-description" onMouseDown={(event) => event.stopPropagation()}>
        <div className="grid gap-5 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-red-500/15 text-red-300">
            <AlertTriangle size={22} />
          </span>
          <div>
            <h2 id="confirm-dialog-title" className="text-lg font-semibold">{title}</h2>
            <p id="confirm-dialog-description" className="mt-2 text-sm leading-6 text-slate-300">{description}</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={onClose} disabled={loading}>{cancelLabel}</Button>
            <Button type="button" variant="danger" onClick={onConfirm} disabled={loading}>{loading ? "Processando..." : confirmLabel}</Button>
          </div>
        </div>
      </section>
    </div>
  );
}
