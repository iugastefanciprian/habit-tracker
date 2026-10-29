import type {
  ExportPayload,
  Habit,
  HabitInput,
  HabitUpdateInput,
  Profile,
  ProfileUpdateInput,
  PushStatus,
  RestoreMode,
  RestoreSummary,
  WebPushSubscription,
} from "@/lib/types";

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function apiErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Something went wrong. Please try again.";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body !== undefined;
  const response = await fetch(path, {
    ...init,
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    credentials: "same-origin",
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      data?.error ?? "Request failed. Please try again."
    );
  }

  return data as T;
}

export async function listProfiles(): Promise<Profile[]> {
  const data = await request<{ profiles: Profile[] }>("/api/profiles");
  return data.profiles;
}

export async function createProfile(name: string): Promise<Profile> {
  const data = await request<{ profile: Profile }>("/api/profiles", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return data.profile;
}

export async function updateProfile(
  profileId: string,
  input: ProfileUpdateInput
): Promise<Profile> {
  const data = await request<{ profile: Profile }>(
    `/api/profiles/${encodeURIComponent(profileId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return data.profile;
}

export async function listHabits(profileId: string): Promise<Habit[]> {
  const data = await request<{ habits: Habit[] }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits`
  );
  return data.habits;
}

export async function createHabit(
  profileId: string,
  input: HabitInput
): Promise<Habit> {
  const data = await request<{ habit: Habit }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits`,
    { method: "POST", body: JSON.stringify(input) }
  );
  return data.habit;
}

export async function updateHabit(
  profileId: string,
  habitId: string,
  input: HabitUpdateInput
): Promise<Habit> {
  const data = await request<{ habit: Habit }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits/${encodeURIComponent(habitId)}`,
    { method: "PATCH", body: JSON.stringify(input) }
  );
  return data.habit;
}

export async function reorderHabits(
  profileId: string,
  habitIds: string[]
): Promise<Habit[]> {
  const data = await request<{ habits: Habit[] }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits/reorder`,
    { method: "PUT", body: JSON.stringify({ habitIds }) }
  );
  return data.habits;
}

export async function renameCategory(
  profileId: string,
  from: string,
  to: string | null
): Promise<Habit[]> {
  const data = await request<{ habits: Habit[] }>(
    `/api/profiles/${encodeURIComponent(profileId)}/categories/rename`,
    { method: "POST", body: JSON.stringify({ from, to }) }
  );
  return data.habits;
}

export async function exportAllData(): Promise<ExportPayload> {
  return request<ExportPayload>("/api/export");
}

export interface RestoreResponse {
  profiles: Profile[];
  summary: RestoreSummary;
}

/** Sends a parsed backup file to the server, merging or replacing data. */
export async function restoreBackup(
  mode: RestoreMode,
  backup: unknown
): Promise<RestoreResponse> {
  return request<RestoreResponse>("/api/restore", {
    method: "POST",
    body: JSON.stringify({ mode, backup }),
  });
}

export async function deleteHabit(
  profileId: string,
  habitId: string
): Promise<void> {
  await request<void>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits/${encodeURIComponent(habitId)}`,
    { method: "DELETE" }
  );
}

export interface DayValueInput {
  value: number | null;
  note?: string | null;
  skipped?: boolean;
}

export async function setDayValue(
  profileId: string,
  habitId: string,
  date: string,
  input: DayValueInput
): Promise<Habit> {
  const data = await request<{ habit: Habit }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits/${encodeURIComponent(habitId)}/days/${encodeURIComponent(date)}`,
    { method: "PUT", body: JSON.stringify(input) }
  );
  return data.habit;
}

export async function toggleHabit(
  profileId: string,
  habitId: string,
  date?: string
): Promise<Habit> {
  const data = await request<{ habit: Habit }>(
    `/api/profiles/${encodeURIComponent(profileId)}/habits/${encodeURIComponent(habitId)}/toggle`,
    { method: "POST", body: JSON.stringify(date ? { date } : {}) }
  );
  return data.habit;
}

export async function getPushStatus(profileId: string): Promise<PushStatus> {
  return request<PushStatus>(
    `/api/push/status?profileId=${encodeURIComponent(profileId)}`
  );
}

export async function subscribeToPush(
  profileId: string,
  subscription: WebPushSubscription
): Promise<void> {
  await request<{ subscribed: boolean }>("/api/push/subscribe", {
    method: "POST",
    body: JSON.stringify({ profileId, subscription }),
  });
}

export async function unsubscribeFromPush(endpoint: string): Promise<void> {
  await request<void>("/api/push/subscribe", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendTestPush(profileId: string): Promise<number> {
  const data = await request<{ sent: number }>("/api/push/test", {
    method: "POST",
    body: JSON.stringify({ profileId }),
  });
  return data.sent;
}

export interface LegacyPayload {
  profiles: {
    name: string;
    habits: {
      name: string;
      goalType: Habit["goalType"];
      required: number;
      minimum?: number;
      unit?: string;
      period: Habit["period"];
      createdAt: string;
      completedDates: string[];
      dailyProgress: Habit["dailyProgress"];
    }[];
  }[];
}

export async function importLegacyData(
  payload: LegacyPayload
): Promise<Profile[]> {
  const data = await request<{ profiles: Profile[] }>("/api/import", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return data.profiles;
}
