import { Text, View } from "react-native";
import { type LucideIcon } from "lucide-react-native";
import { Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type EmptyStateProps = {
  Icon: LucideIcon;
  iconColor: string;
  title: string;
  body: string;
  action?: { label: string; Icon: LucideIcon; onPress: () => void };
};

// The tint behind the icon: its own color, faint.
const TINT_OPACITY = 0.1;

// Centered empty tab: the icon in a soft circle of its own color, title,
// body and an optional call to action.
export function EmptyState({ Icon, iconColor, title, body, action }: EmptyStateProps) {
  return (
    <View className="items-center gap-5 px-6 py-14">
      <View className="h-20 w-20 items-center justify-center">
        <View className="absolute inset-0 rounded-full" style={{ backgroundColor: iconColor, opacity: TINT_OPACITY }} />
        <Icon color={iconColor} size={30} strokeWidth={1.6} />
      </View>
      <View className="items-center">
        <Text className="font-inter-bold text-subheading text-ink-emphasis">{title}</Text>
        <Text className="mt-1 max-w-[260px] text-center font-inter-regular text-body text-ink-subtle">{body}</Text>
      </View>
      {action && (
        <Button
          label={action.label}
          icon={<action.Icon color={colors.white} size={16} />}
          onPress={action.onPress}
          shape="pill"
          style={{ alignSelf: "center" }}
        />
      )}
    </View>
  );
}
