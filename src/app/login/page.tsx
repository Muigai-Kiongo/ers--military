"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Cross,
  Eye,
  EyeOff,
  Fingerprint,
  KeyRound,
  Lock,
  Radio,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User,
  UserCheck,
  UserPlus,
  Wifi,
} from "lucide-react";
import type { RosterUser } from "@/lib/types";
import { ROLE_LABEL } from "@/lib/domain";
import { Led } from "@/components/ui";

const BOOT_LINES = [
  "INITIALIZING SECURE SATCOM HANDSHAKE …",
  "TRANSMITTING CIPHER IDENTITY TO GARRISON ROSTER …",
  "SCRYPT HASH INTEGRITY & CLEARANCE CHECK — OK",
  "DECRYPTING OPERATIONAL ROLE PRIVILEGES …",
  "ESTABLISHING AES-256-GCM ENCRYPTED SESSION …",
  "ACCESS GRANTED — WELCOME TO THE NET",
];

const TICKER = [
  "TCCC PROTOCOLS SYNCED — REV 2025.11",
  "ROLE-BASED ENCRYPTED SESSIONS · ZERO PLAINTEXT PASSWORDS",
  "OFFLINE CAPABLE — QUEUED TRANSMISSIONS AUTOSYNC",
  "FOB SABER COC NET — SATCOM LINK NOMINAL",
  "NIGHT OPTIMIZED — NVG / AMBER / NSG DISPLAY MODES",
  "OPSEC PROTOCOL ACTIVE — ALL AUTHENTICATION ATTEMPTS LOGGED",
];

type RoleType = "field" | "medic" | "command";

interface RoleMeta {
  role: RoleType;
  title: string;
  badge: string;
  clearance: string;
  color: string;
  borderColor: string;
  bgGlow: string;
  icon: typeof Shield;
  scope: string[];
  defaultUser: { callSign: string; username: string; rank: string; name: string };
  redirectPath: string;
}

const ROLES: Record<RoleType, RoleMeta> = {
  field: {
    role: "field",
    title: "FIELD OPERATOR",
    badge: "FORCE PROTECTION",
    clearance: "CLEARANCE LEVEL 3 // TACTICAL PATROL",
    color: "text-emerald-400",
    borderColor: "border-emerald-500/50",
    bgGlow: "bg-emerald-500/10",
    icon: Cross,
    scope: [
      "Immediate 9-Line MEDEVAC submission with auto-MGRS grid",
      "Field Care Under Fire & MARCH casualty algorithms",
      "Squad-level hazard reporting (IED, UXO, Enemy, CBRN)",
    ],
    defaultUser: { callSign: "VIPER-1-1", username: "viper11", rank: "SSG", name: "John Miller" },
    redirectPath: "/",
  },
  medic: {
    role: "medic",
    title: "COMBAT MEDIC",
    badge: "MEDICAL DETACHMENT",
    clearance: "CLEARANCE LEVEL 2 // CLINICAL TRIAGE",
    color: "text-cyan-400",
    borderColor: "border-cyan-500/50",
    bgGlow: "bg-cyan-500/10",
    icon: Activity,
    scope: [
      "Casualty Triage Management Board & evacuation tracking",
      "Advanced Tactical Field Care (TFC) & TACEVAC surgical guides",
      "MIST logbook recording & real-time treatment journal",
    ],
    defaultUser: { callSign: "DOC-1", username: "doc1", rank: "SGT", name: "Maya Okafor" },
    redirectPath: "/triage",
  },
  command: {
    role: "command",
    title: "COMMAND & CONTROL",
    badge: "HQ COC STAFF",
    clearance: "CLEARANCE LEVEL 1 // GARRISON AUTHORITY",
    color: "text-amber-400",
    borderColor: "border-amber-500/50",
    bgGlow: "bg-amber-500/10",
    icon: Shield,
    scope: [
      "Common Operational Picture & garrison situation room",
      "Unit readiness assessment & force posture controls",
      "Garrison identity roster management & personnel admin",
    ],
    defaultUser: { callSign: "SABER-6", username: "saber6", rank: "LTC", name: "Sarah Voss" },
    redirectPath: "/",
  },
};

const RANKS = ["PVT", "PV2", "PFC", "SPC", "CPL", "SGT", "SSG", "SFC", "MSG", "2LT", "1LT", "CPT", "MAJ", "LTC", "COL"];

function RadarMark({ role }: { role: RoleType }) {
  const accent = role === "medic" ? "#06b6d4" : role === "command" ? "#f59e0b" : "var(--acc)";
  return (
    <div className="relative h-32 w-32 sm:h-40 sm:w-40">
      <div className="absolute inset-0 rounded-full border border-line" />
      <div className="absolute inset-3 rounded-full border border-line" />
      <div className="absolute inset-7 rounded-full border border-line" />
      <div className="absolute inset-0 rounded-full border border-line-strong opacity-60" />
      <div className="absolute inset-0 overflow-hidden rounded-full">
        <div
          className="radar-sweep absolute inset-0"
          style={{
            background: `conic-gradient(from 0deg, ${accent} 0deg, transparent 70deg, transparent 360deg)`,
            opacity: 0.22,
          }}
        />
      </div>
      <div className="absolute top-1/2 left-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: accent }} />
      <div className="absolute top-[28%] left-[62%] h-1.5 w-1.5 bg-danger shadow-[0_0_8px_var(--danger)]" />
      <div className="absolute top-[66%] left-[35%] h-1 w-1 rounded-full" style={{ background: accent }} />
      <div className="absolute top-[49%] left-[70%] h-1 w-1 bg-warn" />
      <div className="absolute top-1/2 right-0 left-0 h-px bg-line" />
      <div className="absolute top-0 bottom-0 left-1/2 w-px bg-line" />
      <Cross size={16} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ color: accent }} strokeWidth={2.5} />
    </div>
  );
}

export default function LoginPage() {
  const router = useRouter();

  // Authentication mode: login or register
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [selectedRole, setSelectedRole] = useState<RoleType>("field");

  // Login form state
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("Tactical2025!");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  // Registration form state
  const [regCallSign, setRegCallSign] = useState("");
  const [regUsername, setRegUsername] = useState("");
  const [regFullName, setRegFullName] = useState("");
  const [regRank, setRegRank] = useState("SPC");
  const [regUnit, setRegUnit] = useState("SABER-HQ");
  const [regPassword, setRegPassword] = useState("Tactical2025!");

  // Garrison roster directory
  const [roster, setRoster] = useState<RosterUser[]>([]);
  const [showDirectory, setShowDirectory] = useState(false);

  // Flow status
  const [phase, setPhase] = useState<"idle" | "boot" | "deny">("idle");
  const [bootLine, setBootLine] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  // Fetch garrison roster
  useEffect(() => {
    fetch("/api/roster")
      .then((r) => r.json())
      .then((d) => setRoster(d.users ?? []))
      .catch(() => setRoster([]));

    const iv = setInterval(() => setTick((t) => t + 1), 3200);
    return () => clearInterval(iv);
  }, []);

  // Quick fill preset credentials for the chosen role
  const fillRoleCredentials = (role: RoleType) => {
    setSelectedRole(role);
    setIdentifier(ROLES[role].defaultUser.callSign);
    setPassword("Tactical2025!");
    setErrorMsg(null);
  };

  // Prepopulate default user on initial load
  useEffect(() => {
    setIdentifier(ROLES.field.defaultUser.callSign);
  }, []);

  // Handle Login submission
  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim() || !password || phase === "boot") return;

    setErrorMsg(null);
    setPhase("boot");
    setBootLine(0);

    for (let i = 0; i < BOOT_LINES.length; i++) {
      setBootLine(i);
      await new Promise((r) => setTimeout(r, i === BOOT_LINES.length - 1 ? 380 : 260));
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSign: identifier.trim(),
          username: identifier.trim(),
          password,
          role: selectedRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "AUTHENTICATION FAILED");
      }

      // Successful login -> route to appropriate destination based on role
      const targetRole = (data.user?.role as RoleType) ?? selectedRole;
      const target = ROLES[targetRole]?.redirectPath ?? "/";
      router.replace(target);
    } catch (err) {
      setPhase("deny");
      setErrorMsg(err instanceof Error ? err.message : "AUTHENTICATION FAILED");
      setTimeout(() => setPhase("idle"), 2800);
    }
  };

  // Handle Registration submission
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regCallSign.trim() || !regFullName.trim() || !regPassword || phase === "boot") return;

    setErrorMsg(null);
    setPhase("boot");
    setBootLine(0);

    for (let i = 0; i < 4; i++) {
      setBootLine(i);
      await new Promise((r) => setTimeout(r, 280));
    }

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          callSign: regCallSign.trim().toUpperCase(),
          username: regUsername.trim().toLowerCase() || regCallSign.trim().toLowerCase().replace(/[^a-z0-9]/g, ""),
          fullName: regFullName.trim(),
          rank: regRank,
          role: selectedRole,
          unitCode: regUnit,
          password: regPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "ENLISTMENT FAILED");
      }

      const target = ROLES[selectedRole]?.redirectPath ?? "/";
      router.replace(target);
    } catch (err) {
      setPhase("deny");
      setErrorMsg(err instanceof Error ? err.message : "ENLISTMENT FAILED");
      setTimeout(() => setPhase("idle"), 2800);
    }
  };

  const currentRoleMeta = ROLES[selectedRole];
  const IconComponent = currentRoleMeta.icon;

  const groupedRoster = useMemo(() => {
    return {
      field: roster.filter((u) => u.role === "field"),
      medic: roster.filter((u) => u.role === "medic"),
      command: roster.filter((u) => u.role === "command"),
    };
  }, [roster]);

  return (
    <div className="flex min-h-dvh flex-col bg-bg0 text-ink selection:bg-acc selection:text-bg0">
      {/* Classification bar */}
      <div className="border-b border-line bg-panel px-4 py-1.5 text-center font-data text-[10px] tracking-[0.4em] text-acc">
        FOUO // JOINT TASK FORCE COMMAND // RESTRICTED ACCESS TACTICAL TERMINAL
      </div>

      <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 gap-6 p-4 sm:p-6 lg:grid-cols-12 lg:gap-8">
        {/* Left Side: System Information & Role Overview */}
        <section className="relative flex flex-col justify-between overflow-hidden border border-line bg-panel/75 p-6 lg:col-span-5 sm:p-8">
          <div className="grid-bg pointer-events-none absolute inset-0 opacity-40" />

          <div className="relative">
            <div className="flex items-center gap-2.5">
              <Led tone="ok" />
              <span className="font-data text-[10px] tracking-[0.3em] text-acc">SATCOM SECURE LINK</span>
              <Lock size={11} className="text-faint" />
              <span className="font-data text-[10px] tracking-[0.2em] text-faint">AES-256</span>
            </div>

            <div className="mt-6 flex items-baseline gap-3">
              <h1 className="font-disp text-5xl font-black tracking-wider text-ink sm:text-6xl">
                M-TERS
              </h1>
              <span className="font-data rounded border border-line px-2 py-0.5 text-[9px] font-bold tracking-widest text-acc">
                v4.3 SECURE
              </span>
            </div>

            <div className="mt-1 font-disp text-xs font-semibold tracking-[0.25em] text-acc">
              MILITARY TACTICAL EMERGENCY RESPONSE SYSTEM
            </div>

            <p className="mt-4 text-xs leading-relaxed text-dim sm:text-sm">
              Digitized encrypted combat casualty care, 9-line MEDEVAC transmission, and real-time command situation awareness. Built for high-stress tactical environments and fully operational under NVG illumination.
            </p>

            {/* Dynamic Role Capability Card */}
            <div className={`mt-6 border p-4 transition-all duration-300 ${currentRoleMeta.borderColor} ${currentRoleMeta.bgGlow}`}>
              <div className="flex items-center justify-between gap-2 border-b border-line pb-2.5">
                <div className="flex items-center gap-2">
                  <IconComponent size={16} className={currentRoleMeta.color} />
                  <span className="font-disp text-sm font-bold tracking-wider text-ink">
                    {currentRoleMeta.title}
                  </span>
                </div>
                <span className={`font-data text-[9px] font-semibold tracking-wider uppercase ${currentRoleMeta.color}`}>
                  {currentRoleMeta.badge}
                </span>
              </div>

              <div className="font-data mt-2 text-[9px] tracking-[0.2em] text-faint">
                {currentRoleMeta.clearance}
              </div>

              <ul className="mt-3 space-y-1.5 font-data text-[11px] tracking-wide text-dim">
                {currentRoleMeta.scope.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className={currentRoleMeta.color}>▸</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Quick-fill buttons */}
            <div className="mt-6">
              <div className="font-data text-[10px] tracking-[0.25em] text-faint uppercase">
                QUICK-FILL TEST CREDENTIALS
              </div>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {(["field", "medic", "command"] as RoleType[]).map((r) => {
                  const meta = ROLES[r];
                  const active = selectedRole === r;
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => fillRoleCredentials(r)}
                      className={`t-corners border p-2 text-left transition-all ${
                        active
                          ? `${meta.borderColor} ${meta.bgGlow} shadow-sm`
                          : "border-line bg-panel2/70 hover:border-line-strong hover:bg-panel2"
                      }`}
                    >
                      <div className="font-disp text-xs font-bold tracking-wider text-ink">
                        {meta.defaultUser.callSign}
                      </div>
                      <div className={`font-data text-[9px] tracking-wider uppercase ${meta.color}`}>
                        {r}
                      </div>
                      <div className="font-data text-[8px] tracking-tight text-faint">
                        Tactical2025!
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="relative mt-8 flex items-end justify-between gap-4">
            <RadarMark role={selectedRole} />
            <div className="flex flex-col items-end gap-1 text-right">
              <span className="font-data text-[10px] tracking-[0.25em] text-faint">FOB SABER COC</span>
              <span className="font-data text-[10px] tracking-[0.25em] text-faint">JOINT TASK FORCE</span>
              <span className="font-data mt-1 text-[10px] tracking-[0.25em] text-acc">GARRISON NET // ONLINE</span>
            </div>
          </div>
        </section>

        {/* Right Side: Authentication Panel */}
        <section className="flex flex-col border border-line bg-panel/75 lg:col-span-7">
          {/* Role Selection Tabs */}
          <div className="border-b border-line bg-panel2/50 p-3 sm:p-4">
            <div className="font-data mb-2.5 flex items-center justify-between text-[10px] tracking-[0.3em] text-faint">
              <span>SELECT TACTICAL ROLE CLEARANCE</span>
              <span className="text-acc">{currentRoleMeta.badge}</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(["field", "medic", "command"] as RoleType[]).map((r) => {
                const meta = ROLES[r];
                const active = selectedRole === r;
                const RoleIcon = meta.icon;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSelectedRole(r);
                      setErrorMsg(null);
                    }}
                    className={`relative flex items-center justify-center gap-2 border py-2.5 px-3 transition-all ${
                      active
                        ? `${meta.borderColor} ${meta.bgGlow} shadow-sm`
                        : "border-line bg-panel hover:border-line-strong hover:bg-panel2"
                    }`}
                  >
                    <RoleIcon size={14} className={active ? meta.color : "text-faint"} />
                    <span className={`font-disp text-xs font-bold tracking-wider ${active ? "text-ink" : "text-dim"}`}>
                      {meta.title}
                    </span>
                    {active && (
                      <motion.div
                        layoutId="activeRoleIndicator"
                        className={`absolute -bottom-px left-0 right-0 h-0.5 ${meta.color.replace("text-", "bg-")}`}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Mode Switcher: Sign In vs Enlist */}
          <div className="flex border-b border-line bg-panel/50">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setErrorMsg(null);
              }}
              className={`flex-1 py-3 text-center font-disp text-xs font-bold tracking-[0.2em] transition-colors ${
                authMode === "login"
                  ? "border-b-2 border-acc bg-panel text-ink"
                  : "text-faint hover:text-dim"
              }`}
            >
              AUTHENTICATE IDENTITY
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setErrorMsg(null);
              }}
              className={`flex-1 py-3 text-center font-disp text-xs font-bold tracking-[0.2em] transition-colors ${
                authMode === "register"
                  ? "border-b-2 border-acc bg-panel text-ink"
                  : "text-faint hover:text-dim"
              }`}
            >
              ENLIST OPERATOR
            </button>
          </div>

          {/* Form Container */}
          <div className="grid-bg flex-1 p-6">
            {errorMsg && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-5 flex items-start gap-3 border border-danger/60 bg-danger/10 p-3 text-danger"
              >
                <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                <div className="text-xs">
                  <div className="font-disp font-bold tracking-wider">ACCESS REJECTED</div>
                  <div className="font-data mt-0.5 tracking-wide">{errorMsg}</div>
                </div>
              </motion.div>
            )}

            {authMode === "login" ? (
              /* LOGIN FORM */
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="font-data flex items-center justify-between text-[11px] tracking-[0.2em] text-dim">
                    <span>CALLSIGN OR USERNAME</span>
                    <span className="text-[10px] text-faint">E.G. SABER-6, DOC-1, VIPER-1-1</span>
                  </label>
                  <div className="relative mt-1.5">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
                      <User size={15} />
                    </div>
                    <input
                      type="text"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="ENTER CALLSIGN OR USERNAME"
                      autoComplete="username"
                      required
                      className="font-disp w-full border border-line bg-panel2/80 py-2.5 pr-4 pl-10 text-sm font-semibold tracking-wider text-ink transition-colors placeholder:text-faint/60 focus:border-acc focus:bg-panel2 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <label className="font-data text-[11px] tracking-[0.2em] text-dim">
                      SECURITY KEY / PASSWORD
                    </label>
                    {capsLock && (
                      <span className="font-data text-[10px] tracking-wider text-warn">
                        CAPS LOCK ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1.5">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-faint">
                      <KeyRound size={15} />
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      onKeyDown={(e) => setCapsLock(e.getModifierState("CapsLock"))}
                      placeholder="ENTER SECURE KEY"
                      autoComplete="current-password"
                      required
                      className="font-mono w-full border border-line bg-panel2/80 py-2.5 pr-10 pl-10 text-sm tracking-wider text-ink transition-colors placeholder:text-faint/60 focus:border-acc focus:bg-panel2 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-faint hover:text-dim"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Role Badge Indicator */}
                <div className={`flex items-center justify-between border px-3 py-2 text-xs ${currentRoleMeta.borderColor} ${currentRoleMeta.bgGlow}`}>
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={14} className={currentRoleMeta.color} />
                    <span className="font-data text-[10px] tracking-wider text-dim">
                      AUTHENTICATING FOR:
                    </span>
                  </div>
                  <span className={`font-disp text-xs font-bold tracking-wider ${currentRoleMeta.color}`}>
                    {currentRoleMeta.title}
                  </span>
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={phase === "boot" || !identifier.trim() || !password}
                  className={`glow-pulse font-disp mt-2 flex w-full items-center justify-center gap-2 border py-3 text-base font-bold tracking-[0.2em] transition-all ${
                    identifier.trim() && password && phase !== "boot"
                      ? "border-acc bg-acc text-bg0 hover:bg-acc2"
                      : "cursor-not-allowed border-line bg-panel2 text-faint"
                  }`}
                >
                  <Fingerprint size={18} />
                  {phase === "boot" ? "VERIFYING CIPHER …" : `AUTHENTICATE — ${selectedRole.toUpperCase()}`}
                </button>
              </form>
            ) : (
              /* REGISTRATION / ENLIST FORM */
              <form onSubmit={handleRegister} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      OPERATOR CALLSIGN *
                    </label>
                    <input
                      type="text"
                      value={regCallSign}
                      onChange={(e) => setRegCallSign(e.target.value.toUpperCase())}
                      placeholder="E.G. HAWK-1"
                      required
                      className="font-disp mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs font-semibold tracking-wider text-ink focus:border-acc focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      LOGIN USERNAME
                    </label>
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value.toLowerCase())}
                      placeholder="E.G. hawk1"
                      className="font-disp mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs font-semibold tracking-wider text-ink focus:border-acc focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      FULL NAME *
                    </label>
                    <input
                      type="text"
                      value={regFullName}
                      onChange={(e) => setRegFullName(e.target.value)}
                      placeholder="E.G. Michael Scott"
                      required
                      className="font-disp mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs font-semibold tracking-wider text-ink focus:border-acc focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      RANK
                    </label>
                    <select
                      value={regRank}
                      onChange={(e) => setRegRank(e.target.value)}
                      className="font-disp mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs font-semibold tracking-wider text-ink focus:border-acc focus:outline-none"
                    >
                      {RANKS.map((r) => (
                        <option key={r} value={r} className="bg-panel text-ink">
                          {r}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      GARRISON ATTACHMENT
                    </label>
                    <select
                      value={regUnit}
                      onChange={(e) => setRegUnit(e.target.value)}
                      className="font-disp mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs font-semibold tracking-wider text-ink focus:border-acc focus:outline-none"
                    >
                      <option value="SABER-HQ" className="bg-panel text-ink">SABER-HQ (COC)</option>
                      <option value="SABER-MED" className="bg-panel text-ink">SABER-MED (CLINIC)</option>
                      <option value="APACHE-1" className="bg-panel text-ink">APACHE-1 (A CO)</option>
                      <option value="BONES-2" className="bg-panel text-ink">BONES-2 (B CO)</option>
                      <option value="VIPERS-3" className="bg-panel text-ink">VIPERS-3 (C TRP)</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                      ASSIGNED ROLE
                    </label>
                    <div className={`mt-1 border px-3 py-2 text-xs font-bold uppercase ${currentRoleMeta.borderColor} ${currentRoleMeta.color}`}>
                      {ROLE_LABEL[selectedRole]}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="font-data text-[10px] tracking-[0.2em] text-dim">
                    CREATE SECURITY KEY / PASSWORD *
                  </label>
                  <input
                    type="password"
                    value={regPassword}
                    onChange={(e) => setRegPassword(e.target.value)}
                    placeholder="MINIMUM 6 CHARACTERS"
                    required
                    className="font-mono mt-1 w-full border border-line bg-panel2/80 px-3 py-2 text-xs tracking-wider text-ink focus:border-acc focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={phase === "boot" || !regCallSign.trim() || !regFullName.trim() || !regPassword}
                  className="glow-pulse font-disp mt-3 flex w-full items-center justify-center gap-2 border border-acc bg-acc py-3 text-sm font-bold tracking-[0.2em] text-bg0 transition-all hover:bg-acc2"
                >
                  <UserPlus size={16} />
                  ENLIST & INITIALIZE CHANNEL
                </button>
              </form>
            )}

            {/* Garrison Directory Accordion */}
            <div className="mt-6 border-t border-line pt-4">
              <button
                type="button"
                onClick={() => setShowDirectory((s) => !s)}
                className="flex w-full items-center justify-between text-left font-data text-[10px] tracking-[0.2em] text-faint hover:text-dim"
              >
                <span>VIEW GARRISON ROSTER ({roster.length} IDENTITIES ON NET)</span>
                <ChevronRight size={14} className={`transform transition-transform ${showDirectory ? "rotate-90" : ""}`} />
              </button>

              {showDirectory && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 max-h-56 space-y-3 overflow-y-auto pr-1"
                >
                  {(["command", "medic", "field"] as RoleType[]).map((r) => {
                    const list = groupedRoster[r];
                    if (!list || list.length === 0) return null;
                    return (
                      <div key={r}>
                        <div className="font-data mb-1 text-[9px] tracking-[0.25em] text-faint uppercase">
                          {ROLE_LABEL[r]} ({list.length})
                        </div>
                        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {list.map((u) => (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setSelectedRole(r);
                                setIdentifier(u.callSign);
                                setPassword("Tactical2025!");
                                setErrorMsg(null);
                              }}
                              className="border border-line bg-panel2/60 p-2 text-left hover:border-acc hover:bg-panel2 transition-colors"
                            >
                              <div className="font-disp text-xs font-bold tracking-wide text-ink truncate">
                                {u.rank} {u.callSign}
                              </div>
                              <div className="font-data text-[9px] tracking-wider text-faint truncate">
                                {u.fullName}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              )}
            </div>
          </div>

          <div className="border-t border-line bg-panel/90 px-6 py-3 text-center font-data text-[9px] tracking-[0.25em] text-faint">
            WARNING: CLASSIFIED TACTICAL NETWORK // UNAUTHORIZED ATTEMPTS LOGGED WITH MGRS LOCATION
          </div>
        </section>
      </div>

      {/* Real-time Ticker */}
      <div className="overflow-hidden border-t border-line bg-panel px-4 py-1.5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tick % TICKER.length}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="text-center font-data text-[10px] tracking-[0.3em] text-dim"
          >
            {TICKER[tick % TICKER.length]}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Boot & Authentication Progress Overlay */}
      <AnimatePresence>
        {phase !== "idle" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-bg0/95 p-4 backdrop-blur-md"
          >
            <div className="relative w-full max-w-lg border border-line bg-panel p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <Led tone={phase === "deny" ? "danger" : "ok"} />
                  <span className="font-disp text-sm font-bold tracking-widest text-ink">
                    {phase === "deny" ? "AUTHENTICATION DENIED" : "GARRISON CIPHER VERIFICATION"}
                  </span>
                </div>
                <span className="font-data text-[10px] tracking-widest text-acc">
                  SATCOM // 12H TTL
                </span>
              </div>

              {phase === "boot" && (
                <div className="mt-5 space-y-2.5 font-data text-xs tracking-wider">
                  {BOOT_LINES.map((line, idx) => {
                    const done = idx < bootLine;
                    const curr = idx === bootLine;
                    return (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 transition-colors ${
                          done ? "text-acc" : curr ? "text-ink font-semibold" : "text-faint/40"
                        }`}
                      >
                        <span className="w-5 text-right font-mono text-[10px]">
                          {done ? "✓" : curr ? "▸" : "·"}
                        </span>
                        <span>{line}</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {phase === "deny" && (
                <div className="mt-5 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-danger/40 bg-danger/10 text-danger">
                    <ShieldAlert size={24} />
                  </div>
                  <div className="font-disp mt-3 text-lg font-bold tracking-wider text-danger">
                    SECURITY ACCESS REJECTED
                  </div>
                  <div className="font-data mt-2 text-xs tracking-wider text-dim">
                    {errorMsg || "INVALID CALLSIGN, USERNAME, OR SECURITY PASSWORD"}
                  </div>
                  <div className="font-data mt-4 text-[9px] tracking-widest text-faint">
                    SECURITY INCIDENT LOGGED TO GARRISON NET EVENT REGISTRY
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
