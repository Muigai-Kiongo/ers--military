import { db } from "@/db";
import { incidents as incidentsTable } from "@/db/schema";
import { encryptPayload, makeRef } from "@/lib/crypto";
import { INCIDENT_TYPE_LABEL } from "@/lib/domain";
import { getCurrentUser, listIncidents, logEvent, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["ied", "enemy", "fire", "uxo", "accident", "chem", "other"];
const VALID_SEVERITY = ["low", "medium", "high", "critical"];

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ ok: true, incidents: await listIncidents() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  let body: {
    type?: string;
    severity?: string;
    grid?: string;
    lat?: number | null;
    lng?: number | null;
    description?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return Response.json({ ok: false, error: "INVALID HAZARD TYPE" }, { status: 400 });
  }
  if (!body.description || body.description.trim().length < 4) {
    return Response.json({ ok: false, error: "SITUATION TEXT REQUIRED" }, { status: 400 });
  }
  const severity = VALID_SEVERITY.includes(body.severity ?? "") ? body.severity! : "medium";
  const ref = makeRef("HZ").toUpperCase();
  const inserted = await db
    .insert(incidentsTable)
    .values({
      ref,
      type: body.type,
      severity,
      status: "reported",
      lat: typeof body.lat === "number" ? body.lat : null,
      lng: typeof body.lng === "number" ? body.lng : null,
      reporterId: user.id,
      unitCode: user.unitCode,
      payloadEnc: encryptPayload({
        grid: body.grid?.trim() || "GRID UNAVAILABLE",
        description: body.description.trim().toUpperCase(),
      }),
    })
    .returning();

  await logEvent(
    "incident",
    `${INCIDENT_TYPE_LABEL[body.type]} REPORTED — ${ref} — ${body.grid?.trim() || "GRID UNAVAILABLE"}`,
    ref,
    user.callSign,
  );
  return Response.json({ ok: true, incident: inserted[0] });
}
