import { ENV } from "./_core/env";
import {
  DEFAULT_CPL_TARGET,
  buildActionItems,
  buildCurrentCampaignRows,
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
} from "./metaAdsFetcher";
import {
  buildAdsetActionSignals,
  buildLegacyDailyPerformanceFromNormalizedData,
  persistNormalizedReportData,
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
}): Promise<RefreshExecutionResult> {
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
    const [
      { account, snapshots, sourceMode: snapshotSourceMode },
      normalizedDataset,
      existingActionItems,
    ] = await Promise.all([
      fetchAllSnapshots(),
      fetchNormalizedReportData(),
      getAllActionItems(),
    ]);
    const cplTarget = await resolveCplTarget(input.userId ?? null);
    const completedByTitle = new Map(
      existingActionItems.map(item => [item.title, item.completed])
    );

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

    const primarySnapshot =
      snapshots.find(snapshot => snapshot.datePreset === "last_30d") ?? snapshots[0];

    if (!primarySnapshot) {
      throw new Error("Refresh returned no snapshots to persist");
    }

    await persistNormalizedReportData(normalizedDataset);
    await replaceCurrentDashboardData(account, primarySnapshot, cplTarget);
    await replaceDailyPerformance(
      await buildLegacyDailyPerformanceFromNormalizedData({
        dataset: normalizedDataset,
        since: primarySnapshot.dateRangeSince,
        until: primarySnapshot.dateRangeUntil,
      })
    );
    await replaceActionItemsData(
      buildActionItems(
        buildCurrentCampaignRows(primarySnapshot, cplTarget),
        cplTarget,
        completedByTitle,
        await buildAdsetActionSignals({ preset: "last_30d" }, cplTarget)
      )
    );

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
