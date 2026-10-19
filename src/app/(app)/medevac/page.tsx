"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Cross,
  Crosshair,
  Loader2,
  MapPin,
  RefreshCw,
  Send,
} from "lucide-react";
import { useMe } from "@/components/Shell";
import { Stepper } from "@/components/ui";
import { acquireFix, toGrid, type GeoFix } from "@/lib/client/hooks";
import { transmit } from "@/lib/client/net";
import {
  LINE4_EQUIPMENT,
  LINE6_SECURITY,
  LINE7_MARKING,
  LINE8_NATIONALITY,
  LINE9_NBC,
  PHONETIC,
  clockZulu,
} from "@/lib/domain";
import type { AlertPayload } from "@/lib/types";

const MECHANISMS = ["GSW", "BLAST / FRAG", "IED", "BURN", "CRUSH", "FALL", "MVA", "CHEM", "OTHER"];

const WIZARD_STEPS = [
  { id: "site", label: "PICKUP SITE" },
  { id: "patients", label: "PATIENTS" },
  { id: "params", label: "SITE DETAIL" },
  { id: "mist", label: "CASUALTY" },
  { id: "review", label: "TRANSMIT" },
] as const;

function OptionList<T extends string>({
  options,
  value,
  onChange,
}: {
  options: Record<T, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="space-y-1.5">
      {(Object.entries(options) as [T, string][]).map(([k, label]) => {
        const active = value === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => onChange(k)}
            className={`flex w-full items-center gap-3 border px-3.5 py-3 text-left transition-colors ${
              active ? "border-acc bg-acc/10" : "border-line bg-panel2/50 hover:bg-panel2"
            }`}
          >
            <span
              className={`font-data flex h-8 w-8 shrink-0 items-center justify-center border text-sm font-bold ${
                active ? "border-acc bg-acc text-bg0" : "border-line-strong text-acc"
              }`}
            >
              {k}
            </span>
            <span className={`font-disp text-[15px] font-semibold tracking-[0.08em] ${active ? "text-ink" : "text-dim"}`}>
              {label}
            </span>
            {active && <Check size={16} className="ml-auto text-acc" />}
          </button>
        );
      })}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-data text-[10px] tracking-[0.25em] text-faint">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function MedevacWizard() {
  const me = useMe();
  const [step, setStep] = useState(0);
  const [fix, setFix] = useState<GeoFix | null>(null);
  const [grid, setGrid] = useState("");
  const [gridOverride, setGridOverride] = useState("");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState<string | null>(null);

  const [line2, setLine2] = useState("");
  const [line3, setLine3] = useState({ A: 1, B: 0, C: 0, D: 0, E: 0 });
  const [line5, setLine5] = useState({ L: 1, A: 0 });
  const [line4, setLine4] = useState("A");
  const [line6, setLine6] = useState("N");
  const [line7, setLine7] = useState("C");
  const [line8, setLine8] = useState("A");
  const [line9, setLine9] = useState("X");
  const [mech, setMech] = useState("GSW");
  const [injuries, setInjuries] = useState("");
  const [signs, setSigns] = useState("");
  const [treatment, setTreatment] = useState("");

  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ref: string; queued: boolean; at: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const triedAuto = useRef(false);

  useEffect(() => {
    if (me && !line2) setLine2(`FM 36.375 / ${me.callSign}`);
  }, [me, line2]);

  const locate = useCallback(async () => {
    setLocating(true);
    setLocError(null);
    try {
      const f = await acquireFix();
      setFix(f);
      setGrid(await toGrid(f.lat, f.lng));
      setGridOverride("");
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "POSITION FIX FAILED — ENTER GRID MANUALLY");
    } finally {
      setLocating(false);
    }
  }, []);

  useEffect(() => {
    if (triedAuto.current) return;
    triedAuto.current = true;
    void locate();
  }, [locate]);

  const line1 = gridOverride.trim() ? gridOverride.trim().toUpperCase() : grid;
  const patients = line3.A + line3.B + line3.C + line3.D + line3.E;

  // keep line5 sensible: litter >= non-ambulatory unless edited
  const line5Valid = line5.L + line5.A === patients;

  const canNext = useMemo(() => {
    if (step === 0) return line1.length >= 4 && line2.trim().length >= 3;
    if (step === 1) return patients > 0 && line5Valid;
    return true;
  }, [step, line1, line2, patients, line5Valid]);

  const phoneticGrid = useMemo(
    () =>
      line1
        .replace(/\s+/g, " ")
        .split("")
        .map((ch) => (PHONETIC[ch as keyof typeof PHONETIC] ? PHONETIC[ch as keyof typeof PHONETIC] : ch))
        .join(" "),
    [line1],
  );

  const submit = async () => {
    if (sending) return;
    setSending(true);
    setError(null);
    const payload: AlertPayload = {
      line1,
      lat: fix?.lat ?? null,
      lng: fix?.lng ?? null,
      line2: line2.trim().toUpperCase(),
      line3,
      line4,
      line5,
      line6,
      line7,
      line8,
      line9,
      mist: {
        mechanism: `${mech}${injuries ? "" : " — DETAILS PENDING"}`,
        injuries: injuries.trim().toUpperCase() || "UNSPECIFIED",
        signs: signs.trim().toUpperCase() || "NOT REPORTED",
        treatment: treatment.trim().toUpperCase() || "NONE YET",
      },
    };
    const res = await transmit<{ alert?: { alertRef: string } }>("/api/alerts", payload, `9-LINE ${patients}PT`);
    if (res.ok && res.data?.alert) {
      setResult({ ref: res.data.alert.alertRef, queued: false, at: clockZulu(new Date()) });
    } else if (res.queued) {
      setResult({ ref: "QUEUED", queued: true, at: clockZulu(new Date()) });
    } else {
      setError(res.error ?? "TRANSMISSION REJECTED");
    }
    setSending(false);
  };

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`t-corners border p-6 text-center sm:p-10 ${result.queued ? "border-warn/60 bg-warn/5" : "border-line bg-panel"}`}
        >
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center border ${result.queued ? "border-warn bg-warn/15 text-warn" : "border-acc bg-acc/15 text-acc"}`}
          >
            {result.queued ? <RefreshCw size={28} /> : <Check size={32} strokeWidth={2.5} />}
          </div>
          <div className="font-data mt-6 text-[10px] tracking-[0.35em] text-faint">
            {result.queued ? "LINK DEGRADED — TRANSMISSION QUEUED" : "TRANSMISSION CONFIRMED"}
          </div>
          <h1 className="font-disp mt-2 text-3xl font-bold tracking-[0.08em] text-ink">
            {result.queued ? "WILL SEND WHEN LINK RESTORED" : `9-LINE ${result.ref} ON THE NET`}
          </h1>
          <p className="font-data mt-3 text-[11px] tracking-[0.12em] text-dim">
            {result.at} · {result.queued ? "STORED LOCALLY, ENCRYPTED, AUTOSYNC ACTIVE" : "COC NOTIFIED — MONITOR BOARD FOR ACK"}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/board"
              className="font-disp border border-line-strong bg-panel2 px-6 py-3 text-sm font-bold tracking-[0.15em] text-acc hover:bg-panel"
            >
              OPEN SITUATION BOARD
            </Link>
            <button
              onClick={() => {
                setResult(null);
                setStep(0);
              }}
              className="font-disp border border-danger/60 bg-danger/10 px-6 py-3 text-sm font-bold tracking-[0.15em] text-danger hover:bg-danger/20"
            >
              NEW 9-LINE
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <header>
        <div className="flex items-center justify-between gap-2">
          <div className="font-data flex items-center gap-2 text-[10px] tracking-[0.3em] text-danger">
            <Cross size={12} /> URGENT TRAFFIC — MEDICAL EVACUATION REQUEST
          </div>
          <div className="font-data text-[10px] tracking-[0.2em] text-faint">
            STEP {step + 1}/{WIZARD_STEPS.length}
          </div>
        </div>
        <h1 className="font-disp mt-1 text-3xl font-bold tracking-[0.05em] text-ink">9-LINE MEDEVAC</h1>
        <div className="mt-2 flex gap-1">
          {WIZARD_STEPS.map((s, i) => (
            <div key={s.id} className={`h-1 flex-1 ${i <= step ? "bg-danger" : "border border-line bg-panel2"}`} />
          ))}
        </div>
      </header>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 22 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -22 }}
          transition={{ duration: 0.2 }}
          className="t-corners border border-line bg-panel p-5 sm:p-6"
        >
          {/* ---------------- STEP 0: SITE ------------------------- */}
          {step === 0 && (
            <div className="space-y-5">
              <div>
                <div className="font-disp text-lg font-bold tracking-[0.1em] text-acc">LINE 1 — PICKUP SITE GRID</div>
                <p className="mt-1 text-[13px] text-dim">Auto-acquire your terminal position as an MGRS grid. Accuracy ± displayed.</p>
              </div>
              <div className="grid-bg relative border border-line bg-bg1 p-4 text-center">
                <div className="font-data text-[10px] tracking-[0.3em] text-faint">MGRS GRID — 10 DIGIT</div>
                <div className="font-data mt-2 min-h-[44px] text-3xl font-bold tracking-[0.08em] text-acc sm:text-4xl">
                  {locating ? (
                    <span className="inline-flex items-center gap-2 text-xl text-dim">
                      <Loader2 className="animate-spin" size={20} /> ACQUIRING FIX …
                    </span>
                  ) : (
                    line1 || "— NO FIX —"
                  )}
                </div>
                <div className="font-data mt-1 text-[10px] tracking-[0.15em] text-dim">
                  {fix ? `±${Math.round(fix.accuracy)}M · ${fix.lat.toFixed(5)}, ${fix.lng.toFixed(5)}` : "WAITING ON POSITION"}
                </div>
                {locError && <div className="font-data mt-2 text-[11px] text-warn">{locError}</div>}
                <button
                  onClick={locate}
                  disabled={locating}
                  className="font-disp mx-auto mt-3 flex items-center gap-2 border border-line-strong bg-panel2 px-4 py-2 text-[12px] font-bold tracking-[0.15em] text-acc hover:bg-panel"
                >
                  <Crosshair size={13} /> {locating ? "ACQUIRING" : "RE-ACQUIRE"}
                </button>
              </div>
              <Field label="GRID OVERRIDE (IF GPS DENIED)">
                <input
                  value={gridOverride}
                  onChange={(e) => setGridOverride(e.target.value)}
                  placeholder="E.G. 11S NV 12345 67890"
                  className="font-data w-full border border-line bg-panel2 px-3 py-3 text-sm tracking-[0.1em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                />
              </Field>
              <Field label="LINE 2 — FREQUENCY / CALLSIGN">
                <input
                  value={line2}
                  onChange={(e) => setLine2(e.target.value)}
                  placeholder="FM 36.375 / SABER MED"
                  className="font-data w-full border border-line bg-panel2 px-3 py-3 text-sm tracking-[0.1em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                />
              </Field>
            </div>
          )}

          {/* ---------------- STEP 1: PATIENTS ---------------------- */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <div className="font-disp text-lg font-bold tracking-[0.1em] text-acc">LINE 3 — PRECEDENCE COUNTS</div>
                <p className="mt-1 text-[13px] text-dim">Total patients: <span className="font-data font-bold text-ink">{patients}</span></p>
              </div>
              <div className="space-y-3">
                {(
                  [
                    ["A", "URGENT — surgical within 2h", "danger"],
                    ["B", "URGENT SURGICAL — advanced airway/bleed", "danger"],
                    ["C", "PRIORITY — care within 4h", "warn"],
                    ["D", "ROUTINE — within 24h", "idle"],
                    ["E", "CONVENIENCE — as available", "idle"],
                  ] as const
                ).map(([key, label, tone]) => (
                  <div key={key} className="flex items-center justify-between gap-3 border border-line bg-panel2/50 px-3 py-2.5">
                    <div className="flex items-center gap-3">
                      <span className={`font-data flex h-9 w-9 items-center justify-center border font-bold ${tone === "danger" ? "border-danger/60 text-danger" : tone === "warn" ? "border-warn/50 text-warn" : "border-line-strong text-acc"}`}>
                        {key}
                      </span>
                      <span className="text-[13px] font-medium text-dim">{label}</span>
                    </div>
                    <Stepper value={line3[key]} onChange={(v) => setLine3((s) => ({ ...s, [key]: v }))} />
                  </div>
                ))}
              </div>
              <div>
                <div className="font-disp text-base font-bold tracking-[0.1em] text-acc">LINE 5 — PATIENTS BY TYPE</div>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  {(
                    [
                      ["L", "LITTER"],
                      ["A", "AMBULATORY"],
                    ] as const
                  ).map(([key, label]) => (
                    <div key={key} className="flex items-center justify-between gap-2 border border-line bg-panel2/50 px-3 py-2.5">
                      <span className="font-disp text-sm font-semibold tracking-[0.1em] text-dim">
                        <span className="font-data text-acc">{key}</span> — {label}
                      </span>
                      <Stepper value={line5[key]} onChange={(v) => setLine5((s) => ({ ...s, [key]: v }))} />
                    </div>
                  ))}
                </div>
                {!line5Valid && (
                  <div className="font-data mt-2 text-[11px] tracking-[0.06em] text-warn">
                    LINE 5 TOTAL ({line5.L + line5.A}) MUST EQUAL LINE 3 TOTAL ({patients}) — A+A = {patients}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---------------- STEP 2: SITE DETAIL ------------------- */}
          {step === 2 && (
            <div className="space-y-6">
              <div>
                <div className="font-disp mb-2 text-lg font-bold tracking-[0.1em] text-acc">LINE 4 — SPECIAL EQUIPMENT</div>
                <OptionList options={LINE4_EQUIPMENT} value={line4} onChange={setLine4} />
              </div>
              <div>
                <div className="font-disp mb-2 text-lg font-bold tracking-[0.1em] text-acc">LINE 6 — SECURITY AT PICKUP</div>
                <OptionList options={LINE6_SECURITY} value={line6} onChange={setLine6} />
              </div>
              <div>
                <div className="font-disp mb-2 text-lg font-bold tracking-[0.1em] text-acc">LINE 7 — MARKING METHOD</div>
                <OptionList options={LINE7_MARKING} value={line7} onChange={setLine7} />
              </div>
            </div>
          )}

          {/* ---------------- STEP 3: CASUALTY / MIST --------------- */}
          {step === 3 && (
            <div className="space-y-6">
              <div>
                <div className="font-disp mb-2 text-lg font-bold tracking-[0.1em] text-acc">LINE 8 — PATIENT STATUS</div>
                <OptionList options={LINE8_NATIONALITY} value={line8} onChange={setLine8} />
              </div>
              <div>
                <div className="font-disp mb-2 text-lg font-bold tracking-[0.1em] text-acc">LINE 9 — CBRN CONTAMINATION</div>
                <OptionList options={LINE9_NBC} value={line9} onChange={setLine9} />
              </div>
              <div className="border-t border-line pt-5">
                <div className="font-disp text-lg font-bold tracking-[0.1em] text-acc">MIST REPORT</div>
                <div className="mt-3 space-y-4">
                  <Field label="M — MECHANISM OF INJURY">
                    <div className="flex flex-wrap gap-1.5">
                      {MECHANISMS.map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMech(m)}
                          className={`font-data border px-3 py-2 text-[11px] tracking-[0.08em] ${mech === m ? "border-acc bg-acc text-bg0 font-bold" : "border-line bg-panel2 text-dim hover:text-acc"}`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </Field>
                  <Field label="I — INJURIES FOUND / SUSPECTED">
                    <textarea
                      value={injuries}
                      onChange={(e) => setInjuries(e.target.value)}
                      rows={2}
                      placeholder="E.G. TRAUMATIC AMPUTATION L LEG, FRAG WOUNDS R ARM"
                      className="font-data w-full border border-line bg-panel2 px-3 py-2.5 text-[13px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                    />
                  </Field>
                  <Field label="S — SIGNS / VITALS">
                    <textarea
                      value={signs}
                      onChange={(e) => setSigns(e.target.value)}
                      rows={2}
                      placeholder="E.G. HR 122, WEAK RADIAL PULSE, ALERT"
                      className="font-data w-full border border-line bg-panel2 px-3 py-2.5 text-[13px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                    />
                  </Field>
                  <Field label="T — TREATMENT GIVEN">
                    <textarea
                      value={treatment}
                      onChange={(e) => setTreatment(e.target.value)}
                      rows={2}
                      placeholder="E.G. TQ HIGH R THIGH 0946Z, WOUND PACKED, HPMK"
                      className="font-data w-full border border-line bg-panel2 px-3 py-2.5 text-[13px] tracking-[0.05em] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
                    />
                  </Field>
                </div>
              </div>
            </div>
          )}

          {/* ---------------- STEP 4: REVIEW / TRANSMIT -------------- */}
          {step === 4 && (
            <div className="space-y-5">
              <div className="font-disp text-lg font-bold tracking-[0.1em] text-acc">FINAL READBACK — VERIFY BEFORE TRANSMIT</div>
              <div className="border border-line-strong bg-bg1 p-4">
                <pre className="font-data text-[12px] leading-[1.9] whitespace-pre-wrap text-ink sm:text-[13px]">
{`LINE 1  GRID........ ${line1}
        SPOKEN...... ${phoneticGrid}
LINE 2  FREQ/CS..... ${line2.toUpperCase()}
LINE 3  PRECEDENCE.. A:${line3.A} B:${line3.B} C:${line3.C} D:${line3.D} E:${line3.E}
LINE 4  EQUIPMENT... ${line4} — ${LINE4_EQUIPMENT[line4]}
LINE 5  BY TYPE..... LITTER ${line5.L} / AMBULATORY ${line5.A}
LINE 6  SECURITY.... ${line6} — ${LINE6_SECURITY[line6]}
LINE 7  MARKING..... ${line7} — ${LINE7_MARKING[line7]}
LINE 8  STATUS...... ${line8} — ${LINE8_NATIONALITY[line8]}
LINE 9  CBRN........ ${line9} — ${LINE9_NBC[line9]}
MIST    ${mech} / ${injuries || "—"} / ${signs || "—"} / ${treatment || "—"}`}
                </pre>
              </div>
              <div className="flex items-center gap-2 border border-line bg-panel2 px-3 py-2 font-data text-[10px] tracking-[0.15em] text-dim">
                <MapPin size={11} className="text-acc" />
                ENCRYPTED AES-256-GCM · REQUESTER {me?.rank} {me?.callSign} · {me?.unitCode}
              </div>
              {error && (
                <div className="border border-danger/50 bg-danger/10 px-3 py-2 font-data text-[12px] tracking-[0.08em] text-danger">
                  {error}
                </div>
              )}
              <button
                onClick={submit}
                disabled={sending}
                className="sos-pulse font-disp flex w-full items-center justify-center gap-3 border border-danger bg-danger py-4 text-xl font-bold tracking-[0.2em] text-dangerInk transition-colors hover:brightness-110 disabled:opacity-60"
              >
                {sending ? <Loader2 className="animate-spin" size={22} /> : <Send size={20} />}
                {sending ? "TRANSMITTING …" : "TRANSMIT 9-LINE"}
              </button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      {/* nav row */}
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="font-disp flex min-h-[58px] items-center justify-center gap-2 border border-line bg-panel2 text-base font-bold tracking-[0.15em] text-dim disabled:opacity-30 hover:not-disabled:text-acc"
        >
          <ChevronLeft size={18} /> BACK
        </button>
        <button
          onClick={() => setStep((s) => Math.min(WIZARD_STEPS.length - 1, s + 1))}
          disabled={!canNext || step === WIZARD_STEPS.length - 1}
          className="font-disp flex min-h-[58px] items-center justify-center gap-2 border border-line-strong bg-panel text-base font-bold tracking-[0.15em] text-acc disabled:opacity-30 hover:bg-panel2"
        >
          CONTINUE <ChevronRight size={18} />
        </button>
      </div>
    </div>
  );
}
