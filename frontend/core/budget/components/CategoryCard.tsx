import { ImageSourcePropType, Pressable, View } from "react-native";
import { Image } from "expo-image";
import type { LucideIcon } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";

type Props = {
  label: string;
  image: ImageSourcePropType;
  badgeIcon: LucideIcon;
  badgeColor: string;
  bgClassName: string;
  borderClassName: string;
  /** 10% darker than borderClassName, swapped in when selected. Fill never changes. */
  selectedBorderClassName: string;
  selected: boolean;
  onPress: () => void;
};

export function CategoryCard({
  label,
  image,
  badgeIcon: BadgeIcon,
  badgeColor,
  bgClassName,
  borderClassName,
  selectedBorderClassName,
  selected,
  onPress,
}: Props) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-1 items-center border ${bgClassName} ${selected ? selectedBorderClassName : borderClassName}`}
      style={{ borderRadius: 8, paddingVertical: 12, borderWidth: 2 }}
    >
      <View className="absolute" style={{ top: 8, right: 8, zIndex: 10 }}>
        <BadgeIcon color={badgeColor} size={16} strokeWidth={1} />
      </View>

      <Image source={image} style={{ width: 65, height: 65 }} contentFit="contain" />

      <AppText variant="bodyMedium" className="mt-1">
        {label}
      </AppText>
    </Pressable>
  );
}
