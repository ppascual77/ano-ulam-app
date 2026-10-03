import { Pressable, Text, View } from "react-native";
import { Sparkles, type LucideIcon } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

type EmptyStateProps = {
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  body: string;
  action?: { label: string; Icon: LucideIcon; onPress: () => void };
};

// Centered empty tab: icon tile with a sparkle badge in the icon's color,
// title, body and one call to action.
export function EmptyState({ Icon, iconColor, title, body, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-5 px-6 py-16">
      <View className="h-20 w-20 items-center justify-center">
        <Icon color={iconColor} size={32} strokeWidth={1.5} />
        <View
          className="absolute -right-1 -top-1 h-6 w-6 items-center justify-center rounded-full"
          style={{ backgroundColor: iconColor }}
        >
          <Sparkles color={colors.white} size={12} />
        </View>
      </View>
      <View className="items-center">
        <Text className="font-inter-bold text-subheading text-web-ink">{title}</Text>
        <Text className="mt-1 max-w-[260px] text-center font-inter-regular text-body text-web-ink-muted">{body}</Text>
      </View>
      {action && (
        <Pressable
          onPress={action.onPress}
          className="flex-row items-center gap-2 rounded-2xl bg-brand-green px-6 py-3 active:scale-95"
        >
          <action.Icon color={colors.white} size={16} />
          <Text className="font-inter-semibold text-body text-white">{action.label}</Text>
        </Pressable>
      )}
    </View>
  );
}
