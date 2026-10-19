"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen,
  ChevronRight,
  Cross,
  MapPin,
  Radio,
  ShieldCheck,
  Siren,
} from "lucide-react";
import { useMe } from "@/components/Shell";
import {
  EmptyState,
  Panel,
  Pill,
  alertStatusTone,
  incidentStatusTone,
  severityTone,
} from "@/components/ui";
import { apiGet } from "@/lib/client/net";
import { useOnline, usePoll } from "@/lib/client/hooks";
import {
  ALERT_STATUS_LABEL,
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  PHASE_LABEL,
  timeAgo,
} from "@/lib/domain";
import type { AlertDTO, IncidentDTO, StatsDTO } from "@/lib/types";

const rise = {
  hidden: { opacity: 0, y: 14 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: 0.06 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] as const },
  }),
};

export default function OpsHome() {
  const me = useMe();
  const online = useOnline();
  const { data: alertsData } = usePoll(
    async () => (await apiGet<{ alerts: AlertDTO[] }>("/api/alerts")).data,
    4000,
  );
  const { data: incidentsData } = usePoll(
    async () => (await apiGet<{ incidents: IncidentDTO[] }>("/api/incidents")).data,
    5001,
  );
  const { data: statsData } = usePoll(
    async () => (await apiGet<{ stats: StatsDTO }>("/api/stats")).data,
    5002,
  );

  const alerts = (alertsData?.alerts ?? []).filter((a) => a.status !== "complete" && a.status !== "cancelled");
  const mine = me ? alerts.filter((a) => a.requesterCallSign === me.callSign || a.unitCode === me.unitCode) : [];
  const incidents = (incidentsData?.incidents ?? []).filter((i) => i.status !== "resolved").slice(0, 5);
  const stats = statsData?.stats;

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      {/* ---------- identity header -------------------------------- */}
      <motion.div variants={rise} custom={0} initial="hidden" animate="show" className="flicker-in">
        <div className="flex flex-wrap items-end justify-between gap-3 border border-line bg-panel/70 px-4 py-3">
          <div>
            <div className="font-data text-[10px] tracking-[0.3em] text-faint">
              FOB SABER · GARRISON EMERGENCY NET
            </div>
            <h1 className="font-disp mt-0.5 text-2xl leading-none font-bold tracking-[0.06em] text-ink sm:text-3xl">
              {me ? `${me.rank} ${me.callSign}` : "—"}
            </h1>
            <div className="font-data mt-1 text-[11px] tracking-[0.15em] text-dim">
              {me?.unitCode} · {me?.mosDesignation ?? "FIELD ELEMENT"} · TCCC: {me?.tcccLevel}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={online ? "ok" : "warn"}>
              {online ? "LINK SECURE" : "OFFLINE MODE"}
            </Pill>
            {stats ? (
              <Pill tone={stats.activeAlerts > 0 ? "danger" : "idle"}>
                {stats.activeAlerts} ACTIVE MEDEVAC
              </Pill>
            ) : null}
          </div>
        </div>
      </motion.div>

      {/* ---------- one-action emergency row ------------------------ */}
      <motion.div variants={rise} custom={1} initial="hidden" animate="show">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Link
            href="/medevac"
            className="sos-pulse group border border-danger/70 bg-danger/12 p-4 transition-colors hover:bg-danger/20"
          >
            <div className="flex items-center justify-between">
              <Cross size={26} className="text-danger" strokeWidth={2.2} />
              <span className="font-data text-[10px] tracking-[0.2em] text-danger/80">ALT+M</span>
            </div>
            <div className="font-disp mt-3 text-xl leading-tight font-bold tracking-[0.06em] text-danger">
              MEDEVAC 9-LINE
            </div>
            <div className="mt-1 text-[12px] leading-snug text-danger/80">
              One-action casualty evacuation request with auto GPS grid + MIST report.
            </div>
          </Link>

          <Link
            href="/report"
            className="group border border-line bg-panel/70 p-4 transition-colors hover:border-warn/50 hover:bg-warn/5"
          >
            <div className="flex items-center justify-between">
              <Siren size={24} className="text-warn" strokeWidth={1.9} />
              <span className="font-data text-[10px] tracking-[0.2em] text-faint">ALT+R</span>
            </div>
            <div className="font-disp mt-3 text-xl leading-tight font-bold tracking-[0.06em] text-ink group-hover:text-warn">
              REPORT HAZARD
            </div>
            <div className="mt-1 text-[12px] leading-snug text-dim">
              IED, enemy movement, fire, UXO — alerts nearby units + COC off the radio net.
            </div>
          </Link>

          <Link
            href="/guide"
            className="group border border-line bg-panel/70 p-4 transition-colors hover:border-line-strong hover:bg-panel"
          >
            <div className="flex items-center justify-between">
              <BookOpen size={24} className="text-acc" strokeWidth={1.9} />
              <span className="font-data text-[10px] tracking-[0.2em] text-faint">ALT+G</span>
            </div>
            <div className="font-disp mt-3 text-xl leading-tight font-bold tracking-[0.06em] text-ink group-hover:text-acc">
              TCCC GUIDE
            </div>
            <div className="mt-1 text-[12px] leading-snug text-dim">
              Hands-free tactical casualty care, legible under night vision.
            </div>
          </Link>
        </div>
      </motion.div>

      {/* ---------- stats strip (command-aware) --------------------- */}
      {me?.role === "command" && stats ? (
        <motion.div variants={rise} custom={2} initial="hidden" animate="show">
          <Link href="/board" className="block border border-line bg-panel/70 px-4 py-3 hover:border-line-strong">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Radio size={16} className="text-acc" />
                <span className="font-disp text-sm font-semibold tracking-[0.12em] text-ink">
                  COMMAND PICTURE
                </span>
              </div>
              <div className="font-data flex flex-wrap items-center gap-4 text-[11px] tracking-[0.1em]">
                <span className="text-danger">{stats.activeAlerts} MEDEVAC</span>
                <span className="text-warn">{stats.openIncidents} INCIDENTS</span>
                <span className="text-acc">{stats.activeCasualties} CAS</span>
                <span className="text-dim">
                  UNITS {stats.unitsReady}/{stats.totalUnits} READY
                </span>
                <ChevronRight size={14} className="text-faint" />
              </div>
            </div>
          </Link>
        </motion.div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        {/* ---------- active medevac traffic ------------------------- */}
        <motion.div variants={rise} custom={3} initial="hidden" animate="show" className="lg:col-span-3">
          <Panel
            kicker="MEDICAL EVACUATION TRAFFIC"
            title="ACTIVE MEDEVAC REQUESTS"
            right={
              <Link href="/medevac" className="font-data text-[10px] tracking-[0.2em] text-danger hover:underline">
                NEW 9-LINE →
              </Link>
            }
            pad={false}
          >
            {alerts.length === 0 ? (
              <div className="p-4">
                <EmptyState title="NO ACTIVE MEDEVAC TRAFFIC" sub="NET IS CLEAR — STAND BY" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`flex h-9 w-9 shrink-0 items-center justify-center border ${
                        a.priority === "urgent" || a.priority === "urgent_surgical"
                          ? "border-danger/60 bg-danger/10 text-danger"
                          : "border-line bg-panel2 text-warn"
                      }`}
                    >
                      <Cross size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-data text-[13px] font-bold tracking-wider text-ink">{a.alertRef}</span>
                        <span className="font-data text-[10px] tracking-[0.1em] text-faint uppercase">
                          {a.priority.replace("_", " ")} · {a.patients} PT
                        </span>
                        {mine.some((m) => m.id === a.id) && (
                          <span className="font-data text-[9px] tracking-[0.2em] text-acc">YOUR UNIT</span>
                        )}
                      </div>
                      <div className="font-data mt-0.5 flex items-center gap-1.5 text-[10px] tracking-[0.1em] text-dim">
                        <MapPin size={10} className="shrink-0" />
                        <span className="truncate">{a.payload?.line1 ?? "GRID ENCRYPTED"}</span>
                        <span className="text-faint">· {timeAgo(a.createdAt)}</span>
                      </div>
                    </div>
                    <Pill tone={alertStatusTone(a.status)}>{ALERT_STATUS_LABEL[a.status] ?? a.status}</Pill>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </motion.div>

        {/* ---------- hazard feed ------------------------------------ */}
        <motion.div variants={rise} custom={4} initial="hidden" animate="show" className="lg:col-span-2">
          <Panel
            kicker="BLUE FORCE REPORTING"
            title="HAZARD WATCH"
            right={
              <Link href="/board" className="font-data text-[10px] tracking-[0.2em] text-dim hover:text-acc">
                BOARD →
              </Link>
            }
            pad={false}
          >
            {incidents.length === 0 ? (
              <div className="p-4">
                <EmptyState title="NO OPEN HAZARDS" sub="AREA CURRENTLY CLEAR" />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {incidents.map((i) => (
                  <li key={i.id} className="px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`font-disp text-[13px] font-bold tracking-[0.08em] ${i.severity === "critical" ? "text-danger" : "text-ink"}`}>
                        {INCIDENT_TYPE_LABEL[i.type] ?? i.type}
                      </span>
                      <Pill tone={incidentStatusTone(i.status)}>{INCIDENT_STATUS_LABEL[i.status] ?? i.status}</Pill>
                    </div>
                    <div className="font-data mt-1 text-[10px] tracking-[0.08em] text-faint uppercase">
                      {i.ref} · <span className={severityTone(i.severity) === "danger" ? "text-danger" : "text-dim"}>{i.severity}</span> · {timeAgo(i.createdAt)} · {i.reporterCallSign}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </motion.div>
      </div>

      {/* ---------- quick phase index ------------------------------- */}
      <motion.div variants={rise} custom={5} initial="hidden" animate="show">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["cuf", "tfc", "tacevac"] as const).map((p) => (
            <Link
              key={p}
              href={`/guide?phase=${p}`}
              className="border border-line bg-panel/70 px-3 py-3 hover:border-line-strong hover:bg-panel"
            >
              <div className="font-data text-[9px] tracking-[0.25em] text-faint">TCCC</div>
              <div className="font-disp mt-1 text-sm leading-tight font-semibold tracking-[0.06em] text-ink">
                {PHASE_LABEL[p]}
              </div>
              <div className="mt-1.5 flex items-center gap-1 font-data text-[9px] tracking-[0.2em] text-acc">
                OPEN <ChevronRight size={10} />
              </div>
            </Link>
          ))}
          <Link
            href="/medevac"
            className="border border-danger/50 bg-danger/10 px-3 py-3 hover:bg-danger/20"
          >
            <div className="font-data text-[9px] tracking-[0.25em] text-danger/70">SUSTAINMENT</div>
            <div className="font-disp mt-1 text-sm leading-tight font-semibold tracking-[0.06em] text-danger">
              REQUEST EVACUATION
            </div>
            <div className="mt-1.5 flex items-center gap-1 font-data text-[9px] tracking-[0.2em] text-danger">
              <ShieldCheck size={10} /> ENCRYPTED
            </div>
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
