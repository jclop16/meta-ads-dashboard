import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  decimal,
  boolean,
} from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ── Account-level metrics snapshot ──────────────────────────
export const accountMetrics = mysqlTable("account_metrics", {
  id: int("id").autoincrement().primaryKey(),
  reportDateRange: varchar("reportDateRange", { length: 64 }).notNull(),
  accountName: varchar("accountName", { length: 128 }).notNull(),
  accountCurrency: varchar("accountCurrency", { length: 8 }).notNull().default("USD"),
  amountSpent: decimal("amountSpent", { precision: 12, scale: 2 }).notNull(),
  impressions: int("impressions").notNull(),
  reach: int("reach").notNull(),
  frequency: decimal("frequency", { precision: 6, scale: 2 }).notNull(),
  clicksAll: int("clicksAll").notNull(),
  linkClicks: int("linkClicks").notNull(),
  ctrAll: decimal("ctrAll", { precision: 6, scale: 2 }).notNull(),
  ctrLink: decimal("ctrLink", { precision: 6, scale: 2 }).notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).notNull(),
  cpcAll: decimal("cpcAll", { precision: 8, scale: 4 }).notNull(),
  cpcLink: decimal("cpcLink", { precision: 8, scale: 4 }).notNull(),
  leads: int("leads").notNull(),
  costPerLead: decimal("costPerLead", { precision: 8, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AccountMetrics = typeof accountMetrics.$inferSelect;

// ── Campaign performance data ────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: varchar("id", { length: 32 }).primaryKey(),
  name: text("name").notNull(),
  shortName: varchar("shortName", { length: 128 }).notNull(),
  objective: mysqlEnum("objective", ["FEGLI Trap", "Annuity", "FEGLI Conversion", "Other"]).notNull(),
  amountSpent: decimal("amountSpent", { precision: 12, scale: 2 }).notNull(),
  impressions: int("impressions").notNull(),
  reach: int("reach").notNull(),
  frequency: decimal("frequency", { precision: 6, scale: 2 }).notNull(),
  clicksAll: int("clicksAll").notNull(),
  linkClicks: int("linkClicks").notNull(),
  ctrAll: decimal("ctrAll", { precision: 6, scale: 2 }).notNull(),
  ctrLink: decimal("ctrLink", { precision: 6, scale: 2 }).notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).notNull(),
  cpcAll: decimal("cpcAll", { precision: 8, scale: 4 }).notNull(),
  cpcLink: decimal("cpcLink", { precision: 8, scale: 4 }).notNull(),
  leads: int("leads").notNull(),
  costPerLead: decimal("costPerLead", { precision: 8, scale: 2 }),
  status: mysqlEnum("status", ["excellent", "moderate", "poor"]).notNull(),
  recommendation: text("recommendation").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;

// ── Action items / recommendations ──────────────────────────
export const actionItems = mysqlTable("action_items", {
  id: int("id").autoincrement().primaryKey(),
  priority: mysqlEnum("priority", ["critical", "high", "medium"]).notNull(),
  category: mysqlEnum("category", ["pause", "scale", "optimize", "test"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  description: text("description").notNull(),
  estimatedImpact: text("estimatedImpact").notNull(),
  completed: boolean("completed").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ActionItem = typeof actionItems.$inferSelect;

// ── Stored daily account series for the active reporting window ──
export const dailyPerformance = mysqlTable("daily_performance", {
  date: varchar("date", { length: 16 }).primaryKey(),
  label: varchar("label", { length: 32 }).notNull(),
  amountSpent: decimal("amountSpent", { precision: 12, scale: 2 }).notNull(),
  leads: int("leads").notNull(),
  costPerLead: decimal("costPerLead", { precision: 8, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DailyPerformance = typeof dailyPerformance.$inferSelect;

// ── Per-user dashboard settings (CPL target, etc.) ──────────
export const userSettings = mysqlTable("user_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),  // NULL = anonymous/global
  settingKey: varchar("settingKey", { length: 64 }).notNull(),
  settingValue: text("settingValue").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserSetting = typeof userSettings.$inferSelect;

// ── Performance snapshots (one row per date-range fetch) ─────────
export const performanceSnapshots = mysqlTable("performance_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  datePreset: varchar("datePreset", { length: 64 }).notNull(),
  datePresetLabel: varchar("datePresetLabel", { length: 128 }).notNull(),
  dateRangeSince: varchar("dateRangeSince", { length: 16 }).notNull(),
  dateRangeUntil: varchar("dateRangeUntil", { length: 16 }).notNull(),
  isPartial: boolean("isPartial").default(false).notNull(),
  // Account-level aggregates for this snapshot
  amountSpent: decimal("amountSpent", { precision: 12, scale: 2 }).notNull(),
  impressions: int("impressions").notNull(),
  reach: int("reach").notNull(),
  frequency: decimal("frequency", { precision: 6, scale: 2 }).notNull(),
  clicksAll: int("clicksAll").notNull(),
  linkClicks: int("linkClicks").notNull(),
  ctrAll: decimal("ctrAll", { precision: 6, scale: 4 }).notNull(),
  ctrLink: decimal("ctrLink", { precision: 6, scale: 4 }).notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).notNull(),
  cpcAll: decimal("cpcAll", { precision: 8, scale: 4 }).notNull(),
  cpcLink: decimal("cpcLink", { precision: 8, scale: 4 }).notNull(),
  leads: int("leads").notNull(),
  costPerLead: decimal("costPerLead", { precision: 8, scale: 2 }).notNull(),
  fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type PerformanceSnapshot = typeof performanceSnapshots.$inferSelect;

// ── Per-campaign data within a snapshot ───────────────────────
export const snapshotCampaigns = mysqlTable("snapshot_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: int("snapshotId").notNull(),
  campaignId: varchar("campaignId", { length: 32 }).notNull(),
  campaignName: text("campaignName").notNull(),
  shortName: varchar("shortName", { length: 128 }).notNull(),
  objective: varchar("objective", { length: 64 }).notNull(),
  status: varchar("status", { length: 32 }).notNull(),
  amountSpent: decimal("amountSpent", { precision: 12, scale: 2 }).notNull(),
  impressions: int("impressions").notNull(),
  reach: int("reach").notNull(),
  frequency: decimal("frequency", { precision: 6, scale: 2 }).notNull(),
  clicksAll: int("clicksAll").notNull(),
  linkClicks: int("linkClicks").notNull(),
  ctrAll: decimal("ctrAll", { precision: 6, scale: 4 }).notNull(),
  ctrLink: decimal("ctrLink", { precision: 6, scale: 4 }).notNull(),
  cpm: decimal("cpm", { precision: 8, scale: 2 }).notNull(),
  cpcAll: decimal("cpcAll", { precision: 8, scale: 4 }).notNull(),
  cpcLink: decimal("cpcLink", { precision: 8, scale: 4 }).notNull(),
  leads: int("leads").notNull(),
  costPerLead: decimal("costPerLead", { precision: 8, scale: 2 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SnapshotCampaign = typeof snapshotCampaigns.$inferSelect;
