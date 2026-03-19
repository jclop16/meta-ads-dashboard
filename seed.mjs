// seed.mjs — Populate the database with Meta Ads report data
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// Dynamically import schema after drizzle is ready
const { accountMetrics: accountMetricsTable, campaigns: campaignsTable, actionItems: actionItemsTable, userSettings: userSettingsTable } = await import("./drizzle/schema.ts");

// ── Account Metrics ──────────────────────────────────────────
await db.insert(accountMetricsTable).values({
  reportDateRange: "Feb 17 – Mar 18, 2026",
  accountName: "Legacy Empowerment Group",
  accountCurrency: "USD",
  amountSpent: "14647.37",
  impressions: 396773,
  reach: 169894,
  frequency: "2.34",
  clicksAll: 20553,
  linkClicks: 10079,
  ctrAll: "5.18",
  ctrLink: "2.54",
  cpm: "36.92",
  cpcAll: "0.7100",
  cpcLink: "1.4500",
  leads: 653,
  costPerLead: "22.43",
}).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
console.log("✓ account_metrics seeded");

// ── Campaigns ────────────────────────────────────────────────
const campaignData = [
  { id: "6976841592619", name: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 1", shortName: "FEGLI Trap — Hook 1", objective: "FEGLI Trap", amountSpent: "3614.90", impressions: 99646, reach: 57756, frequency: "1.73", clicksAll: 4330, linkClicks: 2640, ctrAll: "4.35", ctrLink: "2.65", cpm: "36.28", cpcAll: "0.8300", cpcLink: "1.3700", leads: 162, costPerLead: "22.31", status: "moderate", recommendation: "Stable volume driver at account-average CPL. Consolidate with Hook 2 into a single CBO to let Meta optimize between hooks dynamically." },
  { id: "6976841592620", name: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 2", shortName: "FEGLI Trap — Hook 2", objective: "FEGLI Trap", amountSpent: "2881.30", impressions: 77697, reach: 46821, frequency: "1.56", clicksAll: 2931, linkClicks: 1776, ctrAll: "3.77", ctrLink: "2.29", cpm: "37.08", cpcAll: "0.9800", cpcLink: "1.6200", leads: 132, costPerLead: "21.83", status: "moderate", recommendation: "Best CPL among the FEGLI Trap group. Consolidate with Hook 1 into a single CBO campaign to maximize delivery efficiency." },
  { id: "6991305311219", name: "DS | Annuity | Leads | CBO | FB | Oct 2025 | Finish Line [SAC]", shortName: "Annuity — Finish Line [SAC]", objective: "Annuity", amountSpent: "1791.86", impressions: 49228, reach: 32702, frequency: "1.51", clicksAll: 2987, linkClicks: 1185, ctrAll: "6.07", ctrLink: "2.41", cpm: "36.40", cpcAll: "0.6000", cpcLink: "1.5100", leads: 24, costPerLead: "74.66", status: "poor", recommendation: "PAUSE IMMEDIATELY. Spending $1,791 for only 24 leads at $74.66 CPL — 3.3× the account average. Reallocate budget to Annuity Oct25-2." },
  { id: "6976841592621", name: "DS | FEGLI Trap | Leads | CBO | FB & IG | Feb 2026 | Hook 3", shortName: "FEGLI Trap — Hook 3", objective: "FEGLI Trap", amountSpent: "1853.76", impressions: 51657, reach: 36597, frequency: "1.41", clicksAll: 1717, linkClicks: 1066, ctrAll: "3.32", ctrLink: "2.06", cpm: "35.89", cpcAll: "1.0800", cpcLink: "1.7400", leads: 70, costPerLead: "26.48", status: "moderate", recommendation: "Slightly above average CPL. Monitor closely. If CPL doesn't improve within 7 days, consolidate budget into Hooks 1 & 2." },
  { id: "6917542246619", name: "DS | Annuity | Leads | CBO | FB | Oct 2025 - 2", shortName: "Annuity — Oct 2025 #2", objective: "Annuity", amountSpent: "1366.10", impressions: 39240, reach: 30900, frequency: "1.27", clicksAll: 3270, linkClicks: 1550, ctrAll: "8.33", ctrLink: "3.95", cpm: "34.81", cpcAll: "0.4200", cpcLink: "0.8800", leads: 105, costPerLead: "13.01", status: "excellent", recommendation: "SCALE NOW. Best CPL in the account at $13.01 — 42% below average. Increase budget 15–20% every 3 days. Enable Advantage+ Placements for projected 9% further CPL reduction." },
  { id: "6917545840019", name: "DS | Annuity | Leads | CBO | FB | Oct 2025 - 2 [SAC]", shortName: "Annuity — Oct 2025 #2 [SAC]", objective: "Annuity", amountSpent: "1293.79", impressions: 30446, reach: 21144, frequency: "1.44", clicksAll: 2429, linkClicks: 1031, ctrAll: "7.98", ctrLink: "3.39", cpm: "42.49", cpcAll: "0.5300", cpcLink: "1.2500", leads: 73, costPerLead: "17.72", status: "excellent", recommendation: "Strong performer at $17.72 CPL. The higher CPM ($42.49) vs. the non-SAC variant is expected for special ad categories. Continue scaling alongside Oct25-2." },
  { id: "6812512881019", name: "DS | Annuity | Leads | CBO | FB | May 2025 - 1", shortName: "Annuity — May 2025 #1", objective: "Annuity", amountSpent: "876.38", impressions: 24435, reach: 17930, frequency: "1.36", clicksAll: 1627, linkClicks: 443, ctrAll: "6.66", ctrLink: "1.81", cpm: "35.87", cpcAll: "0.5400", cpcLink: "1.9800", leads: 61, costPerLead: "14.37", status: "excellent", recommendation: "Consistently efficient at $14.37 CPL. A proven evergreen campaign. Maintain current budget and use as a benchmark for new creative tests." },
  { id: "6991332151819", name: "DS | Annuity | Leads | CBO | FB | May 2025 | Legacy [SAC]", shortName: "Annuity — May 2025 Legacy [SAC]", objective: "Annuity", amountSpent: "596.77", impressions: 18629, reach: 13343, frequency: "1.40", clicksAll: 1030, linkClicks: 272, ctrAll: "5.53", ctrLink: "1.46", cpm: "32.03", cpcAll: "0.5800", cpcLink: "2.1900", leads: 21, costPerLead: "28.42", status: "moderate", recommendation: "Above-average CPL at $28.42. The low CTR (link) of 1.46% suggests the landing page experience may be the bottleneck. Test a new landing page variant before scaling." },
  { id: "6322238560419", name: "[Conversion] FEGLI", shortName: "[Conv] FEGLI", objective: "FEGLI Conversion", amountSpent: "372.51", impressions: 5795, reach: 4394, frequency: "1.32", clicksAll: 232, linkClicks: 114, ctrAll: "4.00", ctrLink: "1.97", cpm: "64.28", cpcAll: "1.6100", cpcLink: "3.2700", leads: 5, costPerLead: "74.50", status: "poor", recommendation: "PAUSE. CPM of $64.28 is 74% above account average, and CPL of $74.50 is 3.3× the account average. The audience/creative combination is not viable in the current auction." },
];

for (const c of campaignData) {
  await db.insert(campaignsTable).values(c).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
}
console.log(`✓ campaigns seeded (${campaignData.length} rows)`);

// ── Action Items (only if empty) ─────────────────────────────
const existing = await db.select().from(actionItemsTable).limit(1);
if (existing.length === 0) {
  await db.insert(actionItemsTable).values([
    { priority: "critical", category: "pause", title: "Pause 'Annuity Finish Line [SAC]'", description: "This campaign is spending $1,791.86 for only 24 leads at $74.66 CPL — 3.3× the account average. Immediate pause and budget reallocation will lower your blended CPL.", estimatedImpact: "Saves ~$1,800/month, reallocatable to top performers" },
    { priority: "critical", category: "pause", title: "Pause '[Conversion] FEGLI'", description: "CPM of $64.28 (74% above account average) and CPL of $74.50 indicate this audience/creative combination is not competitive in the current auction environment.", estimatedImpact: "Saves ~$370/month, eliminates highest-CPM drag" },
    { priority: "high", category: "scale", title: "Scale 'Annuity Oct 2025 #2' budget 15–20%", description: "At $13.01 CPL — 42% below account average — this is your most efficient campaign. Incrementally increase budget every 3 days while CPL stays below $25.", estimatedImpact: "Projected +30–50 additional leads/month at current efficiency" },
    { priority: "high", category: "optimize", title: "Enable Advantage+ Placements on top Annuity campaigns", description: "Meta's system recommends enabling Advantage+ placements on the active Annuity campaign. The algorithm estimates a 9% lower cost per result by accessing all eligible placements.", estimatedImpact: "Estimated 9% CPL reduction (Meta official recommendation)" },
    { priority: "medium", category: "optimize", title: "Consolidate FEGLI Trap Hooks 1 & 2 into one CBO", description: "Hooks 1 ($22.31 CPL) and Hook 2 ($21.83 CPL) are performing similarly. Merging into a single CBO allows Meta's ML to dynamically allocate between hooks for marginal efficiency gains.", estimatedImpact: "Reduced auction competition between own campaigns, better budget utilization" },
    { priority: "medium", category: "optimize", title: "Opt-in to Reels placements for FEGLI Trap creatives", description: "Meta recommends Reels placements for ads with media that performs well in that format. Fullscreen 9:16 vertical video with audio has shown better performance vs. other formats.", estimatedImpact: "Estimated 1.4% lower cost per result (Meta official recommendation)" },
    { priority: "medium", category: "test", title: "Test new landing page for 'Annuity May 2025 Legacy [SAC]'", description: "The low CTR (link click-through rate) of 1.46% on this campaign suggests the landing page is the conversion bottleneck, not the ad creative. A/B test a new landing page variant.", estimatedImpact: "Potential CPL reduction from $28.42 toward the $17–22 range" },
  ]);
  console.log("✓ action_items seeded (7 rows)");
} else {
  console.log("  action_items already seeded, skipping");
}

// ── Default CPL target setting ───────────────────────────────
const settingExists = await db.select().from(userSettingsTable).limit(1);
if (settingExists.length === 0) {
  await db.insert(userSettingsTable).values({ userId: null, settingKey: "cplTarget", settingValue: "22.43" });
  console.log("✓ default CPL target setting seeded");
} else {
  console.log("  CPL target setting already exists, skipping");
}

await connection.end();
console.log("\n✅ Database seeded successfully!");
