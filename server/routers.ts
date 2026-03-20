import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import {
  getLatestAccountMetrics,
  getAllCampaigns,
  getAllActionItems,
  getDailyPerformance,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  toggleActionItem,
  getSetting,
  upsertSetting,
  getAllSnapshots,
  getSnapshotWithCampaigns,
} from "./db";
import {
  buildCampaignRecommendation,
  DEFAULT_CPL_TARGET,
  getCampaignStatus,
} from "./dashboardLogic";
import {
  DATE_PRESETS,
  isMetaApiConfigured,
} from "./metaAdsFetcher";
import { ENV } from "./_core/env";
import { runDashboardRefresh } from "./refreshService";

async function resolveCplTarget(userId: number | null) {
  const storedTarget = userId != null ? await getSetting("cplTarget", userId) : null;
  const fallbackTarget = await getSetting("cplTarget", null);

  return storedTarget != null
    ? Number.parseFloat(storedTarget)
    : fallbackTarget != null
      ? Number.parseFloat(fallbackTarget)
      : DEFAULT_CPL_TARGET;
}

export const appRouter = router({
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ── Dashboard data ────────────────────────────────────────────
  dashboard: router({
    metaState: publicProcedure.query(() => ({
      sourceMode: isMetaApiConfigured() ? ("live" as const) : ("demo" as const),
      apiConfigured: isMetaApiConfigured(),
      adAccountId: ENV.metaAdAccountId || null,
      apiVersion: ENV.metaApiVersion,
    })),

    refreshStatus: publicProcedure.query(async () => {
      const [latestRun, latestSuccessfulRun] = await Promise.all([
        getLatestRefreshRun(),
        getLatestSuccessfulRefreshRun(),
      ]);

      return {
        latestStatus: latestRun?.status ?? null,
        latestTrigger: latestRun?.trigger ?? null,
        latestFinishedAt: latestRun?.finishedAt ?? null,
        latestStartedAt: latestRun?.startedAt ?? null,
        latestErrorMessage: latestRun?.errorMessage ?? null,
        latestSavedPresets: latestRun?.savedPresets ?? [],
        latestFailedPresets: latestRun?.failedPresets ?? [],
        lastSuccessfulRefreshAt: latestSuccessfulRun?.finishedAt ?? null,
      };
    }),

    accountMetrics: publicProcedure.query(async () => {
      const metrics = await getLatestAccountMetrics();
      if (!metrics) return null;
      return {
        ...metrics,
        amountSpent: parseFloat(metrics.amountSpent),
        frequency: parseFloat(metrics.frequency),
        ctrAll: parseFloat(metrics.ctrAll),
        ctrLink: parseFloat(metrics.ctrLink),
        cpm: parseFloat(metrics.cpm),
        cpcAll: parseFloat(metrics.cpcAll),
        cpcLink: parseFloat(metrics.cpcLink),
        costPerLead: parseFloat(metrics.costPerLead),
      };
    }),

    campaigns: publicProcedure.query(async ({ ctx }) => {
      const rows = await getAllCampaigns();
      const cplTarget = await resolveCplTarget(ctx.user?.id ?? null);

      return rows.map(c => ({
        ...c,
        status: getCampaignStatus(
          c.costPerLead != null ? parseFloat(c.costPerLead) : null,
          cplTarget
        ),
        recommendation: buildCampaignRecommendation(
          {
            campaignId: c.id,
            campaignName: c.name,
            shortName: c.shortName,
            objective: c.objective,
            status: c.status,
            amountSpent: parseFloat(c.amountSpent),
            impressions: c.impressions,
            reach: c.reach,
            frequency: parseFloat(c.frequency),
            clicksAll: c.clicksAll,
            linkClicks: c.linkClicks,
            ctrAll: parseFloat(c.ctrAll),
            ctrLink: parseFloat(c.ctrLink),
            cpm: parseFloat(c.cpm),
            cpcAll: parseFloat(c.cpcAll),
            cpcLink: parseFloat(c.cpcLink),
            leads: c.leads,
            costPerLead: c.costPerLead != null ? parseFloat(c.costPerLead) : null,
          },
          cplTarget
        ),
        amountSpent: parseFloat(c.amountSpent),
        frequency: parseFloat(c.frequency),
        ctrAll: parseFloat(c.ctrAll),
        ctrLink: parseFloat(c.ctrLink),
        cpm: parseFloat(c.cpm),
        cpcAll: parseFloat(c.cpcAll),
        cpcLink: parseFloat(c.cpcLink),
        costPerLead: c.costPerLead != null ? parseFloat(c.costPerLead) : null,
      }));
    }),

    actionItems: publicProcedure.query(async () => {
      return getAllActionItems();
    }),

    dailyPerformance: publicProcedure.query(async () => {
      const rows = await getDailyPerformance();

      return {
        days: rows.map(row => ({
          date: row.date,
          label: row.label,
          amountSpent: parseFloat(row.amountSpent),
          leads: row.leads,
          costPerLead:
            row.costPerLead != null ? parseFloat(row.costPerLead) : null,
        })),
      };
    }),

    toggleActionItem: publicProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleActionItem(input.id, input.completed);
        return { success: true };
    }),

    // Refresh all date-range snapshots from Meta Ads API
    refresh: publicProcedure.mutation(async ({ ctx }) =>
      runDashboardRefresh({
        trigger: "manual",
        userId: ctx.user?.id ?? null,
      })
    ),

    // List all stored snapshots (summary only)
    snapshots: publicProcedure.query(async () => {
      const rows = await getAllSnapshots();
      return rows.map(s => ({
        ...s,
        amountSpent: parseFloat(s.amountSpent),
        frequency: parseFloat(s.frequency),
        ctrAll: parseFloat(s.ctrAll),
        ctrLink: parseFloat(s.ctrLink),
        cpm: parseFloat(s.cpm),
        cpcAll: parseFloat(s.cpcAll),
        cpcLink: parseFloat(s.cpcLink),
        costPerLead: parseFloat(s.costPerLead),
      }));
    }),

    // Get full snapshot with campaign breakdown
    snapshotDetail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const data = await getSnapshotWithCampaigns(input.id);
        if (!data) return null;
        return {
          snapshot: {
            ...data.snapshot,
            amountSpent: parseFloat(data.snapshot.amountSpent),
            frequency: parseFloat(data.snapshot.frequency),
            ctrAll: parseFloat(data.snapshot.ctrAll),
            ctrLink: parseFloat(data.snapshot.ctrLink),
            cpm: parseFloat(data.snapshot.cpm),
            cpcAll: parseFloat(data.snapshot.cpcAll),
            cpcLink: parseFloat(data.snapshot.cpcLink),
            costPerLead: parseFloat(data.snapshot.costPerLead),
          },
          campaigns: data.campaigns.map(c => ({
            ...c,
            amountSpent: parseFloat(c.amountSpent),
            frequency: parseFloat(c.frequency),
            ctrAll: parseFloat(c.ctrAll),
            ctrLink: parseFloat(c.ctrLink),
            cpm: parseFloat(c.cpm),
            cpcAll: parseFloat(c.cpcAll),
            cpcLink: parseFloat(c.cpcLink),
            costPerLead: c.costPerLead != null ? parseFloat(c.costPerLead) : null,
          })),
        };
      }),

    // Available date presets (for the UI picker)
    datePresets: publicProcedure.query(() => DATE_PRESETS),
  }),

  // ── Settings (CPL target, etc.) ───────────────────────────────
  settings: router({
    getCplTarget: publicProcedure.query(async ({ ctx }) => {
      const userId = ctx.user?.id ?? null;
      let val = userId != null ? await getSetting("cplTarget", userId) : null;
      if (val == null) val = await getSetting("cplTarget", null);
      return { cplTarget: val != null ? parseFloat(val) : DEFAULT_CPL_TARGET };
    }),

    setCplTarget: publicProcedure
      .input(z.object({ value: z.number().positive() }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.user?.id ?? null;
        await upsertSetting("cplTarget", String(input.value), userId);
        return { success: true, cplTarget: input.value };
      }),
  }),
});

export type AppRouter = typeof appRouter;
