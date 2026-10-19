"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Cross,
  ListOrdered,
  OctagonAlert,
  PersonStanding,
  Timer,
  TriangleAlert,
} from "lucide-react";
import { EmptyState, Pill } from "@/components/ui";
import { apiGet, loadCachedProtocols } from "@/lib/client/net";
import { PHASE_LABEL } from "@/lib/domain";
import type { ProtocolDTO } from "@/lib/types";

function fmtElapsed(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `T+${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function ProtocolPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const [protocol, setProtocol] = useState<ProtocolDTO | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<"steps" | "full">("steps");
  const [idx, setIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiGet<{ protocols: ProtocolDTO[] }>("/api/protocols");
      let list: ProtocolDTO[] | null = null;
      if (res.ok && res.data) list = res.data.protocols;
      else list = loadCachedProtocols<ProtocolDTO[]>()?.data ?? null;
      if (cancelled) return;
      const found = list?.find((p) => p.slug === slug) ?? null;
      setProtocol(found);
      setNotFound(!found);
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // session timer
  useEffect(() => {
    const iv = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const total = protocol?.steps.length ?? 0;
  const next = () => {
    if (idx >= total - 1) setDone(true);
    else setIdx((i) => Math.min(total - 1, i + 1));
  };
  const prev = () => setIdx((i) => Math.max(0, i - 1));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (mode !== "steps" || !protocol) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, protocol, idx, total]);

  const step = useMemo(() => protocol?.steps[idx] ?? null, [protocol, idx]);

  if (notFound) {
    return (
      <EmptyState
        title="PROTOCOL NOT AVAILABLE"
        sub="NOT IN LIBRARY OR CACHE — SYNC WHEN LINK IS RESTORED"
      />
    );
  }

  if (!protocol) {
    return (
      <div className="py-20 text-center font-data text-[11px] tracking-[0.25em] text-faint">
        LOADING PROTOCOL …
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/guide"
          className="font-data flex items-center gap-1 text-[11px] tracking-[0.2em] text-dim hover:text-acc"
        >
          <ChevronLeft size={14} /> PROTOCOL LIBRARY
        </Link>
        <div className="flex items-center gap-2">
          <span className="font-data flex items-center gap-1.5 border border-line bg-panel2 px-2.5 py-1 text-[11px] tracking-[0.1em] text-acc">
            <Timer size={11} />
            {fmtElapsed(elapsed)}
          </span>
          <div className="flex gap-1 border border-line bg-panel2 p-0.5">
            <button
              onClick={() => setMode("steps")}
              className={`px-2.5 py-1 font-data text-[10px] tracking-[0.15em] ${mode === "steps" ? "bg-acc text-bg0" : "text-dim"}`}
            >
              <PersonStanding size={11} className="mr-1 -mt-0.5 inline" />
              HANDS-FREE
            </button>
            <button
              onClick={() => setMode("full")}
              className={`px-2.5 py-1 font-data text-[10px] tracking-[0.15em] ${mode === "full" ? "bg-acc text-bg0" : "text-dim"}`}
            >
              <ListOrdered size={11} className="mr-1 -mt-0.5 inline" />
              FULL TEXT
            </button>
          </div>
        </div>
      </header>

      <div className="border border-line bg-panel/70 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone="idle">{PHASE_LABEL[protocol.phase] ?? protocol.phase}</Pill>
          <Pill tone="ok">{protocol.category.toUpperCase()}</Pill>
          {protocol.medicOnly && <Pill tone="warn">MEDIC SCOPE ONLY</Pill>}
          <Pill tone="dim">≈{Math.round(protocol.estSec / 60) || 1} MIN</Pill>
        </div>
        <h1 className="font-disp mt-2.5 text-2xl leading-tight font-bold tracking-[0.03em] text-ink sm:text-3xl">
          {protocol.title}
        </h1>
        <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-dim">{protocol.summary}</p>
      </div>

      {mode === "steps" ? (
        <>
          {/* progress rail */}
          <div className="flex gap-1">
            {protocol.steps.map((_, i) => (
              <button
                key={i}
                onClick={() => {
                  setDone(false);
                  setIdx(i);
                }}
                aria-label={`step ${i + 1}`}
                className={`h-1.5 flex-1 transition-colors ${i <= idx && !done ? "bg-acc" : "bg-panel2 border border-line"}`}
              />
            ))}
          </div>

          <div className="t-corners relative min-h-[300px] border border-line bg-panel p-5 sm:p-8">
            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex min-h-[260px] flex-col items-center justify-center text-center"
                >
                  <div className="font-data text-[11px] tracking-[0.3em] text-acc">
                    PROTOCOL COMPLETE — {fmtElapsed(elapsed)}
                  </div>
                  <div className="font-disp mt-3 text-3xl font-bold tracking-wide text-ink">
                    REASSESS YOUR CASUALTY
                </div>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-dim">
                    Interventions drift under load. Recheck dressings, tourniquets and
                    airway — then report the casualty on the net.
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2">
                    <button
                      onClick={() => {
                        setIdx(0);
                        setDone(false);
                        setElapsed(0);
                      }}
                      className="font-disp border border-line bg-panel2 px-5 py-3 text-sm font-bold tracking-[0.15em] text-dim hover:text-acc"
                    >
                      RESTART PROTOCOL
                    </button>
                    <Link
                      href="/medevac"
                      className="font-disp flex items-center gap-2 border border-danger/60 bg-danger/15 px-5 py-3 text-sm font-bold tracking-[0.15em] text-danger hover:bg-danger/25"
                    >
                      <Cross size={15} /> SEND 9-LINE
                    </Link>
                  </div>
                </motion.div>
              ) : (
                step && (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -24 }}
                    transition={{ duration: 0.22 }}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-data text-[11px] tracking-[0.3em] text-faint">
                        STEP {String(idx + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
                      </div>
                      <div className="font-data text-[10px] tracking-[0.2em] text-faint">
                        {(protocol.warnings ?? []).length > 0 && idx === 0 ? "READ WARNINGS FIRST" : ""}
                      </div>
                    </div>
                    <h2 className="font-disp mt-4 text-3xl leading-none font-bold tracking-[0.03em] text-acc sm:text-4xl">
                      {step.t}
                    </h2>
                    <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink sm:text-xl">
                      {step.d}
                    </p>
                  </motion.div>
                )
              )}
            </AnimatePresence>
          </div>

          {/* giant glove-friendly controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={prev}
              disabled={idx === 0 || done}
              className="font-disp flex min-h-[64px] items-center justify-center gap-2 border border-line bg-panel2 text-lg font-bold tracking-[0.15em] text-dim transition-colors disabled:opacity-30 hover:not-disabled:text-acc"
            >
              <ChevronLeft size={22} /> PREV
            </button>
            <button
              onClick={next}
              className={`font-disp flex min-h-[64px] items-center justify-center gap-2 border text-lg font-bold tracking-[0.15em] transition-colors ${
                done
                  ? "border-line bg-panel2 text-faint"
                  : idx >= total - 1
                    ? "border-acc bg-acc text-bg0"
                    : "border-line-strong bg-panel text-acc hover:bg-panel2"
              }`}
            >
              {done ? "COMPLETE" : idx >= total - 1 ? "FINISH" : "NEXT STEP"} <ChevronRight size={22} />
            </button>
          </div>
          <p className="text-center font-data text-[10px] tracking-[0.25em] text-faint">
            ARROW KEYS / SPACE ALSO ADVANCE — GLOVE-FRIENDLY TARGETS
          </p>
        </>
      ) : (
        <ol className="space-y-3">
          {protocol.steps.map((s, i) => (
            <li key={i} className="t-corners border border-line bg-panel/70 p-4 sm:p-5">
              <div className="font-data text-[10px] tracking-[0.3em] text-faint">
                STEP {String(i + 1).padStart(2, "0")}
              </div>
              <div className="font-disp mt-1 text-xl font-bold tracking-wide text-acc">{s.t}</div>
              <p className="mt-2 text-[15px] leading-relaxed text-ink">{s.d}</p>
            </li>
          ))}
        </ol>
      )}

      {/* warnings */}
      {protocol.warnings.length > 0 && (
        <div className="border border-danger/50 bg-danger/8 p-4 sm:p-5">
          <div className="font-disp flex items-center gap-2 text-sm font-bold tracking-[0.15em] text-danger">
            <TriangleAlert size={15} /> DO NOT
          </div>
          <ul className="mt-2.5 space-y-2">
            {protocol.warnings.map((w, i) => (
              <li key={i} className="flex items-start gap-2 text-[14px] leading-relaxed text-ink">
                <OctagonAlert size={14} className="mt-0.5 shrink-0 text-danger" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
