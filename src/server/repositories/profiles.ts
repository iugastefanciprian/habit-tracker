import type { Profile } from "@/lib/types";
import type { ProfileDoc } from "../db/documents";
import { getDb } from "../db/mongodb";

function profiles() {
  return getDb().then((db) => db.collection<ProfileDoc>("profiles"));
}

function toProfile(doc: ProfileDoc): Profile {
  return {
    id: doc._id,
    name: doc.name,
    avatar: doc.avatar,
    timeZone: doc.timeZone,
    dayStartHour: doc.dayStartHour,
  };
}

export async function listProfiles(userId: string): Promise<Profile[]> {
  const docs = await (await profiles())
    .find({ userId })
    .sort({ createdAt: 1, _id: 1 })
    .toArray();
  return docs.map(toProfile);
}

export async function countProfiles(userId: string): Promise<number> {
  return (await profiles()).countDocuments({ userId });
}

export async function findProfile(
  userId: string,
  profileId: string
): Promise<ProfileDoc | null> {
  return (await profiles()).findOne({ _id: profileId, userId });
}

export async function insertProfile(doc: ProfileDoc): Promise<Profile> {
  await (await profiles()).insertOne(doc);
  return toProfile(doc);
}

/** Removes every profile for a user; used by a full backup restore. */
export async function removeAllProfiles(userId: string): Promise<number> {
  const result = await (await profiles()).deleteMany({ userId });
  return result.deletedCount;
}

export async function updateProfile(
  userId: string,
  profileId: string,
  fields: Partial<ProfileDoc>,
  unset: string[] = []
): Promise<Profile | null> {
  const update: {
    $set?: Partial<ProfileDoc>;
    $unset?: Record<string, "">;
  } = {};
  if (Object.keys(fields).length > 0) update.$set = fields;
  if (unset.length > 0) {
    update.$unset = Object.fromEntries(unset.map((key) => [key, ""]));
  }
  if (!update.$set && !update.$unset) {
    const doc = await findProfile(userId, profileId);
    return doc ? toProfile(doc) : null;
  }

  const doc = await (await profiles()).findOneAndUpdate(
    { _id: profileId, userId },
    update,
    { returnDocument: "after" }
  );
  return doc ? toProfile(doc) : null;
}
