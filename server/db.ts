import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accountMetrics,
  actionItems,
  campaigns,
  dailyPerformance,
  performanceSnapshots,
  refreshRuns,
  snapshotCampaigns,
  userSettings,
  users,
  type AccountMetrics,
  type ActionItem,
  type Campaign,
  type DailyPerformance,
  type InsertUser,
  type PerformanceSnapshot,
  type RefreshRun,
  type RefreshRunStatus,
  type RefreshRunTrigger,
  type SnapshotCampaign,
  type User,
  type UserSetting,
} from "../drizzle/schema";
import {
  type ActionItemDraft,
  DEFAULT_CPL_TARGET,
  buildActionItems,
  buildCurrentAccountMetricsRow,
  buildCurrentCampaignRows,
} from "./dashboardLogic";
import { getDemoDailyPerformance, getDemoFetchedDataset } from "./demoData";
import { ENV } from "./_core/env";
import type {
  DailyPerformancePoint,
  FetchedSnapshot,
  MetaAccountProfile,
} from "./metaAdsFetcher";

type MemoryStore = {
  users: User[];
  accountMetrics: AccountMetrics | null;
  campaigns: Campaign[];
  actionItems: ActionItem[];
  dailyPerformance: DailyPerformance[];
  refreshRuns: RefreshRun[];
  settings: UserSetting[];
  snapshots: PerformanceSnapshot[];
  snapshotCampaigns: SnapshotCampaign[];
  nextIds: {
    user: number;
    accountMetrics: number;
    actionItem: number;
    refreshRun: number;
    setting: number;
    snapshot: number;
    snapshotCampaign: number;
  };
};

export type RefreshRunRecord = Omit<
  RefreshRun,
  "savedPresets" | "failedPresets"
> & {
  savedPresets: string[];
  failedPresets: string[];
};

let dbInstance: ReturnType<typeof drizzle> | null = null;
let memoryStore: MemoryStore | null = null;

function toSnapshotRow(snapshot: FetchedSnapshot, id: number): PerformanceSnapshot {
  const now = new Date();

  return {
    id,
    datePreset: snapshot.datePreset,
    datePresetLabel: snapshot.datePresetLabel,
    dateRangeSince: snapshot.dateRangeSince,
    dateRangeUntil: snapshot.dateRangeUntil,
    isPartial: snapshot.isPartial,
    amountSpent: snapshot.account.amountSpent.toFixed(2),
    impressions: snapshot.account.impressions,
    reach: snapshot.account.reach,
    frequency: snapshot.account.frequency.toFixed(2),
    clicksAll: snapshot.account.clicksAll,
    linkClicks: snapshot.account.linkClicks,
    ctrAll: snapshot.account.ctrAll.toFixed(4),
    ctrLink: snapshot.account.ctrLink.toFixed(4),
    cpm: snapshot.account.cpm.toFixed(2),
    cpcAll: snapshot.account.cpcAll.toFixed(4),
    cpcLink: snapshot.account.cpcLink.toFixed(4),
    leads: snapshot.account.leads,
    costPerLead: snapshot.account.costPerLead.toFixed(2),
    fetchedAt: now,
    createdAt: now,
  };
}

function toSnapshotCampaignRows(
  snapshot: FetchedSnapshot,
  snapshotId: number,
  nextId: () => number
): SnapshotCampaign[] {
  const createdAt = new Date();

  return snapshot.campaigns.map(campaign => ({
    id: nextId(),
    snapshotId,
    campaignId: campaign.campaignId,
    campaignName: campaign.campaignName,
    shortName: campaign.shortName,
    objective: campaign.objective,
    status: campaign.status,
    amountSpent: campaign.amountSpent.toFixed(2),
    impressions: campaign.impressions,
    reach: campaign.reach,
    frequency: campaign.frequency.toFixed(2),
    clicksAll: campaign.clicksAll,
    linkClicks: campaign.linkClicks,
    ctrAll: campaign.ctrAll.toFixed(4),
    ctrLink: campaign.ctrLink.toFixed(4),
    cpm: campaign.cpm.toFixed(2),
    cpcAll: campaign.cpcAll.toFixed(4),
    cpcLink: campaign.cpcLink.toFixed(4),
    leads: campaign.leads,
    costPerLead:
      campaign.costPerLead != null ? campaign.costPerLead.toFixed(2) : null,
    createdAt,
  }));
}

function toDailyPerformanceRows(
  days: DailyPerformancePoint[]
): DailyPerformance[] {
  const now = new Date();

  return days.map(day => ({
    date: day.date,
    label: day.label,
    amountSpent: day.amountSpent.toFixed(2),
    leads: day.leads,
    costPerLead: day.costPerLead != null ? day.costPerLead.toFixed(2) : null,
    createdAt: now,
    updatedAt: now,
  }));
}

function encodePresetList(values: string[]) {
  return values.length > 0 ? JSON.stringify(values) : null;
}

function decodePresetList(value: string | null) {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((entry): entry is string => typeof entry === "string")
      : [];
  } catch {
    return [];
  }
}

function toRefreshRunRecord(row: RefreshRun): RefreshRunRecord {
  return {
    ...row,
    savedPresets: decodePresetList(row.savedPresets),
    failedPresets: decodePresetList(row.failedPresets),
  };
}

function priorityRank(priority: ActionItem["priority"]) {
  if (priority === "critical") return 0;
  if (priority === "high") return 1;
  return 2;
}

function getCompletedByTitle(items: ActionItem[]) {
  return new Map(items.map(item => [item.title, item.completed]));
}

function createInitialMemoryStore(): MemoryStore {
  const store: MemoryStore = {
    users: [],
    accountMetrics: null,
    campaigns: [],
    actionItems: [],
    dailyPerformance: [],
    refreshRuns: [],
    settings: [],
    snapshots: [],
    snapshotCampaigns: [],
    nextIds: {
      user: 1,
      accountMetrics: 1,
      actionItem: 1,
      refreshRun: 1,
      setting: 1,
      snapshot: 1,
      snapshotCampaign: 1,
    },
  };
  const dataset = getDemoFetchedDataset();
  const primary =
    dataset.snapshots.find(snapshot => snapshot.datePreset === "last_30d") ??
    dataset.snapshots[0];

  if (primary) {
    replaceCurrentDashboardDataInMemory(
      store,
      dataset.account,
      primary,
      DEFAULT_CPL_TARGET
    );
  }

  replaceDailyPerformanceInMemory(store, getDemoDailyPerformance());
  dataset.snapshots.forEach(snapshot => saveSnapshotInMemory(store, snapshot));

  return store;
}

function getMemoryStore() {
  if (!memoryStore) {
    memoryStore = createInitialMemoryStore();
  }

  return memoryStore;
}

function replaceCurrentDashboardDataInMemory(
  store: MemoryStore,
  account: MetaAccountProfile,
  snapshot: FetchedSnapshot,
  cplTarget: number
) {
  const currentAccountMetrics = buildCurrentAccountMetricsRow(account, snapshot);
  const currentCampaigns = buildCurrentCampaignRows(snapshot, cplTarget);
  const nextCampaigns = currentCampaigns.map(campaign => ({
    ...campaign,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
  const actionItemDrafts = buildActionItems(
    currentCampaigns,
    cplTarget,
    getCompletedByTitle(store.actionItems)
  );

  store.accountMetrics = {
    id: store.nextIds.accountMetrics++,
    ...currentAccountMetrics,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.campaigns = nextCampaigns;
  store.actionItems = actionItemDrafts.map(item => ({
    id: store.nextIds.actionItem++,
    ...item,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function saveSnapshotInMemory(store: MemoryStore, snapshot: FetchedSnapshot) {
  const existing = store.snapshots.find(
    current => current.datePreset === snapshot.datePreset
  );

  if (existing) {
    const updated = toSnapshotRow(snapshot, existing.id);
    updated.createdAt = existing.createdAt;
    store.snapshots = store.snapshots.map(current =>
      current.id === existing.id ? updated : current
    );
    store.snapshotCampaigns = store.snapshotCampaigns.filter(
      row => row.snapshotId !== existing.id
    );
    store.snapshotCampaigns.push(
      ...toSnapshotCampaignRows(snapshot, existing.id, () => store.nextIds.snapshotCampaign++)
    );
    return existing.id;
  }

  const snapshotId = store.nextIds.snapshot++;
  store.snapshots.push(toSnapshotRow(snapshot, snapshotId));
  store.snapshotCampaigns.push(
    ...toSnapshotCampaignRows(snapshot, snapshotId, () => store.nextIds.snapshotCampaign++)
  );
  return snapshotId;
}

function replaceDailyPerformanceInMemory(
  store: MemoryStore,
  days: DailyPerformancePoint[]
) {
  store.dailyPerformance = toDailyPerformanceRows(days);
}

function createRefreshRunInMemory(
  store: MemoryStore,
  input: { trigger: RefreshRunTrigger; accountId?: string | null }
) {
  const id = store.nextIds.refreshRun++;
  store.refreshRuns.push({
    id,
    trigger: input.trigger,
    status: "started",
    startedAt: new Date(),
    finishedAt: null,
    savedPresets: null,
    failedPresets: null,
    errorMessage: null,
    accountId: input.accountId ?? null,
  });
  return id;
}

function finishRefreshRunInMemory(
  store: MemoryStore,
  id: number,
  input: {
    status: RefreshRunStatus;
    savedPresets?: string[];
    failedPresets?: string[];
    errorMessage?: string | null;
  }
) {
  store.refreshRuns = store.refreshRuns.map(run =>
    run.id === id
      ? {
          ...run,
          status: input.status,
          finishedAt: new Date(),
          savedPresets: encodePresetList(input.savedPresets ?? []),
          failedPresets: encodePresetList(input.failedPresets ?? []),
          errorMessage: input.errorMessage ?? null,
        }
      : run
  );
}

export async function getDb() {
  if (!dbInstance && ENV.databaseUrl) {
    try {
      dbInstance = drizzle(ENV.databaseUrl);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      dbInstance = null;
    }
  }

  return dbInstance;
}

export async function isDatabaseAvailable() {
  const db = await getDb();

  if (!db) {
    return false;
  }

  try {
    await db.execute(sql`select 1`);
    return true;
  } catch (error) {
    console.warn("[Database] Health check failed:", error);
    return false;
  }
}

export async function createRefreshRun(input: {
  trigger: RefreshRunTrigger;
  accountId?: string | null;
}) {
  const db = await getDb();

  if (!db) {
    return createRefreshRunInMemory(getMemoryStore(), input);
  }

  const [result] = await db.insert(refreshRuns).values({
    trigger: input.trigger,
    status: "started",
    accountId: input.accountId ?? null,
  });

  return (result as { insertId: number }).insertId;
}

export async function finishRefreshRun(
  id: number,
  input: {
    status: RefreshRunStatus;
    savedPresets?: string[];
    failedPresets?: string[];
    errorMessage?: string | null;
  }
) {
  const db = await getDb();

  if (!db) {
    finishRefreshRunInMemory(getMemoryStore(), id, input);
    return;
  }

  await db
    .update(refreshRuns)
    .set({
      status: input.status,
      finishedAt: new Date(),
      savedPresets: encodePresetList(input.savedPresets ?? []),
      failedPresets: encodePresetList(input.failedPresets ?? []),
      errorMessage: input.errorMessage ?? null,
    })
    .where(eq(refreshRuns.id, id));
}

export async function getLatestRefreshRun() {
  const db = await getDb();

  if (!db) {
    const latest = [...getMemoryStore().refreshRuns].sort((left, right) => {
      return right.startedAt.getTime() - left.startedAt.getTime() || right.id - left.id;
    })[0];

    return latest ? toRefreshRunRecord(latest) : null;
  }

  const result = await db
    .select()
    .from(refreshRuns)
    .orderBy(desc(refreshRuns.startedAt), desc(refreshRuns.id))
    .limit(1);

  return result[0] ? toRefreshRunRecord(result[0]) : null;
}

export async function getLatestSuccessfulRefreshRun() {
  const db = await getDb();

  if (!db) {
    const latest = [...getMemoryStore().refreshRuns]
      .filter(run => run.status === "success" && run.finishedAt != null)
      .sort((left, right) => {
        return (
          (right.finishedAt?.getTime() ?? 0) - (left.finishedAt?.getTime() ?? 0) ||
          right.id - left.id
        );
      })[0];

    return latest ? toRefreshRunRecord(latest) : null;
  }

  const result = await db
    .select()
    .from(refreshRuns)
    .where(eq(refreshRuns.status, "success"))
    .orderBy(desc(refreshRuns.finishedAt), desc(refreshRuns.id))
    .limit(1);

  return result[0] ? toRefreshRunRecord(result[0]) : null;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    const existingIndex = store.users.findIndex(
      current => current.openId === user.openId
    );
    const now = new Date();
    const nextUser: User = {
      id:
        existingIndex >= 0
          ? store.users[existingIndex].id
          : store.nextIds.user++,
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? "user",
      createdAt:
        existingIndex >= 0 ? store.users[existingIndex].createdAt : now,
      updatedAt: now,
      lastSignedIn: user.lastSignedIn ?? now,
    };

    if (existingIndex >= 0) {
      store.users[existingIndex] = nextUser;
    } else {
      store.users.push(nextUser);
    }
    return;
  }

  const values: InsertUser = {
    openId: user.openId,
  };
  const updateSet: Record<string, unknown> = {};

  if (user.name !== undefined) {
    values.name = user.name;
    updateSet.name = user.name;
  }
  if (user.email !== undefined) {
    values.email = user.email;
    updateSet.email = user.email;
  }
  if (user.loginMethod !== undefined) {
    values.loginMethod = user.loginMethod;
    updateSet.loginMethod = user.loginMethod;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  await db.insert(users).values(values).onDuplicateKeyUpdate({
    set: updateSet,
  });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();

  if (!db) {
    return getMemoryStore().users.find(user => user.openId === openId);
  }

  const result = await db
    .select()
    .from(users)
    .where(eq(users.openId, openId))
    .limit(1);

  return result[0];
}

export async function getLatestAccountMetrics() {
  const db = await getDb();

  if (!db) {
    return getMemoryStore().accountMetrics;
  }

  const result = await db
    .select()
    .from(accountMetrics)
    .orderBy(desc(accountMetrics.updatedAt))
    .limit(1);

  return result[0] ?? null;
}

export async function getAllCampaigns() {
  const db = await getDb();

  if (!db) {
    return [...getMemoryStore().campaigns].sort(
      (left, right) => Number(right.amountSpent) - Number(left.amountSpent)
    );
  }

  return db.select().from(campaigns).orderBy(desc(campaigns.amountSpent));
}

export async function getAllActionItems() {
  const db = await getDb();

  if (!db) {
    return [...getMemoryStore().actionItems].sort((left, right) => {
      return priorityRank(left.priority) - priorityRank(right.priority);
    });
  }

  return db.select().from(actionItems).orderBy(actionItems.priority, actionItems.id);
}

export async function getDailyPerformance() {
  const db = await getDb();

  if (!db) {
    return [...getMemoryStore().dailyPerformance].sort((left, right) =>
      left.date.localeCompare(right.date)
    );
  }

  return db.select().from(dailyPerformance).orderBy(dailyPerformance.date);
}

export async function toggleActionItem(id: number, completed: boolean) {
  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    store.actionItems = store.actionItems.map(item =>
      item.id === id ? { ...item, completed, updatedAt: new Date() } : item
    );
    return;
  }

  await db.update(actionItems).set({ completed }).where(eq(actionItems.id, id));
}

export async function getSetting(key: string, userId?: number | null) {
  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    const row = store.settings.find(setting => {
      if (setting.settingKey !== key) return false;
      if (userId != null) return setting.userId === userId;
      return setting.userId == null;
    });

    return row?.settingValue ?? null;
  }

  const condition =
    userId != null
      ? and(eq(userSettings.settingKey, key), eq(userSettings.userId, userId))
      : and(eq(userSettings.settingKey, key), isNull(userSettings.userId));
  const result = await db.select().from(userSettings).where(condition).limit(1);
  return result[0]?.settingValue ?? null;
}

export async function upsertSetting(
  key: string,
  value: string,
  userId?: number | null
) {
  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    const existingIndex = store.settings.findIndex(setting => {
      if (setting.settingKey !== key) return false;
      if (userId != null) return setting.userId === userId;
      return setting.userId == null;
    });
    const now = new Date();

    if (existingIndex >= 0) {
      store.settings[existingIndex] = {
        ...store.settings[existingIndex],
        settingValue: value,
        updatedAt: now,
      };
      return;
    }

    store.settings.push({
      id: store.nextIds.setting++,
      userId: userId ?? null,
      settingKey: key,
      settingValue: value,
      createdAt: now,
      updatedAt: now,
    });
    return;
  }

  const condition =
    userId != null
      ? and(eq(userSettings.settingKey, key), eq(userSettings.userId, userId))
      : and(eq(userSettings.settingKey, key), isNull(userSettings.userId));
  const existing = await db.select().from(userSettings).where(condition).limit(1);

  if (existing.length > 0) {
    await db
      .update(userSettings)
      .set({ settingValue: value })
      .where(condition);
  } else {
    await db.insert(userSettings).values({
      userId: userId ?? null,
      settingKey: key,
      settingValue: value,
    });
  }
}

export async function replaceCurrentDashboardData(
  account: MetaAccountProfile,
  snapshot: FetchedSnapshot,
  cplTarget: number
) {
  const db = await getDb();

  if (!db) {
    replaceCurrentDashboardDataInMemory(
      getMemoryStore(),
      account,
      snapshot,
      cplTarget
    );
    return;
  }

  const campaignRows = buildCurrentCampaignRows(snapshot, cplTarget);
  const currentActionItems = await db.select().from(actionItems);
  const nextActionItems = buildActionItems(
    campaignRows,
    cplTarget,
    getCompletedByTitle(currentActionItems)
  );

  await db.delete(actionItems);
  await db.delete(campaigns);
  await db.delete(accountMetrics);

  await db.insert(accountMetrics).values(buildCurrentAccountMetricsRow(account, snapshot));

  if (campaignRows.length > 0) {
    await db.insert(campaigns).values(campaignRows);
  }

  if (nextActionItems.length > 0) {
    await db.insert(actionItems).values(nextActionItems);
  }
}

export async function replaceDailyPerformance(days: DailyPerformancePoint[]) {
  const db = await getDb();

  if (!db) {
    replaceDailyPerformanceInMemory(getMemoryStore(), days);
    return;
  }

  await db.delete(dailyPerformance);

  const rows = toDailyPerformanceRows(days);
  if (rows.length > 0) {
    await db.insert(dailyPerformance).values(rows);
  }
}

export async function replaceActionItemsData(nextActionItems: ActionItemDraft[]) {
  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    store.actionItems = nextActionItems.map(item => ({
      id: store.nextIds.actionItem++,
      ...item,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    return;
  }

  await db.delete(actionItems);

  if (nextActionItems.length > 0) {
    await db.insert(actionItems).values(nextActionItems);
  }
}

export async function saveSnapshot(data: FetchedSnapshot): Promise<number> {
  const db = await getDb();

  if (!db) {
    return saveSnapshotInMemory(getMemoryStore(), data);
  }

  const existing = await db
    .select({ id: performanceSnapshots.id })
    .from(performanceSnapshots)
    .where(eq(performanceSnapshots.datePreset, data.datePreset))
    .limit(1);

  if (existing.length > 0) {
    const id = existing[0].id;
    await db
      .update(performanceSnapshots)
      .set({
        datePresetLabel: data.datePresetLabel,
        dateRangeSince: data.dateRangeSince,
        dateRangeUntil: data.dateRangeUntil,
        isPartial: data.isPartial,
        amountSpent: data.account.amountSpent.toFixed(2),
        impressions: data.account.impressions,
        reach: data.account.reach,
        frequency: data.account.frequency.toFixed(2),
        clicksAll: data.account.clicksAll,
        linkClicks: data.account.linkClicks,
        ctrAll: data.account.ctrAll.toFixed(4),
        ctrLink: data.account.ctrLink.toFixed(4),
        cpm: data.account.cpm.toFixed(2),
        cpcAll: data.account.cpcAll.toFixed(4),
        cpcLink: data.account.cpcLink.toFixed(4),
        leads: data.account.leads,
        costPerLead: data.account.costPerLead.toFixed(2),
        fetchedAt: new Date(),
      })
      .where(eq(performanceSnapshots.id, id));

    await db.delete(snapshotCampaigns).where(eq(snapshotCampaigns.snapshotId, id));

    if (data.campaigns.length > 0) {
      await db.insert(snapshotCampaigns).values(
        data.campaigns.map(campaign => ({
          snapshotId: id,
          campaignId: campaign.campaignId,
          campaignName: campaign.campaignName,
          shortName: campaign.shortName,
          objective: campaign.objective,
          status: campaign.status,
          amountSpent: campaign.amountSpent.toFixed(2),
          impressions: campaign.impressions,
          reach: campaign.reach,
          frequency: campaign.frequency.toFixed(2),
          clicksAll: campaign.clicksAll,
          linkClicks: campaign.linkClicks,
          ctrAll: campaign.ctrAll.toFixed(4),
          ctrLink: campaign.ctrLink.toFixed(4),
          cpm: campaign.cpm.toFixed(2),
          cpcAll: campaign.cpcAll.toFixed(4),
          cpcLink: campaign.cpcLink.toFixed(4),
          leads: campaign.leads,
          costPerLead:
            campaign.costPerLead != null
              ? campaign.costPerLead.toFixed(2)
              : null,
        }))
      );
    }

    return id;
  }

  const [result] = await db.insert(performanceSnapshots).values({
    datePreset: data.datePreset,
    datePresetLabel: data.datePresetLabel,
    dateRangeSince: data.dateRangeSince,
    dateRangeUntil: data.dateRangeUntil,
    isPartial: data.isPartial,
    amountSpent: data.account.amountSpent.toFixed(2),
    impressions: data.account.impressions,
    reach: data.account.reach,
    frequency: data.account.frequency.toFixed(2),
    clicksAll: data.account.clicksAll,
    linkClicks: data.account.linkClicks,
    ctrAll: data.account.ctrAll.toFixed(4),
    ctrLink: data.account.ctrLink.toFixed(4),
    cpm: data.account.cpm.toFixed(2),
    cpcAll: data.account.cpcAll.toFixed(4),
    cpcLink: data.account.cpcLink.toFixed(4),
    leads: data.account.leads,
    costPerLead: data.account.costPerLead.toFixed(2),
  });
  const newId = (result as { insertId: number }).insertId;

  if (data.campaigns.length > 0) {
    await db.insert(snapshotCampaigns).values(
      data.campaigns.map(campaign => ({
        snapshotId: newId,
        campaignId: campaign.campaignId,
        campaignName: campaign.campaignName,
        shortName: campaign.shortName,
        objective: campaign.objective,
        status: campaign.status,
        amountSpent: campaign.amountSpent.toFixed(2),
        impressions: campaign.impressions,
        reach: campaign.reach,
        frequency: campaign.frequency.toFixed(2),
        clicksAll: campaign.clicksAll,
        linkClicks: campaign.linkClicks,
        ctrAll: campaign.ctrAll.toFixed(4),
        ctrLink: campaign.ctrLink.toFixed(4),
        cpm: campaign.cpm.toFixed(2),
        cpcAll: campaign.cpcAll.toFixed(4),
        cpcLink: campaign.cpcLink.toFixed(4),
        leads: campaign.leads,
        costPerLead:
          campaign.costPerLead != null ? campaign.costPerLead.toFixed(2) : null,
      }))
    );
  }

  return newId;
}

export async function getAllSnapshots() {
  const db = await getDb();

  if (!db) {
    return [...getMemoryStore().snapshots].sort(
      (left, right) => right.fetchedAt.getTime() - left.fetchedAt.getTime()
    );
  }

  return db
    .select()
    .from(performanceSnapshots)
    .orderBy(desc(performanceSnapshots.fetchedAt));
}

export async function getSnapshotWithCampaigns(snapshotId: number) {
  const db = await getDb();

  if (!db) {
    const store = getMemoryStore();
    const snapshot = store.snapshots.find(current => current.id === snapshotId);

    if (!snapshot) {
      return null;
    }

    return {
      snapshot,
      campaigns: store.snapshotCampaigns.filter(
        campaign => campaign.snapshotId === snapshotId
      ),
    };
  }

  const [snapshot] = await db
    .select()
    .from(performanceSnapshots)
    .where(eq(performanceSnapshots.id, snapshotId))
    .limit(1);

  if (!snapshot) {
    return null;
  }

  const rows = await db
    .select()
    .from(snapshotCampaigns)
    .where(eq(snapshotCampaigns.snapshotId, snapshotId));

  return {
    snapshot,
    campaigns: rows,
  };
}
