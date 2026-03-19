# Meta Ads Dashboard

Standalone Meta Ads reporting app built with React, Vite, Express, tRPC, and Drizzle.

This baseline no longer depends on Manus. It supports:

- Demo mode with in-memory data
- Live Meta Graph API refreshes
- Snapshot history for common reporting windows
- Current dashboard tables derived from the latest refresh
- Stored 30-day daily pacing series for trend analysis

## Product scope

Current Phase 1.5 capabilities:

- Account KPI view for the active reporting window
- Campaign breakdown with CPL-aware recommendations
- Objective-level budget mix and efficiency rollups
- Action queue for scale, pause, and optimization decisions
- Snapshot history for `last_30d`, `last_7d`, `this_week_mon_today`, `today`, and `yesterday`
- 30-day daily spend and lead series persisted on refresh

Still not in scope yet:

- Ad set, ad, and creative drilldowns
- CRM revenue attribution / ROAS / CAC / LTV stitching
- Multi-account switching
- User auth / roles

## Quick start

1. Copy [.env.example](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/.env.example) to `.env`.
2. Install dependencies with `npm install`.
3. Start the app with `npm run dev`.
4. Open `http://localhost:3000`.

If port `3000` is busy, the server will pick the next available port and print it in the terminal.

## Environment

- `DATABASE_URL`
  Optional MySQL connection string. If omitted, the app runs in memory.
- `META_ACCESS_TOKEN`
  Meta Marketing API token with access to the target ad account.
- `META_AD_ACCOUNT_ID`
  Ad account ID. Either `act_123...` or the raw numeric ID works.
- `META_API_VERSION`
  Optional Graph API version override. Default is `v22.0`.
- `META_ACCOUNT_NAME`
  Optional fallback name if the Meta profile endpoint does not return one.

## How to use the dashboard

### Demo mode

If you start the app without Meta credentials, it boots with demo data. This is useful for UI review, layout work, and deployment smoke tests.

### Live mode

To switch to live Meta reporting:

1. Set `META_ACCESS_TOKEN`.
2. Set `META_AD_ACCOUNT_ID`.
3. Restart the app if it is already running.
4. Click `Refresh from Meta Ads`.

That refresh will:

- Pull the configured reporting windows from the Meta Graph API
- Save/update the snapshot history
- Replace the current account metrics, campaign table, and action items
- Save the 30-day daily spend/lead series used by the home-page trend chart

### CPL target

The CPL target control in the header updates how campaigns are graded:

- `excellent`: CPL is at or below target
- `moderate`: CPL is above target but not severely inefficient
- `poor`: CPL is materially above target

That target affects campaign status, recommendations, and the action queue.

### Snapshot history

Use the `History` view to inspect saved snapshots across the supported reporting windows. Refreshing the dashboard updates those snapshots in place.

## Persistence behavior

- No `DATABASE_URL`: state is in memory only. Restarting the app resets it.
- With `DATABASE_URL`: snapshots, dashboard state, settings, and daily performance rows persist.

After schema changes, run:

```bash
npm run db:push
```

## Health check

The app exposes:

```text
/api/health
```

This returns JSON with:

- `ok`
- `timestamp`
- `uptimeSeconds`
- `sourceMode`
- `metaConfigured`
- `databaseConfigured`

Use that for deploy health checks.

## Build and run

```bash
npm run build
npm run start
```

Production serves the built client from `dist/public` and the Node server from `dist/index.js`.

## Live launch options

### Option 1: Node service on Railway / Render / Fly.io

Use:

- Build command: `npm install && npm run build`
- Start command: `npm run start`

Set these environment variables in the platform:

- `NODE_ENV=production`
- `PORT` (usually injected by the platform)
- `DATABASE_URL` if you want persistence
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `META_API_VERSION` optional
- `META_ACCOUNT_NAME` optional

Recommended health check path:

- `/api/health`

### Option 2: Docker

This repo includes a [Dockerfile](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/Dockerfile).

Build locally:

```bash
docker build -t meta-ads-dashboard .
```

Run locally:

```bash
docker run --rm -p 3000:3000 --env-file .env meta-ads-dashboard
```

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run check`
- `npm test`
- `npm run format`
- `npm run db:push`
- `npm run db:seed`

## Recommended next product steps

- Persist ad set, ad, and creative breakdowns on refresh
- Add change reporting between the latest refresh and prior snapshot
- Layer in first-party outcomes from CRM / call / sales data
- Add executive summary exports for weekly reporting
