import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/lib/sync";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  // Vercel Cron sends this header automatically when CRON_SECRET is set;
  // it also lets you trigger a manual run with the same bearer token.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    const summary = await runSync();
    return NextResponse.json({ ok: true, summary });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
