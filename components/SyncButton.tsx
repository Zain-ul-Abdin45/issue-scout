"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onClick() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/sync-now", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        const s = data.summary;
        setMessage(`${s.newIssues} new, ${s.labelChanges} label changes, ${s.newComments} new replies`);
        router.refresh();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage("Sync failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={onClick}
        disabled={loading}
        className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800 disabled:opacity-50"
      >
        {loading ? "Syncing..." : "Sync now"}
      </button>
      {message && <span className="text-xs text-neutral-400">{message}</span>}
    </div>
  );
}
