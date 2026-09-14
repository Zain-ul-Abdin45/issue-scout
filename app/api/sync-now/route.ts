import { NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

// Manual trigger for the "Sync now" button on the dashboard.
// Reachable only by someone who already passed the password gate in middleware.
export const maxDuration = 60;

export async function POST() {
  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
