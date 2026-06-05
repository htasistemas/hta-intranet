export function formatCurrencyInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 15);
  if (!digits) return "";
  const amount = Number(digits) / 100;
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function numberToCurrencyInput(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function currencyInputToNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return Number(digits) / 100;
}
