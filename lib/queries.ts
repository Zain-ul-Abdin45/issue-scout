import { sql } from "./db";

export type DashboardIssue = {
  id: number;
  issue_number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  is_personal: boolean;
  comments_count: number;
  competing_prs_count: number;
  first_seen_at: string;
  last_changed_at: string;
  owner: string;
  repo: string;
  priority: number;
};

export type DashboardEvent = {
  id: number;
  event_type: string;
  detail: string | null;
  occurred_at: string;
  issue_number: number;
  title: string;
  url: string;
  owner: string;
  repo: string;
};

export type RepoSummary = {
  id: number;
  owner: string;
  repo: string;
  priority: number;
  notes: string | null;
  open_issue_count: number;
};

export async function getPersonalIssues(): Promise<DashboardIssue[]> {
  const db = sql();
  const rows = await db`
    select ti.*, wr.owner, wr.repo, wr.priority
    from tracked_issues ti
    join watched_repos wr on wr.id = ti.repo_id
    where ti.is_personal = true
    order by ti.last_changed_at desc
  `;
  return rows as unknown as DashboardIssue[];
}

export async function getRecentEvents(limit = 30): Promise<DashboardEvent[]> {
  const db = sql();
  const rows = await db`
    select ev.id, ev.event_type, ev.detail, ev.occurred_at,
           ti.issue_number, ti.title, ti.url, wr.owner, wr.repo
    from issue_events ev
    join tracked_issues ti on ti.id = ev.tracked_issue_id
    join watched_repos wr on wr.id = ti.repo_id
    order by ev.occurred_at desc
    limit ${limit}
  `;
  return rows as unknown as DashboardEvent[];
}

export async function getWatchlistSummary(): Promise<RepoSummary[]> {
  const db = sql();
  const rows = await db`
    select wr.id, wr.owner, wr.repo, wr.priority, wr.notes,
           count(ti.id) filter (where ti.state = 'open' and ti.is_personal = false) as open_issue_count
    from watched_repos wr
    left join tracked_issues ti on ti.repo_id = wr.id
    where wr.active = true
    group by wr.id
    order by wr.priority asc, open_issue_count desc
  `;
  return rows as unknown as RepoSummary[];
}

export async function getOpenIssuesByRepo(repoId: number, limit = 8): Promise<DashboardIssue[]> {
  const db = sql();
  const rows = await db`
    select ti.*, wr.owner, wr.repo, wr.priority
    from tracked_issues ti
    join watched_repos wr on wr.id = ti.repo_id
    where ti.repo_id = ${repoId} and ti.state = 'open' and ti.is_personal = false
    order by ti.competing_prs_count asc, ti.github_created_at desc
    limit ${limit}
  `;
  return rows as unknown as DashboardIssue[];
}

export async function getLastSyncTime(): Promise<string | null> {
  const db = sql();
  const rows = (await db`
    select max(last_checked_at) as last from tracked_issues
  `) as unknown as { last: string | null }[];
  return rows[0]?.last ?? null;
}
