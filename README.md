# Habit Tracker

A local-first Next.js 15 habit tracker with MongoDB persistence, multiple profiles, and no sign-in step.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy the environment template and fill it in:

   ```bash
   cp .env.example .env.local
   ```

   - `MONGODB_URI` – MongoDB Atlas connection string (or a local `mongodb://` URI).
   - `MONGODB_DB` – database name (defaults to `habit_tracker`).
   - `LOCAL_USERNAME` – optional username for the local account created on first run (defaults to `local`).

3. Run the app:

   ```bash
   npm run dev
   ```

Open http://localhost:3000, choose a profile, and start tracking. Profiles are
local to the machine running the app, so there is no login screen. If the
database already contains an account, the oldest account is adopted so
existing profiles and habits remain available.

## Scripts

- `npm run dev` – development server
- `npm run build` / `npm start` – production build and server
- `npm run lint` – ESLint
- `npm test` – Vitest unit tests
- `npm run test:watch` – Vitest in watch mode

## Pages

- `/today` – the daily list, grouped by category. Quick `+`/`−` or done/undo
  actions log progress, and Edit opens the full day editor for exact values,
  notes, and rest days. Weekly goals show on-track guidance and log one unit per
  click.
- `/habits` – the 30-day grid where habits are created, edited, reordered,
  archived, and permanently deleted from the archive. Filter and search by
  category, rename or delete a category in bulk, and select any day to record a
  value, a note, or a rest day.
- `/calendar` – a month view with per-day completion across every habit. Select
  a day to see scheduled and off-schedule habits and log them in place. Choose
  any category to focus the grid.
- `/insights` – completion trends across the last 8 weeks or 6 months, with
  per-habit streaks, 30-day and all-time completion, and current-week progress.
- `/profiles` – profile switching and creation.
- `/` redirects to `/today`; the retired `/overview` redirects to `/habits`.

Habits are archived rather than deleted. Permanent deletion is only available
from the archived section and is confirmed in the UI and enforced by the API.
Settings includes **Export all data (JSON)**, a full backup of every profile,
habit, and history entry, including archived habits, categories, appearance,
reminders, and calendar settings.

### Backup and restore

The export in Settings is a complete, versioned backup. **Restore from backup…**
reads that file back and previews what it contains before writing anything.
*Merge* adds the backup's profiles beside the current ones; *Replace* deletes
every current profile and habit first and is confirmed with a warning. A replace
keeps the backup's profile ids, so the active profile survives the reload.
Older backups without categories, appearance, reminders, or calendar settings
still restore, with those fields defaulting to empty.

### Categories and templates

A habit can have an optional free-text category. The category chips on
`/habits` and `/calendar` filter the list, and Today groups habits by category.
Renaming a category updates every habit at once; deleting a category moves its
habits to Uncategorized without touching their history. Templates in the create
dialog (and on empty screens) prefill a goal, schedule, category, emoji, and
colour, which can still be edited before saving.

### Calendar and time zone

Each habit detail shows a navigable month calendar and a 12-month heatmap. The
`/calendar` page aggregates the same colours across habits; a day's percentage
comes from the scheduled habits that were kept, excluding skipped and
off-schedule habits. Future days cannot be edited.

Settings can set a profile time zone and a day-start hour (for example 04:00 for
late-night routines). `today` is resolved in that zone and refreshes while the
app is open, so check-ins land on the correct local date.

### Install as an app (PWA)

The app ships a manifest, icons, and a service worker, so it can be installed
from the browser (Chrome/Edge: install icon in the address bar; iOS/iPadOS:
Share → Add to Home Screen). Installed windows open at `/today` with no browser
chrome. The service worker keeps a cached offline page for navigation failures;
habit data itself still needs the server.

### Reminders

Any habit can have an optional daily reminder time, set in the habit form. A
reminder becomes due on scheduled days once its local time passes and the day is
still open; logging, skipping, or noting the day clears it. Reminder times use
the profile time zone from Settings.

There are two delivery paths:

- **In-app** — Today always lists due habits while it is open. The list is
  dismissible and each habit notifies once per day when browser notifications
  are allowed.
- **Background Web Push** — enable it in Settings → Background reminders. The
  browser registers a push subscription, which is stored in MongoDB. A scheduler
  calls `/api/cron/reminders` every few minutes; the server checks each profile's
  own time zone and sends one notification per habit-day. Deliveries are claimed
  in MongoDB first, so overlapping cron runs cannot notify twice. Gone
  subscriptions (404/410) are removed automatically.

To configure Web Push:

1. Generate VAPID keys and add them to `.env.local`:

   ```bash
   npm run push:keys
   ```

   ```env
   VAPID_PUBLIC_KEY=...
   VAPID_PRIVATE_KEY=...
   VAPID_SUBJECT=mailto:you@example.com
   CRON_SECRET=some-long-random-string
   ```

2. Call the cron route from any scheduler (system cron, systemd timer, Vercel
   Cron, GitHub Actions), for example every 5 minutes:

   ```cron
   */5 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
     https://your-host.example.com/api/cron/reminders > /dev/null
   ```

   Locally:

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" \
     http://localhost:3000/api/cron/reminders
   ```

3. In Settings, press **Enable background reminders**, then **Send test
   notification**.

Notes and caveats:

- HTTPS is required for service workers and Web Push (localhost is exempt).
- On iPhone/iPad, notifications only work after the app is added to the Home
  Screen (iOS 16.4+). Settings shows this hint when it applies.
- The cron route returns `503` until both VAPID keys and `CRON_SECRET` are set,
  and `401` for a missing or wrong secret.
- Reminders are sent at most once per habit-day even when the scheduler runs
  more often.

## Tracking rules

- **Daily goals** compare each day's value with that day's target. A value below
  the optional minimum counts as failed; any other partial value is in progress.
- **Weekly total goals** add units from Monday through Sunday. The quick action
  logs one unit per click, and the weekly target is snapshotted from the first
  entry in the week so editing a goal never rewrites past weeks.
- **Schedules** can be every day, specific weekdays, or a number of days per
  week. "3 days a week" is a schedule, not a weekly amount goal: any three kept
  days complete the week.
- **Notes** can be saved with or without a value. A note without a value is a
  neutral `noted` day; it is excluded from streaks and percentages instead of
  counting as a miss. Notes with a value are shown in the day grid tooltip.
- **Skip / rest days** are neutral. They never break a streak and are excluded
  from percentages. A fully skipped week is also neutral for weekly goals.
- **Streaks** count consecutive achieved scheduled days, or consecutive
  achieved weeks for weekly goals and times-per-week schedules. An incomplete
  current week does not break a weekly streak. Best streaks use the same rules.
- **Percentages** score achieved days, or achieved weeks for weekly goals,
  excluding off-schedule, skipped, note-only, and before-creation days.

Day entries snapshot their target at save time, so later goal edits keep the
original history intact.

### Milestones

Each habit detail shows earned and upcoming badges for best streak length
(3, 7, 14, 30, 60, 100, 180, 365) and total kept days (1, 10, 25, 50, 100, 250,
500, 1000). Weekly goals and times-per-week schedules count weeks instead of
days, with scaled thresholds (streaks 3, 7, 14, 26, 52, 100; kept 1, 5, 10, 25,
50, 100). Streak badges use the best streak, so an earned badge never
disappears; skipped, note-only, and off-schedule days count toward neither
metric.

### Insights

`/insights` reuses the same completion rules. Daily habits score scheduled days
within each week or month; weekly goals and times-per-week schedules score
eligible weeks. Off-schedule, skipped, note-only, and before-creation days are
excluded, and future days in the current period are not counted yet. The
overall trend averages habits with activity in each period so every habit
carries equal weight, while per-habit cards show streaks and a mini trend.

The page also summarizes the current week and month (completion, kept entries,
days left, and the strongest/weakest habit of the month), rolls the last 30 days
up by category, and compares weekdays over the last 90 days. Category averages
weight each habit equally, and weekday stats cover daily habits only.

## Architecture

- `src/app/(app)` – app pages (`/today`, `/habits`, `/calendar`, `/insights`,
  `/profiles`)
- `src/app/api` – REST endpoints (profiles, habits, reorder, categories, restore,
  import, export)
- `src/server` – MongoDB client, repositories, services, local user helper
- `src/lib/domain` – shared pure habit rules (streaks, percentages, day updates)
- `src/lib/api` – typed browser API client
- `src/lib/useHabits.ts` – shared profile/habit loading and mutation hook

Habit mutations (create, edit, archive, reorder, delete, set a day, toggle
today) run on the server in `src/server/services/habits.ts`. The browser only
renders and calls the API. Target values are snapshotted per day, so editing a
goal never rewrites recorded history.

Profiles can have a picture uploaded from Settings. Uploaded images are resized
in the browser and stored on the profile document as a data URL. Profiles
without a picture show their initials on a color gradient.

Data previously stored in `localStorage` is imported into MongoDB once for the
local account the first time the app loads, provided the account has no
profiles yet. Theme, sidebar state, and the active profile selection remain
local UI preferences.
