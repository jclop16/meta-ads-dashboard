import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import {
  getLatestAccountMetrics,
  getAllCampaigns,
  getAllActionItems,
  toggleActionItem,
  getSetting,
  upsertSetting,
  saveSnapshot,
  getAllSnapshots,
  getSnapshotWithCampaigns,
} from "./db";
import { fetchAllSnapshots, DATE_PRESETS } from "./metaAdsFetcher";

export const appRouter = router({
  system: systemRouter,

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

    campaigns: publicProcedure.query(async () => {
      const rows = await getAllCampaigns();
      return rows.map(c => ({
        ...c,
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

    toggleActionItem: publicProcedure
      .input(z.object({ id: z.number(), completed: z.boolean() }))
      .mutation(async ({ input }) => {
        await toggleActionItem(input.id, input.completed);
        return { success: true };
      }),

    // Refresh all date-range snapshots from Meta Ads API
    refresh: publicProcedure.mutation(async () => {
      const snapshots = await fetchAllSnapshots();
      const saved: string[] = [];
      const failed: string[] = [];
      for (const snap of snapshots) {
        try {
          await saveSnapshot(snap);
          saved.push(snap.datePresetLabel);
        } catch (err) {
          console.error(`[Refresh] Failed to save ${snap.datePresetLabel}:`, err);
          failed.push(snap.datePresetLabel);
        }
      }
      return {
        success: true,
        saved,
        failed,
        fetchedAt: new Date(),
      };
    }),

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
      return { cplTarget: val != null ? parseFloat(val) : 22.43 };
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
