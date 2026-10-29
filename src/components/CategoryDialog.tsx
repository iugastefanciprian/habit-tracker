"use client";

import { useEffect, useState } from "react";

interface CategoryDialogProps {
  mode: "rename" | "delete";
  category: string;
  busy?: boolean;
  error?: string | null;
  onRename: (name: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function CategoryDialog({
  mode,
  category,
  busy = false,
  error: externalError,
  onRename,
  onDelete,
  onClose,
}: CategoryDialogProps) {
  const [name, setName] = useState(category);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Give the category a name.");
      return;
    }
    if (trimmed.toLowerCase() === category.toLowerCase()) {
      onClose();
      return;
    }
    onRename(trimmed);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-dialog-title"
        className="w-full max-w-sm rounded-lg bg-white p-6 shadow-lg dark:bg-gray-800"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === "rename" ? (
          <form onSubmit={submit}>
            <h2
              id="category-dialog-title"
              className="text-xl font-bold text-gray-900 dark:text-gray-100"
            >
              Rename category
            </h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Every habit in “{category}” moves to the new name.
            </p>
            <label className="mt-4 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Category name
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={40}
                autoFocus
                className="mt-1 w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
              />
            </label>
            {(error || externalError) && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
              >
                {error ?? externalError}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="rounded-lg bg-blue-600 px-5 py-2 text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                {busy ? "Renaming…" : "Rename"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <>
            <h2
              id="category-dialog-title"
              className="text-xl font-bold text-gray-900 dark:text-gray-100"
            >
              Delete category?
            </h2>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              “{category}” will be removed from its habits. The habits and their
              history stay, and they move to Uncategorized.
            </p>
            {externalError && (
              <p
                role="alert"
                className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/40 dark:text-red-300"
              >
                {externalError}
              </p>
            )}
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onDelete}
                disabled={busy}
                className="rounded-lg bg-red-600 px-5 py-2 text-white transition hover:bg-red-700 disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Delete category"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-gray-600 transition hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
