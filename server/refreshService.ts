import { ENV } from "./_core/env";
import {
  DEFAULT_CPL_TARGET,
} from "./dashboardLogic";
import {
  createRefreshRun,
  finishRefreshRun,
  getAllActionItems,
  getSetting,
  replaceActionItemsData,
  replaceCurrentDashboardData,
  replaceDailyPerformance,
  saveSnapshot,
} from "./db";
import {
  fetchAllSnapshots,
  fetchNormalizedReportData,
  type NormalizedSyncMode,
} from "./metaAdsFetcher";
import {
  buildHomeDashboardViewFromDataset,
  buildLegacyDailyPerformanceFromNormalizedData,
  buildRecommendationItemsFromDataset,
  persistNormalizedReportData,
  persistRecommendationRun,
} from "./reportingStore";

export type RefreshTrigger = "manual" | "scheduled";

export type RefreshExecutionResult = {
  success: true;
  saved: string[];
  failed: string[];
  sourceMode: "live" | "demo";
  accountName: string;
  accountId: string | null;
  fetchedAt: Date;
  refreshRunId: number;
  trigger: RefreshTrigger;
};

export class DashboardRefreshError extends Error {
  readonly details: Omit<RefreshExecutionResult, "success">;

  constructor(message: string, details: Omit<RefreshExecutionResult, "success">) {
    super(message);
    this.name = "DashboardRefreshError";
    this.details = details;
  }
}

async function resolveCplTarget(userId: number | null) {
  const storedTarget = userId != null ? await getSetting("cplTarget", userId) : null;
  const fallbackTarget = await getSetting("cplTarget", null);

  return storedTarget != null
    ? Number.parseFloat(storedTarget)
    : fallbackTarget != null
      ? Number.parseFloat(fallbackTarget)
      : DEFAULT_CPL_TARGET;
}

export async function runDashboardRefresh(input: {
  trigger: RefreshTrigger;
  userId?: number | null;
  mode?: NormalizedSyncMode;
}): Promise<RefreshExecutionResult> {
  const mode = input.mode ?? "hot";
  const refreshRunId = await createRefreshRun({
    trigger: input.trigger,
    accountId: ENV.metaAdAccountId || null,
  });
  const saved: string[] = [];
  const failed: string[] = [];
  let sourceMode: "live" | "demo" = "demo";
  let accountName = ENV.metaAccountName || "Meta Ad Account";
  let accountId = ENV.metaAdAccountId || null;

  try {
    const [normalizedDataset, existingActionItems] = await Promise.all([
      fetchNormalizedReportData({ mode }),
      getAllActionItems(),
    ]);
    const cplTarget = await resolveCplTarget(input.userId ?? null);
    const completedByTitle = new Map(
      existingActionItems.map(item => [item.title, item.completed])
    );

    await persistNormalizedReportData(normalizedDataset);
    sourceMode = normalizedDataset.sourceMode;
    accountName = normalizedDataset.account.name;
    accountId = normalizedDataset.account.id;

    if (mode === "hot") {
      const { account, snapshots, sourceMode: snapshotSourceMode } =
        await fetchAllSnapshots();
      sourceMode = snapshotSourceMode;
      accountName = account.name;
      accountId = account.id;

      for (const snapshot of snapshots) {
        try {
          await saveSnapshot(snapshot);
          saved.push(snapshot.datePresetLabel);
        } catch (error) {
          console.error(`[Refresh] Failed to save ${snapshot.datePresetLabel}:`, error);
          failed.push(snapshot.datePresetLabel);
        }
      }

      const homeView = buildHomeDashboardViewFromDataset(normalizedDataset, cplTarget);
      const recommendationItems = buildRecommendationItemsFromDataset(
        normalizedDataset,
        cplTarget
      );

      await replaceCurrentDashboardData(
        {
          id: normalizedDataset.account.id,
          name: normalizedDataset.account.name,
          currency: normalizedDataset.account.currency,
        },
        {
          datePreset: "last_30d",
          datePresetLabel: "Last 30 Days",
          dateRangeSince: homeView.range.since,
          dateRangeUntil: homeView.range.until,
          isPartial: false,
          account: {
            amountSpent: homeView.accountMetrics.amountSpent,
            impressions: homeView.accountMetrics.impressions,
            reach: homeView.accountMetrics.reach,
            frequency: homeView.accountMetrics.frequency,
            clicksAll: homeView.accountMetrics.clicksAll,
            linkClicks: homeView.accountMetrics.linkClicks,
            ctrAll: homeView.accountMetrics.ctrAll,
            ctrLink: homeView.accountMetrics.ctrLink,
            cpm: homeView.accountMetrics.cpm,
            cpcAll: homeView.accountMetrics.cpcAll,
            cpcLink: homeView.accountMetrics.cpcLink,
            leads: homeView.accountMetrics.leads,
            costPerLead: homeView.accountMetrics.costPerLead ?? 0,
          },
          campaigns: homeView.campaigns.map(campaign => ({
            campaignId: campaign.id,
            campaignName: campaign.name,
            shortName: campaign.displayName,
            objective: campaign.objective,
            status: campaign.performanceStatus,
            amountSpent: campaign.amountSpent,
            impressions: campaign.impressions,
            reach: campaign.reach,
            frequency: campaign.frequency,
            clicksAll: campaign.clicksAll,
            linkClicks: campaign.linkClicks,
            ctrAll: campaign.ctrAll,
            ctrLink: campaign.ctrLink,
            cpm: campaign.cpm,
            cpcAll: campaign.cpcAll,
            cpcLink: campaign.cpcLink,
            leads: campaign.leads,
            costPerLead: campaign.costPerLead,
          })),
        },
        cplTarget
      );
      await replaceDailyPerformance(
        await buildLegacyDailyPerformanceFromNormalizedData({
          dataset: normalizedDataset,
          since: homeView.range.since,
          until: homeView.range.until,
        })
      );
      await replaceActionItemsData(
        recommendationItems.map(item => ({
          priority: item.priority,
          category: item.category,
          title: item.headline,
          description: item.rationale,
          estimatedImpact: item.expectedImpact,
          completed: completedByTitle.get(item.headline) ?? false,
        }))
      );
      await persistRecommendationRun({
        accountId: normalizedDataset.account.id,
        since: homeView.range.since,
        until: homeView.range.until,
        sourceMode: normalizedDataset.sourceMode,
        items: recommendationItems,
      });
    } else {
      saved.push("Historical Reconciliation");
    }

    if (failed.length > 0) {
      throw new DashboardRefreshError(
        `Refresh completed with failed presets: ${failed.join(", ")}`,
        {
          saved,
          failed,
          sourceMode,
          accountName,
          accountId,
          fetchedAt: new Date(),
          refreshRunId,
          trigger: input.trigger,
        }
      );
    }

    await finishRefreshRun(refreshRunId, {
      status: "success",
      savedPresets: saved,
      failedPresets: failed,
    });

    return {
      success: true,
      saved,
      failed,
      sourceMode,
      accountName,
      accountId,
      fetchedAt: new Date(),
      refreshRunId,
      trigger: input.trigger,
    };
  } catch (error) {
    const details =
      error instanceof DashboardRefreshError
        ? error.details
        : {
            saved,
            failed,
            sourceMode,
            accountName,
            accountId,
            fetchedAt: new Date(),
            refreshRunId,
            trigger: input.trigger,
          };
    const errorMessage =
      error instanceof Error ? error.message : "Unknown refresh error";

    await finishRefreshRun(refreshRunId, {
      status: "failed",
      savedPresets: details.saved,
      failedPresets: details.failed,
      errorMessage,
    });

    if (error instanceof DashboardRefreshError) {
      throw error;
    }

    throw new DashboardRefreshError(errorMessage, details);
  }
}
