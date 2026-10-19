import { getCurrentUser, listEvents, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  const url = new URL(req.url);
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 40) || 40));
  return Response.json({ ok: true, events: await listEvents(limit) });
}
