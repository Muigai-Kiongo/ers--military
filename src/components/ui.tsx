"use client";

import type { ReactNode } from "react";

export type Tone = "ok" | "warn" | "danger" | "dim" | "idle";

export const TONE_TEXT: Record<Tone, string> = {
  ok: "text-acc",
  warn: "text-warn",
  danger: "text-danger",
  dim: "text-faint",
  idle: "text-dim",
};

export const TONE_BORDER: Record<Tone, string> = {
  ok: "border-line-strong",
  warn: "border-warn/40",
  danger: "border-danger/50",
  dim: "border-line",
  idle: "border-line",
};

export const TONE_BG: Record<Tone, string> = {
  ok: "bg-acc",
  warn: "bg-warn",
  danger: "bg-danger",
  dim: "bg-faint",
  idle: "bg-dim",
};

const TONE_PILL: Record<Tone, string> = {
  ok: "text-acc border-line-strong bg-acc/10",
  warn: "text-warn border-warn/40 bg-warn/10",
  danger: "text-danger border-danger/50 bg-danger/10",
  dim: "text-faint border-line bg-panel2",
  idle: "text-dim border-line bg-panel2",
};

export function severityTone(sev: string): Tone {
  switch (sev) {
    case "critical":
      return "danger";
    case "high":
      return "warn";
    case "medium":
      return "ok";
    default:
      return "dim";
  }
}

export function alertStatusTone(status: string): Tone {
  switch (status) {
    case "sent":
      return "danger";
    case "ack":
    case "en_route":
    case "on_scene":
    case "evac":
      return "warn";
    case "complete":
      return "ok";
    default:
      return "dim";
  }
}

export function incidentStatusTone(status: string): Tone {
  switch (status) {
    case "reported":
      return "danger";
    case "ack":
    case "responding":
      return "warn";
    case "monitored":
      return "ok";
    default:
      return "dim";
  }
}

export function casualtyTone(status: string): Tone {
  switch (status) {
    case "urgent":
      return "danger";
    case "priority":
      return "warn";
    case "routine":
    case "minimal":
      return "ok";
    default:
      return "dim";
  }
}

export function Panel({
  kicker,
  title,
  right,
  children,
  className = "",
  pad = true,
}: {
  kicker?: string;
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`t-corners border border-line bg-panel/80 ${className}`}>
      {(kicker || title || right) && (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <div className="min-w-0">
            {kicker && (
              <div className="font-data text-[10px] tracking-[0.25em] text-faint">
                {kicker}
              </div>
            )}
            {title && (
              <h2 className="font-disp text-[15px] font-semibold tracking-[0.08em] text-ink">
                {title}
              </h2>
            )}
          </div>
          {right}
        </header>
      )}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}

export function Pill({ tone = "idle", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 font-data text-[10px] font-medium tracking-[0.14em] whitespace-nowrap ${TONE_PILL[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Led({ tone = "ok", className = "" }: { tone?: Tone; className?: string }) {
  return <span className={`led inline-block h-1.5 w-1.5 rounded-full ${TONE_BG[tone]} ${className}`} />;
}

export function Stat({
  label,
  value,
  tone = "idle",
  sub,
}: {
  label: string;
  value: string | number;
  tone?: Tone;
  sub?: string;
}) {
  return (
    <div className="t-corners border border-line bg-panel/80 px-4 py-3">
      <div className="font-data text-[10px] tracking-[0.22em] text-faint">{label}</div>
      <div className={`font-disp mt-1 text-3xl leading-none font-semibold ${TONE_TEXT[tone]}`}>
        {value}
      </div>
      {sub && <div className="font-data mt-1 text-[10px] text-dim">{sub}</div>}
    </div>
  );
}

export function Seg<T extends string>({
  options,
  value,
  onChange,
  className = "",
  size = "md",
}: {
  options: { value: T; label: string; tone?: Tone }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const pad =
    size === "lg"
      ? "px-4 py-3 text-base min-h-[52px]"
      : size === "sm"
        ? "px-2.5 py-1.5 text-[11px]"
        : "px-3 py-2 text-[13px]";
  return (
    <div className={`flex flex-wrap gap-1 border border-line bg-panel2 p-1 ${className}`}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`font-disp grow ${pad} font-semibold tracking-[0.1em] transition-colors ${
              active
                ? `${o.tone ? TONE_BG[o.tone] : "bg-acc"} text-bg0`
                : `${o.tone ? TONE_TEXT[o.tone] : "text-dim"} hover:bg-panel`
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="decrease"
        className="font-disp flex h-12 w-12 items-center justify-center border border-line bg-panel2 text-2xl font-semibold text-dim active:bg-line"
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        −
      </button>
      <div className="font-data flex h-12 w-14 items-center justify-center border border-line-strong bg-bg1 text-2xl font-bold text-acc">
        {value}
      </div>
      <button
        type="button"
        aria-label="increase"
        className="font-disp flex h-12 w-12 items-center justify-center border border-line bg-panel2 text-2xl font-semibold text-dim active:bg-line"
        onClick={() => onChange(Math.min(max, value + 1))}
      >
        +
      </button>
    </div>
  );
}

export function EmptyState({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="border border-dashed border-line px-6 py-10 text-center">
      <div className="font-disp text-sm font-semibold tracking-[0.15em] text-dim">{title}</div>
      {sub && <div className="font-data mt-1.5 text-[11px] text-faint">{sub}</div>}
    </div>
  );
}
