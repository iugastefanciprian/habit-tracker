"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import ProfileAvatar from "@/components/ProfileAvatar";

interface ProfilePickerProps {
  profiles: Profile[];
  busy: boolean;
  loading: boolean;
  error: string | null;
  onSelect: (profile: Profile) => void;
  onCreate: (name: string) => void;
  onCancel?: () => void;
}

export default function ProfilePicker({
  profiles,
  busy,
  loading,
  error,
  onSelect,
  onCreate,
  onCancel,
}: ProfilePickerProps) {
  const [newName, setNewName] = useState("");

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const name = newName.trim();
    if (!name || busy) return;
    onCreate(name);
  };

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100">
              Choose a profile
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Pick who is tracking habits on this device.
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="text-sm text-gray-500 transition hover:text-blue-600 dark:text-gray-400 dark:hover:text-blue-400"
            >
              Back to tracker
            </button>
          )}
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
          >
            {error}
          </p>
        )}

        {loading ? (
          <p className="py-8 text-center text-gray-500 dark:text-gray-400">
            Loading profiles…
          </p>
        ) : (
          <>
            {profiles.length === 0 ? (
              <p className="mb-6 rounded-lg bg-white px-4 py-6 text-center text-gray-500 shadow dark:bg-gray-800 dark:text-gray-400">
                No profiles yet. Create your first one below.
              </p>
            ) : (
              <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {profiles.map((profile) => (
                  <button
                    key={profile.id}
                    type="button"
                    onClick={() => onSelect(profile)}
                    disabled={busy}
                    className="flex flex-col items-center gap-3 rounded-lg bg-white p-5 shadow transition hover:shadow-md disabled:opacity-60 dark:bg-gray-800"
                  >
                    <ProfileAvatar profile={profile} size="lg" />
                    <span className="w-full truncate text-center font-semibold text-gray-900 dark:text-gray-100">
                      {profile.name}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <form
              onSubmit={submit}
              className="rounded-lg bg-white p-6 shadow dark:bg-gray-800"
            >
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                New profile
              </h2>
              <div className="mt-3 flex gap-2">
                <input
                  type="text"
                  value={newName}
                  maxLength={80}
                  onChange={(event) => setNewName(event.target.value)}
                  placeholder="Profile name"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
                />
                <button
                  type="submit"
                  disabled={busy || newName.trim().length === 0}
                  className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
                >
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
