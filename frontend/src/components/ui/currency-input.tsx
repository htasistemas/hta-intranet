import type { InputHTMLAttributes } from "react";
import { formatCurrencyInput } from "@/lib/currency-input";
import { Input } from "@/components/ui/input";

interface CurrencyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "inputMode" | "value" | "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

export function CurrencyInput({ value, onChange, ...props }: CurrencyInputProps) {
  return (
    <Input
      inputMode="decimal"
      placeholder="0,00"
      value={value}
      onChange={(event) => onChange(formatCurrencyInput(event.target.value))}
      {...props}
    />
  );
}
