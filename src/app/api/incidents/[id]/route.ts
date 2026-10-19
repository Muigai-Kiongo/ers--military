import { eq } from "drizzle-orm";
import { db } from "@/db";
import { incidents } from "@/db/schema";
import { INCIDENT_STATUS_LABEL } from "@/lib/domain";
import { getCurrentUser, logEvent, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["ack", "responding", "monitored", "resolved"];

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
  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!body.status || !ALLOWED.includes(body.status)) {
    return Response.json({ ok: false, error: "INVALID STATUS" }, { status: 400 });
  }
  const updated = await db
    .update(incidents)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(incidents.id, id))
    .returning();
  const inc = updated[0];
  if (!inc) return Response.json({ ok: false, error: "NOT FOUND" }, { status: 404 });

  await logEvent(
    "incident",
    `${inc.ref} → ${INCIDENT_STATUS_LABEL[body.status] ?? body.status.toUpperCase()}`,
    inc.ref,
    user.callSign,
  );
  return Response.json({ ok: true, incident: inc });
}
