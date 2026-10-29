"use client";

import { createContext, useContext } from "react";
import type { User } from "@/lib/types";

const SessionContext = createContext<User | null>(null);

export function SessionProvider({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={user}>{children}</SessionContext.Provider>
  );
}

export function useSession(): User | null {
  return useContext(SessionContext);
}
