import { eq } from "drizzle-orm";
import { db } from "@/db";
import { alerts, users } from "@/db/schema";
import { ALERT_STATUS_LABEL } from "@/lib/domain";
import {
  getCurrentUser,
  logEvent,
  serializeAlert,
  unauthorized,
} from "@/lib/server";

export const dynamic = "force-dynamic";

const ALLOWED = ["ack", "en_route", "on_scene", "evac", "complete", "cancelled"];

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
    .update(alerts)
    .set({ status: body.status, updatedAt: new Date() })
    .where(eq(alerts.id, id))
    .returning();
  const alert = updated[0];
  if (!alert) return Response.json({ ok: false, error: "NOT FOUND" }, { status: 404 });

  await logEvent(
    "medevac",
    `${alert.alertRef} → ${ALERT_STATUS_LABEL[body.status] ?? body.status.toUpperCase()}`,
    alert.alertRef,
    user.callSign,
  );
  const requester = (
    await db.select().from(users).where(eq(users.id, alert.requesterId)).limit(1)
  )[0];
  return Response.json({ ok: true, alert: serializeAlert(alert, requester) });
}
