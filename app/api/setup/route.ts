import { NextRequest, NextResponse } from "next/server";
import { ensureSchema } from "@/lib/sync";

// One-time (idempotent) schema init. Hit this once after wiring up POSTGRES_URL,
// or anytime -- it's just `create table if not exists`.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  try {
    await ensureSchema();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 500 });
  }
}
