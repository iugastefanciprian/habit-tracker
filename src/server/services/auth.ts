import { randomUUID } from "node:crypto";
import type { User } from "@/lib/types";
import type { UserDoc } from "../db/documents";
import {
  createUser,
  findFirstUser,
  findUserByUsername,
} from "../repositories/users";

function publicUser(doc: UserDoc): User {
  return { id: doc._id, username: doc.username };
}

function localUsername(): string {
  const configured = process.env.LOCAL_USERNAME?.trim().toLowerCase();
  return configured || "local";
}

async function createLocalUser(): Promise<UserDoc> {
  const doc: UserDoc = {
    _id: randomUUID(),
    username: localUsername(),
    createdAt: new Date().toISOString(),
  };

  try {
    await createUser(doc);
    return doc;
  } catch (error) {
    // Unique index on username: another request created it first.
    if (
      error instanceof Error &&
      "code" in error &&
      (error as { code?: number }).code === 11000
    ) {
      const raced = await findUserByUsername(doc.username);
      if (raced) return raced;
    }
    throw error;
  }
}

/**
 * Local single-user mode: resolve the account that owns all data.
 *
 * The oldest existing account is reused so data created under the previous
 * username-based sign-in stays reachable. A fixed local account is created
 * only when the database has no users yet.
 */
export async function getOrCreateLocalUser(): Promise<User> {
  const existing = await findFirstUser();
  if (existing) return publicUser(existing);

  return publicUser(
    (await findUserByUsername(localUsername())) ?? (await createLocalUser())
  );
}
