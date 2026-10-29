import { getDb } from "../db/mongodb";
import type { UserDoc } from "../db/documents";

function users() {
  return getDb().then((db) => db.collection<UserDoc>("users"));
}

export async function createUser(doc: UserDoc): Promise<void> {
  await (await users()).insertOne(doc);
}

export async function findUserByUsername(
  username: string
): Promise<UserDoc | null> {
  return (await users()).findOne({ username });
}

export async function findUserById(id: string): Promise<UserDoc | null> {
  return (await users()).findOne({ _id: id });
}

/**
 * Returns the oldest account in the database. Used by local mode so data
 * created by the previous username-based sign-in stays reachable.
 */
export async function findFirstUser(): Promise<UserDoc | null> {
  return (await users()).findOne({}, { sort: { createdAt: 1, _id: 1 } });
}
