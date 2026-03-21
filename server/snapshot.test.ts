import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ── Mock DB helpers ───────────────────────────────────────────
vi.mock("./db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getAllSnapshots: vi.fn().mockResolvedValue([
      {
        id: 1,
        datePreset: "last_30d",
        datePresetLabel: "Last 30 Days",
        dateRangeSince: "2026-02-17",
        dateRangeUntil: "2026-03-18",
        isPartial: false,
        amountSpent: "13219.50",
        impressions: 1200000,
        reach: 980000,
        frequency: "1.22",
        clicksAll: 18500,
        linkClicks: 9200,
        ctrAll: "1.54",
        ctrLink: "0.77",
        cpm: "11.02",
        cpcAll: "0.7146",
        cpcLink: "1.4369",
        leads: 589,
        costPerLead: "22.44",
        fetchedAt: new Date("2026-03-19T14:00:00Z"),
        createdAt: new Date("2026-03-19T14:00:00Z"),
      },
    ]),
    getSnapshotWithCampaigns: vi.fn().mockResolvedValue({
      snapshot: {
        id: 1,
        datePreset: "last_30d",
        datePresetLabel: "Last 30 Days",
        dateRangeSince: "2026-02-17",
        dateRangeUntil: "2026-03-18",
        isPartial: false,
        amountSpent: "13219.50",
        impressions: 1200000,
        reach: 980000,
        frequency: "1.22",
        clicksAll: 18500,
        linkClicks: 9200,
        ctrAll: "1.54",
        ctrLink: "0.77",
        cpm: "11.02",
        cpcAll: "0.7146",
        cpcLink: "1.4369",
        leads: 589,
        costPerLead: "22.44",
        fetchedAt: new Date("2026-03-19T14:00:00Z"),
        createdAt: new Date("2026-03-19T14:00:00Z"),
      },
      campaigns: [
        {
          id: 1,
          snapshotId: 1,
          campaignId: "120213178430570352",
          campaignName: "Annuity Oct 2025 - 2",
          shortName: "Annuity Oct 2025 - 2",
          objective: "Annuity",
          status: "excellent",
          amountSpent: "1001.41",
          impressions: 77000,
          reach: 62000,
          frequency: "1.24",
          clicksAll: 1200,
          linkClicks: 600,
          ctrAll: "1.56",
          ctrLink: "0.78",
          cpm: "13.00",
          cpcAll: "0.8345",
          cpcLink: "1.6690",
          leads: 77,
          costPerLead: "13.00",
          createdAt: new Date("2026-03-19T14:00:00Z"),
        },
      ],
    }),
    getDailyPerformance: vi.fn().mockResolvedValue([
      {
        date: "2026-03-12",
        label: "Mar 12",
        amountSpent: "421.18",
        leads: 19,
        costPerLead: "22.17",
        createdAt: new Date("2026-03-19T14:00:00Z"),
        updatedAt: new Date("2026-03-19T14:00:00Z"),
      },
      {
        date: "2026-03-13",
        label: "Mar 13",
        amountSpent: "447.02",
        leads: 21,
        costPerLead: "21.29",
        createdAt: new Date("2026-03-19T14:00:00Z"),
        updatedAt: new Date("2026-03-19T14:00:00Z"),
      },
    ]),
    getLatestRefreshRun: vi.fn().mockResolvedValue({
      id: 9,
      trigger: "manual",
      status: "success",
      startedAt: new Date("2026-03-19T14:00:00Z"),
      finishedAt: new Date("2026-03-19T14:02:00Z"),
      savedPresets: ["Last 30 Days"],
      failedPresets: [],
      errorMessage: null,
      accountId: "act_1234567890",
    }),
    getLatestSuccessfulRefreshRun: vi.fn().mockResolvedValue({
      id: 9,
      trigger: "manual",
      status: "success",
      startedAt: new Date("2026-03-19T14:00:00Z"),
      finishedAt: new Date("2026-03-19T14:02:00Z"),
      savedPresets: ["Last 30 Days"],
      failedPresets: [],
      errorMessage: null,
      accountId: "act_1234567890",
    }),
  };
});

vi.mock("./refreshService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./refreshService")>();
  return {
    ...actual,
    runDashboardRefresh: vi.fn().mockResolvedValue({
      success: true,
      saved: ["Last 30 Days"],
      failed: [],
      sourceMode: "live",
      accountName: "Legacy Empowerment Group",
      accountId: "act_1234567890",
      fetchedAt: new Date("2026-03-19T14:02:00Z"),
      refreshRunId: 9,
      trigger: "manual",
    }),
  };
});

vi.mock("./reportingStore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./reportingStore")>();
  return {
    ...actual,
    getHomeDashboardView: vi.fn().mockResolvedValue({
      range: {
        preset: "last_30d",
        since: "2026-02-17",
        until: "2026-03-18",
        previousSince: "2026-01-18",
        previousUntil: "2026-02-16",
        label: "Feb 17 – Mar 18, 2026",
      },
      accountMetrics: {
        reportDateRange: "Feb 17 – Mar 18, 2026",
        accountName: "Legacy Empowerment Group",
        accountCurrency: "USD",
        amountSpent: 13219.5,
        impressions: 1200000,
        reach: 980000,
        frequency: 1.22,
        clicksAll: 18500,
        linkClicks: 9200,
        ctrAll: 1.54,
        ctrLink: 0.77,
        cpm: 11.02,
        cpcAll: 0.7146,
        cpcLink: 1.4369,
        leads: 589,
        costPerLead: 22.44,
      },
      campaigns: [],
      dailyPerformance: [
        {
          date: "2026-03-12",
          label: "Mar 12",
          amountSpent: 421.18,
          leads: 19,
          costPerLead: 22.17,
        },
        {
          date: "2026-03-13",
          label: "Mar 13",
          amountSpent: 447.02,
          leads: 21,
          costPerLead: 21.29,
        },
      ],
    }),
  };
});

// ── Mock metaAdsFetcher ───────────────────────────────────────
vi.mock("./metaAdsFetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./metaAdsFetcher")>();
  return {
    ...actual,
    isMetaApiConfigured: vi.fn().mockReturnValue(true),
  };
});

// ── Context factory ───────────────────────────────────────────
function makeCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ── Tests ─────────────────────────────────────────────────────
describe("dashboard.snapshots", () => {
  it("returns a list of snapshots with numeric fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.snapshots();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    const snap = result[0];
    expect(typeof snap.amountSpent).toBe("number");
    expect(typeof snap.costPerLead).toBe("number");
    expect(snap.datePreset).toBe("last_30d");
  });
});

describe("dashboard.snapshotDetail", () => {
  it("returns snapshot with campaigns for a valid id", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.snapshotDetail({ id: 1 });
    expect(result).not.toBeNull();
    expect(result?.snapshot.id).toBe(1);
    expect(Array.isArray(result?.campaigns)).toBe(true);
    const camp = result?.campaigns[0];
    expect(typeof camp?.amountSpent).toBe("number");
    expect(typeof camp?.costPerLead).toBe("number");
  });

  it("returns null for a non-existent snapshot id", async () => {
    const { getSnapshotWithCampaigns } = await import("./db");
    vi.mocked(getSnapshotWithCampaigns).mockResolvedValueOnce(null);
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.snapshotDetail({ id: 9999 });
    expect(result).toBeNull();
  });
});

describe("dashboard.dailyPerformance", () => {
  it("returns stored daily rows with numeric fields", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.dailyPerformance();

    expect(result.days).toHaveLength(2);
    expect(result.days[0].date).toBe("2026-03-12");
    expect(typeof result.days[0].amountSpent).toBe("number");
    expect(typeof result.days[0].costPerLead).toBe("number");
  });
});

describe("dashboard.refresh", () => {
  it("fetches snapshots from Meta Ads and saves them", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.refresh();
    expect(result.success).toBe(true);
    expect(result.saved).toContain("Last 30 Days");
    expect(result.failed).toHaveLength(0);
  });

  it("surfaces refresh service failures", async () => {
    const { runDashboardRefresh } = await import("./refreshService");
    vi.mocked(runDashboardRefresh).mockRejectedValueOnce(new Error("DB error"));
    const caller = appRouter.createCaller(makeCtx());
    await expect(caller.dashboard.refresh()).rejects.toThrow("DB error");
  });
});

describe("dashboard.refreshStatus", () => {
  it("returns latest refresh metadata", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.refreshStatus();

    expect(result.latestStatus).toBe("success");
    expect(result.latestTrigger).toBe("manual");
    expect(result.latestSavedPresets).toContain("Last 30 Days");
    expect(result.lastSuccessfulRefreshAt).toBeInstanceOf(Date);
  });
});

describe("dashboard.datePresets", () => {
  it("returns the list of available date presets", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.datePresets();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    const presets = result.map((p: any) => p.preset);
    expect(presets).toContain("last_30d");
    expect(presets).toContain("today");
    expect(presets).toContain("yesterday");
  });
});
