import type { User } from "@/lib/types";
import { getOrCreateLocalUser } from "../services/auth";

/**
 * Local mode has no sign-in step: every request acts as the single local user.
 */
export async function requireLocalUser(): Promise<User> {
  return getOrCreateLocalUser();
}
