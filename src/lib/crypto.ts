import crypto from "crypto";
import { scryptSync } from "crypto";
import { cookies } from "next/headers";

// ---------------------------------------------------------------------------
// SESSION — HMAC-signed cookie, tamper-evident
// ---------------------------------------------------------------------------
const SESSION_COOKIE = "mters_sess";

function sessionSecret(): string {
  return (
    process.env.MTERS_SESSION_SECRET ??
    process.env.DATABASE_URL ??
    "mters-dev-secret"
  );
}

function sign(value: string): string {
  return crypto
    .createHmac("sha256", sessionSecret())
    .update(value)
    .digest("hex");
}

export function encodeSession(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function decodeSession(token: string): string | null {
  const dot = token.lastIndexOf(".");
  if (dot < 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  try {
    const payload = Buffer.from(body, "base64url").toString("utf8");
    const expected = sign(payload);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    return payload.slice(0, payload.lastIndexOf("."));
  } catch {
    return null;
  }
}

export async function getSessionUserId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return decodeSession(token);
}

export async function setSession(userId: string): Promise<void> {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, encodeSession(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ---------------------------------------------------------------------------
// PASSWORD HASHING — scrypt with secure random salt
// ---------------------------------------------------------------------------
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored || !stored.includes(":")) return false;
  try {
    const [salt, key] = stored.split(":");
    const keyBuffer = Buffer.from(key, "hex");
    const derivedKey = crypto.scryptSync(password, salt, 64);
    return (
      keyBuffer.length === derivedKey.length &&
      crypto.timingSafeEqual(keyBuffer, derivedKey)
    );
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// PAYLOAD ENCRYPTION — AES-256-GCM at rest for all tactical data
// ---------------------------------------------------------------------------
const keyCache: { key?: Buffer } = {};

function dataKey(): Buffer {
  if (keyCache.key) return keyCache.key;
  const material =
    process.env.MTERS_DATA_KEY ??
    process.env.DATABASE_URL ??
    "mters-field-data-key";
  keyCache.key = scryptSync(material, "mters-static-salt-v1", 32);
  return keyCache.key;
}

export function encryptPayload(data: unknown): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dataKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptPayload<T>(payloadEnc: string): T | null {
  try {
    const [v, ivB, tagB, dataB] = payloadEnc.split(".");
    if (v !== "v1") return null;
    const iv = Buffer.from(ivB, "base64url");
    const tag = Buffer.from(tagB, "base64url");
    const enc = Buffer.from(dataB, "base64url");
    const decipher = crypto.createDecipheriv("aes-256-gcm", dataKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString("utf8")) as T;
  } catch {
    return null;
  }
}

// Alphabet grids → MGRS handled client-side; refs generated server-side.
export function makeRef(prefix: string): string {
  const stamp = Date.now().toString(36).toUpperCase().slice(-4);
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `${prefix}-${stamp}${rand}`;
}
