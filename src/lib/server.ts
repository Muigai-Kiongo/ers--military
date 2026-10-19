import { eq, desc, asc } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import { decryptPayload, getSessionUserId, makeRef } from "@/lib/crypto";
import type {
  AlertDTO,
  CasualtyDTO,
  EventDTO,
  IncidentDTO,
  MeUser,
  UnitDTO,
} from "@/lib/types";

export { makeRef };

export async function getCurrentUser(): Promise<MeUser | null> {
  const userId = await getSessionUserId();
  if (!userId) return null;
  const rows = await db.select().from(s.users).where(eq(s.users.id, userId)).limit(1);
  const u = rows[0];
  if (!u || u.status !== "active") return null;
  return {
    id: u.id,
    callSign: u.callSign,
    username: u.username,
    fullName: u.fullName,
    rank: u.rank,
    role: u.role as MeUser["role"],
    unitCode: u.unitCode,
    mosDesignation: u.mosDesignation,
    tcccLevel: u.tcccLevel,
    status: u.status,
  };
}

export function unauthorized() {
  return Response.json({ ok: false, error: "UNAUTHORIZED — SESSION INVALID" }, { status: 401 });
}

export async function logEvent(
  kind: string,
  message: string,
  ref: string | null,
  actor: string | null,
): Promise<void> {
  await db.insert(s.netEvents).values({ kind, message, ref, actor });
}

// ---------------- serialization -------------------------------------------

export function serializeAlert(a: s.Alert, requester: s.User | null): AlertDTO {
  const payload = decryptPayload(a.payloadEnc) as AlertDTO["payload"];
  return {
    id: a.id,
    alertRef: a.alertRef,
    status: a.status,
    priority: a.priority,
    patients: a.patients,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    requesterCallSign: requester?.callSign ?? "UNKNOWN",
    requesterRank: requester?.rank ?? "--",
    unitCode: a.unitCode,
    payload,
  };
}

export function serializeIncident(i: s.Incident, reporter: s.User | null): IncidentDTO {
  const payload = decryptPayload<{ grid: string; description: string }>(i.payloadEnc);
  return {
    id: i.id,
    ref: i.ref,
    type: i.type,
    severity: i.severity,
    status: i.status,
    lat: i.lat,
    lng: i.lng,
    grid: payload?.grid ?? "GRID WITHHELD",
    description: payload?.description ?? "",
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    reporterCallSign: reporter?.callSign ?? "UNKNOWN",
    reporterRank: reporter?.rank ?? "--",
    unitCode: i.unitCode,
  };
}

export function serializeCasualty(c: s.Casualty, alertRef: string | null): CasualtyDTO {
  const payload = decryptPayload<{ mechanism: string; injuries: string[]; meds: string }>(c.payloadEnc);
  return {
    id: c.id,
    casualtyRef: c.casualtyRef,
    status: c.status,
    phase: c.phase,
    alertRef,
    alertId: c.alertId,
    unitCode: c.unitCode,
    mechanism: payload?.mechanism ?? "UNSPECIFIED",
    injuries: payload?.injuries ?? [],
    meds: payload?.meds ?? "—",
    treatmentLog: (c.treatmentLog as CasualtyDTO["treatmentLog"]) ?? [],
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

export function serializeUnit(u: s.Unit): UnitDTO {
  return {
    id: u.id,
    code: u.code,
    name: u.name,
    callSign: u.callSign,
    locationGrid: u.locationGrid,
    readiness: u.readiness,
    personnel: u.personnel,
  };
}

export function serializeEvent(e: s.NetEvent): EventDTO {
  return {
    id: e.id,
    kind: e.kind,
    message: e.message,
    ref: e.ref,
    actor: e.actor,
    createdAt: e.createdAt.toISOString(),
  };
}

export async function listAlerts(): Promise<AlertDTO[]> {
  const rows = await db.select().from(s.alerts).orderBy(desc(s.alerts.createdAt)).limit(100);
  const reqIds = [...new Set(rows.map((r) => r.requesterId))];
  const reqs = reqIds.length
    ? await db.select().from(s.users).where(inArrayIds(s.users.id, reqIds))
    : [];
  const map = new Map(reqs.map((u) => [u.id, u]));
  return rows.map((r) => serializeAlert(r, map.get(r.requesterId) ?? null));
}

export async function listIncidents(): Promise<IncidentDTO[]> {
  const rows = await db.select().from(s.incidents).orderBy(desc(s.incidents.createdAt)).limit(200);
  const ids = [...new Set(rows.map((r) => r.reporterId))];
  const reps = ids.length
    ? await db.select().from(s.users).where(inArrayIds(s.users.id, ids))
    : [];
  const map = new Map(reps.map((u) => [u.id, u]));
  return rows.map((r) => serializeIncident(r, map.get(r.reporterId) ?? null));
}

export async function listCasualties(): Promise<CasualtyDTO[]> {
  const rows = await db.select().from(s.casualties).orderBy(desc(s.casualties.createdAt)).limit(200);
  const alertIds = [...new Set(rows.map((r) => r.alertId).filter(Boolean))] as string[];
  const alerts = alertIds.length
    ? await db.select().from(s.alerts).where(inArrayIds(s.alerts.id, alertIds))
    : [];
  const amap = new Map(alerts.map((a) => [a.id, a.alertRef]));
  return rows.map((r) => serializeCasualty(r, r.alertId ? amap.get(r.alertId) ?? null : null));
}

export async function listUnits(): Promise<UnitDTO[]> {
  const rows = await db.select().from(s.units).orderBy(asc(s.units.code));
  return rows.map(serializeUnit);
}

export async function listEvents(limitN = 40): Promise<EventDTO[]> {
  const rows = await db.select().from(s.netEvents).orderBy(desc(s.netEvents.createdAt)).limit(limitN);
  return rows.map(serializeEvent);
}

// drizzle inArray helper (kept local to avoid extra imports)
import { inArray, type Column } from "drizzle-orm";
function inArrayIds(col: Column, ids: string[]) {
  return inArray(col, ids);
}
