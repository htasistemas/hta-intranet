import { endOfDay, endOfWeek, format, startOfDay, startOfMonth, startOfWeek, subMonths } from "date-fns";
import { prisma } from "../prisma/client.js";

export class DashboardService {
  public async summary(userId: string) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => startOfMonth(subMonths(now, 5 - index)));
    const earliestMonth = months[0];
    if (!earliestMonth) throw new Error("Periodo do dashboard invalido.");
    const [total, active, prospects, inactive, todayAppointments, weekAppointments, pendingTasks, revenue, birthdays, categories, schedules, taskStatuses] = await prisma.$transaction([
      prisma.client.count({ where: { ownerId: userId } }),
      prisma.client.count({ where: { ownerId: userId, status: "ACTIVE" } }),
      prisma.client.count({ where: { ownerId: userId, status: "PROSPECT" } }),
      prisma.client.count({ where: { ownerId: userId, status: "INACTIVE" } }),
      prisma.schedule.count({ where: { userId, startAt: { gte: startOfDay(now), lte: endOfDay(now) } } }),
      prisma.schedule.count({ where: { userId, startAt: { gte: startOfWeek(now), lte: endOfWeek(now) } } }),
      prisma.task.count({ where: { userId, status: { not: "COMPLETED" } } }),
      prisma.client.aggregate({ where: { ownerId: userId, status: "ACTIVE" }, _sum: { expectedValue: true } }),
      prisma.client.count({ where: { ownerId: userId, birthDate: { not: null } } }),
      prisma.category.findMany({ include: { _count: { select: { clients: true } } } }),
      prisma.schedule.findMany({ where: { userId, startAt: { gte: earliestMonth } }, select: { startAt: true } }),
      prisma.task.findMany({ where: { userId }, select: { status: true } })
    ]);
    const clients = await prisma.client.findMany({ where: { ownerId: userId, createdAt: { gte: earliestMonth } }, select: { createdAt: true } });
    return {
      kpis: { total, active, prospects, inactive, todayAppointments, weekAppointments, pendingTasks, revenue: Number(revenue._sum.expectedValue ?? 0), birthdays },
      clientsByMonth: months.map((month) => ({ month: format(month, "MMM"), total: clients.filter((client) => format(client.createdAt, "yyyy-MM") === format(month, "yyyy-MM")).length })),
      clientsByCategory: categories.map((category) => ({ name: category.name, total: category._count.clients, color: category.color })),
      appointments: months.map((month) => ({ month: format(month, "MMM"), total: schedules.filter((schedule) => format(schedule.startAt, "yyyy-MM") === format(month, "yyyy-MM")).length })),
      productivity: ["NOT_STARTED", "IN_PROGRESS", "PAUSED", "COMPLETED"].map((status) => ({
        name: status,
        total: taskStatuses.filter((task) => task.status === status).length
      }))
    };
  }
}
