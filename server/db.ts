import { eq, and, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  accountMetrics,
  campaigns,
  actionItems,
  userSettings,
  performanceSnapshots,
  snapshotCampaigns,
} from "../drizzle/schema";
import type { FetchedSnapshot } from "./metaAdsFetcher";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// ── Account metrics helpers ──────────────────────────────────────────
export async function getLatestAccountMetrics() {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select()
    .from(accountMetrics)
    .orderBy(accountMetrics.updatedAt)
    .limit(1);
  return result[0] ?? null;
}

// ── Campaign helpers ─────────────────────────────────────────
export async function getAllCampaigns() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(campaigns).orderBy(campaigns.amountSpent);
}

// ── Action items helpers ─────────────────────────────────────
export async function getAllActionItems() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(actionItems).orderBy(actionItems.priority, actionItems.id);
}

export async function toggleActionItem(id: number, completed: boolean) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(actionItems).set({ completed }).where(eq(actionItems.id, id));
}

// ── User settings helpers ────────────────────────────────────
export async function getSetting(key: string, userId?: number | null) {
  const db = await getDb();
  if (!db) return null;
  const condition = userId != null
    ? and(eq(userSettings.settingKey, key), eq(userSettings.userId, userId))
    : and(eq(userSettings.settingKey, key), isNull(userSettings.userId));
  const result = await db.select().from(userSettings).where(condition).limit(1);
  return result[0]?.settingValue ?? null;
}

export async function upsertSetting(key: string, value: string, userId?: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const condition = userId != null
    ? and(eq(userSettings.settingKey, key), eq(userSettings.userId, userId))
    : and(eq(userSettings.settingKey, key), isNull(userSettings.userId));
  const existing = await db.select().from(userSettings).where(condition).limit(1);
  if (existing.length > 0) {
    await db.update(userSettings).set({ settingValue: value }).where(condition);
  } else {
    await db.insert(userSettings).values({ userId: userId ?? null, settingKey: key, settingValue: value });
  }
}

// ── Snapshot helpers ────────────────────────────────────────────
export async function saveSnapshot(data: FetchedSnapshot): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Upsert snapshot: replace existing row for same datePreset (keep latest)
  const existing = await db
    .select({ id: performanceSnapshots.id })
    .from(performanceSnapshots)
    .where(eq(performanceSnapshots.datePreset, data.datePreset))
    .limit(1);

  if (existing.length > 0) {
    const id = existing[0].id;
    await db.update(performanceSnapshots).set({
      datePresetLabel: data.datePresetLabel,
      dateRangeSince: data.dateRangeSince,
      dateRangeUntil: data.dateRangeUntil,
      isPartial: data.isPartial,
      amountSpent: String(data.account.amountSpent),
      impressions: data.account.impressions,
      reach: data.account.reach,
      frequency: String(data.account.frequency),
      clicksAll: data.account.clicksAll,
      linkClicks: data.account.linkClicks,
      ctrAll: String(data.account.ctrAll),
      ctrLink: String(data.account.ctrLink),
      cpm: String(data.account.cpm),
      cpcAll: String(data.account.cpcAll),
      cpcLink: String(data.account.cpcLink),
      leads: data.account.leads,
      costPerLead: String(data.account.costPerLead),
      fetchedAt: new Date(),
    }).where(eq(performanceSnapshots.id, id));

    // Delete old campaign rows for this snapshot
    await db.delete(snapshotCampaigns).where(eq(snapshotCampaigns.snapshotId, id));

    // Re-insert campaign rows
    if (data.campaigns.length > 0) {
      await db.insert(snapshotCampaigns).values(
        data.campaigns.map(c => ({
          snapshotId: id,
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          shortName: c.shortName,
          objective: c.objective,
          status: c.status,
          amountSpent: String(c.amountSpent),
          impressions: c.impressions,
          reach: c.reach,
          frequency: String(c.frequency),
          clicksAll: c.clicksAll,
          linkClicks: c.linkClicks,
          ctrAll: String(c.ctrAll),
          ctrLink: String(c.ctrLink),
          cpm: String(c.cpm),
          cpcAll: String(c.cpcAll),
          cpcLink: String(c.cpcLink),
          leads: c.leads,
          costPerLead: c.costPerLead != null ? String(c.costPerLead) : null,
        }))
      );
    }
    return id;
  } else {
    // Insert new snapshot
    const [result] = await db.insert(performanceSnapshots).values({
      datePreset: data.datePreset,
      datePresetLabel: data.datePresetLabel,
      dateRangeSince: data.dateRangeSince,
      dateRangeUntil: data.dateRangeUntil,
      isPartial: data.isPartial,
      amountSpent: String(data.account.amountSpent),
      impressions: data.account.impressions,
      reach: data.account.reach,
      frequency: String(data.account.frequency),
      clicksAll: data.account.clicksAll,
      linkClicks: data.account.linkClicks,
      ctrAll: String(data.account.ctrAll),
      ctrLink: String(data.account.ctrLink),
      cpm: String(data.account.cpm),
      cpcAll: String(data.account.cpcAll),
      cpcLink: String(data.account.cpcLink),
      leads: data.account.leads,
      costPerLead: String(data.account.costPerLead),
    });
    const newId = (result as any).insertId as number;

    if (data.campaigns.length > 0) {
      await db.insert(snapshotCampaigns).values(
        data.campaigns.map(c => ({
          snapshotId: newId,
          campaignId: c.campaignId,
          campaignName: c.campaignName,
          shortName: c.shortName,
          objective: c.objective,
          status: c.status,
          amountSpent: String(c.amountSpent),
          impressions: c.impressions,
          reach: c.reach,
          frequency: String(c.frequency),
          clicksAll: c.clicksAll,
          linkClicks: c.linkClicks,
          ctrAll: String(c.ctrAll),
          ctrLink: String(c.ctrLink),
          cpm: String(c.cpm),
          cpcAll: String(c.cpcAll),
          cpcLink: String(c.cpcLink),
          leads: c.leads,
          costPerLead: c.costPerLead != null ? String(c.costPerLead) : null,
        }))
      );
    }
    return newId;
  }
}

export async function getAllSnapshots() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(performanceSnapshots)
    .orderBy(performanceSnapshots.fetchedAt);
}

export async function getSnapshotWithCampaigns(snapshotId: number) {
  const db = await getDb();
  if (!db) return null;
  const [snapshot] = await db
    .select()
    .from(performanceSnapshots)
    .where(eq(performanceSnapshots.id, snapshotId))
    .limit(1);
  if (!snapshot) return null;
  const campaigns = await db
    .select()
    .from(snapshotCampaigns)
    .where(eq(snapshotCampaigns.snapshotId, snapshotId));
  return { snapshot, campaigns };
}
