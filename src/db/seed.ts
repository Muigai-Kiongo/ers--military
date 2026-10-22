/* eslint-disable no-console */
import "dotenv/config";
import crypto from "crypto";
import { scryptSync } from "crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import * as schema from "./schema";

const isRemoteDb =
  process.env.DATABASE_URL?.includes("supabase.co") ||
  process.env.DATABASE_URL?.includes("supabase.com") ||
  process.env.DATABASE_URL?.includes("pooler.supabase.com") ||
  process.env.DATABASE_URL?.includes("sslmode=");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
});
const db = drizzle(pool, { schema });

// --- local copies of crypto helpers so this runs as a plain node script ----
function payloadKey(): Buffer {
  const material =
    process.env.MTERS_DATA_KEY ??
    process.env.DATABASE_URL ??
    "mters-field-data-key";
  return scryptSync(material, "mters-static-salt-v1", 32);
}
function encryptPayload(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", payloadKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// FOB SABER — approximate training center coords (35.262 N, 116.684 W)
function gridFor(lat: number, lng: number): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mgrs = require("mgrs") as { forward: (p: [number, number], a?: number) => string };
    const raw = mgrs.forward([lng, lat], 5);
    const m = raw.match(/^(\d{1,2})([A-Z])([A-Z]{2})(\d+)$/i);
    if (m) {
      const digits = m[4];
      const half = Math.floor(digits.length / 2);
      return `${m[1]}${m[2].toUpperCase()} ${m[3].toUpperCase()} ${digits.slice(0, half)} ${digits.slice(half)}`;
    }
    return raw;
  } catch {
    const e = Math.round(1000 + Math.abs(lat * 37) % 8999);
    const n = Math.round(1000 + Math.abs(lng * 53) % 8999);
    return `11S NV ${e} ${n}`;
  }
}

const protocols = [
  {
    slug: "cuf-massive-hemorrhage-tourniquet",
    title: "MASSIVE EXTREMITY HEMORRHAGE — TOURNIQUET",
    category: "hemorrhage",
    phase: "cuf",
    summary:
      "Apply a CoTCCC-recommended limb tourniquet to stop life-threatening extremity bleeding while under fire. Speed over precision: in Care Under Fire the tourniquet is applied high and tight over the uniform.",
    steps: [
      { t: "SUPPRESS & ASSESS", d: "Direct casualty to remain engaged if capable. Return fire / take cover before treatment if the tactical situation requires. Identify spurting or pooling blood on an extremity." },
      { t: "HIGH & TIGHT", d: "Apply the tourniquet over the uniform as high on the limb as possible ('high and tight') — thigh or upper arm. Slide no debris under the band." },
      { t: "TIGHTEN WINDLASS", d: "Pull strap tight through the friction adapter. Twist the windlass rod until bleeding STOPS — typically 3 half-turns. Expect it to hurt; that is normal." },
      { t: "LOCK & MARK", d: "Lock the windlass into the clip. Write the time of application on the tourniquet or casualty's forehead (T + ZULU time)." },
      { t: "CHECK PULSE & MOVE", d: "Verify the distal pulse is gone and bleeding has stopped. If bleeding continues, apply a second tourniquet side-by-side above the first. Move casualty to cover." },
    ],
    warnings: [
      "NEVER loosen or remove a tourniquet applied for massive hemorrhage in the field.",
      "Do NOT place over joints or pockets containing objects.",
      "Pain from a properly applied tourniquet is expected — do not loosen.",
    ],
    estSec: 45,
    medicOnly: false,
  },
  {
    slug: "tfc-junctional-hemorrhage-wound-packing",
    title: "JUNCTIONAL HEMORRHAGE — WOUND PACKING",
    category: "hemorrhage",
    phase: "tfc",
    summary:
      "Control bleeding in places a tourniquet cannot reach: groin, axilla, neck. Pack the wound cavity with hemostatic dressing and apply aggressive direct pressure for a minimum of 3 minutes.",
    steps: [
      { t: "EXPOSE THE WOUND", d: "Cut clothing away from the injury. Identify the source of bleeding inside the wound — you must pack the bleeding vessel, not just fill the hole." },
      { t: "PACK WITH COMBAT GAUZE", d: "Push hemostatic gauze (Combat Gauze / ChitoGauze / Celox Gauze) deep into the wound cavity with one finger, feeding it in continuously until the cavity is completely filled." },
      { t: "HOLD 3-MINUTE PRESSURE", d: "Apply hard direct pressure with both hands over the packed wound for a MINIMUM of 3 minutes. Do not release early to check." },
      { t: "PRESSURE DRESSING", d: "Apply a pressure bandage (Israeli / emergency trauma dressing) tightly over the packed site to maintain compression." },
      { t: "REASSESS & DOCUMENT", d: "Check distal circulation. If bleeding soaks through, repack with plain gauze or apply a junctional tourniquet (SAM JTQ / CRoC) if available. Document dressings applied." },
    ],
    warnings: [
      "Never pack wounds of the chest or abdomen — bleeding there requires surgical control.",
      "If hemostatic gauze is unavailable, pack tightly with plain gauze and hold pressure.",
      "Monitor for re-bleed continuously during movement.",
    ],
    estSec: 240,
    medicOnly: false,
  },
  {
    slug: "tfc-airway-management",
    title: "AIRWAY MANAGEMENT — UNCONSCIOUS CASUALTY",
    category: "airway",
    phase: "tfc",
    summary:
      "Open and maintain the airway of an unconscious casualty using chin lift, nasopharyngeal airway, and the recovery position. Definitive airway is reserved for the medic.",
    steps: [
      { t: "POSITION & OPEN", d: "Roll casualty onto their back. Open the airway with chin lift or jaw thrust. Sweep visible debris/blood from the mouth with fingers. LOOK for chest rise, LISTEN for air movement." },
      { t: "INSERT NPA", d: "Lubricate the nasopharyngeal airway. Insert through the right nostril (bevel toward septum), straight back — NOT upward — until the flange rests at the nostril. If resistance, try the other side slowly." },
      { t: "RECOVERY POSITION", d: "Place casualty on their side (recovery position) so blood and secretions drain out rather than into the airway. Keep the airway clear at all times." },
      { t: "OXYGEN IF AVAILABLE", d: "If trained and available, apply supplemental oxygen. Keep the casualty warm — airway casualties crash fast when cold." },
      { t: "CONTINUOUS REASSESSMENT", d: "Recheck airway every few minutes and after any movement. Suction if available. Escalate to the medic for advanced airway if obstruction persists." },
    ],
    warnings: [
      "A casualty with penetrating neck trauma needs aggressive airway monitoring — swelling can close the airway rapidly.",
      "Never leave an unconscious casualty supine and unattended.",
      "NPA is tolerated by most unconscious casualties; if gagging occurs, chin lift + recovery position is acceptable.",
    ],
    estSec: 90,
    medicOnly: false,
  },
  {
    slug: "tfc-open-chest-wound-seal",
    title: "OPEN CHEST WOUND — VENTED SEAL",
    category: "breathing",
    phase: "tfc",
    summary:
      "Seal penetrating chest wounds with a vented occlusive dressing, position the casualty for drainage, and monitor continuously for tension pneumothorax — the deadliest treatable battlefield condition.",
    steps: [
      { t: "ASSESS BREATHING", d: "Expose the chest. Look for entry AND exit wounds between the neck and umbilicus. Sucking sounds, frothy blood, or bubbles = open pneumothorax." },
      { t: "SEAL THE WOUND", d: "Wipe blood/dirt from the wound site. On exhalation, apply a vented chest seal (Hyfin / Halo / Beacon) directly over the wound. If unvented, do NOT release pressure by lifting the seal." },
      { t: "POSITION FOR DRAINAGE", d: "Sit the casualty up or position with the injured side DOWN so fluid drains and the good lung expands." },
      { t: "MONITOR FOR TENSION", d: "Watch for progressive respiratory distress: rapid labored breathing, decreasing SpO₂ (<90%), cyanosis, absent breath sounds on the injured side, shock." },
      { t: "ESCALATE FAST", d: "If tension pneumothorax signs develop: this is a casualty for immediate medic needle decompression or burping of the seal, then URGENT evacuation." },
    ],
    warnings: [
      "Never pack chest wounds.",
      "Burp an unvented seal ONLY if tension signs appear; a vented seal is preferred.",
      "Tension pneumothorax kills faster than external bleeding in many chest injuries.",
    ],
    estSec: 120,
    medicOnly: false,
  },
  {
    slug: "tfc-needle-decompression",
    title: "NEEDLE DECOMPRESSION — TENSION PNEUMOTHORAX",
    category: "breathing",
    phase: "tfc",
    summary:
      "Medic-level intervention for progressing tension pneumothorax: needle decompression at the 5th intercostal space, anterior axillary line, on the side of injury.",
    steps: [
      { t: "CONFIRM INDICATION", d: "Casualty has significant chest trauma + progressive severe respiratory distress + one or more of: SpO₂ <90%, absent breath sounds on injured side, shock or traumatic cardiac arrest." },
      { t: "SELECT SITE", d: "5th intercostal space, anterior axillary line (AAL) on the injured side — lateral to the nipple line, above the rib. Prep with antiseptic. Keep the chest seal in place." },
      { t: "INSERT NEEDLE", d: "Insert the 10- or 14-gauge, 3.25-inch needle/catheter over the top of the lower rib at 90° to the chest wall. Advance until air escapes with a hissing sound." },
      { t: "SECURE & ASSESS", d: "Remove the needle, leave the catheter. Secure it. Expect immediate improvement in breathing and SpO₂ within 5 minutes. If none, consider a second needle lateral to the first." },
      { t: "MONITOR & EVACUATE", d: "Continuously reassess — catheters occlude/kink. Mark casualty clearly. Evacuate URGENT with oxygen if available. Document time and site on the TCCC card." },
    ],
    warnings: [
      "MEDIC (CMC) scope only under current TCCC guidelines.",
      "A second decompression on the same side is authorized if there is no response to the first.",
      "Every decompressed casualty is a surgical consult — do not downgrade triage category.",
    ],
    estSec: 120,
    medicOnly: true,
  },
  {
    slug: "tfc-iv-txa",
    title: "IV/IO ACCESS & TXA ADMINISTRATION",
    category: "circulation",
    phase: "tfc",
    summary:
      "Gain vascular access and give tranexamic acid to casualties in hemorrhagic shock — within 3 hours of injury for maximum benefit.",
    steps: [
      { t: "INDICATION FOR TXA", d: "Casualty is losing or has lost significant blood, or shows signs of shock (HR >100, weak radial pulse, altered mental status, cool pale skin). Must be given within 3 hours of wounding." },
      { t: "GAIN ACCESS", d: "18-gauge IV in a large peripheral vein. If two attempts fail or access is urgent, use sternal or humeral IO (EZ-IO). Flush to confirm patency." },
      { t: "ADMINISTER TXA", d: "2 grams TXA slow IV/IO push over 10 minutes OR reconstituted per protocol. Alternatively infuse 1g TXA in 100–250 mL of normal saline or LR." },
      { t: "FLUID RESUSCITATION", d: "If in shock and blood products available: give blood. Otherwise do NOT give large crystalloid volumes — target a palpable radial pulse / normal mentation (hypotensive resuscitation)." },
      { t: "DOCUMENT", d: "Record TXA time, dose, access site, and fluids on the TCCC Casualty Card. Report to evacuation platform on handover." },
    ],
    warnings: [
      "MEDIC (CMC) scope. CLS personnel establish access per unit SOP only.",
      "TXA more than 3 hours post-injury provides no benefit and may cause harm.",
      "Avoid over-resuscitation — 'scoop and run' to surgical care beats large-volume fluids.",
    ],
    estSec: 300,
    medicOnly: true,
  },
  {
    slug: "tfc-cricothyroidotomy",
    title: "SURGICAL CRICOTHYROIDOTOMY",
    category: "airway",
    phase: "tfc",
    summary:
      "Medic-level definitive airway for severe face/neck trauma when the airway cannot be maintained by position or NPA.",
    steps: [
      { t: "CONFIRM INDICATION", d: "Severe facial/neck trauma with airway compromise that cannot be managed with position of comfort, recovery position, or NPA. Call for immediate evacuation in parallel." },
      { t: "POSITION & PREP", d: "Extend the neck (only if no c-spine concern). Palpate the cricothyroid membrane between thyroid and cricoid cartilages. Prep the anterior neck." },
      { t: "VERTICAL SKIN INCISION", d: "Make a ~4 cm vertical midline incision over the membrane. Bluntly dissect to the cricothyroid membrane with a finger or hemostat." },
      { t: "HORIZONTAL MEMBRANE INCISION", d: "Make a horizontal stab incision through the membrane. Open it with the hook or hemostat. Insert the 6.0–6.5 cuffed tube (or trach tube) and inflate the cuff." },
      { t: "CONFIRM & SECURE", d: "Confirm by chest rise and auscultation. Secure aggressively. Continuous pulse ox if available. This casualty is URGENT — package and evacuate now." },
    ],
    warnings: [
      "MEDIC (CMC) scope only; requires current competency training.",
      "Never delay evacuation to perform this procedure in a moving fight.",
      "Complications: hemorrhage, false passage, posterior tracheal wall injury.",
    ],
    estSec: 240,
    medicOnly: true,
  },
  {
    slug: "tfc-hypothermia-prevention",
    title: "HYPOTHERMIA PREVENTION — HPMK",
    category: "circulation",
    phase: "tfc",
    summary:
      "Trauma casualty chilling accelerates the lethal triad: hypothermia, acidosis, coagulopathy. Wrap every seriously injured casualty — even in hot climates.",
    steps: [
      { t: "MINIMIZE EXPOSURE", d: "Keep the casualty covered. Work fast in a sheltered spot. Remove wet clothing if a dry replacement or wrap is ready. Cut gear only when replacement insulation exists." },
      { t: "INSULATE FROM GROUND", d: "Move the casualty off cold ground/vehicle floor onto a litter with insulation, sleeping mat, or the Ready-Heat blanket隔热 layer — ground contact steals heat fastest." },
      { t: "APPLY HPMK", d: "Unroll the Hypothermia Prevention and Management Kit: Ready-Heat blanket around the torso, casualty inside the vapor-impermeable shell, sealed. Cover the head — do not cover the face." },
      { t: "WARM FLUIDS IF AVAILABLE", d: "If trained and equipment exists, warm IV fluids to ~38°C before administration." },
      { t: "REASSESS", d: "Check that warm periphery is maintained and the wrap has not loosened during movement. Re-tape after every transfer between platforms." },
    ],
    warnings: [
      "Do not delay — heat loss begins immediately after wounding regardless of weather.",
      "Never place the chemical heating blanket directly against skin.",
      "Cold casualty blood does not clot: hypothermia = re-bleeding.",
    ],
    estSec: 90,
    medicOnly: false,
  },
  {
    slug: "tfc-burns-management",
    title: "BURNS — ASSESS & DRESS",
    category: "burns",
    phase: "tfc",
    summary:
      "Estimate burn size with the rule of nines, cover with dry sterile dressings, treat the hidden killer — hypothermia — and evacuate early.",
    steps: [
      { t: "STOP THE BURNING", d: "Remove the casualty from the source. Smother flames; do NOT remove smoldering synthetic material adhered to skin without irrigation. Watch for inhalation injury: singed nasal hair, soot in mouth, hoarse voice." },
      { t: "ESTIMATE %TBSA", d: "Rule of nines: head 9%, each arm 9%, anterior trunk 18%, posterior trunk 18%, each leg 18%, perineum 1%. Palm of casualty's hand ≈ 1% for scattered areas." },
      { t: "COVER WITH DRY DRESSINGS", d: "Cover burns >20% TBSA with dry, sterile dressings or clean cloth. Do NOT cool large burns with water — hypothermia kills." },
      { t: "PREVENT HYPOTHERMIA", d: "Burned skin cannot thermoregulate. Wrap aggressively per the hypothermia protocol — double the urgency." },
      { t: "FLUIDS & EVACUATE", d: "Burns >20% TBSA: fluid resuscitation per rule of tens (medic task). Any airway involvement, circumferential chest burns, or hands/face/genitalia = URGENT evacuation." },
    ],
    warnings: [
      "Airway burns can close the airway with little warning — evacuate early.",
      "Never apply ointments, ice, or wet dressings to large burns.",
      "Electrical burns hide deep injury — treat all as URGENT.",
    ],
    estSec: 300,
    medicOnly: false,
  },
  {
    slug: "tfc-shock-management",
    title: "HEMORRHAGIC SHOCK — RECOGNIZE & RESPOND",
    category: "circulation",
    phase: "tfc",
    summary:
      "Shock is a failure of oxygen delivery. Field recognition is clinical: mentation and radial pulse. Response is stop bleeding, prevent heat loss, evacuate to blood products.",
    steps: [
      { t: "RECOGNIZE EARLY", d: "Assess: altered mental status (confusion, anxiety) + rapid weak/absent radial pulse + cool pale skin = shock. You do not need a blood pressure to diagnose it." },
      { t: "STOP THE BLEEDING", d: "Reassess every tourniquet, packing and pressure dressing. Any re-bleed = immediate re-intervention. Shock with uncontrolled bleeding is a surgical emergency." },
      { t: "WARM THE CASUALTY", d: "Apply HPMK per hypothermia protocol. Cold accelerates the lethal triad and worsens shock." },
      { t: "POSITION & OXYGEN", d: "Supine on a litter, legs uninjured elevated slightly if desired. Supplemental oxygen if available." },
      { t: "PRIORITIZE EVACUATION", d: "Shock = URGENT or URGENT SURGICAL precedence. State 'IN SHOCK' explicitly on the 9-line and MIST report — it changes the receiving facility's posture." },
    ],
    warnings: [
      "Children and fit young adults compensate then crash fast — trend vitals, do not fixate on one reading.",
      "Do not give oral fluids to a casualty in shock.",
      "Normal mentation + palpable radial pulse is the only field resuscitation target.",
    ],
    estSec: 120,
    medicOnly: false,
  },
  {
    slug: "tacevac-packaging-handoff",
    title: "TACEVAC — CASUALTY PACKAGING & HANDOVER",
    category: "evacuation",
    phase: "tacevac",
    summary:
      "Package casualties for safe movement on the evacuation platform and hand over with a structured MIST report so nothing dies in the transfer.",
    steps: [
      { t: "SECURE ALL INTERVENTIONS", d: "Tape down dressings, secure tourniquet windlasses, protect airway devices and lines. Rough transport will find every loose edge — find it first." },
      { t: "PACKAGE ON LITTER", d: "Strap the casualty at chest, hip and knee. Immobilize fractures with splints. Maintain spinal motion restriction only when indicated (penetrating trauma does NOT need it)." },
      { t: "MISSION BRIEF TO CREW", d: "Tell the evacuation crew: number of patients, precedence, any airway/breathing concerns, and interventions that need monitoring en route." },
      { t: "MIST HANDOVER", d: 'Report MIST: M — Mechanism of injury. I — Injuries found/suspected. S — Signs: last vitals and trend. T — Treatment given with times. Attach the TCCC card to the casualty.' },
      { t: "DOCUMENT & UPDATE M-TERS", d: "Update the casualty record to EVAC state, confirm platform and destination, and close the loop with the command post when wheels up." },
    ],
    warnings: [
      "Never hand over a casualty without the TCCC card — it is the only memory the receiving facility trusts.",
      "Recheck tourniquets and airway after every transfer between vehicles or aircraft.",
      "Expect deterioration in flight — package for the worst 10 minutes, not the best.",
    ],
    estSec: 180,
    medicOnly: false,
  },
  {
    slug: "tfc-eye-trauma-shield",
    title: "EYE TRAUMA — RIGID SHIELD",
    category: "wounds",
    phase: "tfc",
    summary:
      "Shield penetrating eye injuries with a rigid cover over the bony orbit. No pressure, no patching both eyes, and rapid evacuation.",
    steps: [
      { t: "COVER THE EYE", d: "If penetrating injury suspected (protruding object, misshapen globe, blood from the globe), cover with a rigid shield taped over the bony orbit — NO pressure on the eye itself." },
      { t: "DO NOT REMOVE OBJECTS", d: "Never remove impaled objects from the globe. Stabilize them with bulky dressings around — not on — the object." },
      { t: "KEEP BOTH EYES OUT OF PLAY", d: "Do not patch the uninjured eye unless the casualty cannot control movement — but warn them that seeing nothing increases anxiety; talk continuously." },
      { t: "AVOID STRAINING", d: "Keep the casualty calm and sitting semi-reclined. Vomiting, coughing, or carrying loads raises intraocular pressure." },
      { t: "EVACUATE URGENT", d: "Penetrating eye injuries are sight-saving emergencies. Evacuate URGENT with the shield protected from compression." },
    ],
    warnings: [
      "Never apply pressure dressings to the globe.",
      "A rigid shield may be improvised from any stiff cup — tape it to bone, not soft tissue.",
    ],
    estSec: 75,
    medicOnly: false,
  },
  {
    slug: "march-paws-survey",
    title: "MARCH-PAWS CASUALTY SURVEY",
    category: "evacuation",
    phase: "tfc",
    summary:
      "The complete Tactical Field Care survey: massive hemorrhage, airway, respirations, circulation, hypothermia/head — then pain, antibiotics, wounds, splinting.",
    steps: [
      { t: "M — MASSIVE HEMORRHAGE", d: "Sweep head-to-toe for bleeding. Tourniquets on extremities, pack junctional wounds, direct pressure. Reassess every intervention already placed." },
      { t: "A — AIRWAY", d: "Open, clear, NPA, recovery position. Advanced airway for facial trauma casualties that cannot maintain their own." },
      { t: "R — RESPIRATIONS", d: "Seal open chest wounds (vented), position for drainage, monitor for tension pneumothorax, decompress per protocol if progressing." },
      { t: "C — CIRCULATION", d: "IV/IO access, TXA within 3 hours, hypotensive resuscitation to mentation + radial pulse. Blood products beat crystalloid." },
      { t: "H — HYPOTHERMIA / HEAD", d: "Wrap every casualty. Immobilize neck wounds loosely. Document GCS/mental status — it anchors the evacuation report." },
      { t: "PAWS", d: "P: Pain control (combat wound medication pack / ketamine per scope). A: Antibiotics for penetrating trauma (moxifloxacin PO if can swallow; cefotetan IV/IO if not). W: Wounds — dress all remaining injuries. S: Splint fractures, re-check pulses." },
    ],
    warnings: [
      "MARCH order is survivability order — never skip to PAWS before MARCH is complete.",
      "Antibiotics and pain control follow unit scope-of-practice.",
      "Complete the TCCC card as you go — memory fails under load.",
    ],
    estSec: 360,
    medicOnly: false,
  },
];

async function main() {
  console.log("M-TERS seed starting…");

  // wipe in dependency order
  await db.delete(schema.netEvents);
  await db.delete(schema.casualties);
  await db.delete(schema.alerts);
  await db.delete(schema.incidents);
  await db.delete(schema.protocols);
  await db.delete(schema.users);
  await db.delete(schema.units);

  const [hq, med, apache, bones, vipers] = await db
    .insert(schema.units)
    .values([
      { code: "SABER-HQ", name: "HHC, 2-16 IN — GARRISON COC", callSign: "SABER", locationGrid: gridFor(35.262, -116.684), readiness: "green", personnel: 34 },
      { code: "SABER-MED", name: "MEDICAL DETACHMENT", callSign: "SABER MED", locationGrid: gridFor(35.2599, -116.681), readiness: "green", personnel: 12 },
      { code: "APACHE-1", name: "A CO, 2-16 IN", callSign: "APACHE", locationGrid: gridFor(35.278, -116.659), readiness: "amber", personnel: 96 },
      { code: "BONES-2", name: "B CO, 2-16 IN", callSign: "BONES", locationGrid: gridFor(35.248, -116.704), readiness: "green", personnel: 91 },
      { code: "VIPERS-3", name: "C TRP / RTE CLEARANCE", callSign: "VIPERS", locationGrid: gridFor(35.297, -116.692), readiness: "red", personnel: 44 },
    ])
    .returning();
  console.log("units:", hq.code, med.code, apache.code, bones.code, vipers.code);

  const passHash = hashPassword("Tactical2025!");

  const insertedUsers = await db
    .insert(schema.users)
    .values([
      { callSign: "SABER-6", username: "saber6", passwordHash: passHash, fullName: "Sarah Voss", rank: "LTC", role: "command", unitCode: "SABER-HQ", mosDesignation: "11A INF OFFICER", tcccLevel: "CLS" },
      { callSign: "SABER-3", username: "saber3", passwordHash: passHash, fullName: "James Halloran", rank: "CPT", role: "command", unitCode: "SABER-HQ", mosDesignation: "11A INF OFFICER", tcccLevel: "CLS" },
      { callSign: "SABER-7", username: "saber7", passwordHash: passHash, fullName: "Tomas Krieger", rank: "MSG", role: "command", unitCode: "SABER-HQ", mosDesignation: "11Z OPS SGT MAJ", tcccLevel: "CLS" },
      { callSign: "DOC-1", username: "doc1", passwordHash: passHash, fullName: "Maya Okafor", rank: "SGT", role: "medic", unitCode: "SABER-MED", mosDesignation: "68W COMBAT MEDIC", tcccLevel: "CMC" },
      { callSign: "DOC-2", username: "doc2", passwordHash: passHash, fullName: "Elias Brandt", rank: "SGT", role: "medic", unitCode: "SABER-MED", mosDesignation: "68W COMBAT MEDIC", tcccLevel: "CMC" },
      { callSign: "DOC-3", username: "doc3", passwordHash: passHash, fullName: "Rosa Delgado", rank: "SPC", role: "medic", unitCode: "SABER-MED", mosDesignation: "68W COMBAT MEDIC", tcccLevel: "CMC" },
      { callSign: "VIPER-1-1", username: "viper11", passwordHash: passHash, fullName: "John Miller", rank: "SSG", role: "field", unitCode: "VIPERS-3", mosDesignation: "11B INFANTRYMAN", tcccLevel: "CLS" },
      { callSign: "VIPER-1-2", username: "viper12", passwordHash: passHash, fullName: "David Kim", rank: "SPC", role: "field", unitCode: "VIPERS-3", mosDesignation: "11B INFANTRYMAN", tcccLevel: "CLS" },
      { callSign: "APACHE-2-1", username: "apache21", passwordHash: passHash, fullName: "Ana Petrova", rank: "SGT", role: "field", unitCode: "APACHE-1", mosDesignation: "11B TEAM LEADER", tcccLevel: "CLS" },
      { callSign: "APACHE-2-2", username: "apache22", passwordHash: passHash, fullName: "Luis Torres", rank: "PFC", role: "field", unitCode: "APACHE-1", mosDesignation: "11B INFANTRYMAN", tcccLevel: "ALL" },
      { callSign: "BONES-1-4", username: "bones14", passwordHash: passHash, fullName: "Grace Nakamura", rank: "SPC", role: "field", unitCode: "BONES-2", mosDesignation: "11B INFANTRYMAN", tcccLevel: "CLS" },
      { callSign: "BONES-2-2", username: "bones22", passwordHash: passHash, fullName: "Marcus Webb", rank: "PV2", role: "field", unitCode: "BONES-2", mosDesignation: "11B INFANTRYMAN", tcccLevel: "ALL" },
    ])
    .returning();
  const byCall = Object.fromEntries(insertedUsers.map((u) => [u.callSign, u]));
  console.log("users:", insertedUsers.length);

  const protoRows = await db
    .insert(schema.protocols)
    .values(protocols.map((p) => ({ ...p })))
    .returning();
  console.log("protocols:", protoRows.length);

  // --- ALERTS (9-line medevac) -------------------------------------------
  const req = byCall["DOC-1"];
  const req2 = byCall["APACHE-2-1"];
  const [alert1, alert2, alert3] = await db
    .insert(schema.alerts)
    .values([
      {
        alertRef: "MV-7K2Q-AA",
        status: "en_route",
        priority: "urgent",
        patients: 3,
        requesterId: req.id,
        unitCode: "SABER-MED",
        payloadEnc: encryptPayload({
          line1: gridFor(35.2815, -116.6642),
          lat: 35.2815,
          lng: -116.6642,
          line2: "FM 36.375 / SABER MED",
          line3: { A: 2, B: 0, C: 1, D: 0, E: 0 },
          line4: "A",
          line5: { L: 2, A: 1 },
          line6: "P",
          line7: "C",
          line8: "A",
          line9: "X",
          mist: {
            mechanism: "IED STRIKE ON MOUNTED PATROL, RTE ATHENA",
            injuries: "TRAUMATIC AMPUTATION L LEG, FRAG WOUNDS BILATERAL ARMS, CHEST FRAG WOUND",
            signs: "HR 122, WEAK RADIAL PULSE, GCS 13",
            treatment: "TQ X2 APPLIED 0946Z, WOUND PACKED R AXILLA, HPMK APPLIED",
          },
        }),
      },
      {
        alertRef: "MV-7K2R-BC",
        status: "sent",
        priority: "routine",
        patients: 1,
        requesterId: req2.id,
        unitCode: "APACHE-1",
        payloadEnc: encryptPayload({
          line1: gridFor(35.2742, -116.6511),
          lat: 35.2742,
          lng: -116.6511,
          line2: "FM 36.375 / APACHE-2",
          line3: { A: 0, B: 0, C: 0, D: 1, E: 0 },
          line4: "A",
          line5: { L: 0, A: 1 },
          line6: "N",
          line7: "A",
          line8: "A",
          line9: "X",
          mist: {
            mechanism: "FALL FROM VEHICLE DURING DISMOUNT",
            injuries: "SUSPECTED CLOSED FRACTURE R TIBIA",
            signs: "ALERT, HR 88, NO DISTRESS",
            treatment: "SPLINTED, PAIN CONTROL PO",
          },
        }),
      },
      {
        alertRef: "MV-7JXP-0F",
        status: "complete",
        priority: "priority",
        patients: 2,
        requesterId: byCall["VIPER-1-1"].id,
        unitCode: "VIPERS-3",
        payloadEnc: encryptPayload({
          line1: gridFor(35.2941, -116.6863),
          lat: 35.2941,
          lng: -116.6863,
          line2: "FM 36.375 / VIPER-1",
          line3: { A: 0, B: 0, C: 2, D: 0, E: 0 },
          line4: "A",
          line5: { L: 1, A: 1 },
          line6: "N",
          line7: "B",
          line8: "A",
          line9: "X",
          mist: {
            mechanism: "BLAST OVERPRESSURE, RANGE 7",
            injuries: "CONCUSSION X2, NO PENETRATING INJURY",
            signs: "A&OX3 BOTH, HR 78/82",
            treatment: "OBSERVATION, DOCUMENTED EXPOSURE",
          },
        }),
      },
    ])
    .returning();
  console.log("alerts:", alert1.alertRef, alert2.alertRef, alert3.alertRef);

  // --- CASUALTIES ---------------------------------------------------------
  await db.insert(schema.casualties).values([
    {
      casualtyRef: "C-1138",
      status: "urgent",
      phase: "tacevac",
      alertId: alert1.id,
      unitCode: "VIPERS-3",
      payloadEnc: encryptPayload({ mechanism: "IED BLAST", injuries: ["AMPUTATION L LEG", "HEMORRHAGIC SHOCK"], meds: "TQ, TXA" }),
      treatmentLog: [
        { t: "0946Z", note: "TQ APPLIED HIGH L THIGH, BLEEDING CONTROLLED", by: "DOC-1" },
        { t: "0955Z", note: "TXA 2G IO, HPMK APPLIED, MOVED TO CCP", by: "DOC-1" },
        { t: "1008Z", note: "LOADED ON DUSTOFF-2, EN ROUTE ROLE 2", by: "DOC-2" },
      ],
    },
    {
      casualtyRef: "C-1139",
      status: "urgent",
      phase: "tfc",
      alertId: alert1.id,
      unitCode: "VIPERS-3",
      payloadEnc: encryptPayload({ mechanism: "IED BLAST", injuries: ["FRAG WOUNDS BILATERAL ARMS", "OPEN PNEUMOTHORAX R"], meds: "VENTED SEAL" }),
      treatmentLog: [
        { t: "0952Z", note: "VENTED CHEST SEAL R SIDE, POSITIONED INJURED SIDE DOWN", by: "DOC-1" },
        { t: "1001Z", note: "BREATHING IMPROVED, SPO2 94%, MONITORING FOR TENSION", by: "DOC-1" },
      ],
    },
    {
      casualtyRef: "C-1140",
      status: "priority",
      phase: "tfc",
      alertId: alert1.id,
      unitCode: "VIPERS-3",
      payloadEnc: encryptPayload({ mechanism: "IED BLAST", injuries: ["CONCUSSION", "LACERATION SCALP"], meds: "DRESSING" }),
      treatmentLog: [
        { t: "0950Z", note: "SCALP WOUND DRESSED, GCS 15, WALKING WOUNDED", by: "VIPER-1-1" },
      ],
    },
    {
      casualtyRef: "C-1144",
      status: "routine",
      phase: "tfc",
      unitCode: "APACHE-1",
      payloadEnc: encryptPayload({ mechanism: "FALL", injuries: ["FRACTURE R TIBIA"], meds: "SPLINT, CWMP" }),
      treatmentLog: [
        { t: "1031Z", note: "SPLINT APPLIED, DISTAL PULSE PRESENT", by: "APACHE-2-1" },
      ],
    },
  ]);

  // --- INCIDENTS ----------------------------------------------------------
  const rep1 = byCall["VIPER-1-1"];
  const rep2 = byCall["BONES-1-4"];
  const rep3 = byCall["SABER-3"];
  await db.insert(schema.incidents).values([
    {
      ref: "HZ-88F1-QA",
      type: "ied",
      severity: "critical",
      status: "responding",
      lat: 35.2861,
      lng: -116.6698,
      reporterId: rep1.id,
      unitCode: "VIPERS-3",
      payloadEnc: encryptPayload({
        grid: gridFor(35.2861, -116.6698),
        description: "COMMAND-WIRE IED LOCATED, RTE ATHENA KM 4.2. PARTIAL BURIAL, WIRE TRACES EAST BERM. CORDON SET 300M. EOD REQUESTED.",
      }),
    },
    {
      ref: "HZ-88F2-RB",
      type: "fire",
      severity: "high",
      status: "ack",
      lat: 35.2637,
      lng: -116.6901,
      reporterId: rep2.id,
      unitCode: "BONES-2",
      payloadEnc: encryptPayload({
        grid: gridFor(35.2637, -116.6901),
        description: "FUEL POINT 2 — VEHICLE FIRE SPREAD TO BLIVET RACK. NO PERSONNEL IN CONTACT AREA. GARRISON FD NOTIFIED, WIND SW 12KT TOWARD MOTOR POOL.",
      }),
    },
    {
      ref: "HZ-88F3-SC",
      type: "enemy",
      severity: "medium",
      status: "reported",
      lat: 35.3012,
      lng: -116.6777,
      reporterId: rep1.id,
      unitCode: "VIPERS-3",
      payloadEnc: encryptPayload({
        grid: gridFor(35.3012, -116.6777),
        description: "OBSERVED 4X OPFOR DISMOUNTS MOVING SW ALONG RIDGE 214, 1.1KM NORTH. NO WEAPONS VISIBLE. BREAKING CONTACT, WILL RE-OBSERVE FROM OP NORTH.",
      }),
    },
    {
      ref: "HZ-88E9-TD",
      type: "uxo",
      severity: "low",
      status: "monitored",
      lat: 35.2556,
      lng: -116.6724,
      reporterId: rep2.id,
      unitCode: "BONES-2",
      payloadEnc: encryptPayload({
        grid: gridFor(35.2556, -116.6724),
        description: "UXO, APPEARS 60MM MORTAR, SURFACE LAID, RANGE 7 IMPACT AREA EDGE. MARKED WITH CHEMLIGHT + VS-17. RANGE CONTROL INFORMED.",
      }),
    },
    {
      ref: "HZ-88E5-UE",
      type: "accident",
      severity: "medium",
      status: "resolved",
      lat: 35.2601,
      lng: -116.6831,
      reporterId: rep3.id,
      unitCode: "SABER-HQ",
      payloadEnc: encryptPayload({
        grid: gridFor(35.2601, -116.6831),
        description: "HMMWV ROLLOVER, MOTOR POOL ACCESS ROAD. VEHICLE RIGHTED, NO CASUALTIES, HAZMAT SPILL KIT DEPLOYED FOR FUEL LEAK. CLOSED.",
      }),
    },
  ]);

  // --- NET EVENTS (digital logbook) ---------------------------------------
  const now = Date.now();
  const minutesAgo = (m: number) => new Date(now - m * 60000);
  await db.insert(schema.netEvents).values([
    { kind: "system", message: "M-TERS NET ESTABLISHED — AES-256-GCM CHANNEL ACTIVE", ref: "SYS", actor: "M-TERS CORE", createdAt: minutesAgo(74) },
    { kind: "incident", message: "UXO REPORTED — RANGE 7 IMPACT AREA EDGE, MARKED", ref: "HZ-88E9-TD", actor: "BONES-1-4", createdAt: minutesAgo(52) },
    { kind: "incident", message: "IED LOCATED RTE ATHENA KM 4.2 — CORDON 300M, EOD REQUESTED", ref: "HZ-88F1-QA", actor: "VIPER-1-1", createdAt: minutesAgo(41) },
    { kind: "medevac", message: "9-LINE RECEIVED — MV-7K2Q-AA — 2 URGENT 1 PRIORITY, RTE ATHENA", ref: "MV-7K2Q-AA", actor: "DOC-1", createdAt: minutesAgo(26) },
    { kind: "medevac", message: "DUSTOFF-2 WHEELS UP — EN ROUTE PZ GRID 11S NV 6641 2815", ref: "MV-7K2Q-AA", actor: "SABER-3", createdAt: minutesAgo(18) },
    { kind: "casualty", message: "C-1138 TXA 2G IO — LOADED, EVAC IN PROGRESS", ref: "C-1138", actor: "DOC-2", createdAt: minutesAgo(17) },
    { kind: "incident", message: "FUEL POINT 2 VEHICLE FIRE — GARRISON FD NOTIFIED", ref: "HZ-88F2-RB", actor: "BONES-1-4", createdAt: minutesAgo(12) },
    { kind: "medevac", message: "9-LINE RECEIVED — MV-7K2R-BC — 1 ROUTINE, FRACTURE", ref: "MV-7K2R-BC", actor: "APACHE-2-1", createdAt: minutesAgo(9) },
    { kind: "status", message: "APACHE-1 READINESS DEGRADED — RETURNING FROM PATROL", ref: "APACHE-1", actor: "SABER-3", createdAt: minutesAgo(6) },
    { kind: "incident", message: "OPFOR MOVEMENT REPORTED RIDGE 214 — 4 DISMOUNTS SW", ref: "HZ-88F3-SC", actor: "VIPER-1-1", createdAt: minutesAgo(2) },
  ]);

  console.log("M-TERS seed complete.");
  await pool.end();
  process.exit(0);
}

main().catch(async (e) => {
  console.error(e);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
