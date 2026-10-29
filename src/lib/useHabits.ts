"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/components/SessionProvider";
import type {
  Habit,
  HabitInput,
  HabitUpdateInput,
  Profile,
} from "@/lib/types";
import {
  apiErrorMessage,
  createHabit as createHabitRequest,
  deleteHabit as deleteHabitRequest,
  listHabits,
  listProfiles,
  renameCategory as renameCategoryRequest,
  reorderHabits as reorderHabitsRequest,
  setDayValue as setDayValueRequest,
  toggleHabit as toggleHabitRequest,
  updateHabit as updateHabitRequest,
} from "@/lib/api/client";
import { ensureLegacyImport, hasPendingLegacyImport } from "@/lib/importLocal";
import { sortHabits, todayForProfile } from "@/lib/domain/habits";
import {
  getCurrentProfileId,
  setCurrentProfileId,
} from "@/lib/storage";

/**
 * Loads the active profile and its habits, and exposes the Phase 1 mutation
 * actions. Archived habits are kept in the same list and partitioned here so
 * restoring one needs no extra fetch.
 */
export function useHabits() {
  const router = useRouter();
  const user = useSession();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        if (hasPendingLegacyImport(user.id)) setImporting(true);
        const imported = await ensureLegacyImport(user.id);
        const profiles = imported ?? (await listProfiles());
        if (cancelled) return;

        const storedId = getCurrentProfileId();
        const nextProfile = storedId
          ? profiles.find((candidate) => candidate.id === storedId) ?? null
          : null;

        if (!nextProfile) {
          router.replace("/profiles");
          return;
        }

        setProfile(nextProfile);
        setCurrentProfileId(nextProfile.id);
        const loaded = await listHabits(nextProfile.id);
        if (!cancelled) setAllHabits(sortHabits(loaded));
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) {
          setLoading(false);
          setImporting(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, router]);

  const clearError = useCallback(() => setError(null), []);

  const run = useCallback(
    async <T>(action: () => Promise<T>): Promise<T | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setBusy(true);
      setError(null);
      try {
        return await action();
      } catch (err) {
        setError(apiErrorMessage(err));
        return null;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    []
  );

  const replaceHabit = useCallback((updated: Habit) => {
    setAllHabits((prev) => {
      const exists = prev.some((habit) => habit.id === updated.id);
      const next = exists
        ? prev.map((habit) => (habit.id === updated.id ? updated : habit))
        : [...prev, updated];
      return sortHabits(next);
    });
  }, []);

  const createHabit = useCallback(
    (input: HabitInput) =>
      run(async () => {
        if (!profile) return null;
        const created = await createHabitRequest(profile.id, {
          ...input,
          createdAt: input.createdAt ?? todayForProfile(profile),
        });
        replaceHabit(created);
        return created;
      }),
    [profile, replaceHabit, run]
  );

  const updateHabit = useCallback(
    (habitId: string, input: HabitUpdateInput) =>
      run(async () => {
        if (!profile) return null;
        const updated = await updateHabitRequest(profile.id, habitId, input);
        replaceHabit(updated);
        return updated;
      }),
    [profile, replaceHabit, run]
  );

  const setArchived = useCallback(
    (habitId: string, archived: boolean) =>
      updateHabit(habitId, { archived }),
    [updateHabit]
  );

  const deleteHabit = useCallback(
    (habitId: string) =>
      run(async () => {
        if (!profile) return null;
        await deleteHabitRequest(profile.id, habitId);
        setAllHabits((prev) => prev.filter((habit) => habit.id !== habitId));
        return true;
      }),
    [profile, run]
  );

  const reorder = useCallback(
    (habitIds: string[]) =>
      run(async () => {
        if (!profile) return null;
        const updated = await reorderHabitsRequest(profile.id, habitIds);
        setAllHabits(sortHabits(updated));
        return updated;
      }),
    [profile, run]
  );

  const toggleToday = useCallback(
    (habitId: string) =>
      run(async () => {
        if (!profile) return null;
        const updated = await toggleHabitRequest(
          profile.id,
          habitId,
          todayForProfile(profile)
        );
        replaceHabit(updated);
        return updated;
      }),
    [profile, replaceHabit, run]
  );

  const toggleDay = useCallback(
    (habitId: string, date: string) =>
      run(async () => {
        if (!profile) return null;
        const updated = await toggleHabitRequest(profile.id, habitId, date);
        replaceHabit(updated);
        return updated;
      }),
    [profile, replaceHabit, run]
  );

  const renameCategory = useCallback(
    (from: string, to: string | null) =>
      run(async () => {
        if (!profile) return null;
        const updated = await renameCategoryRequest(profile.id, from, to);
        setAllHabits(sortHabits(updated));
        return updated;
      }),
    [profile, run]
  );

  const setDayValue = useCallback(
    (
      habitId: string,
      date: string,
      input: { value: number | null; note?: string | null; skipped?: boolean }
    ) =>
      run(async () => {
        if (!profile) return null;
        const updated = await setDayValueRequest(
          profile.id,
          habitId,
          date,
          input
        );
        replaceHabit(updated);
        return updated;
      }),
    [profile, replaceHabit, run]
  );

  const habits = useMemo(
    () => allHabits.filter((habit) => !habit.archivedAt),
    [allHabits]
  );
  const archivedHabits = useMemo(
    () => allHabits.filter((habit) => habit.archivedAt),
    [allHabits]
  );

  // Re-resolve "today" as the clock rolls over (or the profile's time zone or
  // day-start boundary changes), so an open tab never shows yesterday.
  const [today, setToday] = useState(() =>
    profile ? todayForProfile(profile) : ""
  );
  useEffect(() => {
    if (!profile) {
      setToday("");
      return;
    }
    const update = () => setToday(todayForProfile(profile));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [profile]);

  return {
    user,
    profile,
    habits,
    archivedHabits,
    today,
    loading,
    importing,
    busy,
    error,
    clearError,
    setProfile,
    createHabit,
    updateHabit,
    setArchived,
    deleteHabit,
    reorder,
    renameCategory,
    toggleToday,
    toggleDay,
    setDayValue,
  };
}
