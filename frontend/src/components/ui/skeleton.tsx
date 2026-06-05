export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-slate-700/50 ${className}`} aria-label="Carregando" />;
}
