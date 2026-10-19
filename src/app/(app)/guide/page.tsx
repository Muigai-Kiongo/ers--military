"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronRight, CloudOff, Search, ShieldCheck, Timer } from "lucide-react";
import { useMe } from "@/components/Shell";
import { EmptyState, Pill } from "@/components/ui";
import { apiGet, cacheProtocols, loadCachedProtocols } from "@/lib/client/net";
import { PHASE_LABEL } from "@/lib/domain";
import type { ProtocolDTO } from "@/lib/types";

const PHASES = ["all", "cuf", "tfc", "tacevac"] as const;

function GuideList() {
  const me = useMe();
  const sp = useSearchParams();
  const [protocols, setProtocols] = useState<ProtocolDTO[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [phase, setPhase] = useState<string>(sp.get("phase") ?? "all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await apiGet<{ protocols: ProtocolDTO[] }>("/api/protocols");
      if (cancelled) return;
      if (res.ok && res.data) {
        setProtocols(res.data.protocols);
        cacheProtocols(res.data.protocols);
        setOffline(false);
      } else {
        const cached = loadCachedProtocols<ProtocolDTO[]>();
        if (cached) {
          setProtocols(cached.data);
          setOffline(true);
        }
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return protocols.filter((p) => {
      if (phase !== "all" && p.phase !== phase) return false;
      if (!ql) return true;
      return (
        p.title.toLowerCase().includes(ql) ||
        p.category.toLowerCase().includes(ql) ||
        p.summary.toLowerCase().includes(ql)
      );
    });
  }, [protocols, q, phase]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-data text-[10px] tracking-[0.3em] text-faint">
            TACTICAL COMBAT CASUALTY CARE
          </div>
          <h1 className="font-disp mt-0.5 text-3xl font-bold tracking-[0.05em] text-ink">
            TCCC PROTOCOL LIBRARY
          </h1>
        </div>
        <Pill tone={offline ? "warn" : "ok"}>
          {offline ? <CloudOff size={11} /> : <ShieldCheck size={11} />}
          {offline ? "OFFLINE CACHE — READY" : "LIBRARY SYNCED · OFFLINE-READY"}
        </Pill>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-faint" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="SEARCH: tourniquet, airway, burns, shock …"
            className="font-data w-full border border-line bg-panel2 py-3 pr-3 pl-9 text-sm text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <div className="flex gap-1 border border-line bg-panel2 p-1">
          {PHASES.map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`font-disp grow px-3 py-2 text-[12px] font-semibold tracking-[0.12em] transition-colors sm:grow-0 ${
                phase === p ? "bg-acc text-bg0" : "text-dim hover:text-acc"
              }`}
            >
              {p === "all" ? "ALL" : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-16 text-center font-data text-[11px] tracking-[0.25em] text-faint">
          RETRIEVING PROTOCOL LIBRARY …
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState title="NO PROTOCOLS MATCH" sub="ADJUST SEARCH OR PHASE FILTER" />
      ) : (
        <ul className="space-y-2.5">
          {filtered.map((p, i) => {
            const locked = p.medicOnly && me?.role === "field";
            return (
              <motion.li
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.04, 0.3), duration: 0.35 }}
              >
                <Link
                  href={`/guide/${p.slug}`}
                  className="t-corners group block border border-line bg-panel/70 px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-panel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-data text-[9px] tracking-[0.25em] text-faint">
                          {PHASE_LABEL[p.phase] ?? p.phase.toUpperCase()}
                        </span>
                        <span className="font-data text-[9px] tracking-[0.25em] text-acc">
                          {p.category.toUpperCase()}
                        </span>
                        {p.medicOnly && (
                          <span className="border border-warn/40 bg-warn/10 px-1.5 font-data text-[9px] tracking-[0.2em] text-warn">
                            MEDIC SCOPE
                          </span>
                        )}
                      </div>
                      <div className="font-disp mt-1 text-lg leading-tight font-semibold tracking-[0.04em] text-ink group-hover:text-acc">
                        {p.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-[12px] leading-snug text-dim">
                        {p.summary}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <div className="font-data flex items-center gap-1 text-[10px] tracking-[0.1em] text-dim">
                        <Timer size={10} />~{Math.round(p.estSec / 60) || 1} MIN
                      </div>
                      <div className="font-data text-[10px] tracking-[0.1em] text-faint">
                        {p.steps.length} STEPS
                      </div>
                      <ChevronRight size={16} className="text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-acc" />
                    </div>
                  </div>
                </Link>
              </motion.li>
            );
          })}
        </ul>
      )}

      {me?.role === "field" && (
        <p className="font-data px-1 text-[10px] leading-relaxed tracking-[0.1em] text-faint uppercase">
          CLS scope shown. MEDIC-SCOPE protocols are issued to 68W personnel — route casualties to a medic when available.
        </p>
      )}
    </div>
  );
}

export default function GuidePage() {
  return (
    <Suspense>
      <GuideList />
    </Suspense>
  );
}
