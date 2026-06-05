import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = cva("inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:pointer-events-none disabled:opacity-50", {
  variants: {
    variant: {
      default: "gradient-fill text-white hover:brightness-110",
      outline: "border border-slate-700 bg-transparent hover:bg-white/5",
      ghost: "hover:bg-white/5 text-slate-300",
      danger: "bg-red-500/15 text-red-300 hover:bg-red-500/25"
    },
    size: { default: "", sm: "px-3 py-2 text-xs", icon: "h-10 w-10 p-0" }
  },
  defaultVariants: { variant: "default", size: "default" }
});

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof variants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Component = asChild ? Slot : "button";
  return <Component className={cn(variants({ variant, size }), className)} {...props} />;
}
