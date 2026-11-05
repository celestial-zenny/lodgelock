import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Booking deadlines (private.process_deadlines): auto-release 48h after a handover with no student response, and
 * no-show cancellation 7 days after the move-in date with no handover. Vercel Cron calls this with
 * `Authorization: Bearer $CRON_SECRET`.
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
  const { data, error } = await db.rpc("run_booking_deadlines");
  if (error) {
    console.error("run_booking_deadlines failed", { code: error.code });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, ...(data as object) });
}
