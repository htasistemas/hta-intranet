import { useQuery } from "@tanstack/react-query";
import { CalendarCheck, Cake, CircleDollarSign, Contact, ContactRound, ListTodo, UserCheck, UserX } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/services/api";
import type { DashboardData } from "@/types";
import { currency } from "@/lib/utils";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ["dashboard"], queryFn: () => api.get<DashboardData>("/dashboard") });
  if (isLoading || !data) return <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 8 }, (_, item) => <Skeleton key={item} className="h-36" />)}</div>;
  const cards = [
    ["Total de clientes", data.kpis.total, ContactRound, "Base cadastrada"],
    ["Clientes ativos", data.kpis.active, UserCheck, "Relacionamentos ativos"],
    ["Clientes inativos", data.kpis.inactive, UserX, "Precisam de atencao"],
    ["Compromissos hoje", data.kpis.todayAppointments, CalendarCheck, "Agenda de hoje"],
    ["Compromissos semana", data.kpis.weekAppointments, Contact, "Nesta semana"],
    ["Tarefas pendentes", data.kpis.pendingTasks, ListTodo, "Em aberto"],
    ["Receita prevista", currency(data.kpis.revenue), CircleDollarSign, "Clientes ativos"],
    ["Aniversarios", data.kpis.birthdays, Cake, "Monitorados"]
  ] as const;
  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([title, value, icon, caption]) => <KpiCard key={title} title={title} value={value} icon={icon} caption={caption} />)}</section>
      <section className="grid gap-5 xl:grid-cols-2">
        <Card><CardTitle>Clientes por mes</CardTitle><ResponsiveContainer width="100%" height={260}><LineChart data={data.clientsByMonth}><CartesianGrid stroke="#263857" vertical={false} /><XAxis dataKey="month" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Line type="monotone" dataKey="total" stroke="#2DD4BF" strokeWidth={3} /></LineChart></ResponsiveContainer></Card>
        <Card><CardTitle>Clientes por categoria</CardTitle><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={data.clientsByCategory} dataKey="total" nameKey="name" innerRadius={62} outerRadius={92}>{data.clientsByCategory.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></Card>
        <Card><CardTitle>Produtividade</CardTitle><ResponsiveContainer width="100%" height={250}><BarChart data={data.productivity}><XAxis dataKey="name" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Bar dataKey="total" fill="#3B82F6" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></Card>
        <Card><CardTitle>Compromissos</CardTitle><ResponsiveContainer width="100%" height={250}><BarChart data={data.appointments}><XAxis dataKey="month" stroke="#94A3B8" /><YAxis stroke="#94A3B8" /><Tooltip /><Bar dataKey="total" fill="#2DD4BF" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></Card>
      </section>
    </div>
  );
}
