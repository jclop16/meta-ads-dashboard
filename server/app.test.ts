import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getLatestRefreshRun: vi.fn(),
  getLatestSuccessfulRefreshRun: vi.fn(),
  isDatabaseAvailable: vi.fn(),
}));

vi.mock("./refreshService", () => ({
  runDashboardRefresh: vi.fn(),
}));

const ORIGINAL_ENV = { ...process.env };

function createMockResponse() {
  const response = {
    statusCode: 200,
    payload: null as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.payload = body;
      return this;
    },
  };

  return response;
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env = {
    ...ORIGINAL_ENV,
    NODE_ENV: "test",
  };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("/api/internal/refresh", () => {
  it("returns unavailable when no refresh api key is configured", async () => {
    const { handleInternalRefreshRequest } = await import("./app");
    const response = createMockResponse();

    await handleInternalRefreshRequest(
      {
        header: vi.fn().mockReturnValue(undefined),
      } as any,
      response as any
    );

    expect(response.statusCode).toBe(503);
    expect(response.payload).toEqual({
      ok: false,
      error: "Refresh API key is not configured",
    });
  });

  it("returns unauthorized without a valid bearer token", async () => {
    process.env.REFRESH_API_KEY = "top-secret";
    const { handleInternalRefreshRequest } = await import("./app");
    const response = createMockResponse();

    await handleInternalRefreshRequest(
      {
        header: vi.fn().mockReturnValue(undefined),
      } as any,
      response as any
    );

    expect(response.statusCode).toBe(401);
    expect(response.payload).toEqual({
      ok: false,
      error: "Unauthorized",
    });
  });

  it("runs the shared refresh pipeline with a valid bearer token", async () => {
    process.env.REFRESH_API_KEY = "top-secret";
    const { runDashboardRefresh } = await import("./refreshService");
    vi.mocked(runDashboardRefresh).mockResolvedValueOnce({
      success: true,
      saved: ["Last 30 Days"],
      failed: [],
      sourceMode: "live",
      accountName: "Legacy Empowerment Group",
      accountId: "act_1234567890",
      fetchedAt: new Date("2026-03-19T14:02:00Z"),
      refreshRunId: 12,
      trigger: "scheduled",
    });
    const { handleInternalRefreshRequest } = await import("./app");
    const response = createMockResponse();

    await handleInternalRefreshRequest(
      {
        header: vi.fn().mockImplementation((name: string) =>
          name.toLowerCase() === "authorization" ? "Bearer top-secret" : undefined
        ),
      } as any,
      response as any
    );

    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual(
      expect.objectContaining({
        ok: true,
        success: true,
      })
    );
    expect(vi.mocked(runDashboardRefresh)).toHaveBeenCalledWith({
      trigger: "scheduled",
      userId: null,
    });
  });
});

describe("/api/health", () => {
  it("reports healthy when the database is available and refresh is recent", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/meta_ads_dashboard";
    const { getLatestRefreshRun, getLatestSuccessfulRefreshRun, isDatabaseAvailable } =
      await import("./db");
    vi.mocked(isDatabaseAvailable).mockResolvedValueOnce(true);
    vi.mocked(getLatestRefreshRun).mockResolvedValueOnce({
      id: 10,
      trigger: "scheduled",
      status: "failed",
      startedAt: new Date("2026-03-19T14:00:00Z"),
      finishedAt: new Date("2026-03-19T14:02:00Z"),
      savedPresets: ["Last 30 Days"],
      failedPresets: ["Today"],
      errorMessage: "Meta timed out",
      accountId: "act_1234567890",
    });
    vi.mocked(getLatestSuccessfulRefreshRun).mockResolvedValueOnce({
      id: 9,
      trigger: "scheduled",
      status: "success",
      startedAt: new Date(),
      finishedAt: new Date(),
      savedPresets: ["Last 30 Days"],
      failedPresets: [],
      errorMessage: null,
      accountId: "act_1234567890",
    });
    const { handleHealthRequest } = await import("./app");
    const response = createMockResponse();

    await handleHealthRequest({} as any, response as any);

    expect(response.statusCode).toBe(200);
    expect(response.payload).toEqual(
      expect.objectContaining({
        ok: true,
        databaseConfigured: true,
        lastRefreshStatus: "failed",
      })
    );
    expect((response.payload as any).lastRefreshAt).not.toBeNull();
  });

  it("reports unhealthy when there is no recent successful refresh", async () => {
    process.env.DATABASE_URL = "mysql://user:pass@localhost:3306/meta_ads_dashboard";
    const { getLatestRefreshRun, getLatestSuccessfulRefreshRun, isDatabaseAvailable } =
      await import("./db");
    vi.mocked(isDatabaseAvailable).mockResolvedValueOnce(true);
    vi.mocked(getLatestRefreshRun).mockResolvedValueOnce(null);
    vi.mocked(getLatestSuccessfulRefreshRun).mockResolvedValueOnce(null);
    const { handleHealthRequest } = await import("./app");
    const response = createMockResponse();

    await handleHealthRequest({} as any, response as any);

    expect(response.statusCode).toBe(503);
    expect(response.payload).toEqual(
      expect.objectContaining({
        ok: false,
        lastRefreshStatus: null,
        lastRefreshAt: null,
      })
    );
  });
});
