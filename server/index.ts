import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./_core/context";
import { serveStatic, setupVite } from "./_core/vite";
import { ENV } from "./_core/env";
import { isMetaApiConfigured } from "./metaAdsFetcher";
import { appRouter } from "./routers";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      sourceMode: isMetaApiConfigured() ? "live" : "demo",
      metaConfigured: isMetaApiConfigured(),
      databaseConfigured: Boolean(ENV.databaseUrl),
    });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = Number.parseInt(process.env.PORT || "3000", 10);
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Meta Ads Dashboard running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Server] Failed to start", error);
  process.exitCode = 1;
});
