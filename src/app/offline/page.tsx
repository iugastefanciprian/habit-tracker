import Link from "next/link";

export const metadata = {
  title: "Offline · Habit Tracker",
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 dark:bg-gray-900">
      <div className="w-full max-w-sm rounded-lg bg-white p-8 text-center shadow dark:bg-gray-800">
        <p className="text-4xl" aria-hidden="true">
          📶
        </p>
        <h1 className="mt-3 text-xl font-bold text-gray-900 dark:text-gray-100">
          You are offline
        </h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
          Your habits are stored on the server. Reconnect to load them and log
          today&apos;s progress.
        </p>
        <Link
          href="/today"
          className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-700"
        >
          Try again
        </Link>
      </div>
    </main>
  );
}
