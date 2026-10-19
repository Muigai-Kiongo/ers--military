"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Activity,
  ChevronDown,
  Cross,
  Loader2,
  Radio,
  ScrollText,
  Users,
} from "lucide-react";
import { useMe } from "@/components/Shell";
import TacMap from "@/components/TacMap";
import {
  Pill,
  Stat,
  alertStatusTone,
  casualtyTone,
  incidentStatusTone,
  severityTone,
  TONE_TEXT,
} from "@/components/ui";
import { apiGet, transmit } from "@/lib/client/net";
import { usePoll } from "@/lib/client/hooks";
import {
  ALERT_STATUS_FLOW,
  ALERT_STATUS_LABEL,
  CASUALTY_STATUS_LABEL,
  INCIDENT_STATUS_FLOW,
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  timeAgo,
  zuluTime,
} from "@/lib/domain";
import type {
  AlertDTO,
  CasualtyDTO,
  EventDTO,
  IncidentDTO,
  StatsDTO,
  UnitDTO,
} from "@/lib/types";

const EVENT_ICON: Record<string, (s: number) => React.ReactNode> = {
  medevac: (s) => <Cross size={s} />,
  incident: (s) => <Radio size={s} />,
  casualty: (s) => <Activity size={s} />,
  status: (s) => <Users size={s} />,
  auth: (s) => <Users size={s} />,
  system: (s) => <ScrollText size={s} />,
};

function nextOf(flow: readonly string[], status: string): string | null {
  const i = flow.indexOf(status);
  if (i < 0 || i >= flow.length - 1) return null;
  return flow[i + 1];
}

export default function BoardPage() {
  const me = useMe();
  const canAct = me?.role === "medic" || me?.role === "command";

  const { data: alertsD, refresh: refreshAlerts } = usePoll(
    async () => (await apiGet<{ alerts: AlertDTO[] }>("/api/alerts")).data,
    2500,
  );
  const { data: incidentsD, refresh: refreshIncidents } = usePoll(
    async () => (await apiGet<{ incidents: IncidentDTO[] }>("/api/incidents")).data,
    3050,
  );
  const { data: eventsD } = usePoll(
    async () => (await apiGet<{ events: EventDTO[] }>("/api/events?limit=22")).data,
    3100,
  );
  const { data: statsD } = usePoll(
    async () => (await apiGet<{ stats: StatsDTO }>("/api/stats")).data,
    4100,
  );
  const { data: unitsD } = usePoll(
    async () => (await apiGet<{ units: UnitDTO[] }>("/api/units")).data,
    6000,
  );
  const { data: casD } = usePoll(
    async () => (await apiGet<{ casualties: CasualtyDTO[] }>("/api/casualties")).data,
    3600,
  );

  const [alertFilter, setAlertFilter] = useState<"active" | "all" | "done">("active");
  const [incFilter, setIncFilter] = useState<"open" | "all" | "resolved">("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [secTick, setSecTick] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setSecTick((t) => t + 1), 15000);
    return () => clearInterval(iv);
  }, []);

  const alerts = alertsD?.alerts ?? [];
  const incidents = incidentsD?.incidents ?? [];
  const events = eventsD?.events ?? [];
  const stats = statsD?.stats;
  const units = unitsD?.units ?? [];
  const casualties = (casD?.casualties ?? []).filter((c) => c.phase !== "evacuated");

  const shownAlerts = useMemo(() => {
    void secTick;
    const sortPri = (a: AlertDTO, b: AlertDTO) => {
      const rank: Record<string, number> = { urgent: 0, urgent_surgical: 1, priority: 2, routine: 3, convenience: 4 };
      return (rank[a.priority] ?? 5) - (rank[b.priority] ?? 5) || +new Date(b.createdAt) - +new Date(a.createdAt);
    };
    if (alertFilter === "active") return alerts.filter((a) => !["complete", "cancelled"].includes(a.status)).sort(sortPri);
    if (alertFilter === "done") return alerts.filter((a) => ["complete", "cancelled"].includes(a.status));
    return [...alerts].sort(sortPri);
  }, [alerts, alertFilter, secTick]);

  const shownIncidents = useMemo(() => {
    if (incFilter === "open") return incidents.filter((i) => i.status !== "resolved");
    if (incFilter === "resolved") return incidents.filter((i) => i.status === "resolved");
    return incidents;
  }, [incidents, incFilter]);

  const act = async (kind: "alerts" | "incidents", id: string, status: string) => {
    const key = `${kind}:${id}:${status}`;
    if (busy === key) return;
    setBusy(key);
    await transmit(`/api/${kind}/${id}`, { status }, `${kind} ${status}`, "PATCH");
    if (kind === "alerts") void refreshAlerts();
    else void refreshIncidents();
    setBusy(null);
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-data text-[10px] tracking-[0.3em] text-faint">
            COC COMMON OPERATING PICTURE — REPLACES WHITEBOARD AND LOGBOOK
          </div>
          <h1 className="font-disp mt-0.5 text-3xl font-bold tracking-[0.05em] text-ink">
            SITUATION BOARD
          </h1>
        </div>
        <Pill tone="ok">LIVE — 3S REFRESH</Pill>
      </header>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="ACTIVE MEDEVAC" value={stats?.activeAlerts ?? "—"} tone={stats?.activeAlerts ? "danger" : "idle"} />
        <Stat label="OPEN HAZARDS" value={stats?.openIncidents ?? "—"} tone={stats?.openIncidents ? "warn" : "idle"} />
        <Stat label="CASUALTIES" value={stats?.activeCasualties ?? "—"} tone="warn" sub={`${stats?.urgentCasualties ?? 0} URGENT`} />
        <Stat label="UNITS READY" value={`${stats?.unitsReady ?? "—"}/${stats?.totalUnits ?? "—"}`} tone="ok" />
        <Stat label="UNITS COMMITTED" value={stats?.unitsCommitted ?? "—"} tone="warn" />
        <Stat label="EVAC COMPLETE 24H" value={stats?.resolvedToday ?? "—"} tone="dim" />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* MEDEVAC TRAFFIC */}
        <section className="t-corners border border-line bg-panel/80 xl:col-span-7">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div>
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">MEDEVAC TRAFFIC</div>
              <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">9-LINE REQUESTS</h2>
            </div>
            <div className="flex gap-1 border border-line bg-panel2 p-0.5">
              {(["active", "all", "done"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setAlertFilter(f)}
                  className={`font-disp px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] ${
                    alertFilter === f ? "bg-acc text-bg0" : "text-dim hover:text-acc"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </header>
          {shownAlerts.length === 0 ? (
            <div className="px-4 py-8 text-center font-data text-[11px] tracking-[0.2em] text-faint">
              NO MEDEVAC TRAFFIC MATCHES FILTER
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {shownAlerts.map((a) => {
                const mine = expanded === a.id;
                const next = nextOf(ALERT_STATUS_FLOW, a.status);
                return (
                  <li key={a.id}>
                    <button
                      className={`flex w-full items-center gap-3 px-4 py-3 text-left ${a.priority === "urgent" && a.status !== "complete" ? "bg-danger/5" : ""}`}
                      onClick={() => setExpanded(mine ? null : a.id)}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center border ${["urgent", "urgent_surgical"].includes(a.priority) ? "border-danger/60 text-danger" : "border-line text-warn"}`}>
                        <Cross size={17} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-2">
                          <span className="font-data text-[13px] font-bold tracking-wider text-ink">{a.alertRef}</span>
                          <span className="font-data text-[10px] tracking-[0.1em] text-faint uppercase">
                            {a.priority.replace("_", " ")} · {a.patients} PT · {a.requesterRank} {a.requesterCallSign}
                          </span>
                        </div>
                        <div className="font-data mt-0.5 text-[10px] tracking-[0.08em] text-dim">
                          {a.payload?.line1 ?? "GRID ENCRYPTED"} · {zuluTime(a.createdAt)} ({timeAgo(a.createdAt)})
                        </div>
                      </div>
                      <Pill tone={alertStatusTone(a.status)}>{ALERT_STATUS_LABEL[a.status]}</Pill>
                      <ChevronDown size={15} className={`shrink-0 text-faint transition-transform ${mine ? "rotate-180" : ""}`} />
                    </button>

                    {mine && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="border-t border-line bg-bg1 px-4 py-3.5"
                      >
                        {a.payload ? (
                          <pre className="font-data overflow-x-auto text-[11px] leading-[1.8] text-dim">
{`L1 GRID ${a.payload.line1}     L2 ${a.payload.line2}
L3 A:${a.payload.line3.A} B:${a.payload.line3.B} C:${a.payload.line3.C} D:${a.payload.line3.D} E:${a.payload.line3.E}   L5 L:${a.payload.line5.L} A:${a.payload.line5.A}
L4 ${a.payload.line4}   L6 ${a.payload.line6}   L7 ${a.payload.line7}   L8 ${a.payload.line8}   L9 ${a.payload.line9}
MIST  ${a.payload.mist.mechanism}
      I: ${a.payload.mist.injuries}
      S: ${a.payload.mist.signs}
      T: ${a.payload.mist.treatment}`}
                          </pre>
                        ) : (
                          <div className="font-data text-[11px] text-warn">PAYLOAD KEY ROTATED — UNAVAILABLE</div>
                        )}
                        {canAct && next && (
                          <button
                            onClick={() => act("alerts", a.id, next)}
                            disabled={busy !== null}
                            className="font-disp mt-3 flex items-center gap-2 border border-acc bg-acc px-4 py-2.5 text-[13px] font-bold tracking-[0.15em] text-bg0 hover:bg-acc2 disabled:opacity-40"
                          >
                            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                            ADVANCE → {ALERT_STATUS_LABEL[next]}
                          </button>
                        )}
                      </motion.div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* MAP + NET LOG */}
        <div className="space-y-4 xl:col-span-5">
          <TacMap incidents={shownIncidents} alerts={alerts} />

          <section className="t-corners border border-line bg-panel/80">
            <header className="border-b border-line px-4 py-2.5">
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">DIGITAL LOGBOOK</div>
              <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">NET LOG</h2>
            </header>
            <ul className="max-h-[340px] divide-y divide-line/60 overflow-y-auto">
              {events.map((e) => (
                <li key={e.id} className="flex items-start gap-2.5 px-4 py-2.5">
                  <span className={`mt-0.5 shrink-0 ${e.kind === "medevac" ? "text-danger" : e.kind === "incident" ? "text-warn" : "text-faint"}`}>
                    {(EVENT_ICON[e.kind] ?? EVENT_ICON.system)(12)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[12px] leading-snug text-ink">{e.message}</div>
                    <div className="font-data mt-0.5 text-[9px] tracking-[0.12em] text-faint">
                      {e.ref && <span className="mr-2 text-dim">{e.ref}</span>}
                      {e.actor && <span className="mr-2">{e.actor}</span>}
                      {timeAgo(e.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* HAZARDS */}
        <section className="t-corners border border-line bg-panel/80 xl:col-span-7">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
            <div>
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">TACTICAL REPORTING</div>
              <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">HAZARD / INCIDENT LOG</h2>
            </div>
            <div className="flex gap-1 border border-line bg-panel2 p-0.5">
              {(["open", "all", "resolved"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setIncFilter(f)}
                  className={`font-disp px-2.5 py-1 text-[11px] font-semibold tracking-[0.12em] ${
                    incFilter === f ? "bg-acc text-bg0" : "text-dim hover:text-acc"
                  }`}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </header>
          {shownIncidents.length === 0 ? (
            <div className="px-4 py-8 text-center font-data text-[11px] tracking-[0.2em] text-faint">
              NO REPORTS MATCH FILTER
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {shownIncidents.map((i) => {
                const next = nextOf(INCIDENT_STATUS_FLOW, i.status);
                return (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className={`font-disp text-[14px] font-bold tracking-[0.08em] ${TONE_TEXT[severityTone(i.severity)]}`}>
                        {INCIDENT_TYPE_LABEL[i.type] ?? i.type}
                      </span>
                      <span className="font-data text-[10px] tracking-[0.1em] text-faint">
                        {i.ref} · {i.severity.toUpperCase()} · {i.grid}
                      </span>
                      <span className="ml-auto flex shrink-0 items-center gap-2">
                        <Pill tone={incidentStatusTone(i.status)}>{INCIDENT_STATUS_LABEL[i.status]}</Pill>
                      </span>
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-dim">{i.description}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="font-data text-[10px] tracking-[0.1em] text-faint">
                        {i.reporterRank} {i.reporterCallSign} · {zuluTime(i.createdAt)} ({timeAgo(i.createdAt)})
                      </span>
                      {canAct && next && (
                        <button
                          onClick={() => act("incidents", i.id, next)}
                          disabled={busy !== null}
                          className="font-disp ml-auto border border-line-strong bg-panel2 px-2.5 py-1 text-[11px] font-bold tracking-[0.12em] text-acc hover:bg-panel disabled:opacity-40"
                        >
                          → {INCIDENT_STATUS_LABEL[next]}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* CASUALTY STRIP + UNITS */}
        <div className="space-y-4 xl:col-span-5">
          <section className="t-corners border border-line bg-panel/80">
            <header className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <div>
                <div className="font-data text-[10px] tracking-[0.25em] text-faint">TRIAGE STATUS</div>
                <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">CASUALTY BOARD</h2>
              </div>
              {(me?.role === "medic" || me?.role === "command") && (
                <Link href="/triage" className="font-data text-[10px] tracking-[0.2em] text-acc hover:underline">
                  MANAGE →
                </Link>
              )}
            </header>
            {casualties.length === 0 ? (
              <div className="px-4 py-8 text-center font-data text-[11px] tracking-[0.2em] text-faint">
                NO ACTIVE CASUALTIES ON THE NET
              </div>
            ) : (
              <ul className="divide-y divide-line/70">
                {casualties.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="font-data w-16 shrink-0 text-[12px] font-bold tracking-wider text-ink">{c.casualtyRef}</span>
                    <div className="min-w-0 flex-1 truncate text-[12px] text-dim">
                      {c.mechanism} · {c.injuries.join(", ") || "ASSESSING"}
                    </div>
                    <Pill tone={casualtyTone(c.status)}>{CASUALTY_STATUS_LABEL[c.status]}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="t-corners border border-line bg-panel/80">
            <header className="border-b border-line px-4 py-2.5">
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">FORCE LAYDOWN</div>
              <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">UNIT READINESS</h2>
            </header>
            <ul className="divide-y divide-line/70">
              {units.map((u) => (
                <li key={u.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={`h-2 w-2 shrink-0 ${u.readiness === "green" ? "bg-acc" : u.readiness === "amber" ? "bg-warn" : u.readiness === "red" ? "bg-danger" : "bg-faint"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="font-disp text-[13px] font-bold tracking-[0.08em] text-ink">{u.callSign}</div>
                    <div className="font-data text-[9px] tracking-[0.12em] text-faint">{u.code} · {u.personnel} PAX · {u.locationGrid ?? "—"}</div>
                  </div>
                  <span className="font-data text-[10px] tracking-[0.15em] text-dim uppercase">{u.readiness}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
