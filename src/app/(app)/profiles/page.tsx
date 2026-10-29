"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile } from "@/lib/types";
import {
  apiErrorMessage,
  createProfile as createProfileRequest,
  listProfiles,
} from "@/lib/api/client";
import { ensureLegacyImport } from "@/lib/importLocal";
import { getCurrentProfileId, setCurrentProfileId } from "@/lib/storage";
import { useSession } from "@/components/SessionProvider";
import ProfilePicker from "@/components/ProfilePicker";

export default function ProfilesPage() {
  const router = useRouter();
  const user = useSession();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const imported = await ensureLegacyImport(user.id);
        const loaded = imported ?? (await listProfiles());
        if (!cancelled) setProfiles(loaded);
      } catch (err) {
        if (!cancelled) setError(apiErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const select = (profile: Profile) => {
    setCurrentProfileId(profile.id);
    router.push("/today");
  };

  const create = async (name: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createProfileRequest(name);
      setCurrentProfileId(created.id);
      router.push("/today");
    } catch (err) {
      setError(apiErrorMessage(err));
      setBusy(false);
    }
  };

  const hasSelection =
    profiles.length > 0 &&
    profiles.some((profile) => profile.id === getCurrentProfileId());

  return (
    <ProfilePicker
      profiles={profiles}
      busy={busy}
      loading={loading}
      error={error}
      onSelect={select}
      onCreate={(name) => void create(name)}
      onCancel={hasSelection ? () => router.push("/today") : undefined}
    />
  );
}
