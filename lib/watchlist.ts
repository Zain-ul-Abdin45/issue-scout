// Config-as-code: the repos issue-scout watches, and the issues you're
// personally engaged on. Edit this file and redeploy to change what's tracked
// -- the sync cron reads this on every run and upserts into watched_repos.

export type WatchedRepo = {
  owner: string;
  repo: string;
  labels: string[]; // label names that mark a beginner-friendly issue on this repo
  priority: 1 | 2 | 3; // 1 = clean queue + good language match, 2 = normal, 3 = usually sniped/weak match
  notes?: string;
};

export const WATCHLIST: WatchedRepo[] = [
  // Priority 1 -- clean queues, Python-native, worth checking first
  {
    owner: "crewAIInc",
    repo: "crewAI",
    labels: ["good first issue"],
    priority: 1,
    notes: "Actively triaged, issues get assigned same-day. AI-assisted PRs must carry the llm-generated label.",
  },
  {
    owner: "browser-use",
    repo: "browser-use",
    labels: ["good first issue", "help wanted"],
    priority: 1,
    notes: "Clean/empty queue, minimal process friction, no CLA found.",
  },
  {
    owner: "neuml",
    repo: "txtai",
    labels: ["bug", "enhancement"],
    priority: 1,
    notes: "Small, quiet, single responsive maintainer (davidmezzetti). No CONTRIBUTING.md/PR template friction.",
  },
  {
    owner: "open-webui",
    repo: "open-webui",
    labels: ["good first issue", "help wanted", "confirmed issue"],
    priority: 1,
    notes:
      "Bot auto-closes unsolicited PRs -- comment on the issue and get maintainer sign-off before opening one.",
  },

  // Priority 3 -- keep visible, but historically sniped within hours or a weak language/skill match
  {
    owner: "BerriAI",
    repo: "litellm",
    labels: ["good first issue", "help wanted"],
    priority: 3,
    notes: "Issue queue monitored and PR'd almost instantly.",
  },
  {
    owner: "ollama",
    repo: "ollama",
    labels: ["good first issue", "help wanted"],
    priority: 3,
    notes: "Go/C++ core, weak Python match; simple issues draw 10+ competing PRs.",
  },
  {
    owner: "run-llama",
    repo: "llama_index",
    labels: ["good first issue", "contributions wanted"],
    priority: 3,
    notes: "Well-scoped issues typically already have several competing PRs.",
  },
  {
    owner: "deepset-ai",
    repo: "haystack",
    labels: ["good first issue", "help wanted"],
    priority: 3,
    notes: "Labeled queue usually empty; unlabeled bugs get claimed within hours.",
  },
  {
    owner: "chroma-core",
    repo: "chroma",
    labels: ["good first issue", "help wanted"],
    priority: 3,
    notes: "Core moved to Rust; open items tend to be stale.",
  },
  {
    owner: "qdrant",
    repo: "qdrant",
    labels: ["good first issue", "help wanted"],
    priority: 3,
    notes: "Rust core, deep systems/cross-compilation issues -- weak match.",
  },
  {
    owner: "langgenius",
    repo: "dify",
    labels: ["good first issue"],
    priority: 3,
    notes: "Most-sniped repo seen so far (one issue had 18 competing PRs). Requires formal assignment before a PR.",
  },
  {
    owner: "vllm-project",
    repo: "vllm",
    labels: ["good first issue"],
    priority: 3,
    notes: "Skews deep CUDA/distributed-systems, not a beginner Python match.",
  },
];

export type PersonalIssue = {
  owner: string;
  repo: string;
  issueNumber: number;
  note?: string;
};

// Issues you're personally engaged on -- tracked regardless of label/priority,
// and surfaced separately on the dashboard so new replies don't need a manual screenshot.
export const MY_ISSUES: PersonalIssue[] = [
  {
    owner: "open-webui",
    repo: "open-webui",
    issueNumber: 29968,
    note: "Posted repro + verified fix, waiting on maintainer sign-off to open a PR.",
  },
  {
    owner: "neuml",
    repo: "txtai",
    issueNumber: 1239,
    note: "Root-caused to an upstream transformers regression; proposed a setup.py version exclusion.",
  },
];
