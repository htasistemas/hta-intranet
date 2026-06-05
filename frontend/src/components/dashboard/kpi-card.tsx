import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

export function KpiCard({ title, value, icon: Icon, caption }: { title: string; value: string | number; icon: LucideIcon; caption: string }) {
  return (
    <Card className="group">
      <div className="mb-4 flex justify-between"><p className="text-sm text-slate-400">{title}</p><span className="rounded-lg bg-accent/10 p-2 text-accent transition group-hover:bg-accent/20"><Icon size={18} /></span></div>
      <p className="text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{caption}</p>
    </Card>
  );
}
