import { getCurrentUser, unauthorized } from "@/lib/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  return Response.json({ ok: true, user });
}
