"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Poll an async loader on an interval; pauses when the tab is hidden.
export function usePoll<T>(
  loader: () => Promise<T>,
  intervalMs: number,
  deps: unknown[] = [],
): { data: T | null; loading: boolean; refresh: () => void; live: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const fnRef = useRef(loader);
  fnRef.current = loader;

  const run = useCallback(async () => {
    try {
      const out = await fnRef.current();
      setData(out);
      setLive(true);
    } catch {
      setLive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    void run();
    const iv = setInterval(() => {
      if (document.visibilityState === "visible") void run();
    }, intervalMs);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs, run, ...deps]);

  return { data, loading, refresh: run, live };
}

// ticking clock at 1 Hz
export function useClock(): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(iv);
  }, []);
  return now;
}

function safeOnLine(): boolean {
  return typeof navigator === "undefined" ? true : navigator.onLine;
}

// browser online state
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(safeOnLine());
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export interface GeoFix {
  lat: number;
  lng: number;
  accuracy: number;
  ts: number;
}

export function acquireFix(timeoutMs = 12000): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("POSITIONING UNAVAILABLE ON THIS TERMINAL"));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy ?? 9999,
          ts: Date.now(),
        }),
      (err) => reject(new Error(err.message || "FIX DENIED")),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 15000 },
    );
  });
}

// Convert dd → MGRS grid string. Loaded lazily; falls back to raw dd parts.
export async function toGrid(lat: number, lng: number): Promise<string> {
  try {
    const mod = await import("mgrs");
    const mgrs = (mod as unknown as { default: { forward: (p: [number, number], a?: number) => string } }).default;
    const raw = mgrs.forward([lng, lat], 5); // 1-meter precision
    const m = raw.match(/^(\d{1,2})([A-Z])([A-Z]{2})(\d+)$/i);
    if (m) {
      const digits = m[4];
      const half = digits.length / 2;
      return `${m[1]}${m[2].toUpperCase()} ${m[3].toUpperCase()} ${digits.slice(0, half)} ${digits.slice(half)}`;
    }
    return raw;
  } catch {
    const latDir = lat >= 0 ? "N" : "S";
    const lngDir = lng >= 0 ? "E" : "W";
    return `${Math.abs(lat).toFixed(4)}${latDir} ${Math.abs(lng).toFixed(4)}${lngDir}`;
  }
}
