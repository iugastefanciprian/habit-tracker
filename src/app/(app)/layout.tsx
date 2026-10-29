import type { ReactNode } from "react";
import { requireLocalUser } from "@/server/auth/currentUser";
import { SessionProvider } from "@/components/SessionProvider";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireLocalUser();

  return <SessionProvider user={user}>{children}</SessionProvider>;
}
