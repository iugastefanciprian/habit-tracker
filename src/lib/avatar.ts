export function profileInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0];
  const last = parts[parts.length - 1][0];
  return `${first}${last}`.toUpperCase();
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * Deterministic "random" gradient for a profile, so the default avatar keeps
 * the same colors across reloads.
 */
export function profileGradient(seed: string): string {
  const hash = hashString(seed);
  const startHue = hash % 360;
  const endHue = (startHue + 40 + ((hash >>> 8) % 80)) % 360;
  return `linear-gradient(135deg, hsl(${startHue} 72% 55%), hsl(${endHue} 68% 38%))`;
}
