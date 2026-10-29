import { randomUUID } from "node:crypto";
import type { WebPushSubscription } from "@/lib/types";
import type {
  PushSubscriptionDoc,
  ReminderDeliveryDoc,
} from "../db/documents";
import { getDb } from "../db/mongodb";

function subscriptions() {
  return getDb().then((db) =>
    db.collection<PushSubscriptionDoc>("pushSubscriptions")
  );
}

function deliveries() {
  return getDb().then((db) =>
    db.collection<ReminderDeliveryDoc>("reminderDeliveries")
  );
}

/** Stores a browser subscription, replacing the same endpoint if it changed. */
export async function upsertPushSubscription(
  userId: string,
  profileId: string,
  subscription: WebPushSubscription,
  userAgent?: string
): Promise<void> {
  const now = new Date().toISOString();
  await (await subscriptions()).updateOne(
    { userId, profileId, endpoint: subscription.endpoint },
    {
      $set: {
        userId,
        profileId,
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime ?? null,
        keys: subscription.keys,
        userAgent,
        createdAt: now,
      },
      $setOnInsert: { _id: randomUUID() },
    },
    { upsert: true }
  );
}

/** Removes every profile row for this browser endpoint. */
export async function removePushSubscription(
  userId: string,
  endpoint: string
): Promise<boolean> {
  const result = await (await subscriptions()).deleteMany({
    userId,
    endpoint,
  });
  return result.deletedCount > 0;
}

/** Removes a subscription the push service reported as gone (404/410). */
export async function removePushSubscriptionByEndpoint(
  endpoint: string
): Promise<void> {
  await (await subscriptions()).deleteMany({ endpoint });
}

export async function listPushSubscriptions(
  userId: string,
  profileId?: string
): Promise<PushSubscriptionDoc[]> {
  return (await subscriptions())
    .find(profileId ? { userId, profileId } : { userId })
    .sort({ createdAt: 1 })
    .toArray();
}

export async function countPushSubscriptions(
  userId: string,
  profileId?: string
): Promise<number> {
  return (await subscriptions()).countDocuments(
    profileId ? { userId, profileId } : { userId }
  );
}

/**
 * Records that a habit-day reminder was sent. Returns false when another cron
 * run already claimed it, so notifications are never sent twice.
 */
export async function claimReminderDelivery(
  userId: string,
  profileId: string,
  habitId: string,
  date: string
): Promise<boolean> {
  try {
    await (await deliveries()).insertOne({
      userId,
      profileId,
      habitId,
      date,
      sentAt: new Date(),
    });
    return true;
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: number }).code === 11000
    ) {
      return false;
    }
    throw error;
  }
}
