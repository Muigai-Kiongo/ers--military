import { eq } from "drizzle-orm";
import { db } from "@/db";
import { units } from "@/db/schema";
import { getCurrentUser, listUnits, logEvent, serializeUnit, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ ok: true, units: await listUnits() });
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "command") {
    return Response.json({ ok: false, error: "COMMAND AUTHORITY REQUIRED" }, { status: 403 });
  }
  let body: { code?: string; readiness?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!body.code || !["green", "amber", "red", "black"].includes(body.readiness ?? "")) {
    return Response.json({ ok: false, error: "INVALID READINESS" }, { status: 400 });
  }
  const updated = await db
    .update(units)
    .set({ readiness: body.readiness! })
    .where(eq(units.code, body.code))
    .returning();
  if (!updated[0]) return Response.json({ ok: false, error: "NOT FOUND" }, { status: 404 });
  await logEvent("status", `${body.code} READINESS → ${body.readiness!.toUpperCase()}`, body.code, user.callSign);
  return Response.json({ ok: true, unit: serializeUnit(updated[0]) });
}
