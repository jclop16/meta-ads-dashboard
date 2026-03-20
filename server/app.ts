import express from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { Request, Response } from "express";
import { ENV } from "./_core/env";
import { serveStatic, setupVite } from "./_core/vite";
import {
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  isDatabaseAvailable,
} from "./db";
import { isMetaApiConfigured } from "./metaAdsFetcher";
import { runDashboardRefresh } from "./refreshService";

const REFRESH_STALE_THRESHOLD_MS = 8 * 60 * 60 * 1000;

function getBearerToken(request: Request) {
  const header = request.header("authorization");

  if (!header) {
    return null;
  }

  const [scheme, token] = header.split(/\s+/, 2);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
}

export function isInternalRefreshAuthorized(request: Request) {
  if (!ENV.refreshApiKey) {
    return false;
  }

  return getBearerToken(request) === ENV.refreshApiKey;
}

export async function buildHealthPayload(now = new Date()) {
  const [databaseHealthy, latestRun, latestSuccessfulRun] = await Promise.all([
    isDatabaseAvailable(),
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun(),
  ]);
  const lastRefreshAt = latestSuccessfulRun?.finishedAt ?? null;
  const lastRefreshStatus = latestRun?.status ?? null;
  const hasFreshSuccess =
    lastRefreshAt != null &&
    now.getTime() - lastRefreshAt.getTime() <= REFRESH_STALE_THRESHOLD_MS;
  const ok = databaseHealthy && hasFreshSuccess;

  return {
    statusCode: ok ? 200 : 503,
    body: {
      ok,
      timestamp: now.toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      metaConfigured: isMetaApiConfigured(),
      databaseConfigured: Boolean(ENV.databaseUrl),
      lastRefreshAt: lastRefreshAt?.toISOString() ?? null,
      lastRefreshStatus,
    },
  };
}

export async function handleHealthRequest(_request: Request, response: Response) {
  const health = await buildHealthPayload();
  response.status(health.statusCode).json(health.body);
}

export async function handleInternalRefreshRequest(
  request: Request,
  response: Response
) {
  if (!isInternalRefreshAuthorized(request)) {
    response.status(401).json({
      ok: false,
      error: "Unauthorized",
    });
    return;
  }

  try {
    const result = await runDashboardRefresh({
      trigger: "scheduled",
      userId: null,
    });

    response.status(200).json({
      ok: true,
      ...result,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal refresh failed";
    console.error("[Refresh] Internal refresh failed", error);
    response.status(500).json({
      ok: false,
      error: message,
    });
  }
}

export async function createApp(options?: {
  enableVite?: boolean;
  mountClient?: boolean;
  mountTrpc?: boolean;
}) {
  const app = express();
  const server = createServer(app);
  const enableVite = options?.enableVite ?? process.env.NODE_ENV === "development";
  const mountClient = options?.mountClient ?? true;
  const mountTrpc = options?.mountTrpc ?? true;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true, limit: "10mb" }));

  app.get("/api/health", handleHealthRequest);
  app.post("/api/internal/refresh", handleInternalRefreshRequest);

  if (mountTrpc) {
    const [{ createContext }, { appRouter }] = await Promise.all([
      import("./_core/context"),
      import("./routers"),
    ]);

    app.use(
      "/api/trpc",
      createExpressMiddleware({
        router: appRouter,
        createContext,
      })
    );
  }

  if (mountClient) {
    if (enableVite) {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
  }

  return { app, server };
}
