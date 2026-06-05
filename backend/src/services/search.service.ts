import { prisma } from "../prisma/client.js";

export class SearchService {
  public async search(userId: string, term: string) {
    const [clients, projects, schedules, tasks] = await prisma.$transaction([
      prisma.client.findMany({ where: { ownerId: userId, name: { contains: term, mode: "insensitive" } }, take: 5 }),
      prisma.project.findMany({ where: { ownerId: userId, name: { contains: term, mode: "insensitive" } }, take: 5 }),
      prisma.schedule.findMany({ where: { userId, title: { contains: term, mode: "insensitive" } }, take: 5 }),
      prisma.task.findMany({ where: { userId, title: { contains: term, mode: "insensitive" } }, take: 5 })
    ]);
    return { clients, projects, schedules, tasks };
  }
}
