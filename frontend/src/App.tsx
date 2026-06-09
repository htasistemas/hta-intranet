import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "@/contexts/auth-context";
import { AppLayout } from "@/layouts/app-layout";
import { Skeleton } from "@/components/ui/skeleton";

const LoginPage = lazy(() => import("@/pages/login-page"));
const DashboardPage = lazy(() => import("@/pages/dashboard-page"));
const CrmPage = lazy(() => import("@/pages/crm-page"));
const ClientsPage = lazy(() => import("@/pages/clients-page"));
const CustomerPortalPage = lazy(() => import("@/pages/customer-portal-page"));
const ProductsPage = lazy(() => import("@/pages/products-page"));
const ProjectsPage = lazy(() => import("@/pages/projects-page"));
const CalendarPage = lazy(() => import("@/pages/calendar-page"));
const TasksPage = lazy(() => import("@/pages/tasks-page"));
const CalculatorPage = lazy(() => import("@/pages/calculator-page"));
const ReportsPage = lazy(() => import("@/pages/reports-page"));
const SettingsPage = lazy(() => import("@/pages/settings-page"));

function Loading() { return <div className="p-8"><Skeleton className="h-80" /></div>; }

export default function App() {
  const { session } = useAuth();
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={session ? <AppLayout /> : <Navigate to="/login" replace />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/crm-comercial" element={<CrmPage />} />
          <Route path="/clientes" element={<ClientsPage />} />
          <Route path="/portal-cliente" element={<CustomerPortalPage />} />
          <Route path="/produtos" element={<ProductsPage />} />
          <Route path="/projetos" element={<ProjectsPage />} />
          <Route path="/agenda" element={<CalendarPage />} />
          <Route path="/tarefas" element={<TasksPage />} />
          <Route path="/calculadora" element={<CalculatorPage />} />
          <Route path="/relatorios" element={<ReportsPage />} />
          <Route path="/configuracoes" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
