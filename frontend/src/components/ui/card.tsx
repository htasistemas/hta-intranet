import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export const Card = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(function Card({ className, ...props }, ref) {
  return <div ref={ref} className={cn("rounded-2xl border border-slate-700/50 bg-card p-5 shadow-sm transition hover:border-slate-600 hover:shadow-glow", className)} {...props} />;
});

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("mb-4 text-base font-semibold text-foreground", className)} {...props} />;
}
