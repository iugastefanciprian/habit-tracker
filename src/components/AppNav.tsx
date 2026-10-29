"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import { useSidebar } from "@/components/SidebarProvider";
import ProfileAvatar from "@/components/ProfileAvatar";
import SettingsModal from "@/components/SettingsModal";

interface AppNavProps {
  active: "today" | "habits" | "calendar" | "insights";
  profile: Profile;
  onProfileUpdated: (profile: Profile) => void;
  onCreateHabit?: () => void;
}

const NAV_ID = "app-nav";

export default function AppNav({
  active,
  profile,
  onProfileUpdated,
  onCreateHabit,
}: AppNavProps) {
  const router = useRouter();
  const { collapsed, setCollapsed } = useSidebar();
  const [open, setOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const go = (path: string) => {
    setOpen(false);
    router.push(path);
  };

  const createHabit = () => {
    setOpen(false);
    if (onCreateHabit) {
      onCreateHabit();
    } else {
      router.push("/habits?new=1");
    }
  };

  const openSettings = () => {
    setOpen(false);
    setSettingsOpen(true);
  };

  const itemClass = (isActive: boolean) =>
    `w-full text-left px-4 py-2 rounded-lg transition ${
      isActive
        ? "bg-blue-600 text-white"
        : "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
    }`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-controls={NAV_ID}
        aria-expanded={open}
        className={`fixed top-4 left-4 z-50 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow border border-gray-200 dark:border-gray-700 md:hidden ${
          open ? "hidden" : ""
        }`}
      >
        ☰
      </button>

      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Show menu"
        aria-controls={NAV_ID}
        aria-expanded={!collapsed}
        className={`fixed top-4 left-4 z-50 px-3 py-2 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200 shadow border border-gray-200 dark:border-gray-700 hidden ${
          collapsed ? "md:block" : "md:hidden"
        }`}
      >
        ☰
      </button>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        id={NAV_ID}
        className={`app-nav fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4 shadow-lg transition-transform duration-200 ${
          open ? "translate-x-0" : "-translate-x-full"
        } ${collapsed ? "md:-translate-x-full" : "md:translate-x-0"}`}
      >
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Menu
          </h2>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            aria-label="Hide menu"
            aria-controls={NAV_ID}
            aria-expanded={!collapsed}
            className="hidden md:inline-flex px-2 py-1 rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition"
          >
            «
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close menu"
            className="md:hidden px-2 py-1 rounded-lg bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
          >
            ✕
          </button>
        </div>

        <button
          type="button"
          onClick={() => go("/profiles")}
          title="Switch profile"
          className="mb-4 flex w-full items-center gap-3 rounded-lg bg-gray-100 px-3 py-2 text-left transition hover:bg-gray-200 dark:bg-gray-700/60 dark:hover:bg-gray-700"
        >
          <ProfileAvatar profile={profile} size="md" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-gray-900 dark:text-gray-100">
              {profile.name}
            </span>
            <span className="block text-xs text-gray-500 dark:text-gray-400">
              Switch profile
            </span>
          </span>
        </button>

        <div className="flex flex-col gap-2">
          <button type="button" onClick={() => go("/today")} className={itemClass(active === "today")}>
            Today
          </button>
          <button type="button" onClick={() => go("/habits")} className={itemClass(active === "habits")}>
            Habits
          </button>
          <button type="button" onClick={() => go("/calendar")} className={itemClass(active === "calendar")}>
            Calendar
          </button>
          <button type="button" onClick={() => go("/insights")} className={itemClass(active === "insights")}>
            Insights
          </button>
          <button
            type="button"
            onClick={createHabit}
            className="w-full text-left px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            Create Habit
          </button>
        </div>

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={openSettings}
            className="w-full text-left px-4 py-2 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
          >
            ⚙️ Settings
          </button>
        </div>
      </aside>

      {settingsOpen && (
        <SettingsModal
          profile={profile}
          onProfileUpdated={onProfileUpdated}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}
