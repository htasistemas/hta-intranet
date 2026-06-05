import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma/client.js";

export class AuditRepository {
  public log(data: Prisma.AuditLogUncheckedCreateInput) {
    return prisma.auditLog.create({ data });
  }
}
