import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { publicProcedure, router } from "./_core/trpc";
import {
  getAllActionItems,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  toggleActionItem,
  getSetting,
  upsertSetting,
  getAllSnapshots,
  getSnapshotWithCampaigns,
} from "./db";
import {
  DEFAULT_CPL_TARGET,
} from "./dashboardLogic";
import {
  DATE_PRESETS,
  getMetaConnectionStatus,
  isMetaApiConfigured,
} from "./metaAdsFetcher";
import { ENV } from "./_core/env";
import { runDashboardRefresh } from "./refreshService";
import {
  EXPLORER_DATE_PRESETS,
  getExplorerAdBreakdown,
  getExplorerAdsetBreakdown,
  getExplorerCampaignBreakdown,
  getExplorerSummary,
  getExplorerTrendSeries,
  getHomeDashboardView,
} from "./reportingStore";

async function resolveCplTarget(userId: number | null) {
  const storedTarget = userId != null ? await getSetting("cplTarget", userId) : null;
  const fallbackTarget = await getSetting("cplTarget", null);

  return storedTarget != null
    ? Number.parseFloat(storedTarget)
    : fallbackTarget != null
      ? Number.parseFloat(fallbackTarget)
      : DEFAULT_CPL_TARGET;
}

const explorerFiltersSchema = z.object({
  preset: z.enum(EXPLORER_DATE_PRESETS),
  since: z.string().optional().nullable(),
  until: z.string().optional().nullable(),
  objective: z.string().optional().nullable(),
  status: z.string().optional().nullable(),
  query: z.string().optional().nullable(),
});

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

    metaConnection: publicProcedure.query(async () => getMetaConnectionStatus()),

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
      const view = await getHomeDashboardView(
        await resolveCplTarget(null)
      );
      return view.accountMetrics;
    }),

    campaigns: publicProcedure.query(async ({ ctx }) => {
      const cplTarget = await resolveCplTarget(ctx.user?.id ?? null);
      const view = await getHomeDashboardView(cplTarget);
      return view.campaigns;
    }),

    actionItems: publicProcedure.query(async () => {
      return getAllActionItems();
    }),

    dailyPerformance: publicProcedure.query(async () => {
      const view = await getHomeDashboardView(
        await resolveCplTarget(null)
      );
      return {
        days: view.dailyPerformance,
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

    explorerSummary: publicProcedure
      .input(explorerFiltersSchema)
      .query(async ({ input }) => getExplorerSummary(input)),

    explorerCampaigns: publicProcedure
      .input(explorerFiltersSchema)
      .query(async ({ input, ctx }) =>
        getExplorerCampaignBreakdown(
          input,
          await resolveCplTarget(ctx.user?.id ?? null)
        )
      ),

    explorerAdsets: publicProcedure
      .input(
        explorerFiltersSchema.extend({
          campaignId: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) =>
        getExplorerAdsetBreakdown(
          input,
          input.campaignId,
          await resolveCplTarget(ctx.user?.id ?? null)
        )
      ),

    explorerAds: publicProcedure
      .input(
        explorerFiltersSchema.extend({
          adsetId: z.string().min(1),
        })
      )
      .query(async ({ input, ctx }) =>
        getExplorerAdBreakdown(
          input,
          input.adsetId,
          await resolveCplTarget(ctx.user?.id ?? null)
        )
      ),

    explorerTrend: publicProcedure
      .input(
        explorerFiltersSchema.extend({
          level: z.enum(["account", "campaign", "adset", "ad"]),
          entityId: z.string().optional().nullable(),
        })
      )
      .query(async ({ input }) => getExplorerTrendSeries(input)),
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
