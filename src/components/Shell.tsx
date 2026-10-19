"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  Activity,
  BookOpen,
  Cross,
  EyeOff,
  LayoutGrid,
  Lock,
  LogOut,
  Moon,
  Radar,
  ShieldCheck,
  Siren,
  Sun,
} from "lucide-react";
import type { MeUser } from "@/lib/types";
import { clockZulu, ROLE_LABEL } from "@/lib/domain";
import { flushQueue, queueCount } from "@/lib/client/net";
import { useClock, useOnline } from "@/lib/client/hooks";
import { Led } from "@/components/ui";

type Mode = "green" | "amber" | "red";
const MODE_LABEL: Record<Mode, string> = { green: "NVG", amber: "AMB", red: "NSG" };
const MODE_NEXT: Record<Mode, Mode> = { green: "amber", amber: "red", red: "green" };

const MeContext = createContext<MeUser | null>(null);

export function useMe(): MeUser | null {
  return useContext(MeContext);
}

interface NavItem {
  href: string;
  code: string;
  label: string;
  icon: ReactNode;
  roles: string[];
  danger?: boolean;
}

const NAV: NavItem[] = [
  { href: "/", code: "OPS", label: "OPERATIONS", icon: <LayoutGrid size={21} strokeWidth={1.75} />, roles: ["field", "medic", "command"] },
  { href: "/guide", code: "GUIDE", label: "TCCC GUIDE", icon: <BookOpen size={21} strokeWidth={1.75} />, roles: ["field", "medic", "command"] },
  { href: "/report", code: "REPORT", label: "HAZARD REP", icon: <Siren size={21} strokeWidth={1.75} />, roles: ["field", "medic", "command"] },
  { href: "/medevac", code: "9-LINE", label: "MEDEVAC", icon: <Cross size={22} strokeWidth={2} />, roles: ["field", "medic", "command"], danger: true },
  { href: "/board", code: "BOARD", label: "SITUATION", icon: <Radar size={21} strokeWidth={1.75} />, roles: ["field", "medic", "command"] },
  { href: "/triage", code: "TRIAGE", label: "CASUALTIES", icon: <Activity size={21} strokeWidth={1.75} />, roles: ["medic", "command"] },
  { href: "/admin", code: "ADMIN", label: "MANAGE", icon: <ShieldCheck size={21} strokeWidth={1.75} />, roles: ["command"] },
];

function NavIcon({ item, active, compact }: { item: NavItem; active: boolean; compact?: boolean }) {
  const base = item.danger
    ? active
      ? "bg-danger text-bg0 sos-pulse"
      : "text-danger hover:bg-danger/15 border-danger/50 border"
    : active
      ? "bg-acc text-bg0"
      : "text-dim hover:text-acc hover:bg-panel2 border border-transparent";
  const body = (
    <span className={`flex flex-col items-center justify-center gap-1 w-full ${compact ? "py-2" : "py-2.5"}`}>
      {item.icon}
      <span className="font-disp text-[9px] font-semibold tracking-[0.18em]">{compact ? item.label : item.code}</span>
    </span>
  );
  return <span className={`block w-full ${base} transition-colors`}>{body}</span>;
}

export default function Shell({ user, children }: { user: MeUser; children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const now = useClock();
  const online = useOnline();
  const [queue, setQueue] = useState(0);
  const [mode, setMode] = useState<Mode>("green");
  const [dim, setDim] = useState(1);
  const [blackout, setBlackout] = useState(false);

  // restore display prefs
  useEffect(() => {
    const m = (localStorage.getItem("mters_mode") as Mode) || "green";
    setMode(["green", "amber", "red"].includes(m) ? m : "green");
    const d = Number(localStorage.getItem("mters_dim") ?? "1");
    if (d >= 0.28 && d <= 1) setDim(d);
    setBlackout(localStorage.getItem("mters_bo") === "1");
    setQueue(queueCount());
  }, []);

  const applyMode = useCallback((m: Mode) => {
    setMode(m);
    localStorage.setItem("mters_mode", m);
    document.documentElement.dataset.mode = m;
  }, []);

  const applyDim = useCallback((v: number) => {
    setDim(v);
    setBlackout(false);
    localStorage.setItem("mters_dim", String(v));
    localStorage.removeItem("mters_bo");
  }, []);

  const toggleBlackout = useCallback(() => {
    setBlackout((b) => {
      const next = !b;
      localStorage.setItem("mters_bo", next ? "1" : "0");
      return next;
    });
  }, []);

  // offline queue badge + auto-flush
  useEffect(() => {
    const onQ = () => setQueue(queueCount());
    window.addEventListener("mters-queue", onQ);
    const flush = async () => {
      if (navigator.onLine) {
        const n = await flushQueue();
        if (n > 0) setQueue(queueCount());
      }
    };
    const iv = setInterval(flush, 6000);
    window.addEventListener("online", flush);
    void flush();
    return () => {
      window.removeEventListener("mters-queue", onQ);
      window.removeEventListener("online", flush);
      clearInterval(iv);
    };
  }, []);

  // keyboard: ALT+M → medevac, ALT+G → guide, ALT+R → report
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const k = e.key.toLowerCase();
      if (k === "m") {
        e.preventDefault();
        router.push("/medevac");
      } else if (k === "g") {
        e.preventDefault();
        router.push("/guide");
      } else if (k === "r") {
        e.preventDefault();
        router.push("/report");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const zeroize = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* best-effort */
    }
    try {
      localStorage.removeItem("mters_queue");
      localStorage.removeItem("mters_protocols_cache");
      sessionStorage.clear();
    } catch {
      /* */
    }
    router.replace("/login");
  };

  const items = NAV.filter((n) => n.roles.includes(user.role));
  const brightness = blackout ? 0.3 : dim;

  return (
    <MeContext.Provider value={user}>
    <div className="min-h-dvh bg-bg0" style={{ filter: `brightness(${brightness})` }}>
      {/* ---------------- TOP BAR ------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-line bg-bg0/90 backdrop-blur-sm">
        <div className="flex h-14 items-stretch gap-3 px-3 md:px-5">
          <Link href="/" className="flex items-center gap-2.5 pr-1">
            <span className="t-corners flex h-7 w-7 items-center justify-center border border-line-strong bg-panel2">
              <Cross size={15} className="text-acc" strokeWidth={2.5} />
            </span>
            <span className="font-disp text-lg leading-none font-bold tracking-[0.14em] text-ink">
              M-TERS
            </span>
            <span className="font-data hidden text-[9px] leading-tight tracking-[0.2em] text-faint sm:block">
              TACTICAL EMERGENCY
              <br />
              RESPONSE SYSTEM
            </span>
          </Link>

          <div className="hidden items-center gap-2 border-l border-line pl-3 md:flex">
            <Led tone={online && queue === 0 ? "ok" : "warn"} />
            <span className={`font-data text-[10px] tracking-[0.2em] ${online && queue === 0 ? "text-acc" : "text-warn"}`}>
              {online ? (queue > 0 ? `LINK OK — TX QUEUE ${queue}` : "SATCOM LINK SECURE") : `OFFLINE — TX QUEUE ${queue}`}
            </span>
            <Lock size={10} className="text-faint" />
            <span className="font-data text-[10px] tracking-[0.15em] text-faint">AES-256</span>
          </div>

          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <span className="font-data hidden text-sm font-medium tracking-[0.08em] text-acc lg:block">
              {clockZulu(now)}
            </span>

            <div className="hidden items-center gap-2 border border-line bg-panel2 px-2.5 py-1.5 lg:flex">
              <Sun size={13} className="text-faint" />
              <input
                type="range"
                min={0.3}
                max={1}
                step={0.05}
                value={brightness}
                aria-label="display brightness"
                className="dimmer w-20"
                onChange={(e) => applyDim(Number(e.target.value))}
              />
            </div>

            <button
              onClick={toggleBlackout}
              title="Blackout — minimal light signature"
              className={`flex h-9 w-9 items-center justify-center border transition-colors ${
                blackout ? "border-danger bg-danger/20 text-danger" : "border-line bg-panel2 text-dim hover:text-acc"
              }`}
            >
              <EyeOff size={16} />
            </button>

            <button
              onClick={() => applyMode(MODE_NEXT[mode])}
              title="Cycle phosphor mode"
              className="flex h-9 items-center gap-1.5 border border-line bg-panel2 px-2.5 font-data text-[11px] font-bold tracking-[0.15em] text-acc"
            >
              <Moon size={13} />
              {MODE_LABEL[mode]}
            </button>

            <div className="hidden items-center gap-2 border-l border-line pl-3 sm:flex">
              <div className="text-right leading-none">
                <div className="font-disp text-[13px] font-bold tracking-wide text-ink">
                  {user.rank} {user.callSign}
                </div>
                <div className="mt-1 flex items-center justify-end gap-1.5 font-data text-[9px] tracking-[0.15em]">
                  <span
                    className={`rounded border px-1.5 py-0.2 font-semibold uppercase ${
                      user.role === "command"
                        ? "border-amber-500/40 bg-amber-500/10 text-amber-400"
                        : user.role === "medic"
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-400"
                        : "border-emerald-500/40 bg-emerald-500/10 text-emerald-400"
                    }`}
                  >
                    {ROLE_LABEL[user.role]}
                  </span>
                  <span className="text-faint">· {user.unitCode}</span>
                </div>
              </div>
            </div>

            <button
              onClick={zeroize}
              title="Zeroize — end secure session"
              className="font-disp flex h-9 items-center gap-1.5 border border-danger/50 bg-danger/10 px-2.5 text-[11px] font-bold tracking-[0.15em] text-danger hover:bg-danger/25"
            >
              <LogOut size={13} />
              <span className="hidden sm:inline">ZEROIZE</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl md:pl-[84px]">
        {/* ---------------- DESKTOP RAIL ------------------------------ */}
        <aside className="fixed top-14 bottom-0 left-0 z-40 hidden w-[76px] flex-col items-stretch gap-1 overflow-y-auto border-r border-line bg-bg0/95 px-2 py-3 md:flex">
          {items.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} title={`${item.label}${item.danger ? " — ALT+M" : ""}`}>
                <NavIcon item={item} active={active} />
              </Link>
            );
          })}
          <div className="mt-auto pt-3 text-center">
            <div className="font-data text-[8px] leading-relaxed tracking-[0.2em] text-faint">
              FOUO
              <br />
              GARRISON
              <br />
              NET
            </div>
          </div>
        </aside>

        {/* ---------------- CONTENT ----------------------------------- */}
        <main className="px-3 pt-4 pb-28 md:px-5 md:pb-10">{children}</main>
      </div>

      {/* ---------------- MOBILE NAV ---------------------------------- */}
      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-bg0/95 backdrop-blur-sm md:hidden">
        <div className="flex items-stretch">
          {items
            .filter((i) => i.href !== "/admin" && i.href !== "/triage")
            .slice(0, 2)
            .map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <NavIcon item={item} active={active} compact />
                </Link>
              );
            })}
          <Link href="/medevac" className="flex-1">
            <span className="sos-pulse flex flex-col items-center justify-center gap-0.5 border-x border-danger/60 bg-danger/25 py-1.5 text-danger">
              <Cross size={26} strokeWidth={2.25} />
              <span className="font-disp text-[9px] font-bold tracking-[0.2em]">MEDEVAC</span>
            </span>
          </Link>
          {items
            .filter((i) => i.href !== "/medevac" && i.href !== "/admin" && i.href !== "/triage")
            .slice(2, 4)
            .map((item) => {
              const active = pathname === item.href;
              return (
                <Link key={item.href} href={item.href} className="flex-1">
                  <NavIcon item={item} active={active} compact />
                </Link>
              );
            })}
        </div>
      </nav>
    </div>
    </MeContext.Provider>
  );
}
