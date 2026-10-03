import { ReactNode } from "react";
import { Image as RNImage, Linking, Pressable, Text, View } from "react-native";
import { Image, type ImageSource } from "expo-image";
import { BadgeCheck } from "lucide-react-native";
import { Avatar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// Pieces shared by FoodPostCard and OfficialPostCard, so a community post
// and an AnoUlam post read the same.

// Avatar + name (+ verified badge) row, with an optional trailing slot (the
// own-post "..." menu). Tapping the author opens their profile when the
// caller passes onPress.
export function PostAuthor({
  name,
  avatarUrl,
  official = false,
  trailing,
  onPress,
}: {
  name: string;
  avatarUrl?: string | null;
  official?: boolean;
  trailing?: ReactNode;
  /** Tapping the avatar or name (opens the author's profile). */
  onPress?: () => void;
}) {
  return (
    <View className="flex-row items-center gap-2.5 px-4 pt-4">
      <Pressable onPress={onPress} disabled={!onPress} className="flex-1 flex-row items-center gap-2.5">
        {official ? (
          <RNImage source={require("@/assets/icon.png")} className="h-8 w-8 rounded-full border border-web-divider" />
        ) : (
          <Avatar name={name} imageUri={avatarUrl ?? undefined} size={32} />
        )}
        <View className="flex-1 flex-row items-center gap-1">
          <Text className="font-inter-semibold text-body text-web-ink">{name}</Text>
          {official && <BadgeCheck color={colors.white} fill={colors.verified} size={14} />}
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}

const CAPTION_URL_REGEX = /(?:https?:\/\/|www\.)\S+\.\S+/g;

// Caption text with any URLs rendered as green, underlined, tappable links
// (same matching as the web app's renderCaption).
export function PostCaption({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  let last = 0;
  CAPTION_URL_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CAPTION_URL_REGEX.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const raw = match[0];
    const href = raw.startsWith("http") ? raw : `https://${raw}`;
    nodes.push(
      <Text key={match.index} className="text-brand-green underline" onPress={() => Linking.openURL(href)}>
        {raw}
      </Text>,
    );
    last = match.index + raw.length;
  }
  if (last < text.length) nodes.push(text.slice(last));

  return <Text className="mt-2.5 px-4 font-inter-regular text-body leading-6 text-web-ink-soft">{nodes}</Text>;
}

// Full-bleed (no side padding) 16:9 photo; tap opens the lightbox.
export function PostPhoto({ source, onPress }: { source: ImageSource | number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} className="mt-2.5 w-full bg-web-divider active:opacity-90" style={{ aspectRatio: 16 / 9 }}>
      <Image source={source} style={{ flex: 1 }} contentFit="cover" />
    </Pressable>
  );
}
