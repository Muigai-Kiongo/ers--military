import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  real,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// UNITS — garrison sub-units / attachments tracked by the command post
// ---------------------------------------------------------------------------
export const units = pgTable("units", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 24 }).notNull().unique(), // e.g. VIPER-1-PLT
  name: varchar("name", { length: 80 }).notNull(), // e.g. 1st PLT, ACO 2-16
  callSign: varchar("call_sign", { length: 40 }).notNull(),
  locationGrid: varchar("location_grid", { length: 24 }),
  readiness: varchar("readiness", { length: 16 }).notNull().default("green"), // green | amber | red | black
  personnel: integer("personnel").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// USERS — field personnel, combat medics, command
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  callSign: varchar("call_sign", { length: 40 }).notNull().unique(),
  username: varchar("username", { length: 40 }),
  passwordHash: text("password_hash"),
  fullName: varchar("full_name", { length: 120 }).notNull(),
  rank: varchar("rank", { length: 12 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("field"), // field | medic | command
  unitCode: varchar("unit_code", { length: 24 })
    .notNull()
    .references(() => units.code),
  mosDesignation: varchar("mos_designation", { length: 40 }),
  tcccLevel: varchar("tccc_level", { length: 24 }).notNull().default("CLS"), // ALL | CLS | CMC
  status: varchar("status", { length: 16 }).notNull().default("active"), // active | suspended
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// PROTOCOLS — TCCC instruction set, encrypted/signed at rest
// ---------------------------------------------------------------------------
export const protocols = pgTable("protocols", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  title: varchar("title", { length: 140 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(), // hemorrhage | airway | breathing | circulation | burns | hypothermia | evacuation | wounds
  phase: varchar("phase", { length: 16 }).notNull(), // cuf | tfc | tacevac
  summary: text("summary").notNull(),
  steps: jsonb("steps").notNull(), // [{ t: string; d: string }]
  warnings: jsonb("warnings").notNull(), // string[]
  estSec: integer("est_sec").notNull().default(60),
  medicOnly: boolean("medic_only").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// ALERTS — 9-line MEDEVAC requests (payload is AES-256-GCM encrypted at rest)
// ---------------------------------------------------------------------------
export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    alertRef: varchar("alert_ref", { length: 24 }).notNull().unique(), // MV-XXXX-YY
    status: varchar("status", { length: 16 }).notNull().default("sent"), // sent | ack | en_route | on_scene | evac | complete | cancelled
    priority: varchar("priority", { length: 20 }).notNull().default("priority"), // urgent | urgent_surgical | priority | routine | convenience
    payloadEnc: text("payload_enc").notNull(), // encrypted full 9-line + MIST block
    patients: integer("patients").notNull().default(1),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => users.id),
    unitCode: varchar("unit_code", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("alerts_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// INCIDENTS — hazard & tactical reports (IED, enemy movement, fire, UXO...)
// ---------------------------------------------------------------------------
export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    ref: varchar("ref", { length: 24 }).notNull().unique(), // HZ-XXXX-YY
    type: varchar("type", { length: 24 }).notNull(), // ied | enemy | fire | uxo | accident | chem | other
    severity: varchar("severity", { length: 16 }).notNull().default("medium"), // low | medium | high | critical
    status: varchar("status", { length: 16 }).notNull().default("reported"), // reported | ack | responding | monitored | resolved
    payloadEnc: text("payload_enc").notNull(), // encrypted description + coords
    lat: real("lat"),
    lng: real("lng"),
    reporterId: uuid("reporter_id")
      .notNull()
      .references(() => users.id),
    unitCode: varchar("unit_code", { length: 24 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("incidents_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// CASUALTIES — triage tracking record, updated by medics
// ---------------------------------------------------------------------------
export const casualties = pgTable(
  "casualties",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    casualtyRef: varchar("casualty_ref", { length: 24 }).notNull().unique(), // C-XXXX
    status: varchar("status", { length: 16 }).notNull().default("urgent"), // urgent | priority | routine | minimal | expectant
    phase: varchar("phase", { length: 16 }).notNull().default("tfc"), // cuf | tfc | tacevac | evacuated
    alertId: uuid("alert_id").references(() => alerts.id),
    unitCode: varchar("unit_code", { length: 24 }).notNull(),
    payloadEnc: text("payload_enc").notNull(), // encrypted mechanism/injuries/meds
    treatmentLog: jsonb("treatment_log").notNull(), // [{ t, note, by }]
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("casualties_status_idx").on(t.status)],
);

// ---------------------------------------------------------------------------
// NET EVENTS — digitized command logbook (replaces the whiteboard)
// ---------------------------------------------------------------------------
export const netEvents = pgTable("net_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  kind: varchar("kind", { length: 24 }).notNull(), // medevac | incident | casualty | status | auth | system
  message: varchar("message", { length: 240 }).notNull(),
  ref: varchar("ref", { length: 24 }),
  actor: varchar("actor", { length: 60 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Unit = typeof units.$inferSelect;
export type Protocol = typeof protocols.$inferSelect;
export type Alert = typeof alerts.$inferSelect;
export type Incident = typeof incidents.$inferSelect;
export type Casualty = typeof casualties.$inferSelect;
export type NetEvent = typeof netEvents.$inferSelect;
