import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";

interface Toast { id: number; message: string; type: "success" | "error"; }
interface ToastContextValue { toast: (message: string, type?: Toast["type"]) => void; }
const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((message: string, type: Toast["type"] = "success") => {
    const id = Date.now();
    setToasts((items) => [...items, { id, message, type }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4000);
  }, []);
  const value = useMemo(() => ({ toast }), [toast]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 space-y-3" aria-live="polite">
        {toasts.map((item) => (
          <div key={item.id} className="flex min-w-72 items-center gap-3 rounded-xl border border-slate-700 bg-card p-4 shadow-xl">
            {item.type === "success" ? <CheckCircle2 className="text-accent" /> : <XCircle className="text-red-400" />}
            <span className="flex-1 text-sm">{item.message}</span>
            <button onClick={() => setToasts((items) => items.filter((toastItem) => toastItem.id !== item.id))} aria-label="Fechar"><X size={16} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast requer ToastProvider");
  return context;
}
