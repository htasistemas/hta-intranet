import "dotenv/config";
import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { z } from "zod";

const inputSchema = z.object({
  MASTER_USER_EMAIL: z.string().email().transform((value) => value.trim().toLowerCase()),
  MASTER_USER_PASSWORD: z.string().min(12)
});

const input = inputSchema.parse({
  MASTER_USER_EMAIL: process.env.MASTER_USER_EMAIL,
  MASTER_USER_PASSWORD: process.env.MASTER_USER_PASSWORD
});

const prisma = new PrismaClient();

try {
  const passwordHash = await bcrypt.hash(input.MASTER_USER_PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: input.MASTER_USER_EMAIL },
    update: {
      name: "Torresoft Brasil",
      passwordHash,
      role: UserRole.ADMIN,
      partnerId: null
    },
    create: {
      name: "Torresoft Brasil",
      email: input.MASTER_USER_EMAIL,
      passwordHash,
      role: UserRole.ADMIN
    },
    select: { id: true, email: true, role: true }
  });

  console.log(`Usuário mestre criado/atualizado: ${user.email} (${user.role})`);
} finally {
  await prisma.$disconnect();
}
