# Meta Ads Dashboard

Standalone Meta Ads reporting app built with React, Vite, Express, tRPC, and Drizzle.

This baseline no longer depends on Manus. It supports:

- Demo mode with in-memory data
- Live Meta Graph API refreshes
- Snapshot history for common reporting windows
- Current dashboard tables derived from the latest refresh
- Stored 30-day daily pacing series for trend analysis
- Refresh-run audit logging for manual and scheduled syncs
- Railway-ready production boot with Cloudflare in front

## Product scope

Current Production V1 capabilities:

- Account KPI view for the active reporting window
- Campaign breakdown with CPL-aware recommendations
- Objective-level budget mix and efficiency rollups
- Action queue for scale, pause, and optimization decisions
- Snapshot history for `last_30d`, `last_7d`, `this_week_mon_today`, `today`, and `yesterday`
- 30-day daily spend and lead series persisted on refresh
- Protected internal refresh endpoint for automation
- Refresh health/status surface in the UI and `/api/health`

Still not in scope yet:

- Ad set, ad, and creative drilldowns
- CRM revenue attribution / ROAS / CAC / LTV stitching
- Multi-account switching
- User auth / roles

## Quick start

1. Copy [.env.example](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/.env.example) to `.env`.
2. Install dependencies with `npm install`.
3. If you want persistence locally, point `DATABASE_URL` at MySQL and run `npm run db:push`.
4. Start the app with `npm run dev`.
5. Open `http://localhost:3000`.

## Environment

- `DATABASE_URL`
  MySQL connection string. Optional in development, required in production.
- `APP_BASE_URL`
  Public app URL used by the scheduled refresh job, for example `https://ads.example.com`. On Railway, this can fall back to `RAILWAY_PUBLIC_DOMAIN` for smoke testing.
- `REFRESH_API_KEY`
  Shared secret for `POST /api/internal/refresh`. If omitted, the app can still boot for testing, but the internal refresh endpoint stays disabled until you set it.
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

If you start the app in development without Meta credentials, it boots with demo data. This is useful for UI review and layout work.

### Live mode

To switch to live Meta reporting:

1. Set `META_ACCESS_TOKEN`.
2. Set `META_AD_ACCOUNT_ID`.
3. Restart the app if it is already running.
4. Click `Refresh from Meta Ads`.

Any successful refresh will:

- Pull the configured reporting windows from the Meta Graph API
- Save/update the snapshot history
- Replace the current account metrics, campaign table, and action items
- Save the 30-day daily spend/lead series used by the home-page trend chart
- Write a `refresh_runs` audit record for health checks and ops visibility

If a refresh partially saves data but any preset fails, the run is marked as failed and the UI surfaces the error state.

### Testing stage

Before treating the environment as production-ready, use this as a testing checklist:

1. Set `META_ACCESS_TOKEN` and `META_AD_ACCOUNT_ID`.
2. Load the dashboard and confirm the header shows `Connection verified`.
3. If the header shows `Connection failed`, use the surfaced Meta error message and `fbtrace_id` to debug the token or account access.
4. Trigger `Refresh from Meta Ads`.
5. Confirm the dashboard exits demo mode, shows a successful refresh timestamp, and loads account metrics plus campaign rows.

For the token, ensure the connected Meta user or system user has access to the ad account and the token includes at least `ads_read`.

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

For production startup and deploy-time migration runs, use:

```bash
npm run db:migrate:deploy
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
- `metaConfigured`
- `databaseConfigured`
- `lastRefreshAt`
- `lastRefreshStatus`

The endpoint returns `503` if:

- the configured database is unavailable, or
- there has not been a successful refresh in the last 8 hours

Use that for Railway health checks.

## Build and run

```bash
npm run build
npm run start
```

Production serves the built client from `dist/public` and the Node server from `dist/index.js`.

## Production deployment

This V1 is designed to run as:

- Railway for the app container
- Railway MySQL for persistence
- Cloudflare for DNS, SSL, and Zero Trust Access
- GitHub Actions for the scheduled refresh job

### Required production env vars

When `NODE_ENV=production`, the app refuses to boot unless all of these are set:

- `DATABASE_URL`
- `META_ACCESS_TOKEN`
- `META_AD_ACCOUNT_ID`
- `APP_BASE_URL` or Railway-provided `RAILWAY_PUBLIC_DOMAIN`

`REFRESH_API_KEY` is still required for scheduled refresh automation, but it no longer blocks the app from booting for smoke tests.

Demo mode is development-only.

### Railway

1. Provision a Railway MySQL database.
2. Connect Railway to this GitHub repo and deploy from `main`.
3. Set:
   - `NODE_ENV=production`
   - `DATABASE_URL`
   - `META_ACCESS_TOKEN`
   - `META_AD_ACCOUNT_ID`
   - `REFRESH_API_KEY`
   - `APP_BASE_URL` (optional if you are temporarily using the Railway public domain)
4. Use `/api/health` for the service health check.

The included [Dockerfile](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/Dockerfile) runs database migrations before starting the app:

```text
npm run db:migrate:deploy && npm run start
```

### Cloudflare

No custom Cloudflare HTML is needed.

Recommended setup:

1. Create a proxied DNS record such as `ads.<your-domain>` pointing at the Railway hostname.
2. Set SSL/TLS mode to `Full (strict)`.
3. Protect the site with Cloudflare Zero Trust Access and restrict it to internal admin emails.
4. Exclude `/api/internal/refresh` from Cloudflare Access, because that route is protected by `REFRESH_API_KEY`.

### Scheduled refresh job

The repo includes [.github/workflows/scheduled-refresh.yml](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/.github/workflows/scheduled-refresh.yml), which runs every 6 hours and on manual dispatch.

Set these GitHub Actions secrets:

- `APP_BASE_URL`
- `REFRESH_API_KEY`

The workflow calls:

```text
POST $APP_BASE_URL/api/internal/refresh
Authorization: Bearer $REFRESH_API_KEY
```

## Docker

This repo includes a [Dockerfile](/Users/jclopez/Library/Mobile%20Documents/com~apple~CloudDocs/Work/FedLegacy/meta-ads-dashboard/Dockerfile).

Build locally:

```bash
docker build -t meta-ads-dashboard .
```

Run locally:

```bash
docker run --rm -p 3000:3000 --env-file .env meta-ads-dashboard
```

For a production-like container boot, `.env` must include the required production variables.

## Scripts

- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run check`
- `npm test`
- `npm run format`
- `npm run db:push`
- `npm run db:migrate:deploy`
- `npm run db:seed`

## Recommended next product steps

- Persist ad set, ad, and creative breakdowns on refresh
- Add change reporting between the latest refresh and prior snapshot
- Layer in first-party outcomes from CRM / call / sales data
- Add executive summary exports for weekly reporting
