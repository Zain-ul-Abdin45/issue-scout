import { SyncButton } from "@/components/SyncButton";
import { getPersonalIssues, getRecentEvents, getWatchlistSummary, getOpenIssuesByRepo, getLastSyncTime } from "@/lib/queries";

function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function priorityLabel(p: number) {
  if (p === 1) return { text: "clean queue", className: "bg-emerald-950 text-emerald-400 border-emerald-800" };
  if (p === 2) return { text: "normal", className: "bg-neutral-800 text-neutral-300 border-neutral-700" };
  return { text: "usually sniped", className: "bg-amber-950 text-amber-400 border-amber-800" };
}

function eventLabel(type: string) {
  switch (type) {
    case "new_issue":
      return { text: "new issue", className: "text-sky-400" };
    case "new_comment":
      return { text: "new reply", className: "text-emerald-400" };
    case "label_change":
      return { text: "label change", className: "text-amber-400" };
    default:
      return { text: type, className: "text-neutral-400" };
  }
}

export default async function DashboardPage() {
  const [personalIssues, events, repos, lastSync] = await Promise.all([
    getPersonalIssues(),
    getRecentEvents(30),
    getWatchlistSummary(),
    getLastSyncTime(),
  ]);

  const repoIssues = await Promise.all(
    repos.map(async (r) => ({ repo: r, issues: await getOpenIssuesByRepo(r.id, 5) })),
  );

  return (
    <div className="min-h-screen bg-neutral-950 px-4 py-8 text-neutral-100 sm:px-8">
      <div className="mx-auto max-w-5xl space-y-10">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">issue-scout</h1>
            <p className="text-sm text-neutral-400">Last synced {timeAgo(lastSync)}</p>
          </div>
          <SyncButton />
        </header>

        {/* My Issues */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">My Issues</h2>
          {personalIssues.length === 0 && (
            <p className="text-sm text-neutral-500">
              None yet -- add entries to MY_ISSUES in lib/watchlist.ts, then sync.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {personalIssues.map((issue) => (
              <a
                key={issue.id}
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 hover:border-neutral-600"
              >
                <div className="flex items-center justify-between text-xs text-neutral-500">
                  <span>
                    {issue.owner}/{issue.repo}#{issue.issue_number}
                  </span>
                  <span className={issue.state === "open" ? "text-emerald-400" : "text-neutral-500"}>{issue.state}</span>
                </div>
                <p className="mt-1 font-medium">{issue.title}</p>
                <p className="mt-1 text-xs text-neutral-500">
                  {issue.comments_count} comments · updated {timeAgo(issue.last_changed_at)}
                </p>
              </a>
            ))}
          </div>
        </section>

        {/* Recent Activity */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Recent Activity</h2>
          {events.length === 0 && <p className="text-sm text-neutral-500">Nothing yet -- run a sync to populate this.</p>}
          <ul className="divide-y divide-neutral-800 rounded-xl border border-neutral-800 bg-neutral-900">
            {events.map((ev) => {
              const label = eventLabel(ev.event_type);
              return (
                <li key={ev.id} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <span className={`mr-2 text-xs font-medium uppercase ${label.className}`}>{label.text}</span>
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-neutral-200 hover:underline"
                    >
                      {ev.owner}/{ev.repo}#{ev.issue_number} · {ev.title}
                    </a>
                    {ev.detail && <p className="mt-0.5 truncate text-xs text-neutral-500">{ev.detail}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-neutral-500">{timeAgo(ev.occurred_at)}</span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* Watchlist */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Watchlist</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {repoIssues.map(({ repo, issues }) => {
              const pr = priorityLabel(repo.priority);
              return (
                <div key={repo.id} className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
                  <div className="flex items-center justify-between">
                    <a
                      href={`https://github.com/${repo.owner}/${repo.repo}`}
                      target="_blank"
                      rel="noreferrer"
                      className="font-medium hover:underline"
                    >
                      {repo.owner}/{repo.repo}
                    </a>
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] ${pr.className}`}>{pr.text}</span>
                  </div>
                  {repo.notes && <p className="mt-1 text-xs text-neutral-500">{repo.notes}</p>}
                  <ul className="mt-3 space-y-1.5">
                    {issues.length === 0 && <li className="text-xs text-neutral-600">No open tracked issues right now.</li>}
                    {issues.map((issue) => (
                      <li key={issue.id}>
                        <a
                          href={issue.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-neutral-200 hover:underline"
                        >
                          #{issue.issue_number} {issue.title}
                        </a>
                        <span className="ml-2 text-xs text-neutral-500">
                          {issue.competing_prs_count > 0 ? `${issue.competing_prs_count} competing PRs` : "no competing PRs"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export const dynamic = "force-dynamic";
