"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeMode, useTheme } from "@/components/ThemeProvider";
import type { ExportPayload, Profile, RestoreMode } from "@/lib/types";
import { exportAllData, restoreBackup, updateProfile } from "@/lib/api/client";
import { describeBackup, type BackupInput } from "@/lib/domain/backup";
import { fileToAvatarDataUrl } from "@/lib/image";
import { usePush } from "@/lib/usePush";
import ProfileAvatar from "@/components/ProfileAvatar";

interface SettingsModalProps {
  profile: Profile;
  onProfileUpdated: (profile: Profile) => void;
  onClose: () => void;
}

const themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "☀️" },
  { value: "dark", label: "Dark", icon: "🌙" },
  { value: "system", label: "System", icon: "🖥️" },
];

function downloadBackup(payload: ExportPayload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `habit-tracker-backup-${payload.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function SettingsModal({
  profile,
  onProfileUpdated,
  onClose,
}: SettingsModalProps) {
  const { mode, setMode } = useTheme();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreInputRef = useRef<HTMLInputElement>(null);
  const [savingPicture, setSavingPicture] = useState(false);
  const [pictureError, setPictureError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [restoreFile, setRestoreFile] = useState<{
    name: string;
    backup: BackupInput;
    summary: ReturnType<typeof describeBackup>;
  } | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("merge");
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreDone, setRestoreDone] = useState<string | null>(null);
  const [timeZone, setTimeZone] = useState(profile.timeZone ?? "");
  const [dayStartHour, setDayStartHour] = useState(
    String(profile.dayStartHour ?? 0)
  );
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduleSaved, setScheduleSaved] = useState(false);
  const push = usePush(profile);

  const deviceTimeZone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return "";
    }
  }, []);

  const timeZoneOptions = useMemo(() => {
    const values: string[] = [];
    try {
      const supported = (
        Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
      ).supportedValuesOf?.("timeZone");
      if (supported) values.push(...supported);
    } catch {
      // Older browsers: keep the device zone and the current value.
    }
    if (deviceTimeZone) values.unshift(deviceTimeZone);
    if (profile.timeZone) values.unshift(profile.timeZone);
    return [...new Set(values)].sort((a, b) => a.localeCompare(b));
  }, [deviceTimeZone, profile.timeZone]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const saveAvatar = async (avatar: string | null) => {
    if (savingPicture) return;
    setSavingPicture(true);
    setPictureError(null);
    try {
      onProfileUpdated(await updateProfile(profile.id, { avatar }));
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (error) {
      setPictureError(
        error instanceof Error
          ? error.message
          : "Could not update the profile picture."
      );
    } finally {
      setSavingPicture(false);
    }
  };

  const saveSchedule = async () => {
    if (savingSchedule) return;
    const hour = Number(dayStartHour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
      setScheduleError("Day start must be a whole hour from 0 to 23.");
      return;
    }
    setSavingSchedule(true);
    setScheduleError(null);
    setScheduleSaved(false);
    try {
      onProfileUpdated(
        await updateProfile(profile.id, {
          timeZone: timeZone || null,
          dayStartHour: hour === 0 ? null : hour,
        })
      );
      setScheduleSaved(true);
    } catch (error) {
      setScheduleError(
        error instanceof Error ? error.message : "Could not save the schedule."
      );
    } finally {
      setSavingSchedule(false);
    }
  };

  const exportData = async () => {
    if (exporting) return;
    setExporting(true);
    setExportError(null);
    try {
      downloadBackup(await exportAllData());
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Could not export your data."
      );
    } finally {
      setExporting(false);
    }
  };

  const onFileSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPictureError(null);
    try {
      const dataUrl = await fileToAvatarDataUrl(file);
      await saveAvatar(dataUrl);
    } catch (error) {
      setPictureError(
        error instanceof Error
          ? error.message
          : "Could not read that image."
      );
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onBackupSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setRestoreError(null);
    setRestoreDone(null);
    setRestoreFile(null);
    try {
      const parsed: unknown = JSON.parse(await file.text());
      if (
        !parsed ||
        typeof parsed !== "object" ||
        !Array.isArray((parsed as { profiles?: unknown }).profiles)
      ) {
        throw new Error("Not a backup");
      }
      const backup = parsed as BackupInput;
      setRestoreFile({
        name: file.name,
        backup,
        summary: describeBackup(backup),
      });
    } catch {
      setRestoreError("That file is not a habit-tracker backup.");
      if (restoreInputRef.current) restoreInputRef.current.value = "";
    }
  };

  const restore = async () => {
    if (!restoreFile || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    setRestoreDone(null);
    try {
      const result = await restoreBackup(restoreMode, restoreFile.backup);
      const { profiles: profileCount, habits: habitCount } = result.summary;
      setRestoreDone(
        `Restored ${profileCount} ${
          profileCount === 1 ? "profile" : "profiles"
        } and ${habitCount} ${habitCount === 1 ? "habit" : "habits"} (${
          result.summary.mode
        }). Reloading…`
      );
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      setRestoreError(
        error instanceof Error ? error.message : "Could not restore that backup."
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-lg bg-white dark:bg-gray-800 p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="settings-title"
          className="text-xl font-bold text-gray-900 dark:text-gray-100"
        >
          Settings
        </h2>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Profile picture
          </legend>
          <div className="flex items-center gap-4">
            <ProfileAvatar profile={profile} size="lg" />
            <div className="flex-1 space-y-2">
              <input
                ref={fileInputRef}
                id="profile-picture-input"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(event) => void onFileSelected(event)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={savingPicture}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {savingPicture ? "Saving…" : "Upload picture"}
              </button>
              {profile.avatar && (
                <button
                  type="button"
                  onClick={() => void saveAvatar(null)}
                  disabled={savingPicture}
                  className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                >
                  Remove picture
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {profile.avatar
              ? "Upload a new image or remove it to use your initials."
              : "Without a picture, your initials appear on a color gradient."}
          </p>
          {pictureError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {pictureError}
            </p>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Appearance
          </legend>
          <div className="grid grid-cols-3 gap-2">
            {themeOptions.map((option) => {
              const selected = mode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setMode(option.value)}
                  className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-sm transition ${
                    selected
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  <span aria-hidden="true" className="text-lg">
                    {option.icon}
                  </span>
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {mode === "system"
              ? "Following your device's appearance setting."
              : `Always using ${mode} mode.`}
          </p>
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Calendar
          </legend>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Time zone
            <input
              type="text"
              list="timezone-options"
              value={timeZone}
              onChange={(event) => {
                setTimeZone(event.target.value);
                setScheduleSaved(false);
              }}
              placeholder={deviceTimeZone || "Device default"}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
          </label>
          <datalist id="timezone-options">
            {timeZoneOptions.map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setTimeZone(deviceTimeZone);
                setScheduleSaved(false);
              }}
              className="rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Use device time zone
            </button>
            <button
              type="button"
              onClick={() => {
                setTimeZone("");
                setScheduleSaved(false);
              }}
              className="rounded-lg bg-gray-200 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
            >
              Use default
            </button>
          </div>

          <label className="mt-3 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Day starts at
            <select
              value={dayStartHour}
              onChange={(event) => {
                setDayStartHour(event.target.value);
                setScheduleSaved(false);
              }}
              className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            >
              {Array.from({ length: 24 }, (_, hour) => (
                <option key={hour} value={hour}>
                  {hour === 0
                    ? "Midnight (00:00)"
                    : `${String(hour).padStart(2, "0")}:00`}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Habits after this hour count toward the next day. Existing entries
            keep the date they were saved with.
          </p>
          <button
            type="button"
            onClick={() => void saveSchedule()}
            disabled={savingSchedule}
            className="mt-2 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {savingSchedule ? "Saving…" : "Save calendar settings"}
          </button>
          {scheduleSaved && (
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">
              Calendar settings saved.
            </p>
          )}
          {scheduleError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {scheduleError}
            </p>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Background reminders
          </legend>

          {push.loading ? (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Checking notification support…
            </p>
          ) : !push.status?.enabled ? (
            <>
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                Push is not configured on the server. Add{" "}
                <code>VAPID_PUBLIC_KEY</code>, <code>VAPID_PRIVATE_KEY</code>,
                and <code>CRON_SECRET</code> to the environment to enable
                reminders that arrive while the app is closed.
              </p>
              {push.error && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
                >
                  {push.error}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Reminders are delivered by the server even when this app is
                closed, once a scheduler calls{" "}
                <code>/api/cron/reminders</code> every few minutes.
              </p>

              {push.needsInstall && (
                <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:bg-blue-900/30 dark:text-blue-200">
                  On iPhone or iPad, add this app to the Home Screen first
                  (Share → Add to Home Screen), then enable reminders from the
                  installed app.
                </p>
              )}

              {!push.supported && (
                <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  This browser cannot receive background notifications. In-app
                  reminders still appear on Today.
                </p>
              )}

              <div className="mt-2 space-y-2">
                {push.subscribed ? (
                  <>
                    <p className="rounded-lg bg-green-50 px-3 py-2 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-200">
                      Enabled on this device
                      {push.status.subscriptions > 1
                        ? ` · ${push.status.subscriptions} devices total`
                        : ""}
                      .
                    </p>
                    <button
                      type="button"
                      onClick={() => void push.sendTest()}
                      disabled={push.busy}
                      className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      {push.busy ? "Sending…" : "Send test notification"}
                    </button>
                    <button
                      type="button"
                      onClick={() => void push.unsubscribe()}
                      disabled={push.busy}
                      className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
                    >
                      Disable on this device
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => void push.subscribe()}
                    disabled={push.busy || !push.supported}
                    className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700 disabled:opacity-60"
                  >
                    {push.busy
                      ? "Enabling…"
                      : "Enable background reminders"}
                  </button>
                )}
              </div>

              {push.testSent !== null && (
                <p className="mt-2 text-xs text-green-700 dark:text-green-400">
                  Test sent to {push.testSent}{" "}
                  {push.testSent === 1 ? "device" : "devices"}.
                </p>
              )}
              {push.error && (
                <p
                  role="alert"
                  className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
                >
                  {push.error}
                </p>
              )}
            </>
          )}
        </fieldset>

        <fieldset className="mt-4">
          <legend className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            Data
          </legend>
          <button
            type="button"
            onClick={() => void exportData()}
            disabled={exporting}
            className="w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            {exporting ? "Preparing backup…" : "Export all data (JSON)"}
          </button>
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Downloads every profile and habit, including archived habits,
            categories, reminders, and calendar settings.
          </p>
          {exportError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {exportError}
            </p>
          )}

          <input
            ref={restoreInputRef}
            type="file"
            accept="application/json,.json"
            onChange={(event) => void onBackupSelected(event)}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => restoreInputRef.current?.click()}
            disabled={restoring}
            className="mt-3 w-full rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-300 disabled:opacity-60 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600"
          >
            Restore from backup…
          </button>

          {restoreFile && (
            <div className="mt-3 rounded-lg border border-gray-200 p-3 dark:border-gray-600">
              <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                {restoreFile.name}
              </p>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {restoreFile.summary.profiles}{" "}
                {restoreFile.summary.profiles === 1 ? "profile" : "profiles"} ·{" "}
                {restoreFile.summary.habits}{" "}
                {restoreFile.summary.habits === 1 ? "habit" : "habits"} ·{" "}
                {restoreFile.summary.entries} recorded{" "}
                {restoreFile.summary.entries === 1 ? "day" : "days"}
                {restoreFile.summary.archivedHabits > 0
                  ? ` · ${restoreFile.summary.archivedHabits} archived`
                  : ""}
              </p>

              <fieldset className="mt-3">
                <legend className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  How should it apply?
                </legend>
                <label className="mt-1 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="radio"
                    name="restore-mode"
                    checked={restoreMode === "merge"}
                    onChange={() => setRestoreMode("merge")}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="font-medium">Merge</strong> — add these
                    profiles beside the ones you already have.
                  </span>
                </label>
                <label className="mt-1 flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="radio"
                    name="restore-mode"
                    checked={restoreMode === "replace"}
                    onChange={() => setRestoreMode("replace")}
                    className="mt-0.5"
                  />
                  <span>
                    <strong className="font-medium">Replace</strong> — delete
                    every current profile and habit first.
                  </span>
                </label>
              </fieldset>

              {restoreMode === "replace" && (
                <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-200">
                  This cannot be undone. Export your current data first if you
                  might need it.
                </p>
              )}

              <button
                type="button"
                onClick={() => void restore()}
                disabled={restoring}
                className={`mt-3 w-full rounded-lg px-4 py-2 text-sm text-white transition disabled:opacity-60 ${
                  restoreMode === "replace"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {restoring
                  ? "Restoring…"
                  : restoreMode === "replace"
                    ? "Replace all data"
                    : "Merge backup"}
              </button>
            </div>
          )}

          {restoreDone && (
            <p className="mt-2 text-xs text-green-700 dark:text-green-400">
              {restoreDone}
            </p>
          )}
          {restoreError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {restoreError}
            </p>
          )}
        </fieldset>

        <button
          type="button"
          onClick={onClose}
          className="mt-4 w-full rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700"
        >
          Done
        </button>
      </div>
    </div>
  );
}
