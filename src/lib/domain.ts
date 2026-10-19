// Shared domain vocabulary for M-TERS (client + server safe).

export const ALERT_STATUS_FLOW = [
  "sent",
  "ack",
  "en_route",
  "on_scene",
  "evac",
  "complete",
] as const;

export const INCIDENT_STATUS_FLOW = [
  "reported",
  "ack",
  "responding",
  "monitored",
  "resolved",
] as const;

export const ALERT_STATUS_LABEL: Record<string, string> = {
  sent: "SENT",
  ack: "ACKNOWLEDGED",
  en_route: "EN ROUTE",
  on_scene: "ON SCENE",
  evac: "EVAC IN PROGRESS",
  complete: "COMPLETE",
  cancelled: "CANCELLED",
};

export const INCIDENT_TYPE_LABEL: Record<string, string> = {
  ied: "IED / ERW",
  enemy: "ENEMY MOVEMENT",
  fire: "FIRE",
  uxo: "UXO",
  accident: "ACCIDENT / MVA",
  chem: "CBRN HAZARD",
  other: "OTHER HAZARD",
};

export const INCIDENT_STATUS_LABEL: Record<string, string> = {
  reported: "REPORTED",
  ack: "ACKNOWLEDGED",
  responding: "RESPONDING",
  monitored: "MONITORED",
  resolved: "RESOLVED",
};

export const CASUALTY_STATUS_LABEL: Record<string, string> = {
  urgent: "URGENT",
  priority: "PRIORITY",
  routine: "ROUTINE",
  minimal: "MINIMAL",
  expectant: "EXPECTANT",
};

export const PHASE_LABEL: Record<string, string> = {
  cuf: "CARE UNDER FIRE",
  tfc: "TACTICAL FIELD CARE",
  tacevac: "TACEVAC",
  evacuated: "EVACUATED",
};

export const ROLE_LABEL: Record<string, string> = {
  field: "FIELD PERSONNEL",
  medic: "COMBAT MEDIC",
  command: "COMMAND",
};

export const READINESS_LABEL: Record<string, string> = {
  green: "READY",
  amber: "DEGRADED",
  red: "COMMITTED",
  black: "OFF-LINE",
};

// ---- 9-line mapping --------------------------------------------------
export const LINE3_PRECEDENCE: Record<string, string> = {
  A: "URGENT",
  B: "URGENT SURGICAL",
  C: "PRIORITY",
  D: "ROUTINE",
  E: "CONVENIENCE",
};

export const LINE4_EQUIPMENT: Record<string, string> = {
  A: "NONE",
  B: "HOIST",
  C: "EXTRACTION EQUIPMENT",
  D: "VENTILATOR",
};

export const LINE6_SECURITY: Record<string, string> = {
  N: "NO ENEMY IN AREA",
  P: "POSSIBLE ENEMY IN AREA",
  E: "ENEMY IN AREA — CAUTION",
  X: "ENEMY IN AREA — ARMED ESCORT REQ",
};

export const LINE7_MARKING: Record<string, string> = {
  A: "PANELS",
  B: "PYROTECHNIC SIGNAL",
  C: "SMOKE SIGNAL",
  D: "NONE",
  E: "OTHER",
};

export const LINE8_NATIONALITY: Record<string, string> = {
  A: "US MILITARY",
  B: "US CIVILIAN",
  C: "NON-US MILITARY",
  D: "NON-US CIVILIAN",
  E: "OPFOR / EPW",
};

export const LINE9_NBC: Record<string, string> = {
  N: "NUCLEAR",
  B: "BIOLOGICAL",
  C: "CHEMICAL",
  X: "NONE",
};

export const PHONETIC: Record<string, string> = {
  A: "ALPHA",
  B: "BRAVO",
  C: "CHARLIE",
  D: "DELTA",
  E: "ECHO",
  F: "FOXTROT",
  G: "GOLF",
  H: "HOTEL",
  I: "INDIA",
  J: "JULIETT",
  K: "KILO",
  L: "LIMA",
  M: "MIKE",
  N: "NOVEMBER",
  O: "OSCAR",
  P: "PAPA",
  Q: "QUEBEC",
  R: "ROMEO",
  S: "SIERRA",
  T: "TANGO",
  U: "UNIFORM",
  V: "VICTOR",
  W: "WHISKEY",
  X: "X-RAY",
  Y: "YANKEE",
  Z: "ZULU",
};

export function zuluTime(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "------";
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${dd}${hh}${mm}Z`;
}

export function clockZulu(d: Date): string {
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  const ss = String(d.getUTCSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}Z`;
}

export function fmtGridParts(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(5)}° ${latDir} / ${Math.abs(lng).toFixed(5)}° ${lngDir}`;
}

export function timeAgo(from: string | Date, now = Date.now()): string {
  const t = typeof from === "string" ? new Date(from).getTime() : from.getTime();
  const s = Math.max(0, Math.floor((now - t) / 1000));
  if (s < 60) return `${s}S AGO`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}M AGO`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}H ${m % 60}M AGO`;
  return `${Math.floor(h / 24)}D AGO`;
}
