/**
 * metaAdsFetcher.ts
 * Server-side helper that calls the Meta Marketing MCP server via the
 * manus-mcp-cli CLI tool and returns structured performance data.
 *
 * This runs on the Node.js server (not in the browser) so it has access
 * to the CLI tool available in the sandbox environment.
 */

import { execSync } from "child_process";
import * as fs from "fs";

const AD_ACCOUNT_ID = "act_77497873";

// ── Date preset config ────────────────────────────────────────
export const DATE_PRESETS = [
  { preset: "last_30d",              label: "Last 30 Days",       isPartial: false },
  { preset: "last_7d",               label: "Last 7 Days",        isPartial: false },
  { preset: "this_week_mon_today",   label: "This Week",          isPartial: true  },
  { preset: "today",                 label: "Today",              isPartial: true  },
  { preset: "yesterday",             label: "Yesterday",          isPartial: false },
] as const;

export type DatePreset = typeof DATE_PRESETS[number]["preset"];

// ── MCP call helper ───────────────────────────────────────────
function callMcp(toolName: string, input: Record<string, unknown>): unknown {
  const inputJson = JSON.stringify(input);
  const result = execSync(
    `manus-mcp-cli tool call ${toolName} --server meta-marketing --input '${inputJson.replace(/'/g, "'\\''")}'`,
    { encoding: "utf8", timeout: 60_000 }
  );

  // manus-mcp-cli writes result to a file path shown in stdout
  const match = result.match(/Tool call result saved to: (.+\.json)/);
  if (match) {
    const filePath = match[1].trim();
    const fileContent = fs.readFileSync(filePath, "utf8");
    return JSON.parse(fileContent);
  }

  // Fallback: try to parse stdout directly
  try {
    return JSON.parse(result);
  } catch {
    throw new Error(`MCP call failed: ${result}`);
  }
}

// ── Types ─────────────────────────────────────────────────────
export interface MetaInsightRow {
  campaign_id?: string;
  campaign_name?: string;
  spend: string;
  impressions: string;
  reach: string;
  frequency: string;
  clicks: string;
  inline_link_clicks: string;
  ctr: string;
  inline_link_click_ctr: string;
  cpm: string;
  cpc: string;
  cost_per_inline_link_click: string;
  actions?: Array<{ action_type: string; value: string }>;
  date_start: string;
  date_stop: string;
}

export interface FetchedSnapshot {
  datePreset: string;
  datePresetLabel: string;
  dateRangeSince: string;
  dateRangeUntil: string;
  isPartial: boolean;
  account: {
    amountSpent: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicksAll: number;
    linkClicks: number;
    ctrAll: number;
    ctrLink: number;
    cpm: number;
    cpcAll: number;
    cpcLink: number;
    leads: number;
    costPerLead: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    shortName: string;
    objective: string;
    status: string;
    amountSpent: number;
    impressions: number;
    reach: number;
    frequency: number;
    clicksAll: number;
    linkClicks: number;
    ctrAll: number;
    ctrLink: number;
    cpm: number;
    cpcAll: number;
    cpcLink: number;
    leads: number;
    costPerLead: number | null;
  }>;
}

// ── Helpers ───────────────────────────────────────────────────
function parseLeads(row: MetaInsightRow): number {
  const leadAction = row.actions?.find(
    a => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
  );
  return leadAction ? parseInt(leadAction.value, 10) : 0;
}

function safeFloat(v: string | undefined): number {
  if (!v) return 0;
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
}

function safeInt(v: string | undefined): number {
  if (!v) return 0;
  const n = parseInt(v, 10);
  return isNaN(n) ? 0 : n;
}

// Derive a short display name from the full campaign name
function toShortName(name: string): string {
  return name
    .replace(/\[.*?\]/g, "")
    .replace(/\|.*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// Infer objective from campaign name
function inferObjective(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("annuity")) return "Annuity";
  if (lower.includes("fegli") && lower.includes("trap")) return "FEGLI Trap";
  if (lower.includes("fegli") && lower.includes("conversion")) return "FEGLI Conversion";
  if (lower.includes("fegli")) return "FEGLI Trap";
  return "Other";
}

// ── Main fetch function ───────────────────────────────────────
export async function fetchSnapshotForPreset(
  preset: string,
  label: string,
  isPartial: boolean
): Promise<FetchedSnapshot> {
  // 1. Fetch account-level insights
  const accountResult = callMcp("meta_marketing_get_insights", {
    object_type: "ad_account",
    object_id: AD_ACCOUNT_ID,
    date_preset: preset,
    level: "account",
  }) as { result?: { data?: MetaInsightRow[]; paging?: { cursors?: { after?: string } } } };

  const accountRows: MetaInsightRow[] = accountResult?.result?.data ?? [];
  const acct = accountRows[0];

  if (!acct) {
    throw new Error(`No account data returned for preset: ${preset}`);
  }

  const acctLeads = parseLeads(acct);
  const acctSpent = safeFloat(acct.spend);
  const acctCostPerLead = acctLeads > 0 ? acctSpent / acctLeads : 0;

  // 2. Fetch campaign-level insights
  const campaignResult = callMcp("meta_marketing_get_insights", {
    object_type: "ad_account",
    object_id: AD_ACCOUNT_ID,
    date_preset: preset,
    level: "campaign",
  }) as { result?: { data?: MetaInsightRow[] } };

  const campaignRows: MetaInsightRow[] = campaignResult?.result?.data ?? [];

  const campaignData = campaignRows.map(row => {
    const leads = parseLeads(row);
    const spent = safeFloat(row.spend);
    const cpl = leads > 0 ? spent / leads : null;
    const cplStatus = cpl == null ? "moderate" : cpl <= 22.43 ? "excellent" : cpl <= 33.65 ? "moderate" : "poor";

    return {
      campaignId: row.campaign_id ?? "",
      campaignName: row.campaign_name ?? "",
      shortName: toShortName(row.campaign_name ?? ""),
      objective: inferObjective(row.campaign_name ?? ""),
      status: cplStatus,
      amountSpent: spent,
      impressions: safeInt(row.impressions),
      reach: safeInt(row.reach),
      frequency: safeFloat(row.frequency),
      clicksAll: safeInt(row.clicks),
      linkClicks: safeInt(row.inline_link_clicks),
      ctrAll: safeFloat(row.ctr),
      ctrLink: safeFloat(row.inline_link_click_ctr),
      cpm: safeFloat(row.cpm),
      cpcAll: safeFloat(row.cpc),
      cpcLink: safeFloat(row.cost_per_inline_link_click),
      leads,
      costPerLead: cpl,
    };
  });

  return {
    datePreset: preset,
    datePresetLabel: label,
    dateRangeSince: acct.date_start,
    dateRangeUntil: acct.date_stop,
    isPartial,
    account: {
      amountSpent: acctSpent,
      impressions: safeInt(acct.impressions),
      reach: safeInt(acct.reach),
      frequency: safeFloat(acct.frequency),
      clicksAll: safeInt(acct.clicks),
      linkClicks: safeInt(acct.inline_link_clicks),
      ctrAll: safeFloat(acct.ctr),
      ctrLink: safeFloat(acct.inline_link_click_ctr),
      cpm: safeFloat(acct.cpm),
      cpcAll: safeFloat(acct.cpc),
      cpcLink: safeFloat(acct.cost_per_inline_link_click),
      leads: acctLeads,
      costPerLead: acctCostPerLead,
    },
    campaigns: campaignData,
  };
}

export async function fetchAllSnapshots(): Promise<FetchedSnapshot[]> {
  const results: FetchedSnapshot[] = [];
  for (const { preset, label, isPartial } of DATE_PRESETS) {
    try {
      const snapshot = await fetchSnapshotForPreset(preset, label, isPartial);
      results.push(snapshot);
    } catch (err) {
      console.error(`[MetaAdsFetcher] Failed to fetch ${preset}:`, err);
    }
  }
  return results;
}
