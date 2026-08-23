import { Image, View } from "react-native";
import { AppText } from "./AppText";

// Only these four brand colors for generated avatars, per design — never an
// arbitrary/default Tailwind color.
const FALLBACK_COLORS = ["bg-primary", "bg-accent",  "bg-avatar-navy"];

// Deterministic hash so a given seed (e.g. user id or name) always lands on
// the same color — "randomly assigned" per user, not re-randomized on every render.
function hashSeed(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function getInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toUpperCase();
}

// Fallback avatar generator for users without an avatarUrl on signup.
export function getAvatarFallback(seed: string) {
  return {
    initials: getInitials(seed),
    bgClassName: FALLBACK_COLORS[hashSeed(seed) % FALLBACK_COLORS.length],
  };
}

type AvatarProps = {
  /** Also used to seed the generated fallback's color and initials. */
  name: string;
  imageUri?: string;
  size?: number;
  className?: string;
};

export function Avatar({ name, imageUri, size = 44, className = "" }: AvatarProps) {
  const dimensions = { width: size, height: size };

  if (imageUri) {
    return (
      <Image
        source={{ uri: imageUri }}
        style={dimensions}
        className={`rounded-full ${className}`}
      />
    );
  }

  const { initials, bgClassName } = getAvatarFallback(name);

  return (
    <View
      style={dimensions}
      className={`rounded-full items-center justify-center ${bgClassName} ${className}`}
    >
      <AppText variant="bodyBold" className="text-white" style={{ fontSize: size * 0.4 }}>
        {initials}
      </AppText>
    </View>
  );
}
