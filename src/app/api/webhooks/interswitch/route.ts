import { NextResponse, type NextRequest } from "next/server";
import { interswitchConfig } from "@/lib/interswitch/config";
import { verifyInterswitchSignature, webhookEventRef, webhookTxnRef } from "@/lib/interswitch/webhook";
import { settlePayment } from "@/lib/payments/settle";
import { createServiceClient } from "@/lib/supabase/server";
import { dbFailure } from "@/lib/db-error";

export async function POST(request: NextRequest) {
  const secret = interswitchConfig().webhookSecret;
  if (!secret) {
    console.error("INTERSWITCH_WEBHOOK_SECRET not set; rejecting webhook");
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  // Signature is over the exact bytes received, so read raw text before parsing.
  const raw = await request.text();
  if (raw.length > 64_000) return NextResponse.json({ error: "too large" }, { status: 413 });
  if (!verifyInterswitchSignature(raw, request.headers.get("x-interswitch-signature"), secret)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  // Idempotency: first delivery inserts; retries hit the unique (provider, event_ref) and are skipped.
  let db;
  try {
    db = createServiceClient();
  } catch (e) {
    console.error((e as Error).message);
    return NextResponse.json({ error: "not configured" }, { status: 503 }); // Interswitch will retry
  }
  const eventRef = webhookEventRef(payload, raw);
  const { data: inserted, error } = await db
    .from("webhook_events")
    .upsert(
      { provider: "interswitch", event_ref: eventRef, payload: payload as never },
      { onConflict: "provider,event_ref", ignoreDuplicates: true },
    )
    .select("id");
  if (error) dbFailure("Storing Interswitch webhook event", error);
  if (error) return NextResponse.json({ error: "storage" }, { status: 500 }); // let Interswitch retry
  if (!inserted || inserted.length === 0) return NextResponse.json({ ok: true, duplicate: true });

  // The webhook is only a nudge: settlePayment re-queries Interswitch before changing anything.
  const txnRef = webhookTxnRef(payload);
  const outcome = txnRef ? await settlePayment(txnRef) : "unknown_ref";
  if (outcome === "error") {
    // Remove our dedupe marker so Interswitch's retry gets processed.
    await db.from("webhook_events").delete().eq("id", inserted[0].id);
    return NextResponse.json({ error: "retry" }, { status: 500 });
  }

  await db.from("webhook_events").update({ processed_at: new Date().toISOString() }).eq("id", inserted[0].id);
  return NextResponse.json({ ok: true, outcome });
}
