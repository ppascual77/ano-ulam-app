import { Linking, Pressable, Text, View } from "react-native";
import { Image } from "expo-image";

type LinkPreviewCardProps = {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
};

function hostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

// Gray box with a thumbnail, title, description and hostname for a link
// attached to a post. Opens the link.
export function LinkPreviewCard({ url, title, description, image }: LinkPreviewCardProps) {
  return (
    <Pressable
      onPress={() => Linking.openURL(url)}
      className="flex-row overflow-hidden rounded-xl border border-web-divider bg-web-divider/50"
    >
      {image && <Image source={{ uri: image }} style={{ width: 80, height: 80 }} contentFit="cover" />}
      <View className="flex-1 justify-center gap-0.5 px-3 py-2.5">
        {title && (
          <Text className="font-inter-semibold text-small text-web-ink" numberOfLines={1}>
            {title}
          </Text>
        )}
        {description && (
          <Text className="font-inter-regular text-small text-web-ink-muted" numberOfLines={2}>
            {description}
          </Text>
        )}
        <Text className="mt-0.5 font-inter-regular text-sub text-brand-green" numberOfLines={1}>
          {hostname(url)}
        </Text>
      </View>
    </Pressable>
  );
}
