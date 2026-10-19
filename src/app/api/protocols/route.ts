import { asc } from "drizzle-orm";
import { db } from "@/db";
import { protocols } from "@/db/schema";
import { getCurrentUser, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const phase = (url.searchParams.get("phase") ?? "").trim().toLowerCase();

  const rows = await db.select().from(protocols).orderBy(asc(protocols.phase), asc(protocols.title));

  const canSeeMedic = user.role === "medic" || user.role === "command";
  const list = rows
    .filter((p) => canSeeMedic || !p.medicOnly)
    .filter((p) => !phase || p.phase === phase)
    .filter(
      (p) =>
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.summary.toLowerCase().includes(q),
    )
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      category: p.category,
      phase: p.phase,
      summary: p.summary,
      steps: p.steps,
      warnings: p.warnings,
      estSec: p.estSec,
      medicOnly: p.medicOnly,
      updatedAt: p.updatedAt.toISOString(),
    }));

  return Response.json({ ok: true, protocols: list });
}
