import { neon } from "@neondatabase/serverless";

// A fresh connection per invocation is the documented pattern for
// @neondatabase/serverless in a serverless/edge function -- it's HTTP-based,
// not a long-lived pooled connection, so there's no client to leak or reuse.
export function sql() {
  const url = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (!url) {
    throw new Error("POSTGRES_URL (or DATABASE_URL) is not set");
  }
  return neon(url);
}

export type WatchedRepoRow = {
  id: number;
  owner: string;
  repo: string;
  labels: string[];
  priority: number;
  notes: string | null;
  active: boolean;
};

export type TrackedIssueRow = {
  id: number;
  repo_id: number;
  issue_number: number;
  title: string;
  url: string;
  state: string;
  labels: string[];
  author: string | null;
  is_personal: boolean;
  status: string;
  comments_count: number;
  competing_prs_count: number;
  github_created_at: string | null;
  first_seen_at: string;
  last_checked_at: string;
  last_changed_at: string;
};

export type IssueEventRow = {
  id: number;
  tracked_issue_id: number;
  event_type: string;
  detail: string | null;
  occurred_at: string;
};
