import { randomUUID } from "node:crypto";
import type { Profile, ProfileUpdateInput } from "@/lib/types";
import { AppError } from "../errors";
import {
  countProfiles,
  findProfile,
  insertProfile,
  listProfiles,
  updateProfile,
} from "../repositories/profiles";
import type { ProfileDoc } from "../db/documents";

export function listProfilesForUser(userId: string): Promise<Profile[]> {
  return listProfiles(userId);
}

export async function createProfileForUser(
  userId: string,
  name: string
): Promise<Profile> {
  const doc: ProfileDoc = {
    _id: randomUUID(),
    userId,
    name,
    createdAt: new Date().toISOString(),
  };
  return insertProfile(doc);
}

export async function requireOwnedProfile(
  userId: string,
  profileId: string
): Promise<ProfileDoc> {
  const profile = await findProfile(userId, profileId);
  if (!profile) throw new AppError(404, "Profile not found");
  return profile;
}

export async function updateProfileForUser(
  userId: string,
  profileId: string,
  input: ProfileUpdateInput
): Promise<Profile> {
  const fields: Partial<ProfileDoc> = {};
  const unset: string[] = [];

  if (input.avatar === null) unset.push("avatar");
  else if (input.avatar !== undefined) fields.avatar = input.avatar;

  if (input.timeZone === null || input.timeZone === "") unset.push("timeZone");
  else if (input.timeZone !== undefined) fields.timeZone = input.timeZone;

  if (input.dayStartHour === null) unset.push("dayStartHour");
  else if (input.dayStartHour !== undefined) {
    fields.dayStartHour = input.dayStartHour;
  }

  const updated = await updateProfile(userId, profileId, fields, unset);
  if (!updated) throw new AppError(404, "Profile not found");
  return updated;
}

export function userHasProfiles(userId: string): Promise<boolean> {
  return countProfiles(userId).then((count) => count > 0);
}
