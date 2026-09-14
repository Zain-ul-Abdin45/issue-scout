# issue-scout

A small dashboard that watches a fixed list of RAG/agentic/LLM open-source
repos for freshly-filed, unclaimed "good first issue"-style issues, and
separately tracks issues you're personally engaged on (new replies, label
changes) so you don't have to manually re-check GitHub.

A Vercel Cron job hits `/api/cron/sync` on a schedule, which pulls from the
GitHub API and upserts into Postgres. The dashboard reads from that database.

## What it watches

Edit [`lib/watchlist.ts`](lib/watchlist.ts) to change the repo list, their
labels, or your personally-tracked issues (`MY_ISSUES`). The sync job upserts
this config into the `watched_repos` table on every run, so editing the file
and redeploying is enough -- no manual DB changes needed.

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the values below
npm run dev
```

## Environment variables

| Variable | Where to get it |
|---|---|
| `POSTGRES_URL` | Vercel dashboard -> Storage -> create a Postgres (Neon) database -> copy the connection string |
| `GITHUB_TOKEN` | github.com -> Settings -> Developer settings -> Personal access tokens. No special scopes needed for public repos. |
| `GITHUB_USERNAME` | Your GitHub login, used to filter your own comments out of "new reply" detection |
| `CRON_SECRET` | Any random string you generate (e.g. `openssl rand -hex 32`) |
| `DASHBOARD_PASSWORD` | Any password you choose for the login gate |

## Deploying

1. Push this repo to GitHub, then import it in Vercel (or `vercel --prod` from the CLI).
2. Add a Postgres database from the Vercel Storage tab and connect it to the
   project -- this sets `POSTGRES_URL` automatically.
3. Add the other four env vars above in Project Settings -> Environment Variables.
4. Redeploy so the env vars take effect.
5. Hit `/api/setup` once (with `Authorization: Bearer <CRON_SECRET>`) to create the tables:
   ```bash
   curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-app>.vercel.app/api/setup
   ```
6. Vercel Cron will start calling `/api/cron/sync` on the schedule in
   [`vercel.json`](vercel.json) (every 30 minutes). You can also trigger a
   sync manually from the dashboard's "Sync now" button once logged in.

**Note on Vercel plan tiers**: cron frequency limits have varied by plan in
the past (Hobby plans have at times been capped to one run per day). If the
30-minute schedule doesn't take effect after deploying, check your plan's
current cron limits in the Vercel dashboard -- you may need to either upgrade
or accept a lower frequency by editing the `schedule` in `vercel.json`.

## How "new reply" detection works

For issues in `MY_ISSUES`, each sync fetches comments added since the
*previous* sync (not the one that just ran) and logs any from someone other
than `GITHUB_USERNAME` as a `new_comment` event. The first time an issue is
seen, this is skipped so the entire existing comment thread doesn't get
logged as "new" on day one.

## Project structure

- `lib/watchlist.ts` -- config: repos to watch, labels, your personal issues
- `lib/github.ts` -- GitHub API calls (issues by label, competing-PR counts, comments)
- `lib/sync.ts` -- the actual sync logic: upsert repos/issues, detect changes, log events
- `lib/queries.ts` -- read-side queries the dashboard page uses
- `app/api/cron/sync` -- cron-triggered sync endpoint
- `app/api/sync-now` -- manual sync trigger for the dashboard button
- `app/api/setup` -- one-time schema init
- `proxy.ts` -- password gate (Next.js 16's replacement for middleware.ts)
