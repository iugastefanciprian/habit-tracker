"use client";

import { useEffect, useState } from "react";
import type { Profile } from "@/lib/types";
import { profileGradient, profileInitials } from "@/lib/avatar";

type AvatarSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<AvatarSize, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-20 w-20 text-2xl",
};

interface ProfileAvatarProps {
  profile: Pick<Profile, "id" | "name" | "avatar">;
  size?: AvatarSize;
  className?: string;
}

export default function ProfileAvatar({
  profile,
  size = "md",
  className = "",
}: ProfileAvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [profile.avatar]);

  const showImage = Boolean(profile.avatar) && !imageFailed;

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${SIZE_CLASSES[size]} ${className}`}
      style={showImage ? undefined : { backgroundImage: profileGradient(profile.id) }}
      aria-hidden="true"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profile.avatar}
          alt=""
          className="h-full w-full object-cover"
          onError={() => setImageFailed(true)}
        />
      ) : (
        profileInitials(profile.name)
      )}
    </span>
  );
}
