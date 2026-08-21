import { Text, View } from "react-native";
import { AppText, Avatar } from "@/components/ui";

type HeaderProps = {
  /** Undefined/guest shows "Hello" only, no name. */
  name?: string;
  avatarUrl?: string;
};

export function Header({ name, avatarUrl }: HeaderProps) {
  return (
    <View className="flex-row items-center justify-between">
      <View>
        <AppText variant="title">
          {name ? (
            <>
              Hello, <Text className="font-inter-bold text-primary">{name}</Text>
            </>
          ) : (
            "Hello"
          )}
        </AppText>
        <AppText variant="heading">Ano ulam mo today?</AppText>
      </View>
      <Avatar name={name ?? "Guest"} imageUri={avatarUrl} size={48} />
    </View>
  );
}
