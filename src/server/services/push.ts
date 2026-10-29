import webpush from "web-push";
import type { PushStatus, WebPushSubscription } from "@/lib/types";
import { todayForProfile } from "@/lib/domain/habits";
import { isReminderDue, localMinutes } from "@/lib/domain/reminders";
import { AppError } from "../errors";
import { listHabits, toHabit } from "../repositories/habits";
import { listProfiles } from "../repositories/profiles";
import {
  claimReminderDelivery,
  countPushSubscriptions,
  listPushSubscriptions,
  removePushSubscription,
  removePushSubscriptionByEndpoint,
  upsertPushSubscription,
} from "../repositories/push";
import { requireOwnedProfile } from "./profiles";

export interface PushConfig {
  enabled: boolean;
  publicKey: string | null;
}

/** Reads VAPID configuration from the environment; never throws. */
export function getPushConfig(): PushConfig {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) {
    return { enabled: false, publicKey: null };
  }
  return { enabled: true, publicKey };
}

let vapidConfigured = false;

function configureVapid(): PushConfig {
  const config = getPushConfig();
  if (!config.enabled || !config.publicKey) return config;
  if (!vapidConfigured) {
    const subject =
      process.env.VAPID_SUBJECT?.trim() || "mailto:habit-tracker@example.com";
    webpush.setVapidDetails(
      subject,
      config.publicKey,
      process.env.VAPID_PRIVATE_KEY?.trim() ?? ""
    );
    vapidConfigured = true;
  }
  return config;
}

function requirePushConfig(): PushConfig {
  const config = configureVapid();
  if (!config.enabled) {
    throw new AppError(
      503,
      "Background reminders are not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY."
    );
  }
  return config;
}

export async function getPushStatusForProfile(
  userId: string,
  profileId: string
): Promise<PushStatus> {
  await requireOwnedProfile(userId, profileId);
  const config = getPushConfig();
  return {
    enabled: config.enabled,
    publicKey: config.publicKey,
    subscriptions: await countPushSubscriptions(userId, profileId),
  };
}

export async function subscribeProfileToPush(
  userId: string,
  profileId: string,
  subscription: WebPushSubscription,
  userAgent?: string
): Promise<void> {
  requirePushConfig();
  await requireOwnedProfile(userId, profileId);
  await upsertPushSubscription(userId, profileId, subscription, userAgent);
}

export async function unsubscribeFromPush(
  userId: string,
  endpoint: string
): Promise<void> {
  await removePushSubscription(userId, endpoint);
}

interface NotificationPayload {
  title: string;
  body: string;
  url: string;
  tag: string;
}

async function sendToSubscriptions(
  subscriptions: Awaited<ReturnType<typeof listPushSubscriptions>>,
  payload: NotificationPayload
): Promise<number> {
  if (subscriptions.length === 0) return 0;

  const results = await Promise.allSettled(
    subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime ?? null,
            keys: subscription.keys,
          },
          JSON.stringify(payload)
        );
        return true;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        // The browser dropped this subscription; stop retrying it.
        if (statusCode === 404 || statusCode === 410) {
          await removePushSubscriptionByEndpoint(subscription.endpoint);
        }
        throw error;
      }
    })
  );

  return results.filter((result) => result.status === "fulfilled").length;
}

/** Sends a confirmation notification to every device subscribed to a profile. */
export async function sendTestNotification(
  userId: string,
  profileId: string
): Promise<number> {
  requirePushConfig();
  await requireOwnedProfile(userId, profileId);
  const subscriptions = await listPushSubscriptions(userId, profileId);
  if (subscriptions.length === 0) {
    throw new AppError(409, "No device is subscribed to notifications yet.");
  }
  return sendToSubscriptions(subscriptions, {
    title: "Habit Tracker",
    body: "Background reminders are working.",
    url: "/today",
    tag: "habit-tracker-test",
  });
}

export interface ReminderJobSummary {
  profiles: number;
  due: number;
  sent: number;
  alreadySent: number;
  devices: number;
}

/**
 * Finds reminders that are due in each profile's own time zone and pushes one
 * notification per habit-day. Deliveries are claimed in MongoDB first, so
 * overlapping cron runs cannot notify twice.
 */
export async function sendDueRemindersForUser(
  userId: string,
  now = new Date()
): Promise<ReminderJobSummary> {
  requirePushConfig();
  const profiles = await listProfiles(userId);
  const summary: ReminderJobSummary = {
    profiles: 0,
    due: 0,
    sent: 0,
    alreadySent: 0,
    devices: 0,
  };

  for (const profile of profiles) {
    const subscriptions = await listPushSubscriptions(userId, profile.id);
    if (subscriptions.length === 0) continue;

    summary.profiles += 1;
    summary.devices += subscriptions.length;

    const today = todayForProfile(profile);
    const nowMinutes = localMinutes(now, profile.timeZone);
    const habits = (await listHabits(userId, profile.id))
      .map(toHabit)
      .filter((habit) => !habit.archivedAt);

    for (const habit of habits) {
      if (!isReminderDue(habit, today, nowMinutes)) continue;
      summary.due += 1;

      const claimed = await claimReminderDelivery(
        userId,
        profile.id,
        habit.id,
        today
      );
      if (!claimed) {
        summary.alreadySent += 1;
        continue;
      }

      const unit = habit.unit ? ` ${habit.unit}` : "";
      const target =
        habit.period === "weekly"
          ? "this week"
          : `${habit.required}${unit}`;
      summary.sent += await sendToSubscriptions(subscriptions, {
        title: `${habit.emoji ? `${habit.emoji} ` : ""}${habit.name}`,
        body: `Still open today — target ${target}.`,
        url: "/today",
        tag: `habit-${habit.id}-${today}`,
      });
    }
  }

  return summary;
}
