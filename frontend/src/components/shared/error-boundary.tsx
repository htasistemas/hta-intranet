import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface State { failed: boolean; }

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  public state: State = { failed: false };
  public static getDerivedStateFromError(): State { return { failed: true }; }
  public componentDidCatch(error: Error, info: ErrorInfo): void { console.error(error, info); }
  public render() {
    if (this.state.failed) {
      return <div className="grid min-h-screen place-items-center bg-background text-foreground"><div className="text-center"><h1 className="text-xl font-semibold">Algo deu errado</h1><p className="my-4 text-slate-400">Nao foi possivel exibir esta pagina.</p><Button onClick={() => window.location.reload()}>Recarregar</Button></div></div>;
    }
    return this.props.children;
  }
}
