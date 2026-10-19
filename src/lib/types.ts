// Client-safe DTO types shared between API routes and UI.

export interface MeUser {
  id: string;
  callSign: string;
  username?: string | null;
  fullName: string;
  rank: string;
  role: "field" | "medic" | "command";
  unitCode: string;
  mosDesignation: string | null;
  tcccLevel: string;
  status: string;
}

export interface RosterUser {
  id: string;
  callSign: string;
  username?: string | null;
  rank: string;
  fullName: string;
  role: string;
  unitCode: string;
}

export interface ProtocolStep {
  t: string;
  d: string;
}

export interface ProtocolDTO {
  id: string;
  slug: string;
  title: string;
  category: string;
  phase: string;
  summary: string;
  steps: ProtocolStep[];
  warnings: string[];
  estSec: number;
  medicOnly: boolean;
  updatedAt: string;
}

export interface MistBlock {
  mechanism: string;
  injuries: string;
  signs: string;
  treatment: string;
}

export interface AlertPayload {
  line1: string;
  lat: number | null;
  lng: number | null;
  line2: string;
  line3: { A: number; B: number; C: number; D: number; E: number };
  line4: string;
  line5: { L: number; A: number };
  line6: string;
  line7: string;
  line8: string;
  line9: string;
  mist: MistBlock;
}

export interface AlertDTO {
  id: string;
  alertRef: string;
  status: string;
  priority: string;
  patients: number;
  createdAt: string;
  updatedAt: string;
  requesterCallSign: string;
  requesterRank: string;
  unitCode: string;
  payload: AlertPayload | null;
}

export interface IncidentDTO {
  id: string;
  ref: string;
  type: string;
  severity: string;
  status: string;
  lat: number | null;
  lng: number | null;
  grid: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  reporterCallSign: string;
  reporterRank: string;
  unitCode: string;
}

export interface TreatmentEntry {
  t: string;
  note: string;
  by: string;
}

export interface CasualtyDTO {
  id: string;
  casualtyRef: string;
  status: string;
  phase: string;
  alertRef: string | null;
  alertId: string | null;
  unitCode: string;
  mechanism: string;
  injuries: string[];
  meds: string;
  treatmentLog: TreatmentEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface UnitDTO {
  id: string;
  code: string;
  name: string;
  callSign: string;
  locationGrid: string | null;
  readiness: string;
  personnel: number;
}

export interface EventDTO {
  id: string;
  kind: string;
  message: string;
  ref: string | null;
  actor: string | null;
  createdAt: string;
}

export interface StatsDTO {
  activeAlerts: number;
  openIncidents: number;
  activeCasualties: number;
  urgentCasualties: number;
  unitsReady: number;
  unitsCommitted: number;
  totalUnits: number;
  fieldUsers: number;
  medicUsers: number;
  resolvedToday: number;
}
