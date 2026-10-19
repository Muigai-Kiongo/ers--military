"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Bomb,
  Car,
  Check,
  Crosshair,
  Eye,
  Flame,
  Loader2,
  Radiation,
  RefreshCw,
  Send,
  Siren,
  TriangleAlert,
} from "lucide-react";
import { useMe } from "@/components/Shell";
import { EmptyState, Pill, Seg, incidentStatusTone, severityTone } from "@/components/ui";
import { acquireFix, toGrid, usePoll, type GeoFix } from "@/lib/client/hooks";
import { apiGet, transmit } from "@/lib/client/net";
import { INCIDENT_STATUS_LABEL, INCIDENT_TYPE_LABEL, timeAgo } from "@/lib/domain";
import type { IncidentDTO } from "@/lib/types";

const TYPES = [
  { id: "ied", label: "IED / ERW", icon: Bomb },
  { id: "enemy", label: "ENEMY MVT", icon: Eye },
  { id: "fire", label: "FIRE", icon: Flame },
  { id: "uxo", label: "UXO", icon: TriangleAlert },
  { id: "accident", label: "ACCIDENT", icon: Car },
  { id: "chem", label: "CBRN", icon: Radiation },
  { id: "other", label: "OTHER", icon: Siren },
] as const;

const TYPE_ICONS: Record<string, (props: { size?: number }) => React.ReactNode> = {
  ied: (p) => <Bomb {...p} />,
  enemy: (p) => <Eye {...p} />,
  fire: (p) => <Flame {...p} />,
  uxo: (p) => <TriangleAlert {...p} />,
  accident: (p) => <Car {...p} />,
  chem: (p) => <Radiation {...p} />,
  other: (p) => <Siren {...p} />,
};

export default function ReportPage() {
  const me = useMe();
  const [type, setType] = useState<string>("ied");
  const [severity, setSeverity] = useState<string>("high");
  const [text, setText] = useState("");
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [grid, setGrid] = useState("");
  const [gridOverride, setGridOverride] = useState("");
  const [locating, setLocating] = useState(false);
  const [sending, setSending] = useState(false);
  const [flash, setFlash] = useState<{ ok: boolean; msg: string } | null>(null);
  const tried = useRef(false);

  const { data, refresh } = usePoll(
    async () => (await apiGet<{ incidents: IncidentDTO[] }>("/api/incidents")).data,
    5000,
  );
  const recent = (data?.incidents ?? []).filter((i) => i.reporterCallSign === me?.callSign).slice(0, 5);

  const locate = useCallback(async () => {
    setLocating(true);
    try {
      const f = await acquireFix();
      setFix(f);
      setGrid(await toGrid(f.lat, f.lng));
    } catch {
      /* manual entry fallback */
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (tried.current) return;
    tried.current = true;
    void locate();
  }, [locate]);

  const effGrid = gridOverride.trim() ? gridOverride.trim().toUpperCase() : grid;

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setFlash(null);
    const res = await transmit("/api/incidents", {
      type,
      severity,
      grid: effGrid || "GRID UNAVAILABLE",
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      description: text,
    }, `${INCIDENT_TYPE_LABEL[type]} ${severity.toUpperCase()}`);
    if (res.ok) {
      setFlash({ ok: true, msg: "REPORT TRANSMITTED — COC AND NEARBY UNITS NOTIFIED" });
      setText("");
      void refresh();
    } else if (res.queued) {
      setFlash({ ok: true, msg: "LINK DEGRADED — REPORT QUEUED, WILL AUTOSYNC" });
      setText("");
    } else {
      setFlash({ ok: false, msg: res.error ?? "REJECTED BY NET" });
    }
    setSending(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <div className="font-data flex items-center gap-2 text-[10px] tracking-[0.3em] text-warn">
          <Siren size={12} /> SUPPLEMENTARY NET — OFF PRIMARY RADIO FREQ
        </div>
        <h1 className="font-disp mt-1 text-3xl font-bold tracking-[0.05em] text-ink">HAZARD / INCIDENT REPORT</h1>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-dim">
          Transmit once. Nearby units and the COC see it instantly on the board — no radio queue, no wait for net control.
        </p>
      </header>

      <section className="t-corners border border-line bg-panel p-4 sm:p-5">
        <div className="font-data text-[10px] tracking-[0.25em] text-faint">HAZARD TYPE</div>
        <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-7">
          {TYPES.map((t) => {
            const Icon = t.icon;
            const active = type === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={`flex flex-col items-center gap-1.5 border px-1 py-3 transition-colors ${
                  active ? "border-warn bg-warn/15 text-warn" : "border-line bg-panel2/60 text-dim hover:bg-panel2"
                }`}
              >
                <Icon size={20} strokeWidth={1.75} />
                <span className="font-disp text-[9px] font-bold tracking-[0.08em]">{t.label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="font-data text-[10px] tracking-[0.25em] text-faint">SEVERITY</div>
          <Seg
            className="mt-2"
            size="lg"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: "low", label: "LOW" },
              { value: "medium", label: "MEDIUM" },
              { value: "high", label: "HIGH", tone: "warn" },
              { value: "critical", label: "CRITICAL", tone: "danger" },
            ]}
          />
        </div>

        <div className="mt-5">
          <div className="font-data flex items-center justify-between text-[10px] tracking-[0.25em] text-faint">
            <span>GRID</span>
            <button onClick={locate} className="flex items-center gap-1 text-acc hover:text-acc2">
              {locating ? <Loader2 size={11} className="animate-spin" /> : <Crosshair size={11} />}
              {effGrid ? "RE-ACQUIRE" : "ACQUIRE"}
            </button>
          </div>
          <div className="mt-2 border border-line bg-bg1 px-3 py-2.5 text-center">
            <span className="font-data text-xl font-bold tracking-[0.1em] text-acc">{effGrid || "— NO FIX —"}</span>
          </div>
          <input
            value={gridOverride}
            onChange={(e) => setGridOverride(e.target.value)}
            placeholder="MANUAL GRID OVERRIDE"
            className="font-data mt-2 w-full border border-line bg-panel2 px-3 py-2.5 text-[12px] tracking-[0.1em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
        </div>

        <div className="mt-5">
          <div className="font-data text-[10px] tracking-[0.25em] text-faint">SITUATION — BE SPECIFIC, BE BRIEF</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder="E.G. COMMAND-WIRE IED LOCATED RTE ATHENA KM 4.2. CORDON SET 300M. EOD REQUESTED."
            className="font-data mt-2 w-full border border-line bg-panel2 px-3 py-3 text-[13px] leading-relaxed tracking-[0.04em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
          <div className="font-data mt-1 flex justify-between text-[10px] tracking-[0.1em] text-faint">
            <span>UPPERCASE IS FINE — TRANSMITTED AS-IS</span>
            <span className={text.length < 4 ? "text-warn" : "text-acc"}>{text.length} CHAR</span>
          </div>
        </div>

        <AnimatePresence>
          {flash && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-4 flex items-center gap-2 border px-3 py-2.5 font-data text-[12px] tracking-[0.06em] ${
                flash.ok ? "border-line-strong bg-acc/10 text-acc" : "border-danger/50 bg-danger/10 text-danger"
              }`}
            >
              {flash.ok ? <Check size={14} /> : <TriangleAlert size={14} />}
              {flash.msg}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={submit}
          disabled={sending || text.trim().length < 4}
          className="font-disp mt-5 flex w-full items-center justify-center gap-2.5 border border-warn bg-warn py-3.5 text-lg font-bold tracking-[0.2em] text-bg0 transition-colors hover:brightness-110 disabled:opacity-40"
        >
          {sending ? <Loader2 className="animate-spin" size={19} /> : <Send size={17} />}
          {sending ? "TRANSMITTING …" : "TRANSMIT REPORT"}
        </button>
      </section>

      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="font-data text-[10px] tracking-[0.25em] text-faint">YOUR RECENT REPORTS</div>
          {me?.role !== "field" && (
            <Link href="/board" className="font-data text-[10px] tracking-[0.2em] text-acc hover:underline">
              MANAGE ON BOARD →
            </Link>
          )}
        </div>
        {recent.length === 0 ? (
          <EmptyState title="NO REPORTS YET THIS SESSION" sub="TRANSMITTED REPORTS APPEAR HERE" />
        ) : (
          <ul className="space-y-2">
            {recent.map((i) => (
              <li key={i.id} className="flex items-center gap-3 border border-line bg-panel/70 px-3.5 py-3">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center border ${severityTone(i.severity) === "danger" ? "border-danger/50 text-danger" : "border-line text-warn"}`}>
                  {(TYPE_ICONS[i.type] ?? TYPE_ICONS.other)({ size: 15 })}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-disp text-sm font-bold tracking-[0.08em] text-ink">{INCIDENT_TYPE_LABEL[i.type]}</div>
                  <div className="font-data text-[10px] tracking-[0.08em] text-faint">
                    {i.ref} · {timeAgo(i.createdAt)} · {i.grid}
                  </div>
                </div>
                <Pill tone={incidentStatusTone(i.status)}>{INCIDENT_STATUS_LABEL[i.status]}</Pill>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
