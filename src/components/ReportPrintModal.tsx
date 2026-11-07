"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  Bomb,
  Car,
  Check,
  Cross,
  Eye,
  FileText,
  Flame,
  Printer,
  Radiation,
  Shield,
  Siren,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
  LINE4_EQUIPMENT,
  LINE6_SECURITY,
  LINE7_MARKING,
  LINE8_NATIONALITY,
  LINE9_NBC,
  fmtGridParts,
  zuluTime,
} from "@/lib/domain";
import type { AlertDTO, IncidentDTO } from "@/lib/types";

export interface MedevacRawReport {
  ref: string;
  line1: string;
  line2: string;
  line3: { A: number; B: number; C: number; D: number; E: number };
  line4: string;
  line5: { L: number; A: number };
  line6: string;
  line7: string;
  line8: string;
  line9: string;
  mist: {
    mechanism: string;
    injuries: string;
    signs: string;
    treatment: string;
  };
  requesterCallSign?: string;
  requesterRank?: string;
  unitCode?: string;
  createdAt?: string;
}

export interface ReportPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  incident?: IncidentDTO | null;
  incidentList?: IncidentDTO[] | null;
  alert?: AlertDTO | null;
  medevacRaw?: MedevacRawReport | null;
  title?: string;
  autoPrint?: boolean;
}

const TYPE_ICONS: Record<string, (props: { size?: number; className?: string }) => React.ReactNode> = {
  ied: (p) => <Bomb {...p} />,
  enemy: (p) => <Eye {...p} />,
  fire: (p) => <Flame {...p} />,
  uxo: (p) => <TriangleAlert {...p} />,
  accident: (p) => <Car {...p} />,
  chem: (p) => <Radiation {...p} />,
  other: (p) => <Siren {...p} />,
};

function formatDTG(isoString: string): string {
  try {
    const d = new Date(isoString);
    if (Number.isNaN(d.getTime())) return "UNKNOWN DTG";
    const dd = String(d.getUTCDate()).padStart(2, "0");
    const hh = String(d.getUTCHours()).padStart(2, "0");
    const mm = String(d.getUTCMinutes()).padStart(2, "0");
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const mon = months[d.getUTCMonth()];
    const yyyy = d.getUTCFullYear();
    return `${dd}${hh}${mm}Z ${mon} ${yyyy}`;
  } catch {
    return isoString;
  }
}

const emptySubscribe = () => () => {};

export function ReportPrintModal({
  isOpen,
  onClose,
  incident,
  incidentList,
  alert,
  medevacRaw,
  title,
  autoPrint = false,
}: ReportPrintModalProps) {
  const isClient = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const [paperTheme, setPaperTheme] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    document.body.classList.add("has-print-modal");
    return () => {
      document.body.classList.remove("has-print-modal");
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        window.print();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen && autoPrint) {
      const timer = setTimeout(() => {
        window.print();
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoPrint]);

  if (!isClient || !isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const isList = Boolean(incidentList && incidentList.length > 0);
  const isMedevac = Boolean(alert || medevacRaw);
  const isSingleIncident = Boolean(incident && !isList && !isMedevac);

  return createPortal(
    <div id="mters-print-portal" className="relative z-50">
      {/* Backdrop */}
      <div
        className="no-print fixed inset-0 bg-black/85 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 overflow-y-auto pointer-events-none">
        <div className="pointer-events-auto flex flex-col w-full max-w-4xl max-h-[94vh] bg-panel border border-line-strong shadow-2xl overflow-hidden my-auto">
          {/* Header Controls (No-Print) */}
          <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line bg-panel2 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 items-center justify-center border border-line-strong bg-panel text-acc">
                <Printer size={15} />
              </span>
              <div>
                <div className="font-disp text-sm font-bold tracking-[0.12em] text-ink">
                  {title ?? (isList ? "TACTICAL SITREP REPORT LOG" : isMedevac ? "9-LINE MEDEVAC CARD" : "TACTICAL INCIDENT REPORT")}
                </div>
                <div className="font-data text-[10px] tracking-[0.1em] text-faint">
                  PRINT PREVIEW · READY FOR HARDCOPY TRANSMISSION & ARCHIVE
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPaperTheme((p) => !p)}
                className={`font-disp px-2.5 py-1.5 text-[11px] font-bold tracking-[0.1em] border transition-colors ${
                  paperTheme
                    ? "border-line-strong bg-white text-black"
                    : "border-line bg-panel text-dim hover:text-ink"
                }`}
                title="Toggle paper view simulation"
              >
                {paperTheme ? "PAPER PREVIEW ON" : "PREVIEW ON PAPER"}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="font-disp flex items-center gap-2 border border-acc bg-acc px-4 py-1.5 text-xs font-bold tracking-[0.15em] text-bg0 transition-colors hover:brightness-110 active:scale-95"
              >
                <Printer size={14} /> PRINT NOW
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center border border-line bg-panel text-dim hover:border-danger hover:text-danger"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Document Container */}
          <div className={`overflow-y-auto p-4 sm:p-8 flex-1 transition-colors ${paperTheme ? "bg-zinc-200" : "bg-bg1"}`}>
            <div
              className={`print-document mx-auto max-w-3xl transition-colors ${
                paperTheme
                  ? "bg-white text-zinc-950 border-2 border-zinc-900 shadow-md p-6 sm:p-8"
                  : "bg-panel border border-line p-5 sm:p-7 text-ink"
              }`}
            >
              {/* -------------------- 1. SINGLE INCIDENT REPORT -------------------- */}
              {isSingleIncident && incident && (
                <div className="space-y-4">
                  {/* Top Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[10px] tracking-[0.3em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-warn"
                    }`}
                  >
                    UNCLASSIFIED // FOR OFFICIAL USE ONLY // TACTICAL SPOTREP
                  </div>

                  {/* Header Title Block */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-current pb-3">
                    <div>
                      <div className="font-data text-[10px] tracking-[0.25em] opacity-75">
                        MILITARY TACTICAL EMERGENCY RESPONSE SYSTEM
                      </div>
                      <h1 className="font-disp text-2xl sm:text-3xl font-bold tracking-[0.06em] mt-0.5">
                        TACTICAL HAZARD / INCIDENT REPORT
                      </h1>
                      <div className="font-data text-xs tracking-wider opacity-80 mt-1">
                        STANDARDIZED SPOT REPORT (SPOTREP) · AES-256 SECURED
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-block border px-3 py-1 font-data text-base sm:text-lg font-bold tracking-widest ${
                          paperTheme ? "border-zinc-900 bg-zinc-100" : "border-acc bg-acc/10 text-acc"
                        }`}
                      >
                        REF: {incident.ref}
                      </div>
                      <div className="font-data text-[10px] tracking-wider opacity-75 mt-1">
                        STATUS: {INCIDENT_STATUS_LABEL[incident.status] ?? incident.status.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  {/* Tactical Overview Grid */}
                  <div className="print-avoid-break grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-data">
                    <div
                      className={`border p-2 ${
                        paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block opacity-70">DATE-TIME (ZULU)</span>
                      <span className="font-bold">{formatDTG(incident.createdAt)}</span>
                    </div>

                    <div
                      className={`border p-2 ${
                        paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block opacity-70">HAZARD CLASSIFICATION</span>
                      <span className="font-bold flex items-center gap-1.5 mt-0.5">
                        {(TYPE_ICONS[incident.type] ?? TYPE_ICONS.other)({ size: 14 })}
                        {INCIDENT_TYPE_LABEL[incident.type] ?? incident.type.toUpperCase()}
                      </span>
                    </div>

                    <div
                      className={`border p-2 ${
                        paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block opacity-70">SEVERITY LEVEL</span>
                      <span
                        className={`font-bold uppercase ${
                          incident.severity === "critical"
                            ? "text-red-600 dark:text-red-400"
                            : incident.severity === "high"
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-emerald-600 dark:text-emerald-400"
                        }`}
                      >
                        {incident.severity.toUpperCase()}
                      </span>
                    </div>

                    <div
                      className={`border p-2 ${
                        paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"
                      }`}
                    >
                      <span className="text-[9px] uppercase tracking-wider block opacity-70">REPORTING ELEMENT</span>
                      <span className="font-bold truncate block">
                        {incident.reporterRank} {incident.reporterCallSign} ({incident.unitCode})
                      </span>
                    </div>
                  </div>

                  {/* Location Block */}
                  <div
                    className={`print-avoid-break border p-3 font-data text-xs space-y-1.5 ${
                      paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] tracking-widest font-bold opacity-75">
                      <span>LOCATION & GRID COORDINATES</span>
                      <span>DATUM: WGS-84 / MGRS</span>
                    </div>
                    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
                      <div>
                        <span className="opacity-70 mr-1.5">MGRS GRID:</span>
                        <span className="font-bold text-sm tracking-wider">{incident.grid}</span>
                      </div>
                      {typeof incident.lat === "number" && typeof incident.lng === "number" && (
                        <div>
                          <span className="opacity-70 mr-1.5">LAT/LONG:</span>
                          <span className="font-medium">{fmtGridParts(incident.lat, incident.lng)}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Situation Narrative */}
                  <div
                    className={`print-avoid-break border p-3.5 ${
                      paperTheme ? "border-zinc-900 bg-zinc-50/50" : "border-line bg-panel2/60"
                    }`}
                  >
                    <div className="font-data text-[10px] tracking-[0.2em] font-bold opacity-75 mb-2">
                      SITUATION DESCRIPTION & DETAILS (SALUTE FORMAT)
                    </div>
                    <p className="font-data text-sm leading-relaxed whitespace-pre-wrap uppercase tracking-[0.03em]">
                      {incident.description}
                    </p>
                  </div>

                  {/* Tactical Handover & Watchstander Verification */}
                  <div className="print-avoid-break border border-current pt-2 pb-3 px-3 space-y-3">
                    <div className="font-data text-[10px] tracking-[0.2em] font-bold border-b border-current pb-1 opacity-75">
                      COC LOGBOOK & HANDOVER AUTHENTICATION
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-data">
                      <div>
                        <div className="opacity-70 text-[9px]">1. LOGGED BY OPERATOR</div>
                        <div className="font-bold mt-0.5">{incident.reporterCallSign}</div>
                        <div className="text-[10px] opacity-75">{zuluTime(incident.createdAt)}</div>
                      </div>
                      <div>
                        <div className="opacity-70 text-[9px]">2. COC WATCH OFFICER ACK</div>
                        <div className="mt-2 border-b border-current w-3/4 h-3" />
                        <div className="text-[9px] opacity-60 mt-0.5">CALL SIGN / DTG</div>
                      </div>
                      <div>
                        <div className="opacity-70 text-[9px]">3. DISPOSITION / ACTIONS DISPATCHED</div>
                        <div className="mt-2 border-b border-current w-full h-3" />
                        <div className="text-[9px] opacity-60 mt-0.5">CORDON / EOD / QRF / MEDEVAC</div>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[9px] tracking-[0.25em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-faint"
                    }`}
                  >
                    UNCLASSIFIED // FOR OFFICIAL USE ONLY // M-TERS DISPATCH NET
                  </div>
                </div>
              )}

              {/* -------------------- 2. BATCH / SITREP INCIDENT LOG -------------------- */}
              {isList && incidentList && (
                <div className="space-y-4">
                  {/* Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[10px] tracking-[0.3em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-warn"
                    }`}
                  >
                    UNCLASSIFIED // FOR OFFICIAL USE ONLY // TACTICAL SITREP
                  </div>

                  {/* Header Title Block */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-current pb-3">
                    <div>
                      <div className="font-data text-[10px] tracking-[0.25em] opacity-75">
                        MILITARY TACTICAL EMERGENCY RESPONSE SYSTEM
                      </div>
                      <h1 className="font-disp text-2xl sm:text-3xl font-bold tracking-[0.06em] mt-0.5">
                        TACTICAL INCIDENT SUMMARY REPORT (SITREP)
                      </h1>
                      <div className="font-data text-xs tracking-wider opacity-80 mt-1">
                        CONSOLIDATED INCIDENT & HAZARD LOGBOOK RECORD
                      </div>
                    </div>
                    <div className="text-right">
                      <div
                        className={`inline-block border px-3 py-1 font-data text-base font-bold tracking-widest ${
                          paperTheme ? "border-zinc-900 bg-zinc-100" : "border-acc bg-acc/10 text-acc"
                        }`}
                      >
                        RECORDS: {incidentList.length}
                      </div>
                      <div className="font-data text-[10px] tracking-wider opacity-75 mt-1">
                        EXPORT DTG: {formatDTG(new Date().toISOString())}
                      </div>
                    </div>
                  </div>

                  {/* Metrics Banner */}
                  <div className="print-avoid-break grid grid-cols-4 gap-2 text-xs font-data">
                    <div className={`border p-2 text-center ${paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"}`}>
                      <div className="text-[9px] opacity-70">TOTAL REPORTS</div>
                      <div className="text-lg font-bold">{incidentList.length}</div>
                    </div>
                    <div className={`border p-2 text-center ${paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"}`}>
                      <div className="text-[9px] opacity-70">CRITICAL</div>
                      <div className="text-lg font-bold text-red-600">
                        {incidentList.filter((i) => i.severity === "critical").length}
                      </div>
                    </div>
                    <div className={`border p-2 text-center ${paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"}`}>
                      <div className="text-[9px] opacity-70">HIGH SEVERITY</div>
                      <div className="text-lg font-bold text-amber-600">
                        {incidentList.filter((i) => i.severity === "high").length}
                      </div>
                    </div>
                    <div className={`border p-2 text-center ${paperTheme ? "border-zinc-300 bg-zinc-50" : "border-line bg-panel2"}`}>
                      <div className="text-[9px] opacity-70">OPEN / ACTIVE</div>
                      <div className="text-lg font-bold text-acc">
                        {incidentList.filter((i) => i.status !== "resolved").length}
                      </div>
                    </div>
                  </div>

                  {/* Table of Incidents */}
                  <div className="overflow-x-auto">
                    <table className="print-table w-full border-collapse font-data text-xs">
                      <thead>
                        <tr className={paperTheme ? "bg-zinc-100 border-b border-zinc-900" : "bg-panel2 border-b border-line"}>
                          <th className="p-2 text-left font-bold border border-current">REF #</th>
                          <th className="p-2 text-left font-bold border border-current">DTG (ZULU)</th>
                          <th className="p-2 text-left font-bold border border-current">TYPE</th>
                          <th className="p-2 text-left font-bold border border-current">SEV</th>
                          <th className="p-2 text-left font-bold border border-current">GRID LOCATION</th>
                          <th className="p-2 text-left font-bold border border-current">REPORTER</th>
                          <th className="p-2 text-left font-bold border border-current">SITUATION SUMMARY</th>
                          <th className="p-2 text-left font-bold border border-current">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {incidentList.map((inc) => (
                          <tr key={inc.id} className="print-avoid-break border-b border-current">
                            <td className="p-2 font-bold whitespace-nowrap border border-current">{inc.ref}</td>
                            <td className="p-2 whitespace-nowrap border border-current">{zuluTime(inc.createdAt)}</td>
                            <td className="p-2 whitespace-nowrap border border-current">
                              {INCIDENT_TYPE_LABEL[inc.type] ?? inc.type.toUpperCase()}
                            </td>
                            <td className="p-2 uppercase font-semibold border border-current">{inc.severity}</td>
                            <td className="p-2 whitespace-nowrap border border-current">{inc.grid}</td>
                            <td className="p-2 whitespace-nowrap border border-current">{inc.reporterCallSign}</td>
                            <td className="p-2 border border-current text-[11px] leading-snug">{inc.description}</td>
                            <td className="p-2 whitespace-nowrap uppercase font-semibold border border-current">
                              {INCIDENT_STATUS_LABEL[inc.status] ?? inc.status}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Command Certification */}
                  <div className="print-avoid-break border border-current p-3 mt-4">
                    <div className="font-data text-[10px] tracking-[0.2em] font-bold opacity-75 mb-2">
                      COMMAND OPERATIONS CENTER (COC) CERTIFICATION
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-xs font-data">
                      <div>
                        <div className="opacity-70 text-[9px]">DUTY OFFICER SIGNATURE:</div>
                        <div className="mt-3 border-b border-current w-4/5 h-3" />
                      </div>
                      <div>
                        <div className="opacity-70 text-[9px]">AUTHENTICATION STAMP / DTG:</div>
                        <div className="mt-3 border-b border-current w-4/5 h-3" />
                      </div>
                    </div>
                  </div>

                  {/* Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[9px] tracking-[0.25em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-faint"
                    }`}
                  >
                    UNCLASSIFIED // FOR OFFICIAL USE ONLY // M-TERS ARCHIVE
                  </div>
                </div>
              )}

              {/* -------------------- 3. 9-LINE MEDEVAC & MIST REPORT -------------------- */}
              {isMedevac && (
                <div className="space-y-4">
                  {/* Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[10px] tracking-[0.3em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-red-400"
                    }`}
                  >
                    URGENT TRAFFIC // STANAG 2087 // 9-LINE MEDEVAC & MIST CARD
                  </div>

                  {/* Header Title */}
                  {(() => {
                    const ref = alert?.alertRef ?? medevacRaw?.ref ?? "MV-ALERT";
                    const createdAt = alert?.createdAt ?? medevacRaw?.createdAt ?? new Date().toISOString();
                    const reqCS = alert?.requesterCallSign ?? medevacRaw?.requesterCallSign ?? "RECON-1";
                    const reqRank = alert?.requesterRank ?? medevacRaw?.requesterRank ?? "--";
                    const unit = alert?.unitCode ?? medevacRaw?.unitCode ?? "1-B-1";
                    const p = alert?.payload ?? medevacRaw;

                    const l1 = p?.line1 ?? "GRID UNAVAILABLE";
                    const l2 = p?.line2 ?? "FM 36.375 / SABER MED";
                    const l3 = p?.line3 ?? { A: 1, B: 0, C: 0, D: 0, E: 0 };
                    const l4 = p?.line4 ?? "A";
                    const l5 = p?.line5 ?? { L: 1, A: 0 };
                    const l6 = p?.line6 ?? "N";
                    const l7 = p?.line7 ?? "C";
                    const l8 = p?.line8 ?? "A";
                    const l9 = p?.line9 ?? "X";
                    const mist = p?.mist ?? {
                      mechanism: "GSW",
                      injuries: "TRAUMA",
                      signs: "ALERT",
                      treatment: "TQ APPLIED",
                    };

                    return (
                      <>
                        <div className="flex flex-wrap items-start justify-between gap-3 border-b-2 border-current pb-3">
                          <div>
                            <div className="font-data text-[10px] tracking-[0.25em] opacity-75">
                              TACTICAL COMBAT CASUALTY CARE (TCCC) / DD FORM 1380
                            </div>
                            <h1 className="font-disp text-2xl sm:text-3xl font-bold tracking-[0.06em] mt-0.5">
                              9-LINE MEDEVAC & MIST CARD
                            </h1>
                            <div className="font-data text-xs tracking-wider opacity-80 mt-1">
                              REQUESTER: {reqRank} {reqCS} ({unit}) · DTG: {formatDTG(createdAt)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={`inline-block border px-3 py-1 font-data text-base sm:text-lg font-bold tracking-widest ${
                                paperTheme ? "border-zinc-900 bg-zinc-100 text-red-600" : "border-danger bg-danger/10 text-danger"
                              }`}
                            >
                              REF: {ref}
                            </div>
                          </div>
                        </div>

                        {/* 9-Line Fields Table */}
                        <div className="print-avoid-break">
                          <table className="print-table w-full border-collapse font-data text-xs">
                            <tbody>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold w-20 border border-current">LINE 1</td>
                                <td className="p-2 border border-current">LOCATION OF PICKUP SITE</td>
                                <td className="p-2 font-bold border border-current">{l1}</td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 2</td>
                                <td className="p-2 border border-current">FREQ / CALLSIGN / SUFFIX</td>
                                <td className="p-2 font-bold border border-current">{l2.toUpperCase()}</td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 3</td>
                                <td className="p-2 border border-current">PATIENTS BY PRECEDENCE</td>
                                <td className="p-2 font-bold border border-current">
                                  A (URG): {l3.A} | B (SURG): {l3.B} | C (PRIO): {l3.C} | D (ROUT): {l3.D} | E (CONV): {l3.E}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 4</td>
                                <td className="p-2 border border-current">SPECIAL EQUIPMENT REQUIRED</td>
                                <td className="p-2 font-bold border border-current">
                                  {l4} — {LINE4_EQUIPMENT[l4] ?? l4}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 5</td>
                                <td className="p-2 border border-current">PATIENTS BY TYPE</td>
                                <td className="p-2 font-bold border border-current">
                                  LITTER: {l5.L} | AMBULATORY: {l5.A}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 6</td>
                                <td className="p-2 border border-current">SECURITY AT PICKUP SITE</td>
                                <td className="p-2 font-bold border border-current">
                                  {l6} — {LINE6_SECURITY[l6] ?? l6}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 7</td>
                                <td className="p-2 border border-current">METHOD OF MARKING</td>
                                <td className="p-2 font-bold border border-current">
                                  {l7} — {LINE7_MARKING[l7] ?? l7}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 8</td>
                                <td className="p-2 border border-current">PATIENT NATIONALITY / STATUS</td>
                                <td className="p-2 font-bold border border-current">
                                  {l8} — {LINE8_NATIONALITY[l8] ?? l8}
                                </td>
                              </tr>
                              <tr className="border-b border-current">
                                <td className="p-2 font-bold border border-current">LINE 9</td>
                                <td className="p-2 border border-current">CBRN / NBC CONTAMINATION</td>
                                <td className="p-2 font-bold border border-current">
                                  {l9} — {LINE9_NBC[l9] ?? l9}
                                </td>
                              </tr>
                            </tbody>
                          </table>
                        </div>

                        {/* MIST REPORT BOX */}
                        <div
                          className={`print-avoid-break border p-3.5 space-y-2 ${
                            paperTheme ? "border-zinc-900 bg-zinc-50" : "border-line bg-panel2/60"
                          }`}
                        >
                          <div className="font-data text-[11px] tracking-[0.2em] font-bold border-b border-current pb-1">
                            MIST REPORT (ATTACH DIRECTLY TO CASUALTY)
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-data">
                            <div>
                              <span className="opacity-70 font-semibold block text-[10px]">M — MECHANISM OF INJURY</span>
                              <span className="font-bold uppercase">{mist.mechanism || "NOT REPORTED"}</span>
                            </div>
                            <div>
                              <span className="opacity-70 font-semibold block text-[10px]">I — INJURIES FOUND / SUSPECTED</span>
                              <span className="font-bold uppercase">{mist.injuries || "NOT REPORTED"}</span>
                            </div>
                            <div>
                              <span className="opacity-70 font-semibold block text-[10px]">S — SIGNS / VITALS TREND</span>
                              <span className="font-bold uppercase">{mist.signs || "NOT REPORTED"}</span>
                            </div>
                            <div>
                              <span className="opacity-70 font-semibold block text-[10px]">T — TREATMENT GIVEN & TOURNIQUET TIME</span>
                              <span className="font-bold uppercase">{mist.treatment || "NOT REPORTED"}</span>
                            </div>
                          </div>
                        </div>

                        {/* Handover Signatures */}
                        <div className="print-avoid-break border border-current p-3">
                          <div className="font-data text-[10px] tracking-[0.2em] font-bold opacity-75 mb-2">
                            PHYSICAL CASUALTY HANDOVER VERIFICATION
                          </div>
                          <div className="grid grid-cols-2 gap-4 text-xs font-data">
                            <div>
                              <div className="opacity-70 text-[9px]">TRANSFERRING MEDIC SIGNATURE:</div>
                              <div className="mt-3 border-b border-current w-4/5 h-3" />
                            </div>
                            <div>
                              <div className="opacity-70 text-[9px]">RECEIVING FLIGHT CREW / SURGEON:</div>
                              <div className="mt-3 border-b border-current w-4/5 h-3" />
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}

                  {/* Security Banner */}
                  <div
                    className={`border text-center py-1 font-data text-[9px] tracking-[0.25em] font-bold ${
                      paperTheme
                        ? "border-zinc-900 bg-zinc-100 text-zinc-900"
                        : "border-line bg-panel2 text-faint"
                    }`}
                  >
                    UNCLASSIFIED // FOR OFFICIAL USE ONLY // M-TERS MEDEVAC
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
