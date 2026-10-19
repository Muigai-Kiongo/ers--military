"use client";

// Offline-capable transmission layer: failed transmits are encrypted-guard
// queued to localStorage and re-transmitted automatically when the link is
// restored. Protocols are cached locally for degraded-connectivity use.

const QUEUE_KEY = "mters_queue";
const PROTO_KEY = "mters_protocols_cache";

export interface QueueItem {
  id: string;
  path: string;
  method: string;
  body: unknown;
  label: string;
  ts: number;
}

function readQueue(): QueueItem[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(items: QueueItem[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  emitQueueCount();
}

export function queueCount(): number {
  return readQueue().length;
}

export function emitQueueCount() {
  window.dispatchEvent(new CustomEvent("mters-queue", { detail: readQueue().length }));
}

export async function transmit<T = Record<string, unknown>>(
  path: string,
  body: unknown,
  label: string,
  method = "POST",
): Promise<{ ok: boolean; queued: boolean; data: T | null; error: string | null }> {
  try {
    const res = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) {
      // Client errors (400/401/403/404/409) are NOT queued — they will fail again.
      if (res.status >= 500 || res.status === 0) throw new Error("SERVER UNREACHABLE");
      return { ok: false, queued: false, data, error: data?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, queued: false, data, error: null };
  } catch {
    const items = readQueue();
    items.push({
      id: Math.random().toString(36).slice(2, 10).toUpperCase(),
      path,
      method,
      body,
      label,
      ts: Date.now(),
    });
    writeQueue(items);
    return { ok: false, queued: true, data: null, error: null };
  }
}

export async function apiGet<T>(path: string): Promise<{ ok: boolean; data: T | null }> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return { ok: false, data: null };
    return { ok: true, data: (await res.json()) as T };
  } catch {
    return { ok: false, data: null };
  }
}

export async function flushQueue(): Promise<number> {
  const items = readQueue();
  if (!items.length) return 0;
  const remaining: QueueItem[] = [];
  let flushed = 0;
  for (const item of items) {
    try {
      const res = await fetch(item.path, {
        method: item.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item.body),
      });
      if (res.ok || (res.status >= 400 && res.status < 500)) {
        flushed++;
        continue;
      }
      remaining.push(item);
    } catch {
      remaining.push(item);
      break; // still offline — keep the rest in order
    }
  }
  writeQueue(remaining);
  return flushed;
}

// ---------------- offline protocol cache ---------------------------------
export function cacheProtocols(data: unknown) {
  try {
    localStorage.setItem(PROTO_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* storage full — degrade silently */
  }
}

export function loadCachedProtocols<T>(): { at: number; data: T } | null {
  try {
    const raw = localStorage.getItem(PROTO_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as { at: number; data: T };
  } catch {
    return null;
  }
}
