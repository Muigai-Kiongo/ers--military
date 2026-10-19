import { eq } from "drizzle-orm";
import { db } from "@/db";
import { casualties } from "@/db/schema";
import { CASUALTY_STATUS_LABEL, PHASE_LABEL } from "@/lib/domain";
import { getCurrentUser, logEvent, unauthorized } from "@/lib/server";
import type { TreatmentEntry } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS = ["urgent", "priority", "routine", "minimal", "expectant"];
const PHASE = ["cuf", "tfc", "tacevac", "evacuated"];

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role === "field") {
    return Response.json(
      { ok: false, error: "MEDIC / COMMAND AUTHORITY REQUIRED" },
      { status: 403 },
    );
  }
  const { id } = await ctx.params;
  let body: { status?: string; phase?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }

  const current = (await db.select().from(casualties).where(eq(casualties.id, id)).limit(1))[0];
  if (!current) return Response.json({ ok: false, error: "NOT FOUND" }, { status: 404 });

  const log = (current.treatmentLog as TreatmentEntry[]) ?? [];
  const entries: TreatmentEntry[] = [...log];
  const stamp = new Date().toISOString().slice(11, 16).replace(":", "") + "Z";
  const changes: string[] = [];

  if (body.status && STATUS.includes(body.status) && body.status !== current.status) {
    changes.push(`STATUS ${CASUALTY_STATUS_LABEL[current.status]} → ${CASUALTY_STATUS_LABEL[body.status]}`);
  }
  if (body.phase && PHASE.includes(body.phase) && body.phase !== current.phase) {
    changes.push(`PHASE → ${PHASE_LABEL[body.phase]}`);
  }
  if (body.note?.trim()) {
    entries.push({ t: stamp, note: body.note.trim().toUpperCase(), by: user.callSign });
  }
  if (changes.length) {
    entries.push({ t: stamp, note: changes.join(" · "), by: user.callSign });
  }

  const updated = await db
    .update(casualties)
    .set({
      status: body.status && STATUS.includes(body.status) ? body.status : current.status,
      phase: body.phase && PHASE.includes(body.phase) ? body.phase : current.phase,
      treatmentLog: entries,
      updatedAt: new Date(),
    })
    .where(eq(casualties.id, id))
    .returning();

  if (changes.length || body.note?.trim()) {
    await logEvent(
      "casualty",
      `${current.casualtyRef} ${changes.length ? changes.join(" · ") : "NOTE LOGGED"}`,
      current.casualtyRef,
      user.callSign,
    );
  }
  return Response.json({ ok: true, casualty: updated[0] });
}
