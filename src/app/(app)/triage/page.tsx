"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Plus, SquarePen } from "lucide-react";
import { useMe } from "@/components/Shell";
import { EmptyState, Pill, casualtyTone, TONE_BG } from "@/components/ui";
import { apiGet, transmit } from "@/lib/client/net";
import { usePoll } from "@/lib/client/hooks";
import { CASUALTY_STATUS_LABEL, PHASE_LABEL, timeAgo, zuluTime } from "@/lib/domain";
import type { CasualtyDTO } from "@/lib/types";

const STATUSES = ["urgent", "priority", "routine", "minimal", "expectant"] as const;
const PHASES = ["cuf", "tfc", "tacevac", "evacuated"] as const;

export default function TriagePage() {
  const me = useMe();
  const canAct = me?.role === "medic" || me?.role === "command";
  const { data, refresh } = usePoll(
    async () => (await apiGet<{ casualties: CasualtyDTO[] }>("/api/casualties")).data,
    3000,
  );
  const [noteFor, setNoteFor] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [newStatus, setNewStatus] = useState<string>("priority");
  const [newMech, setNewMech] = useState("");
  const [newNote, setNewNote] = useState("");

  const casualties = data?.casualties ?? [];

  const patch = async (id: string, body: Record<string, string>) => {
    if (busy) return;
    setBusy(true);
    await transmit(`/api/casualties/${id}`, body, "CAS UPDATE", "PATCH");
    await refresh();
    setBusy(false);
  };

  const submitNote = async (id: string) => {
    if (!noteText.trim()) {
      setNoteFor(null);
      return;
    }
    await patch(id, { note: noteText });
    setNoteText("");
    setNoteFor(null);
  };

  const createCasualty = async () => {
    if (busy || !newMech.trim()) return;
    setBusy(true);
    await transmit("/api/casualties", {
      status: newStatus,
      mechanism: newMech,
      note: newNote || "RECORD OPENED IN TRIAGE",
    }, "NEW CASUALTY");
    setShowNew(false);
    setNewMech("");
    setNewNote("");
    await refresh();
    setBusy(false);
  };

  if (!canAct) {
    return (
      <EmptyState title="TRIAGE ACCESS RESTRICTED" sub="MEDIC / COMMAND AUTHORITY REQUIRED — VIEW ON THE SITUATION BOARD" />
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-data text-[10px] tracking-[0.3em] text-faint">
            CASUALTY TRACKING — MEDICAL CHANNEL
          </div>
          <h1 className="font-disp mt-0.5 text-3xl font-bold tracking-[0.05em] text-ink">
            TRIAGE BOARD
          </h1>
        </div>
        <button
          onClick={() => setShowNew((s) => !s)}
          className="font-disp flex items-center gap-2 border border-acc bg-acc/10 px-4 py-2.5 text-[13px] font-bold tracking-[0.15em] text-acc hover:bg-acc/20"
        >
          <Plus size={15} /> NEW CASUALTY
        </button>
      </header>

      <AnimatePresence>
        {showNew && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="t-corners overflow-hidden border border-line bg-panel"
          >
            <div className="space-y-3 p-4">
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">PRECEDENCE</div>
              <div className="flex flex-wrap gap-1.5">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    onClick={() => setNewStatus(s)}
                    className={`font-disp border px-3 py-2 text-[12px] font-bold tracking-[0.1em] ${newStatus === s ? `${TONE_BG[casualtyTone(s)]} text-bg0 border-transparent` : "border-line bg-panel2 text-dim"}`}
                  >
                    {CASUALTY_STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
              <input
                value={newMech}
                onChange={(e) => setNewMech(e.target.value)}
                placeholder="MECHANISM — E.G. GSW R THIGH, BLAST, BURN"
                className="font-data w-full border border-line bg-panel2 px-3 py-2.5 text-[13px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <input
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="INITIAL NOTE (OPTIONAL)"
                className="font-data w-full border border-line bg-panel2 px-3 py-2.5 text-[13px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <button
                onClick={createCasualty}
                disabled={busy || !newMech.trim()}
                className="font-disp w-full border border-acc bg-acc py-3 text-sm font-bold tracking-[0.2em] text-bg0 disabled:opacity-40"
              >
                {busy ? "OPENING RECORD …" : "OPEN CASUALTY RECORD"}
              </button>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {casualties.length === 0 ? (
        <EmptyState title="NO CASUALTY RECORDS" sub="RECORDS OPEN AUTOMATICALLY FROM 9-LINE TRAFFIC" />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {casualties.map((c) => (
            <motion.article
              key={c.id}
              layout
              className={`t-corners border bg-panel/85 ${
                c.status === "urgent" ? "border-danger/60" : c.status === "priority" ? "border-warn/50" : "border-line"
              } ${c.phase === "evacuated" ? "opacity-60" : ""}`}
            >
              <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
                <span className="font-data text-lg font-bold tracking-[0.08em] text-ink">{c.casualtyRef}</span>
                <Pill tone={casualtyTone(c.status)} className="text-[11px]">
                  {CASUALTY_STATUS_LABEL[c.status]}
                </Pill>
                <Pill tone="dim">{PHASE_LABEL[c.phase] ?? c.phase.toUpperCase()}</Pill>
                {c.alertRef && <span className="font-data text-[10px] tracking-[0.1em] text-faint">↳ {c.alertRef}</span>}
                <span className="font-data ml-auto text-[10px] tracking-[0.1em] text-faint">
                  {c.unitCode} · {zuluTime(c.createdAt)}
                </span>
              </header>

              <div className="space-y-3 px-4 py-3">
                <div className="text-[13px] leading-relaxed text-ink">
                  <span className="font-data text-[10px] tracking-[0.2em] text-faint">MECHANISM: </span>
                  {c.mechanism}
                </div>
                {c.injuries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {c.injuries.map((inj, i) => (
                      <span key={i} className="border border-line bg-bg1 px-2 py-1 font-data text-[10px] tracking-[0.06em] text-dim">
                        {inj}
                      </span>
                    ))}
                  </div>
                )}
                <div className="text-[12px] text-dim">
                  <span className="font-data text-[10px] tracking-[0.2em] text-faint">TREATMENT: </span>
                  {c.meds}
                </div>

                {/* treatment log */}
                <div className="border border-line bg-bg1/60 px-3 py-2.5">
                  <div className="font-data text-[9px] tracking-[0.25em] text-faint">TREATMENT LOG</div>
                  <ul className="mt-1.5 space-y-1.5">
                    {c.treatmentLog.map((t, i) => (
                      <li key={i} className="flex gap-2 text-[12px] leading-snug">
                        <span className="font-data shrink-0 text-[10px] text-acc">{t.t}</span>
                        <span className="text-dim">
                          {t.note} <span className="font-data text-[10px] text-faint">— {t.by}</span>
                        </span>
                      </li>
                    ))}
                    {c.treatmentLog.length === 0 && (
                      <li className="font-data text-[11px] text-faint">NO ENTRIES YET</li>
                    )}
                  </ul>
                </div>

                {/* controls */}
                <div className="space-y-2 pt-1">
                  <div className="flex flex-wrap gap-1">
                    {STATUSES.map((s) => (
                      <button
                        key={s}
                        disabled={busy}
                        onClick={() => patch(c.id, { status: s })}
                        className={`border px-2.5 py-1.5 font-data text-[10px] tracking-[0.1em] disabled:opacity-40 ${
                          c.status === s
                            ? "border-transparent bg-panel2 text-ink shadow-[inset_0_0_0_1px_var(--line-strong)]"
                            : `${TONE_BG[casualtyTone(s)]} text-bg0 border-transparent font-bold`
                        }`}
                      >
                        {c.status === s ? CASUALTY_STATUS_LABEL[s] : `→ ${CASUALTY_STATUS_LABEL[s]}`}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {PHASES.filter((p) => p !== c.phase).map((p) => (
                      <button
                        key={p}
                        disabled={busy}
                        onClick={() => patch(c.id, { phase: p })}
                        className="border border-line bg-panel2 px-2.5 py-1.5 font-data text-[10px] tracking-[0.08em] text-dim hover:text-acc disabled:opacity-40"
                      >
                        SET {PHASE_LABEL[p]}
                      </button>
                    ))}
                    <button
                      onClick={() => setNoteFor(noteFor === c.id ? null : c.id)}
                      className="ml-auto flex items-center gap-1.5 border border-line bg-panel2 px-2.5 py-1.5 font-data text-[10px] tracking-[0.1em] text-acc"
                    >
                      <SquarePen size={11} /> LOG NOTE
                    </button>
                  </div>
                  {noteFor === c.id && (
                    <div className="flex gap-2 pt-1">
                      <input
                        autoFocus
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitNote(c.id)}
                        placeholder="E.G. TXA 2G IO 1048Z — REASSESS IN 5"
                        className="font-data flex-1 border border-line bg-panel2 px-3 py-2.5 text-[12px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                      />
                      <button
                        onClick={() => submitNote(c.id)}
                        disabled={busy}
                        className="font-disp flex items-center gap-1.5 border border-acc bg-acc px-3 text-[12px] font-bold tracking-[0.12em] text-bg0 disabled:opacity-40"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : "LOG"}
                      </button>
                    </div>
                  )}
                  <div className="font-data text-[9px] tracking-[0.1em] text-faint">
                    LAST UPDATE {timeAgo(c.updatedAt)}
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  );
}
