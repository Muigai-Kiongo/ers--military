import { asc } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export const dynamic = "force-dynamic";

// Public identity list for the login screen (no sensitive fields exposed).
export async function GET() {
  const rows = await db
    .select({
      id: users.id,
      callSign: users.callSign,
      username: users.username,
      rank: users.rank,
      fullName: users.fullName,
      role: users.role,
      unitCode: users.unitCode,
      status: users.status,
    })
    .from(users)
    .orderBy(asc(users.role), asc(users.callSign));

  return Response.json({ ok: true, users: rows.filter((r) => r.status === "active") });
}
