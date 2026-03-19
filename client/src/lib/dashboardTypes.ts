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
