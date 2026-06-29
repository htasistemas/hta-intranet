import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  ContactRound,
  DatabaseBackup,
  Handshake,
  PanelsTopLeft,
  FileBarChart,
  FolderKanban,
  LogOut,
  Menu,
  Package,
  Search,
  Settings,
  Sparkles,
  Target,
  UserCog,
  X,
  type LucideIcon
} from "lucide-react";
import { useAuth } from "@/contexts/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface NavigationItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavigationGroup {
  title: string;
  items: NavigationItem[];
}

const navigation: NavigationGroup[] = [
  { title: "Visao Geral", items: [{ label: "Dashboard", href: "/", icon: BarChart3 }] },
  {
    title: "Controle Empresarial",
    items: [
      { label: "Agenda Profissional", href: "/agenda", icon: CalendarDays },
      { label: "Gestao Pessoal", href: "/tarefas", icon: ClipboardList },
      { label: "CRM Comercial", href: "/crm-comercial", icon: Handshake },
      { label: "Portal Cliente", href: "/portal-cliente", icon: PanelsTopLeft },
      { label: "Clientes ativos", href: "/clientes", icon: ContactRound },
      { label: "Captacao", href: "/captacao", icon: Target },
      { label: "Produtos", href: "/produtos", icon: Package },
      { label: "Projetos", href: "/projetos", icon: FolderKanban }
    ]
  },
  {
    title: "Sistema",
    items: [
      { label: "Relatorios", href: "/relatorios", icon: FileBarChart },
      { label: "Usuarios", href: "/usuarios", icon: UserCog },
      { label: "Backup e restauracao", href: "/backup-restauracao", icon: DatabaseBackup },
      { label: "Configuracoes", href: "/configuracoes", icon: Settings }
    ]
  }
];

const sidebarStorageKey = "htasistemas.sidebar.collapsed";
const routeTitles: Record<string, string> = { "/calculadora": "Calculadora", "/usuarios": "Usuarios" };

function groupsInitiallyOpen(): Record<string, boolean> {
  return Object.fromEntries(navigation.map((group) => [group.title, true]));
}

export function AppLayout() {
  const { session, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpened, setMobileOpened] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(sidebarStorageKey) === "true");
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(groupsInitiallyOpen);
  const activeGroup = navigation.find((group) => group.items.some((item) => item.href === location.pathname));
  const title = activeGroup?.items.find((item) => item.href === location.pathname)?.label ?? routeTitles[location.pathname] ?? "Dashboard";

  useEffect(() => {
    localStorage.setItem(sidebarStorageKey, String(collapsed));
  }, [collapsed]);

  useEffect(() => {
    if (!activeGroup) return;
    setExpandedGroups((current) => ({ ...current, [activeGroup.title]: true }));
  }, [activeGroup]);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      if (event.key !== "F5") return;
      event.preventDefault();
      setMobileOpened(false);
      navigate("/calculadora");
    }

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [navigate]);

  function toggleGroup(groupTitle: string) {
    setExpandedGroups((current) => ({ ...current, [groupTitle]: !current[groupTitle] }));
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-sidebar transition-[width,transform] duration-300 lg:translate-x-0",
          collapsed && "lg:w-20",
          mobileOpened ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className={cn("flex h-20 items-center border-b border-slate-700/60 px-4", collapsed ? "lg:justify-center" : "justify-between")}>
          <Link
            to="/"
            title="HTA Sistemas"
            className={cn("flex min-w-0 items-center gap-3", collapsed && "lg:justify-center")}
            onClick={() => setMobileOpened(false)}
          >
            <span className="gradient-fill grid h-10 w-10 shrink-0 place-items-center rounded-xl">
              <Sparkles size={20} />
            </span>
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <div className="font-bold">HTA <span className="gradient-text">Sistemas</span></div>
              <div className="text-xs text-slate-400">Workspace premium</div>
            </div>
          </Link>
          <button className="ml-auto lg:hidden" onClick={() => setMobileOpened(false)} aria-label="Fechar menu">
            <X />
          </button>
        </div>

        <nav className={cn("flex-1 space-y-3 overflow-y-auto p-4", collapsed && "lg:px-3")}>
          {navigation.map((group) => {
            const expanded = expandedGroups[group.title];
            return (
              <section key={group.title} className={cn(collapsed && "lg:border-b lg:border-slate-700/60 lg:pb-3")}>
                <button
                  type="button"
                  onClick={() => toggleGroup(group.title)}
                  aria-expanded={expanded}
                  className={cn(
                    "mb-1 flex w-full items-center justify-between rounded-lg px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 transition hover:bg-white/5 hover:text-slate-300",
                    collapsed && "lg:hidden"
                  )}
                >
                  <span>{group.title}</span>
                  <ChevronDown size={14} className={cn("transition-transform", !expanded && "-rotate-90")} />
                </button>
                <div className={cn("space-y-1", !expanded && "hidden", collapsed && "lg:block")}>
                  {group.items.map(({ label, href, icon: Icon }) => (
                    <NavLink
                      key={href}
                      to={href}
                      title={collapsed ? label : undefined}
                      onClick={() => setMobileOpened(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition",
                          collapsed && "lg:justify-center lg:px-0",
                          isActive ? "gradient-fill text-white" : "text-slate-400 hover:bg-white/5 hover:text-white"
                        )
                      }
                    >
                      <Icon className="shrink-0" size={19} />
                      <span className={cn(collapsed && "lg:hidden")}>{label}</span>
                    </NavLink>
                  ))}
                </div>
              </section>
            );
          })}
        </nav>

        <div className={cn("border-t border-slate-700/60 p-4", collapsed && "lg:px-3")}>
          <div className={cn(collapsed && "lg:hidden")}>
            <p className="truncate text-sm font-medium">{session?.user.name}</p>
            <p className="mb-3 truncate text-xs text-slate-400">{session?.user.email}</p>
          </div>
          <Button
            variant="ghost"
            title="Sair"
            className={cn("w-full justify-start", collapsed && "lg:justify-center lg:px-0")}
            onClick={() => void logout()}
          >
            <LogOut size={17} />
            <span className={cn(collapsed && "lg:hidden")}>Sair</span>
          </Button>
        </div>

        <button
          type="button"
          onClick={() => setCollapsed((current) => !current)}
          className="absolute -right-3 top-24 hidden h-7 w-7 place-items-center rounded-full border border-slate-700 bg-sidebar text-slate-300 shadow-lg transition hover:border-accent hover:text-white lg:grid"
          aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
          title={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        >
          {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
        </button>
      </aside>

      <div className={cn("transition-[padding] duration-300", collapsed ? "lg:pl-20" : "lg:pl-72")}>
        <header className="sticky top-0 z-20 flex h-20 items-center gap-4 border-b border-slate-800/80 bg-background/90 px-4 backdrop-blur md:px-8">
          <button className="lg:hidden" onClick={() => setMobileOpened(true)} aria-label="Abrir menu">
            <Menu />
          </button>
          <div>
            <h1 className="text-xl font-semibold">{title}</h1>
            <p className="hidden text-xs text-slate-400 sm:block">Controle completo do seu relacionamento com clientes</p>
          </div>
          <label className="relative ml-auto hidden w-72 md:block">
            <Search className="absolute left-3 top-3 text-slate-500" size={18} />
            <Input className="pl-10" placeholder="Pesquisar..." />
          </label>
        </header>
        <main className="p-4 md:p-8"><Outlet /></main>
      </div>
      {mobileOpened && (
        <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMobileOpened(false)} aria-label="Fechar navegacao" />
      )}
    </div>
  );
}
