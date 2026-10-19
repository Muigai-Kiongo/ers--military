import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { units, users } from "@/db/schema";
import { hashPassword } from "@/lib/crypto";
import { getCurrentUser, logEvent, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "command") {
    return Response.json({ ok: false, error: "COMMAND AUTHORITY REQUIRED" }, { status: 403 });
  }
  const rows = await db
    .select()
    .from(users)
    .orderBy(asc(users.role), asc(users.callSign));
  return Response.json({
    ok: true,
    users: rows.map((u) => ({
      id: u.id,
      callSign: u.callSign,
      username: u.username,
      fullName: u.fullName,
      rank: u.rank,
      role: u.role,
      unitCode: u.unitCode,
      mosDesignation: u.mosDesignation,
      tcccLevel: u.tcccLevel,
      status: u.status,
    })),
    units: (await db.select().from(units).orderBy(asc(units.code))).map((u) => u.code),
  });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "command") {
    return Response.json({ ok: false, error: "COMMAND AUTHORITY REQUIRED" }, { status: 403 });
  }
  let body: {
    callSign?: string;
    username?: string;
    fullName?: string;
    rank?: string;
    role?: string;
    unitCode?: string;
    tcccLevel?: string;
    password?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!body.callSign || !body.fullName || !body.unitCode) {
    return Response.json({ ok: false, error: "CALLSIGN, NAME AND UNIT REQUIRED" }, { status: 400 });
  }
  const role = ["field", "medic", "command"].includes(body.role ?? "") ? body.role! : "field";
  const pass = body.password?.trim() ? body.password.trim() : "Tactical2025!";
  const passwordHash = hashPassword(pass);
  const username = body.username?.trim().toLowerCase() || body.callSign.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

  try {
    const inserted = await db
      .insert(users)
      .values({
        callSign: body.callSign.trim().toUpperCase(),
        username,
        passwordHash,
        fullName: body.fullName.trim(),
        rank: (body.rank ?? "SPC").trim().toUpperCase(),
        role,
        unitCode: body.unitCode,
        tcccLevel: ["ALL", "CLS", "CMC"].includes(body.tcccLevel ?? "") ? body.tcccLevel! : "CLS",
      })
      .returning();
    await logEvent("auth", `NEW IDENTITY PROVISIONED — ${inserted[0].callSign} (${role.toUpperCase()})`, inserted[0].callSign, user.callSign);
    return Response.json({ ok: true, user: inserted[0] });
  } catch {
    return Response.json({ ok: false, error: "CALLSIGN OR USERNAME ALREADY IN USE" }, { status: 409 });
  }
}

export async function PATCH(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role !== "command") {
    return Response.json({ ok: false, error: "COMMAND AUTHORITY REQUIRED" }, { status: 403 });
  }
  let body: { id?: string; role?: string; status?: string; unitCode?: string; tcccLevel?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  if (!body.id) return Response.json({ ok: false, error: "ID REQUIRED" }, { status: 400 });
  const patch: Record<string, string> = {};
  if (body.role && ["field", "medic", "command"].includes(body.role)) patch.role = body.role;
  if (body.status && ["active", "suspended"].includes(body.status)) patch.status = body.status;
  if (body.unitCode) patch.unitCode = body.unitCode;
  if (body.tcccLevel && ["ALL", "CLS", "CMC"].includes(body.tcccLevel)) patch.tcccLevel = body.tcccLevel;
  if (body.password?.trim()) patch.passwordHash = hashPassword(body.password.trim());
  if (!Object.keys(patch).length) {
    return Response.json({ ok: false, error: "NOTHING TO UPDATE" }, { status: 400 });
  }
  const updated = await db.update(users).set(patch).where(eq(users.id, body.id)).returning();
  if (!updated[0]) return Response.json({ ok: false, error: "NOT FOUND" }, { status: 404 });
  await logEvent("auth", `IDENTITY UPDATED — ${updated[0].callSign} (${Object.keys(patch).map((k) => `${k.toUpperCase()}→${patch[k].toUpperCase()}`).join(", ")})`, updated[0].callSign, user.callSign);
  return Response.json({ ok: true, user: updated[0] });
}
