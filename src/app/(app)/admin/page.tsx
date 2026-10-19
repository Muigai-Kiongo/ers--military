"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookLock, Loader2, Plus, UserPlus } from "lucide-react";
import { useMe } from "@/components/Shell";
import { EmptyState, Pill } from "@/components/ui";
import { apiGet, transmit } from "@/lib/client/net";
import { usePoll } from "@/lib/client/hooks";
import type { ProtocolDTO, UnitDTO } from "@/lib/types";

interface AdminUser {
  id: string;
  callSign: string;
  fullName: string;
  rank: string;
  role: string;
  unitCode: string;
  mosDesignation: string | null;
  tcccLevel: string;
  status: string;
}

const RANKS = ["PVT", "PV2", "PFC", "SPC", "CPL", "SGT", "SSG", "SFC", "MSG", "2LT", "1LT", "CPT", "MAJ", "LTC", "COL"];
const ROLE_OPTIONS = [
  { v: "field", l: "FIELD" },
  { v: "medic", l: "MEDIC" },
  { v: "command", l: "COMMAND" },
];

export default function AdminPage() {
  const me = useMe();
  const [busy, setBusy] = useState<string | null>(null);
  const { data, refresh } = usePoll(
    async () =>
      (await apiGet<{ users: AdminUser[]; units: string[] }>("/api/users")).data,
    4000,
  );
  const { data: unitsD, refresh: refreshUnits } = usePoll(
    async () => (await apiGet<{ units: UnitDTO[] }>("/api/units")).data,
    6000,
  );
  const { data: protosD } = usePoll(
    async () => (await apiGet<{ protocols: ProtocolDTO[] }>("/api/protocols")).data,
    15000,
  );

  const [form, setForm] = useState({
    callSign: "",
    username: "",
    fullName: "",
    rank: "SPC",
    role: "field",
    unitCode: "",
    tcccLevel: "CLS",
    password: "",
  });
  const [formMsg, setFormMsg] = useState<string | null>(null);

  const users = data?.users ?? [];
  const unitCodes = data?.units ?? [];
  const units = unitsD?.units ?? [];
  const protos = protosD?.protocols ?? [];

  const patchUser = async (id: string, patch: Record<string, string>, label: string) => {
    if (busy) return;
    setBusy(label);
    await transmit("/api/users", { id, ...patch }, `USER ${label}`, "PATCH");
    await refresh();
    setBusy(null);
  };

  const setReadiness = async (code: string, readiness: string) => {
    if (busy) return;
    setBusy(`unit:${code}`);
    await transmit("/api/units", { code, readiness }, `UNIT ${code}`, "PATCH");
    await refreshUnits();
    setBusy(null);
  };

  const addUser = async () => {
    if (busy) return;
    setBusy("add");
    setFormMsg(null);
    const res = await transmit("/api/users", { ...form }, "NEW USER");
    if (res.ok) {
      setForm({
        callSign: "",
        username: "",
        fullName: "",
        rank: "SPC",
        role: "field",
        unitCode: unitCodes[0] ?? "",
        tcccLevel: "CLS",
        password: "",
      });
      setFormMsg("IDENTITY PROVISIONED ON THE NET");
      await refresh();
    } else if (res.queued) {
      setFormMsg("QUEUED — WILL PROVISION WHEN LINK RESTORED");
    } else {
      setFormMsg(res.error ?? "REJECTED");
    }
    setBusy(null);
  };

  if (me?.role !== "command") {
    return <EmptyState title="RESTRICTED — COMMAND CHANNEL" sub="ADMIN FUNCTIONS REQUIRE COMMAND AUTHORITY" />;
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="font-data text-[10px] tracking-[0.3em] text-faint">
            GARRISON NETWORK ADMINISTRATION
          </div>
          <h1 className="font-disp mt-0.5 text-3xl font-bold tracking-[0.05em] text-ink">NET CONTROL</h1>
        </div>
        <Pill tone="ok">{users.length} IDENTITIES · {units.length} UNITS</Pill>
      </header>

      {/* dataset summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="t-corners flex items-center gap-3 border border-line bg-panel/80 px-4 py-3">
          <BookLock size={18} className="text-acc" />
          <div>
            <div className="font-disp text-xl leading-none font-bold text-ink">{protos.length}</div>
            <div className="font-data mt-0.5 text-[9px] tracking-[0.2em] text-faint">TCCC PROTOCOLS LIVE</div>
          </div>
        </div>
        <div className="t-corners flex items-center gap-3 border border-line bg-panel/80 px-4 py-3">
          <BookLock size={18} className="text-warn" />
          <div>
            <div className="font-disp text-xl leading-none font-bold text-ink">{protos.filter((p) => p.medicOnly).length}</div>
            <div className="font-data mt-0.5 text-[9px] tracking-[0.2em] text-faint">MEDIC-SCOPE RESTRICTED</div>
          </div>
        </div>
        <div className="t-corners flex items-center gap-3 border border-line bg-panel/80 px-4 py-3">
          <BookLock size={18} className="text-dim" />
          <div>
            <div className="font-disp text-xl leading-none font-bold text-ink">AES-256</div>
            <div className="font-data mt-0.5 text-[9px] tracking-[0.2em] text-faint">GCM — AT REST & IN MOTION</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        {/* USERS */}
        <section className="t-corners border border-line bg-panel/80 xl:col-span-7">
          <header className="border-b border-line px-4 py-2.5">
            <div className="font-data text-[10px] tracking-[0.25em] text-faint">ACCESS CONTROL</div>
            <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">IDENTITIES</h2>
          </header>
          <ul className="divide-y divide-line/70">
            {users.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="font-disp text-[14px] font-bold tracking-[0.06em] text-ink">
                    {u.rank} {u.callSign}
                    <span className="ml-2 font-data text-[10px] font-normal tracking-[0.1em] text-faint">
                      {u.fullName.toUpperCase()} · {u.unitCode} · TCCC {u.tcccLevel}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {ROLE_OPTIONS.map((r) => (
                    <button
                      key={r.v}
                      onClick={() => patchUser(u.id, { role: r.v }, `${u.callSign}-role`)}
                      disabled={busy !== null}
                      className={`font-disp border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.1em] disabled:opacity-40 ${
                        u.role === r.v ? "border-transparent bg-acc text-bg0" : "border-line bg-panel2 text-dim hover:text-acc"
                      }`}
                    >
                      {r.l}
                    </button>
                  ))}
                  <button
                    onClick={() => patchUser(u.id, { status: u.status === "active" ? "suspended" : "active" }, `${u.callSign}-status`)}
                    disabled={busy !== null}
                    className={`font-disp border px-2.5 py-1.5 text-[10px] font-bold tracking-[0.1em] disabled:opacity-40 ${
                      u.status === "active"
                        ? "border-danger/50 bg-danger/10 text-danger"
                        : "border-acc bg-acc/10 text-acc"
                    }`}
                  >
                    {u.status === "active" ? "SUSPEND" : "RESTORE"}
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* add user */}
          <div className="border-t border-line bg-bg1/50 p-4">
            <div className="font-data flex items-center gap-2 text-[10px] tracking-[0.25em] text-faint">
              <UserPlus size={12} /> PROVISION NEW IDENTITY
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <input
                value={form.callSign}
                onChange={(e) => setForm((f) => ({ ...f, callSign: e.target.value.toUpperCase() }))}
                placeholder="CALLSIGN *"
                className="font-data border border-line bg-panel2 px-3 py-2 text-[12px] text-ink uppercase placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value.toLowerCase() }))}
                placeholder="USERNAME"
                className="font-data border border-line bg-panel2 px-3 py-2 text-[12px] text-ink lowercase placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <input
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                placeholder="FULL NAME *"
                className="font-data border border-line bg-panel2 px-3 py-2 text-[12px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="KEY (DEF: Tactical2025!)"
                className="font-mono border border-line bg-panel2 px-3 py-2 text-[11px] text-ink placeholder:text-faint focus:border-line-strong focus:outline-none"
              />
              <select
                value={form.rank}
                onChange={(e) => setForm((f) => ({ ...f, rank: e.target.value }))}
                className="font-data border border-line bg-panel2 px-2 py-2 text-[12px] text-ink focus:border-line-strong focus:outline-none"
              >
                {RANKS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={form.unitCode}
                onChange={(e) => setForm((f) => ({ ...f, unitCode: e.target.value }))}
                className="font-data border border-line bg-panel2 px-2 py-2 text-[12px] text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="">UNIT …</option>
                {unitCodes.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex gap-1">
                {ROLE_OPTIONS.map((r) => (
                  <button
                    key={r.v}
                    onClick={() => setForm((f) => ({ ...f, role: r.v }))}
                    className={`font-disp border px-3 py-2 text-[11px] font-bold tracking-[0.1em] ${
                      form.role === r.v ? "border-transparent bg-acc text-bg0" : "border-line bg-panel2 text-dim"
                    }`}
                  >
                    {r.l}
                  </button>
                ))}
              </div>
              <select
                value={form.tcccLevel}
                onChange={(e) => setForm((f) => ({ ...f, tcccLevel: e.target.value }))}
                className="font-data border border-line bg-panel2 px-2 py-2 text-[11px] text-ink focus:border-line-strong focus:outline-none"
              >
                <option value="ALL">TCCC: ALL</option>
                <option value="CLS">TCCC: CLS</option>
                <option value="CMC">TCCC: CMC (MEDIC)</option>
              </select>
              <button
                onClick={addUser}
                disabled={busy !== null || !form.callSign.trim() || !form.fullName.trim() || !form.unitCode}
                className="font-disp ml-auto flex items-center gap-2 border border-acc bg-acc px-4 py-2 text-[12px] font-bold tracking-[0.15em] text-bg0 disabled:opacity-40"
              >
                {busy === "add" ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                PROVISION
              </button>
            </div>
            {formMsg && <div className="font-data mt-2 text-[11px] tracking-[0.08em] text-acc">{formMsg}</div>}
          </div>
        </section>

        {/* UNITS */}
        <section className="t-corners h-fit border border-line bg-panel/80 xl:col-span-5">
          <header className="border-b border-line px-4 py-2.5">
            <div className="font-data text-[10px] tracking-[0.25em] text-faint">FORCE MANAGEMENT</div>
            <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">UNIT READINESS</h2>
          </header>
          <ul className="divide-y divide-line/70">
            {units.map((u) => (
              <motion.li key={u.id} layout className="px-4 py-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-disp text-[14px] font-bold tracking-[0.06em] text-ink">
                      {u.callSign} <span className="font-data text-[10px] font-normal tracking-[0.1em] text-faint">· {u.name}</span>
                    </div>
                    <div className="font-data mt-0.5 text-[10px] tracking-[0.12em] text-faint">
                      {u.code} · {u.personnel} PAX · {u.locationGrid ?? "GRID —"}
                    </div>
                  </div>
                </div>
                <div className="mt-2 flex gap-1">
                  {(
                    [
                      ["green", "READY", "bg-acc"],
                      ["amber", "DEGRADED", "bg-warn"],
                      ["red", "COMMITTED", "bg-danger"],
                      ["black", "OFF-LINE", "bg-faint"],
                    ] as const
                  ).map(([v, l, c]) => (
                    <button
                      key={v}
                      onClick={() => setReadiness(u.code, v)}
                      disabled={busy !== null}
                      className={`flex-1 border py-2 font-disp text-[11px] font-bold tracking-[0.1em] disabled:opacity-40 ${
                        u.readiness === v ? `${c} border-transparent text-bg0` : "border-line bg-panel2 text-dim hover:text-acc"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </motion.li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
