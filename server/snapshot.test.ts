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
    saveSnapshot: vi.fn().mockResolvedValue(1),
  };
});

// ── Mock metaAdsFetcher ───────────────────────────────────────
vi.mock("./metaAdsFetcher", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./metaAdsFetcher")>();
  return {
    ...actual,
    fetchAllSnapshots: vi.fn().mockResolvedValue([
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
    ]),
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

describe("dashboard.refresh", () => {
  it("fetches snapshots from Meta Ads and saves them", async () => {
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.refresh();
    expect(result.success).toBe(true);
    expect(result.saved).toContain("Last 30 Days");
    expect(result.failed).toHaveLength(0);
  });

  it("reports failed presets when saveSnapshot throws", async () => {
    const { saveSnapshot } = await import("./db");
    vi.mocked(saveSnapshot).mockRejectedValueOnce(new Error("DB error"));
    const caller = appRouter.createCaller(makeCtx());
    const result = await caller.dashboard.refresh();
    expect(result.failed).toContain("Last 30 Days");
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
