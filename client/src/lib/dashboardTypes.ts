import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../../server/routers";

type RouterOutputs = inferRouterOutputs<AppRouter>;

export type DashboardMetrics = NonNullable<
  RouterOutputs["dashboard"]["accountMetrics"]
>;
export type DashboardCampaign = RouterOutputs["dashboard"]["campaigns"][number];
export type DashboardActionItem =
  RouterOutputs["dashboard"]["actionItems"][number];
export type DailyPerformancePoint =
  RouterOutputs["dashboard"]["dailyPerformance"]["days"][number];
export type MetaState = RouterOutputs["dashboard"]["metaState"];
export type PerformanceStatus = "excellent" | "moderate" | "poor";
export type ExplorerSummary = RouterOutputs["dashboard"]["explorerSummary"];
export type ExplorerCampaign =
  RouterOutputs["dashboard"]["explorerCampaigns"][number];
export type ExplorerAdset = RouterOutputs["dashboard"]["explorerAdsets"][number];
export type ExplorerAd = RouterOutputs["dashboard"]["explorerAds"][number];
export type ExplorerTrendPoint =
  RouterOutputs["dashboard"]["explorerTrend"][number];
