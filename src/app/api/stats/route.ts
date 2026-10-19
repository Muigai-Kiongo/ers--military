import { and, eq, gte, ne } from "drizzle-orm";
import { db } from "@/db";
import { alerts, casualties, incidents, units, users } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/server";
import type { StatsDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const [alertRows, incidentRows, casualtyRows, unitRows, userRows, resolvedRows] =
    await Promise.all([
      db.select({ status: alerts.status }).from(alerts).where(ne(alerts.status, "complete")),
      db.select({ status: incidents.status }).from(incidents).where(ne(incidents.status, "resolved")),
      db
        .select({ status: casualties.status, phase: casualties.phase })
        .from(casualties)
        .where(ne(casualties.phase, "evacuated")),
      db.select({ readiness: units.readiness }).from(units),
      db.select({ role: users.role }).from(users).where(eq(users.status, "active")),
      db
        .select({ id: alerts.id })
        .from(alerts)
        .where(and(eq(alerts.status, "complete"), gte(alerts.updatedAt, new Date(Date.now() - 86400000)))),
    ]);

  const stats: StatsDTO = {
    activeAlerts: alertRows.filter((a) => a.status !== "cancelled").length,
    openIncidents: incidentRows.length,
    activeCasualties: casualtyRows.length,
    urgentCasualties: casualtyRows.filter((c) => c.status === "urgent").length,
    unitsReady: unitRows.filter((u) => u.readiness === "green").length,
    unitsCommitted: unitRows.filter((u) => u.readiness === "red").length,
    totalUnits: unitRows.length,
    fieldUsers: userRows.filter((u) => u.role === "field").length,
    medicUsers: userRows.filter((u) => u.role === "medic").length,
    resolvedToday: resolvedRows.length,
  };
  return Response.json({ ok: true, stats });
}
