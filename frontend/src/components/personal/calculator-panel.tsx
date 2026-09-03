import { useEffect, useState, type ReactNode } from "react";
import { Clock3, Delete, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type Operator = "+" | "-" | "*" | "/";

interface Calculation {
  expression: string;
  result: string;
}

const historyStorageKey = "torresoft.calculator.history";
const operatorLabels: Record<Operator, string> = { "+": "+", "-": "-", "*": "x", "/": "/" };
const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 10 });

function calculate(first: number, second: number, operator: Operator): number | null {
  if (operator === "/" && second === 0) return null;
  if (operator === "+") return first + second;
  if (operator === "-") return first - second;
  if (operator === "*") return first * second;
  return first / second;
}

function displayNumber(value: number): string {
  if (!Number.isFinite(value)) return "Erro";
  return String(Number(value.toPrecision(12)));
}

function formatDisplay(value: string): string {
  if (value === "Erro") return value;
  const number = Number(value);
  if (!Number.isFinite(number)) return "0";
  return numberFormatter.format(number);
}

function formatInputDisplay(value: string): string {
  if (value === "Erro") return value;
  const [integerPart = "0", decimalPart] = value.split(".");
  const integerDisplay = numberFormatter.format(Number(integerPart));
  return decimalPart === undefined ? integerDisplay : `${integerDisplay},${decimalPart}`;
}

function loadHistory(): Calculation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(historyStorageKey) ?? "[]");
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is Calculation => {
      if (typeof item !== "object" || item === null) return false;
      const record = item as Record<string, unknown>;
      return typeof record.expression === "string" && typeof record.result === "string";
    });
  } catch {
    return [];
  }
}

interface CalculatorKeyProps {
  children: ReactNode;
  onClick: () => void;
  emphasis?: "operator" | "action" | "result";
  className?: string;
  label?: string;
}

function CalculatorKey({ children, onClick, emphasis, className, label }: CalculatorKeyProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "h-14 rounded-xl border border-slate-700/70 bg-sidebar text-lg font-medium text-slate-100 transition hover:border-slate-500 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        emphasis === "operator" && "bg-blue-500/10 text-blue-300 hover:bg-blue-500/20",
        emphasis === "action" && "text-accent",
        emphasis === "result" && "gradient-fill border-transparent text-white hover:brightness-110",
        className
      )}
    >
      {children}
    </button>
  );
}

export function CalculatorPanel() {
  const [display, setDisplay] = useState("0");
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOperator, setPendingOperator] = useState<Operator | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<Calculation[]>(loadHistory);

  useEffect(() => {
    localStorage.setItem(historyStorageKey, JSON.stringify(history));
  }, [history]);

  function clear() {
    setDisplay("0");
    setAccumulator(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  }

  function inputDigit(digit: string) {
    if (display === "Erro" || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
      return;
    }
    setDisplay(display === "0" ? digit : `${display}${digit}`);
  }

  function inputDecimal() {
    if (display === "Erro" || waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes(".")) setDisplay(`${display}.`);
  }

  function applyOperator(operator: Operator) {
    if (display === "Erro") return;
    if (pendingOperator && waitingForOperand) {
      setPendingOperator(operator);
      return;
    }
    const current = Number(display);
    if (accumulator !== null && pendingOperator) {
      const result = calculate(accumulator, current, pendingOperator);
      if (result === null) {
        setDisplay("Erro");
        setAccumulator(null);
        setPendingOperator(null);
        return;
      }
      setAccumulator(result);
      setDisplay(displayNumber(result));
    } else {
      setAccumulator(current);
    }
    setPendingOperator(operator);
    setWaitingForOperand(true);
  }

  function resolveCalculation() {
    if (display === "Erro" || accumulator === null || pendingOperator === null || waitingForOperand) return;
    const current = Number(display);
    const result = calculate(accumulator, current, pendingOperator);
    if (result === null) {
      setDisplay("Erro");
      setAccumulator(null);
      setPendingOperator(null);
      return;
    }
    const formattedResult = displayNumber(result);
    const calculation = {
      expression: `${formatDisplay(String(accumulator))} ${operatorLabels[pendingOperator]} ${formatDisplay(display)}`,
      result: formatDisplay(formattedResult)
    };
    setHistory((items) => [calculation, ...items].slice(0, 12));
    setDisplay(formattedResult);
    setAccumulator(null);
    setPendingOperator(null);
    setWaitingForOperand(false);
  }

  function percentage() {
    if (display === "Erro") return;
    setDisplay(displayNumber(Number(display) / 100));
    setWaitingForOperand(false);
  }

  function toggleSign() {
    if (display === "Erro" || display === "0") return;
    setDisplay(displayNumber(Number(display) * -1));
  }

  function removeDigit() {
    if (display === "Erro") {
      clear();
      return;
    }
    if (waitingForOperand) return;
    const shortened = display.slice(0, -1);
    setDisplay(shortened === "" || shortened === "-" ? "0" : shortened);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (/^[0-9]$/.test(event.key)) inputDigit(event.key);
      else if (event.key === "." || event.key === ",") inputDecimal();
      else if (event.key === "+" || event.key === "-" || event.key === "*" || event.key === "/") applyOperator(event.key);
      else if (event.key === "Enter" || event.key === "=") resolveCalculation();
      else if (event.key === "Backspace") removeDigit();
      else if (event.key === "Escape") clear();
      else if (event.key === "%") percentage();
      else return;
      event.preventDefault();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(320px,430px)_minmax(270px,1fr)]">
      <Card className="p-4 sm:p-5">
        <div className="mb-4 rounded-2xl border border-slate-700/60 bg-sidebar/80 p-5 text-right">
          <p className="mb-3 h-5 text-sm text-slate-400">
            {accumulator !== null && pendingOperator ? `${formatDisplay(String(accumulator))} ${operatorLabels[pendingOperator]}` : "\u00a0"}
          </p>
          <output aria-live="polite" className="block truncate text-4xl font-semibold tracking-tight">
            {formatInputDisplay(display)}
          </output>
        </div>
        <div className="grid grid-cols-4 gap-2.5">
          <CalculatorKey onClick={clear} emphasis="action">AC</CalculatorKey>
          <CalculatorKey onClick={toggleSign} emphasis="action">+/-</CalculatorKey>
          <CalculatorKey onClick={percentage} emphasis="action">%</CalculatorKey>
          <CalculatorKey onClick={() => applyOperator("/")} emphasis="operator" label="Dividir">/</CalculatorKey>
          {["7", "8", "9"].map((digit) => <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorKey>)}
          <CalculatorKey onClick={() => applyOperator("*")} emphasis="operator" label="Multiplicar">x</CalculatorKey>
          {["4", "5", "6"].map((digit) => <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorKey>)}
          <CalculatorKey onClick={() => applyOperator("-")} emphasis="operator" label="Subtrair">-</CalculatorKey>
          {["1", "2", "3"].map((digit) => <CalculatorKey key={digit} onClick={() => inputDigit(digit)}>{digit}</CalculatorKey>)}
          <CalculatorKey onClick={() => applyOperator("+")} emphasis="operator" label="Somar">+</CalculatorKey>
          <CalculatorKey onClick={removeDigit} label="Apagar último número"><Delete className="mx-auto" size={19} /></CalculatorKey>
          <CalculatorKey onClick={() => inputDigit("0")}>0</CalculatorKey>
          <CalculatorKey onClick={inputDecimal}>,</CalculatorKey>
          <CalculatorKey onClick={resolveCalculation} emphasis="result" label="Resultado">=</CalculatorKey>
        </div>
      </Card>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="mb-0">
            <span className="flex items-center gap-2"><Clock3 size={18} className="text-accent" /> Histórico</span>
          </CardTitle>
          <Button variant="ghost" size="sm" onClick={() => setHistory([])} disabled={history.length === 0}>
            <Trash2 size={15} /> Limpar
          </Button>
        </div>
        {history.length === 0 ? (
          <p className="mt-10 rounded-xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
            Os cálculos concluídos serão listados aqui.
          </p>
        ) : (
          <ol className="mt-5 space-y-2">
            {history.map((item, index) => (
              <li key={`${item.expression}-${index}`} className="rounded-xl bg-sidebar px-4 py-3 text-right">
                <p className="text-xs text-slate-400">{item.expression}</p>
                <p className="mt-1 text-lg font-medium text-white">= {item.result}</p>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
