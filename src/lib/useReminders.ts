"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Habit, Profile } from "@/lib/types";
import {
  getActiveReminders,
  localMinutes,
} from "@/lib/domain/reminders";

const TICK_MS = 30_000;

function readIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((value): value is string => typeof value === "string")
      : [];
  } catch {
    return [];
  }
}

function writeIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch {
    // Private mode or a full quota: reminders still work in-app.
  }
}

/**
 * Tracks which reminders are due for the active profile. Each habit notifies
 * once per day and stays in the in-app list until the day is logged or the user
 * dismisses it.
 *
 * `notify` controls the foreground browser notification. Background Web Push is
 * handled by the service worker and cron job, so callers disable this when a
 * push subscription is active to avoid duplicate notifications.
 */
export function useReminders(
  habits: Habit[],
  profile: Profile | null,
  today: string,
  options: { notify?: boolean } = {}
) {
  const notify = options.notify ?? true;
  const [nowMinutes, setNowMinutes] = useState(() =>
    localMinutes(new Date(), profile?.timeZone)
  );
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [notified, setNotified] = useState<string[]>([]);

  const baseKey =
    profile && today ? `habit-reminders:${profile.id}:${today}` : "";

  useEffect(() => {
    if (!baseKey) {
      setDismissed([]);
      setNotified([]);
      return;
    }
    setDismissed(readIds(`${baseKey}:dismissed`));
    setNotified(readIds(`${baseKey}:notified`));
  }, [baseKey]);

  useEffect(() => {
    if (!profile) return;
    const update = () =>
      setNowMinutes(localMinutes(new Date(), profile.timeZone));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [profile]);

  const reminders = useMemo(
    () =>
      profile
        ? getActiveReminders(habits, today, nowMinutes, dismissed)
        : [],
    [habits, profile, today, nowMinutes, dismissed]
  );

  useEffect(() => {
    if (!notify || !baseKey || reminders.length === 0) return;
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    const fresh = reminders.filter((habit) => !notified.includes(habit.id));
    if (fresh.length === 0) return;

    for (const habit of fresh) {
      try {
        new Notification(`${habit.emoji ? `${habit.emoji} ` : ""}${habit.name}`, {
          body: `Still open today${
            habit.reminder ? ` (reminder ${habit.reminder.time})` : ""
          }.`,
          tag: `habit-${habit.id}-${today}`,
        });
      } catch {
        // A notification can fail without permission; the in-app list remains.
      }
    }

    const next = [...notified, ...fresh.map((habit) => habit.id)];
    setNotified(next);
    writeIds(`${baseKey}:notified`, next);
  }, [notify, baseKey, reminders, notified, today]);

  const dismiss = useCallback(
    (habitId: string) => {
      setDismissed((current) => {
        if (current.includes(habitId)) return current;
        const next = [...current, habitId];
        if (baseKey) writeIds(`${baseKey}:dismissed`, next);
        return next;
      });
    },
    [baseKey]
  );

  return { reminders, dismiss };
}
