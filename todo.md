# Meta Ads Dashboard TODO

- [x] Basic dashboard layout with dark terminal theme
- [x] KPI metric cards (spend, leads, CPL, CTR, CPM, frequency, etc.)
- [x] CPL by Campaign horizontal bar chart
- [x] Spend by Objective donut chart
- [x] Lead Volume bar chart and Daily Spend & Lead Trend area chart
- [x] Full campaign table with expandable rows
- [x] Winners & Wasters side-by-side panels
- [x] Action items panel with priority color coding
- [x] CPL target input with dynamic re-coloring
- [x] Fix React key prop warning in CampaignTable
- [x] Fix CplTargetProvider context scope error
- [x] Database integration (5 tables: users, account_metrics, campaigns, action_items, user_settings)
- [x] tRPC API routes for dashboard data
- [x] CPL target persisted to database
- [x] Action items "Mark done / Undo" toggle persisted to database

## Refresh + History Feature
- [x] Add `performance_snapshots` table to schema (stores per-date-range snapshots)
- [x] Add `snapshot_campaigns` table (per-campaign data linked to a snapshot)
- [x] Run db:push to migrate new tables
- [x] Build server-side Meta Ads MCP fetch function (calls MCP via child_process)
- [x] Build tRPC `dashboard.refresh` mutation (fetches all 6 date ranges from Meta Ads, saves snapshots)
- [x] Build tRPC `dashboard.snapshots` query (list all saved snapshots)
- [x] Build tRPC `dashboard.snapshotDetail` query (get full campaign data for a snapshot)
- [x] Build Refresh button UI component with loading state
- [x] Build Snapshot History page/tab with comparison table
- [x] Show date range selector on dashboard to switch between snapshots
- [x] Write vitest tests for snapshot routes
