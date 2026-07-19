import http from "node:http";
import { Server } from "socket.io";
import { env } from "./config/env";
import { logger } from "./config/logger";
import { createApp } from "./app";
import { prisma } from "./utils/prisma";

async function main() {
  const app = createApp();
  const server = http.createServer(app);

  const io = new Server(server, { cors: { origin: env.WEB_URL, credentials: true } });
  io.on("connection", (socket) => {
    logger.debug({ socketId: socket.id }, "Socket.IO client connected");
    socket.on("join-org", (organizationId: string) => socket.join(`org:${organizationId}`));
  });

  // Expose io so route handlers / services can emit realtime events if needed.
  app.set("io", io);

  await prisma.$connect();
  logger.info("Conexion a base de datos establecida");

  server.listen(env.PORT, () => {
    logger.info(`API escuchando en http://localhost:${env.PORT} (AI_PROVIDER=${env.AI_PROVIDER})`);
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, "Apagando servidor...");
    server.close();
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err }, "Fallo fatal al iniciar la API");
  process.exit(1);
});
