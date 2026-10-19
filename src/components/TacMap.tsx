"use client";

import { useMemo } from "react";
import type { AlertDTO, IncidentDTO } from "@/lib/types";
import { alertStatusTone, severityTone, TONE_BG } from "@/components/ui";

interface Blip {
  key: string;
  x: number;
  y: number;
  kind: "incident" | "pz";
  tone: string;
  label: string;
  pulse: boolean;
}

const BOUNDS = { latMin: 35.238, latMax: 35.306, lngMin: -116.716, lngMax: -116.64 };

function project(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - BOUNDS.lngMin) / (BOUNDS.lngMax - BOUNDS.lngMin)) * 100;
  const y = ((BOUNDS.latMax - lat) / (BOUNDS.latMax - BOUNDS.latMin)) * 100;
  return { x: Math.max(2, Math.min(98, x)), y: Math.max(2, Math.min(98, y)) };
}

export const FOB = { lat: 35.262, lng: -116.684 };

export default function TacMap({
  incidents,
  alerts,
}: {
  incidents: IncidentDTO[];
  alerts: AlertDTO[];
}) {
  const blips = useMemo<Blip[]>(() => {
    const out: Blip[] = [];
    for (const i of incidents) {
      if (i.status === "resolved" || i.lat == null || i.lng == null) continue;
      const { x, y } = project(i.lat, i.lng);
      out.push({
        key: i.id,
        x,
        y,
        kind: "incident",
        tone: TONE_BG[severityTone(i.severity)],
        label: i.ref,
        pulse: i.severity === "critical" || i.severity === "high",
      });
    }
    for (const a of alerts) {
      if (["complete", "cancelled"].includes(a.status)) continue;
      const lat = a.payload?.lat;
      const lng = a.payload?.lng;
      if (lat == null || lng == null) continue;
      const { x, y } = project(lat, lng);
      out.push({
        key: a.id,
        x,
        y,
        kind: "pz",
        tone: TONE_BG[alertStatusTone(a.status)],
        label: a.alertRef,
        pulse: a.status === "sent" || a.status === "en_route",
      });
    }
    return out;
  }, [incidents, alerts]);

  const fob = project(FOB.lat, FOB.lng);
  const enRoutePz = useMemo(() => {
    const a = alerts.find((al) => al.status === "en_route" && al.payload?.lat != null);
    if (!a?.payload?.lat || !a.payload.lng) return null;
    return project(a.payload.lat, a.payload.lng);
  }, [alerts]);

  return (
    <div className="t-corners relative overflow-hidden border border-line bg-bg1">
      <svg viewBox="0 0 100 100" className="block aspect-square w-full" preserveAspectRatio="none">
        <defs>
          <pattern id="mgrid" width="10" height="10" patternUnits="userSpaceOnUse">
            <path d="M 10 0 L 0 0 0 10" fill="none" stroke="var(--line)" strokeWidth="0.25" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#mgrid)" />
        {/* major grid lines every 20 */}
        {[20, 40, 60, 80].map((g) => (
          <g key={g}>
            <line x1={g} y1="0" x2={g} y2="100" stroke="var(--line-strong)" strokeWidth="0.2" opacity="0.5" />
            <line x1="0" y1={g} x2="100" y2={g} stroke="var(--line-strong)" strokeWidth="0.2" opacity="0.5" />
          </g>
        ))}
        {/* route from COC to active PZ */}
        {enRoutePz && (
          <line
            x1={fob.x}
            y1={fob.y}
            x2={enRoutePz.x}
            y2={enRoutePz.y}
            stroke="var(--warn)"
            strokeWidth="0.35"
            strokeDasharray="1.5 1"
            opacity="0.85"
          />
        )}
        {/* FOB marker */}
        <g>
          <rect x={fob.x - 1.2} y={fob.y - 1.2} width="2.4" height="2.4" fill="none" stroke="var(--acc)" strokeWidth="0.4" />
          <rect x={fob.x - 0.45} y={fob.y - 0.45} width="0.9" height="0.9" fill="var(--acc)" />
        </g>
        {/* blips */}
        {blips.map((b) => (
          <g key={b.key}>
            {b.pulse && (
              <circle cx={b.x} cy={b.y} r="2.4" className="blip-ring" fill="none" stroke="currentColor" strokeWidth="0.3" style={{ color: "var(--danger)" }} />
            )}
            {b.kind === "pz" ? (
              <g transform={`translate(${b.x} ${b.y})`}>
                <path d="M -1.6 0 L 1.6 0 M 0 -1.6 L 0 1.6" stroke="var(--danger)" strokeWidth="0.55" />
                <circle r="2" fill="none" stroke="var(--danger)" strokeWidth="0.3" />
              </g>
            ) : (
              <g transform={`translate(${b.x} ${b.y})`}>
                <path d="M 0 -1.8 L 1.6 1.1 L -1.6 1.1 Z" fill="none" stroke="var(--warn)" strokeWidth="0.45" />
                <circle r="0.55" fill="var(--warn)" />
              </g>
            )}
          </g>
        ))}
      </svg>
      {/* corner labels */}
      <div className="font-data absolute bottom-1.5 left-2 text-[8px] tracking-[0.2em] text-faint">■ FOB SABER COC</div>
      <div className="font-data absolute right-2 bottom-1.5 flex gap-3 text-[8px] tracking-[0.2em] text-faint">
        <span className="text-warn">△ HAZARD</span>
        <span className="text-danger">┼ PICKUP ZONE</span>
      </div>
      <div className="font-data absolute top-1.5 left-2 text-[8px] tracking-[0.2em] text-faint">
        SECTOR VIEW — 11S NV
      </div>
    </div>
  );
}
