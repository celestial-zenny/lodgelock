import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * 72h fallback: confirms bookings where the landlord confirmed the keys handover and the student neither
 * confirmed nor disputed within 72h of that. Vercel Cron calls this with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "not configured" }, { status: 503 });
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let db;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error((e as Error).message);
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }
  const { data, error } = await db.rpc("run_auto_confirm");
  if (error) {
    console.error("run_auto_confirm failed", { code: error.code });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, autoConfirmed: data });
}
