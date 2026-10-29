const CURRENT_PROFILE_KEY = "habitTracker.currentProfileId";

export function getCurrentProfileId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CURRENT_PROFILE_KEY);
  } catch {
    return null;
  }
}

export function setCurrentProfileId(id: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (id === null) {
      localStorage.removeItem(CURRENT_PROFILE_KEY);
    } else {
      localStorage.setItem(CURRENT_PROFILE_KEY, id);
    }
  } catch {
    // Storage can be unavailable; the selection still applies this session.
  }
}
