import { app } from "./app.js";
import { prisma } from "./prisma/client.js";
import { env } from "./utils/env.js";

const server = app.listen(env.PORT, () => {
  console.log(`Torresoft API disponivel em http://localhost:${env.PORT}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await prisma.$disconnect();
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
