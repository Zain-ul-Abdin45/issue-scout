import { sql, type TrackedIssueRow, type WatchedRepoRow } from "./db";
import { github, fetchLabeledIssues, fetchIssue, countCompetingPRs, fetchLatestComments, type GhIssue } from "./github";
import { WATCHLIST, MY_ISSUES } from "./watchlist";

// Comments from this account don't count as "new activity" on a personal issue.
const SELF_LOGIN = process.env.GITHUB_USERNAME ?? "Zain-ul-Abdin45";

export async function ensureSchema() {
  const db = sql();
  await db`
    create table if not exists watched_repos (
      id serial primary key,
      owner text not null,
      repo text not null,
      labels text[] not null default '{}',
      priority smallint not null default 2,
      notes text,
      active boolean not null default true,
      unique (owner, repo)
    )
  `;
  await db`
    create table if not exists tracked_issues (
      id serial primary key,
      repo_id integer not null references watched_repos(id) on delete cascade,
      issue_number integer not null,
      title text not null,
      url text not null,
      state text not null default 'open',
      labels text[] not null default '{}',
      author text,
      is_personal boolean not null default false,
      status text not null default 'new',
      comments_count integer not null default 0,
      competing_prs_count integer not null default 0,
      github_created_at timestamptz,
      first_seen_at timestamptz not null default now(),
      last_checked_at timestamptz not null default now(),
      last_changed_at timestamptz not null default now(),
      unique (repo_id, issue_number)
    )
  `;
  await db`
    create table if not exists issue_events (
      id serial primary key,
      tracked_issue_id integer not null references tracked_issues(id) on delete cascade,
      event_type text not null,
      detail text,
      occurred_at timestamptz not null default now()
    )
  `;
  await db`create index if not exists idx_tracked_issues_repo on tracked_issues(repo_id)`;
  await db`create index if not exists idx_issue_events_issue on issue_events(tracked_issue_id)`;
  await db`create index if not exists idx_issue_events_occurred on issue_events(occurred_at desc)`;
}

async function upsertWatchlist(): Promise<Map<string, WatchedRepoRow>> {
  const db = sql();
  const byKey = new Map<string, WatchedRepoRow>();

  for (const w of WATCHLIST) {
    const rows = (await db`
      insert into watched_repos (owner, repo, labels, priority, notes, active)
      values (${w.owner}, ${w.repo}, ${w.labels}, ${w.priority}, ${w.notes ?? null}, true)
      on conflict (owner, repo)
      do update set labels = excluded.labels, priority = excluded.priority, notes = excluded.notes, active = true
      returning *
    `) as unknown as WatchedRepoRow[];
    byKey.set(`${w.owner}/${w.repo}`, rows[0]);
  }

  return byKey;
}

async function upsertTrackedIssue(
  repoId: number,
  issue: GhIssue,
  isPersonal: boolean,
  competingPrs: number | null,
): Promise<{
  row: TrackedIssueRow;
  isNew: boolean;
  labelsChanged: boolean;
  commentsChanged: boolean;
  previousCheckedAt: string | null;
}> {
  const db = sql();
  const existingRows = (await db`
    select * from tracked_issues where repo_id = ${repoId} and issue_number = ${issue.number}
  `) as unknown as TrackedIssueRow[];
  const existing = existingRows[0];

  const isNew = !existing;
  const previousCheckedAt = existing?.last_checked_at ?? null;
  const labelsChanged = !!existing && JSON.stringify([...existing.labels].sort()) !== JSON.stringify([...issue.labels].sort());
  const commentsChanged = !!existing && existing.comments_count !== issue.comments;

  const rows = (await db`
    insert into tracked_issues (
      repo_id, issue_number, title, url, state, labels, author, is_personal,
      status, comments_count, competing_prs_count, github_created_at,
      first_seen_at, last_checked_at, last_changed_at
    )
    values (
      ${repoId}, ${issue.number}, ${issue.title}, ${issue.html_url}, ${issue.state}, ${issue.labels},
      ${issue.author}, ${isPersonal}, 'new', ${issue.comments}, ${competingPrs ?? 0}, ${issue.created_at},
      now(), now(), now()
    )
    on conflict (repo_id, issue_number) do update set
      title = excluded.title,
      state = excluded.state,
      labels = excluded.labels,
      is_personal = excluded.is_personal or tracked_issues.is_personal,
      comments_count = excluded.comments_count,
      competing_prs_count = coalesce(excluded.competing_prs_count, tracked_issues.competing_prs_count),
      last_checked_at = now(),
      last_changed_at = case
        when tracked_issues.labels <> excluded.labels or tracked_issues.comments_count <> excluded.comments_count
        then now() else tracked_issues.last_changed_at
      end
    returning *
  `) as unknown as TrackedIssueRow[];

  return { row: rows[0], isNew, labelsChanged, commentsChanged, previousCheckedAt };
}

async function logEvent(trackedIssueId: number, eventType: string, detail: string) {
  const db = sql();
  await db`
    insert into issue_events (tracked_issue_id, event_type, detail)
    values (${trackedIssueId}, ${eventType}, ${detail})
  `;
}

export type SyncSummary = {
  reposChecked: number;
  issuesSeen: number;
  newIssues: number;
  labelChanges: number;
  newComments: number;
  errors: string[];
};

export async function runSync(): Promise<SyncSummary> {
  await ensureSchema();
  const octokit = github();
  const watchedByKey = await upsertWatchlist();

  const summary: SyncSummary = {
    reposChecked: 0,
    issuesSeen: 0,
    newIssues: 0,
    labelChanges: 0,
    newComments: 0,
    errors: [],
  };

  // 1. Watchlist repos -- discover new/changed beginner-friendly issues.
  for (const w of WATCHLIST) {
    const repoRow = watchedByKey.get(`${w.owner}/${w.repo}`);
    if (!repoRow) continue;
    summary.reposChecked++;

    try {
      const issues = await fetchLabeledIssues(octokit, w.owner, w.repo, w.labels);
      for (const issue of issues) {
        summary.issuesSeen++;
        let competing: number | null = null;
        try {
          competing = await countCompetingPRs(octokit, w.owner, w.repo, issue.number);
        } catch {
          // search API is rate-limited more aggressively; a miss here just skips this signal for the run
        }

        const { row, isNew, labelsChanged } = await upsertTrackedIssue(repoRow.id, issue, false, competing);

        if (isNew) {
          summary.newIssues++;
          await logEvent(row.id, "new_issue", `${w.owner}/${w.repo}#${issue.number}: ${issue.title}`);
        } else if (labelsChanged) {
          summary.labelChanges++;
          await logEvent(row.id, "label_change", `Labels now: ${issue.labels.join(", ")}`);
        }
      }
    } catch (err) {
      summary.errors.push(`${w.owner}/${w.repo}: ${(err as Error).message}`);
    }
  }

  // 2. Personal issues -- watch for new replies regardless of label/priority.
  for (const p of MY_ISSUES) {
    let repoRow = watchedByKey.get(`${p.owner}/${p.repo}`);
    if (!repoRow) {
      // Personal issue on a repo that isn't in the general watchlist -- register it too.
      const db = sql();
      const rows = (await db`
        insert into watched_repos (owner, repo, labels, priority, active)
        values (${p.owner}, ${p.repo}, ${[]}, 2, true)
        on conflict (owner, repo) do update set active = true
        returning *
      `) as unknown as WatchedRepoRow[];
      repoRow = rows[0];
      watchedByKey.set(`${p.owner}/${p.repo}`, repoRow);
    }

    try {
      const issue = await fetchIssue(octokit, p.owner, p.repo, p.issueNumber);
      const { row, isNew, labelsChanged, previousCheckedAt } = await upsertTrackedIssue(repoRow.id, issue, true, null);
      summary.issuesSeen++;

      if (isNew) {
        summary.newIssues++;
        await logEvent(row.id, "new_issue", `${p.owner}/${p.repo}#${issue.number}: ${issue.title}`);
      }
      if (labelsChanged) {
        summary.labelChanges++;
        await logEvent(row.id, "label_change", `Labels now: ${issue.labels.join(", ")}`);
      }

      // First time we see this issue, there's no meaningful "since" -- skip comment
      // diffing so the whole existing thread doesn't get logged as new activity.
      if (!isNew) {
        const comments = await fetchLatestComments(
          octokit,
          p.owner,
          p.repo,
          p.issueNumber,
          previousCheckedAt ?? undefined,
        );
        const fromOthers = comments.filter((c) => c.author.toLowerCase() !== SELF_LOGIN.toLowerCase());
        for (const c of fromOthers) {
          summary.newComments++;
          await logEvent(
            row.id,
            "new_comment",
            `${c.author} (${c.association}): ${c.body.slice(0, 240)}${c.body.length > 240 ? "..." : ""}`,
          );
        }
      }
    } catch (err) {
      summary.errors.push(`${p.owner}/${p.repo}#${p.issueNumber}: ${(err as Error).message}`);
    }
  }

  return summary;
}
