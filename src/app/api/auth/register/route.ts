import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, units } from "@/db/schema";
import { hashPassword, setSession } from "@/lib/crypto";
import { logEvent } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  let body: {
    callSign?: string;
    username?: string;
    fullName?: string;
    rank?: string;
    role?: string;
    unitCode?: string;
    password?: string;
  };

  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "INVALID REQUEST DATA" }, { status: 400 });
  }

  const callSign = (body.callSign ?? "").trim().toUpperCase();
  const username = (body.username ?? "").trim().toLowerCase();
  const fullName = (body.fullName ?? "").trim();
  const rank = (body.rank ?? "SPC").trim().toUpperCase();
  const role = ["field", "medic", "command"].includes(body.role ?? "") ? body.role! : "field";
  const unitCode = (body.unitCode ?? "").trim();
  const password = body.password ?? "";

  if (!callSign || !fullName || !password) {
    return Response.json(
      { ok: false, error: "CALLSIGN, FULL NAME, AND SECURITY PASSWORD ARE REQUIRED" },
      { status: 400 }
    );
  }

  if (password.length < 6) {
    return Response.json(
      { ok: false, error: "SECURITY KEY MUST BE AT LEAST 6 CHARACTERS" },
      { status: 400 }
    );
  }

  // Verify unit code exists, fallback to first unit if not supplied or invalid
  const availableUnits = await db.select().from(units);
  const matchingUnit = availableUnits.find((u: { code: string }) => u.code === unitCode) ?? availableUnits[0];

  if (!matchingUnit) {
    return Response.json({ ok: false, error: "NO GARRISON UNIT FOUND" }, { status: 400 });
  }

  // Check if callSign or username already exists
  const existing = await db
    .select()
    .from(users)
    .where(
      or(
        eq(users.callSign, callSign),
        username ? sql`LOWER(${users.username}) = LOWER(${username})` : sql`false`
      )
    )
    .limit(1);

  if (existing.length > 0) {
    return Response.json(
      { ok: false, error: `CALLSIGN OR USERNAME "${callSign}" IS ALREADY IN USE ON THE GARRISON ROSTER` },
      { status: 409 }
    );
  }

  const passwordHash = hashPassword(password);
  const defaultTccc = role === "medic" ? "CMC" : "CLS";

  try {
    const inserted = await db
      .insert(users)
      .values({
        callSign,
        username: username || callSign.toLowerCase().replace(/[^a-z0-9]/g, ""),
        passwordHash,
        fullName,
        rank,
        role,
        unitCode: matchingUnit.code,
        mosDesignation: role === "medic" ? "68W COMBAT MEDIC" : role === "command" ? "11A INF OFFICER" : "11B INFANTRYMAN",
        tcccLevel: defaultTccc,
        status: "active",
      })
      .returning();

    const u = inserted[0];
    await setSession(u.id);
    await logEvent(
      "auth",
      `NEW OPERATOR ENLISTED: ${u.rank} ${u.callSign} ASSIGNED TO ${matchingUnit.code} AS ${role.toUpperCase()}`,
      null,
      u.callSign
    );

    return Response.json({
      ok: true,
      user: {
        id: u.id,
        callSign: u.callSign,
        username: u.username,
        fullName: u.fullName,
        rank: u.rank,
        role: u.role,
        unitCode: u.unitCode,
        tcccLevel: u.tcccLevel,
      },
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : "DATABASE ENLISTMENT ERROR" },
      { status: 500 }
    );
  }
}
