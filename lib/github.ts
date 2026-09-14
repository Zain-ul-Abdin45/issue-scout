import { Octokit } from "octokit";

export function github() {
  const auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error("GITHUB_TOKEN is not set");
  }
  return new Octokit({ auth });
}

export type GhIssue = {
  number: number;
  title: string;
  html_url: string;
  state: string;
  labels: string[];
  author: string | null;
  comments: number;
  created_at: string;
  assignee: string | null;
};

const MAX_ISSUES_PER_REPO = 20;

/** Open issues on a repo carrying any of the given labels, newest first. */
export async function fetchLabeledIssues(
  octokit: Octokit,
  owner: string,
  repo: string,
  labels: string[],
): Promise<GhIssue[]> {
  const seen = new Map<number, GhIssue>();

  for (const label of labels) {
    const { data } = await octokit.rest.issues.listForRepo({
      owner,
      repo,
      labels: label,
      state: "open",
      per_page: MAX_ISSUES_PER_REPO,
      sort: "created",
      direction: "desc",
    });

    for (const issue of data) {
      // listForRepo also returns PRs -- skip those
      if ("pull_request" in issue) continue;
      if (seen.has(issue.number)) continue;

      seen.set(issue.number, {
        number: issue.number,
        title: issue.title,
        html_url: issue.html_url,
        state: issue.state,
        labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
        author: issue.user?.login ?? null,
        comments: issue.comments,
        created_at: issue.created_at,
        assignee: issue.assignee?.login ?? null,
      });
    }
  }

  return Array.from(seen.values());
}

/** Single issue by number, used for the personally-tracked issues. */
export async function fetchIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<GhIssue> {
  const { data: issue } = await octokit.rest.issues.get({ owner, repo, issue_number: issueNumber });
  return {
    number: issue.number,
    title: issue.title,
    html_url: issue.html_url,
    state: issue.state,
    labels: issue.labels.map((l) => (typeof l === "string" ? l : l.name ?? "")),
    author: issue.user?.login ?? null,
    comments: issue.comments,
    created_at: issue.created_at,
    assignee: issue.assignee?.login ?? null,
  };
}

/** How many PRs (open or closed) mention this issue number in their body -- our "is this already claimed?" signal. */
export async function countCompetingPRs(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
): Promise<number> {
  const { data } = await octokit.rest.search.issuesAndPullRequests({
    q: `repo:${owner}/${repo} is:pr ${issueNumber} in:body`,
    per_page: 1,
  });
  return data.total_count;
}

/** Latest comments on an issue, used to detect new activity on personally-tracked issues. */
export async function fetchLatestComments(
  octokit: Octokit,
  owner: string,
  repo: string,
  issueNumber: number,
  sinceIso?: string,
) {
  const { data } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: issueNumber,
    since: sinceIso,
    per_page: 30,
  });
  return data.map((c) => ({
    author: c.user?.login ?? "unknown",
    association: c.author_association,
    body: c.body ?? "",
    created_at: c.created_at,
    html_url: c.html_url,
  }));
}
