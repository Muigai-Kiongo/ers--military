import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { encryptPayload, makeRef } from "@/lib/crypto";
import {
  getCurrentUser,
  listAlerts,
  logEvent,
  serializeAlert,
  unauthorized,
} from "@/lib/server";
import type { AlertPayload } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ ok: true, alerts: await listAlerts() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  let payload: AlertPayload;
  try {
    payload = (await req.json()) as AlertPayload;
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!payload.line1 || typeof payload.line1 !== "string") {
    return Response.json({ ok: false, error: "LINE 1 GRID REQUIRED" }, { status: 400 });
  }

  const patients =
    (payload.line3?.A ?? 0) +
    (payload.line3?.B ?? 0) +
    (payload.line3?.C ?? 0) +
    (payload.line3?.D ?? 0) +
    (payload.line3?.E ?? 0);
  const priority =
    (payload.line3?.A ?? 0) > 0
      ? "urgent"
      : (payload.line3?.B ?? 0) > 0
        ? "urgent_surgical"
        : (payload.line3?.C ?? 0) > 0
          ? "priority"
          : (payload.line3?.D ?? 0) > 0
            ? "routine"
            : "convenience";

  const alertRef = makeRef("MV").toUpperCase();
  const inserted = await db
    .insert(s.alerts)
    .values({
      alertRef,
      status: "sent",
      priority,
      patients: Math.max(1, patients),
      requesterId: user.id,
      unitCode: user.unitCode,
      payloadEnc: encryptPayload(payload),
    })
    .returning();
  const alert = inserted[0];

  // Auto-generate triage casualty records from line 3 precedence counts
  const casInserts: (typeof s.casualties.$inferInsert)[] = [];
  const map: [keyof AlertPayload["line3"], string][] = [
    ["A", "urgent"],
    ["B", "urgent"],
    ["C", "priority"],
    ["D", "routine"],
    ["E", "routine"],
  ];
  let n = 1;
  for (const [key, status] of map) {
    const count = payload.line3?.[key] ?? 0;
    for (let i = 0; i < count; i++) {
      casInserts.push({
        casualtyRef: makeRef("C").toUpperCase() + `-${n++}`,
        status,
        phase: "cuf",
        alertId: alert.id,
        unitCode: user.unitCode,
        payloadEnc: encryptPayload({
          mechanism: payload.mist?.mechanism ?? "UNSPECIFIED",
          injuries: [],
          meds: payload.mist?.treatment ?? "—",
        }),
        treatmentLog: [
          {
            t: new Date().toISOString().slice(11, 16).replace(":", "") + "Z",
            note: "RECORD OPENED FROM 9-LINE " + alertRef,
            by: user.callSign,
          },
        ],
      });
    }
  }
  if (casInserts.length) await db.insert(s.casualties).values(casInserts);

  await logEvent(
    "medevac",
    `9-LINE RECEIVED — ${alertRef} — ${patients} PT (${priority.toUpperCase()}), GRID ${payload.line1}`,
    alertRef,
    user.callSign,
  );

  const requester = (
    await db.select().from(s.users).where(eq(s.users.id, user.id)).limit(1)
  )[0];
  return Response.json({ ok: true, alert: serializeAlert(alert, requester), casualtiesCreated: casInserts.length });
}
