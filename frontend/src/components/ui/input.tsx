import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("h-11 w-full rounded-xl border border-slate-700 bg-sidebar px-3 text-sm text-foreground outline-none transition placeholder:text-slate-500 focus:border-accent", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("min-h-24 w-full rounded-xl border border-slate-700 bg-sidebar p-3 text-sm text-foreground outline-none focus:border-accent", className)} {...props} />;
}
