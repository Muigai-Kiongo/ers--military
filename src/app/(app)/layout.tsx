import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getCurrentUser } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <Shell user={user}>{children}</Shell>;
}
