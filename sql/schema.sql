-- issue-scout schema

create table if not exists watched_repos (
  id serial primary key,
  owner text not null,
  repo text not null,
  labels text[] not null default '{}',      -- label names that mark a "beginner friendly" issue on this repo
  priority smallint not null default 2,     -- 1 = high (clean queue, python match), 2 = normal, 3 = low (weak match / usually sniped)
  notes text,
  active boolean not null default true,
  unique (owner, repo)
);

create table if not exists tracked_issues (
  id serial primary key,
  repo_id integer not null references watched_repos(id) on delete cascade,
  issue_number integer not null,
  title text not null,
  url text not null,
  state text not null default 'open',
  labels text[] not null default '{}',
  author text,
  is_personal boolean not null default false,   -- true for issues the user is personally engaged on
  status text not null default 'new',           -- new | watching | in_progress | stale | closed
  comments_count integer not null default 0,
  competing_prs_count integer not null default 0,
  github_created_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  last_changed_at timestamptz not null default now(),
  unique (repo_id, issue_number)
);

create table if not exists issue_events (
  id serial primary key,
  tracked_issue_id integer not null references tracked_issues(id) on delete cascade,
  event_type text not null,   -- new_issue | new_comment | label_change | pr_opened | state_change
  detail text,
  occurred_at timestamptz not null default now()
);

create index if not exists idx_tracked_issues_repo on tracked_issues(repo_id);
create index if not exists idx_issue_events_issue on issue_events(tracked_issue_id);
create index if not exists idx_issue_events_occurred on issue_events(occurred_at desc);
