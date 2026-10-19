import { db } from "@/db";
import { casualties } from "@/db/schema";
import { encryptPayload, makeRef } from "@/lib/crypto";
import { getCurrentUser, listCasualties, logEvent, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ ok: true, casualties: await listCasualties() });
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  if (user.role === "field") {
    return Response.json(
      { ok: false, error: "MEDIC / COMMAND AUTHORITY REQUIRED" },
      { status: 403 },
    );
  }
  let body: {
    status?: string;
    mechanism?: string;
    injuries?: string[];
    meds?: string;
    note?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ ok: false, error: "BAD REQUEST" }, { status: 400 });
  }
  const ref = makeRef("C").toUpperCase();
  const inserted = await db
    .insert(casualties)
    .values({
      casualtyRef: ref,
      status: body.status && ["urgent", "priority", "routine", "minimal", "expectant"].includes(body.status)
        ? body.status
        : "priority",
      phase: "tfc",
      unitCode: user.unitCode,
      payloadEnc: encryptPayload({
        mechanism: (body.mechanism ?? "UNSPECIFIED").toUpperCase(),
        injuries: (body.injuries ?? []).map((i) => i.toUpperCase()),
        meds: body.meds ?? "—",
      }),
      treatmentLog: [
        {
          t: new Date().toISOString().slice(11, 16).replace(":", "") + "Z",
          note: (body.note ?? "RECORD OPENED").toUpperCase(),
          by: user.callSign,
        },
      ],
    })
    .returning();
  await logEvent("casualty", `CASUALTY RECORD OPENED — ${ref}`, ref, user.callSign);
  return Response.json({ ok: true, casualty: inserted[0] });
}
