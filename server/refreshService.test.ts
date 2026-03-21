import { beforeEach, describe, expect, it, vi } from "vitest";
import { runDashboardRefresh } from "./refreshService";

vi.mock("./db", () => ({
  createRefreshRun: vi.fn().mockResolvedValue(42),
  finishRefreshRun: vi.fn().mockResolvedValue(undefined),
  getAllActionItems: vi.fn().mockResolvedValue([]),
  getSetting: vi.fn().mockResolvedValue(null),
  replaceActionItemsData: vi.fn().mockResolvedValue(undefined),
  replaceCurrentDashboardData: vi.fn().mockResolvedValue(undefined),
  replaceDailyPerformance: vi.fn().mockResolvedValue(undefined),
  saveSnapshot: vi.fn().mockResolvedValue(1),
}));

vi.mock("./metaAdsFetcher", () => ({
  fetchAllSnapshots: vi.fn().mockResolvedValue({
    account: {
      id: "act_1234567890",
      name: "Legacy Empowerment Group",
      currency: "USD",
    },
    sourceMode: "live",
    snapshots: [
      {
        datePreset: "last_30d",
        datePresetLabel: "Last 30 Days",
        dateRangeSince: "2026-02-17",
        dateRangeUntil: "2026-03-18",
        isPartial: false,
        account: {
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
      },
    ],
  }),
  fetchNormalizedReportData: vi.fn().mockResolvedValue({
    sourceMode: "live",
    fetchedAt: new Date("2026-03-18T12:00:00Z"),
    account: {
      id: "act_1234567890",
      name: "Legacy Empowerment Group",
      currency: "USD",
    },
    campaigns: [],
    adsets: [],
    ads: [],
    campaignFacts: [],
    adsetFacts: [],
    adFacts: [],
  }),
}));

vi.mock("./reportingStore", () => ({
  persistNormalizedReportData: vi.fn().mockResolvedValue(undefined),
  buildHomeDashboardViewFromDataset: vi.fn().mockReturnValue({
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
    dailyPerformance: [],
  }),
  buildLegacyDailyPerformanceFromNormalizedData: vi.fn().mockResolvedValue([
    {
      date: "2026-03-12",
      label: "Mar 12",
      amountSpent: 421.18,
      leads: 19,
      costPerLead: 22.17,
    },
  ]),
  buildRecommendationItemsFromDataset: vi.fn().mockReturnValue([]),
  persistRecommendationRun: vi.fn().mockResolvedValue(7),
}));

describe("runDashboardRefresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("persists a successful refresh run", async () => {
    const {
      createRefreshRun,
      finishRefreshRun,
      replaceActionItemsData,
      replaceCurrentDashboardData,
      replaceDailyPerformance,
      saveSnapshot,
    } = await import("./db");

    const result = await runDashboardRefresh({
      trigger: "manual",
      userId: null,
    });

    expect(result.success).toBe(true);
    expect(vi.mocked(createRefreshRun)).toHaveBeenCalledWith(
      expect.objectContaining({
        trigger: "manual",
      })
    );
    expect(vi.mocked(saveSnapshot)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(replaceCurrentDashboardData)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(replaceDailyPerformance)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(replaceActionItemsData)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(finishRefreshRun)).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        status: "success",
        savedPresets: ["Last 30 Days"],
        failedPresets: [],
      })
    );
  });

  it("marks the refresh run as failed when snapshot persistence fails", async () => {
    const { saveSnapshot, finishRefreshRun } = await import("./db");
    vi.mocked(saveSnapshot).mockRejectedValueOnce(new Error("DB write failed"));

    await expect(
      runDashboardRefresh({
        trigger: "scheduled",
        userId: null,
      })
    ).rejects.toThrow("Refresh completed with failed presets: Last 30 Days");

    expect(vi.mocked(finishRefreshRun)).toHaveBeenCalledWith(
      42,
      expect.objectContaining({
        status: "failed",
        failedPresets: ["Last 30 Days"],
      })
    );
  });
});
