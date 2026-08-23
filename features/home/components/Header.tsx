import { Text, View } from "react-native";
import { Image } from "expo-image";
import { AppText, Avatar } from "@/components/ui";

type HeaderProps = {
  /** Undefined/guest shows "Hello" only, no name. */
  name?: string;
  avatarUrl?: string;
};

// Avatar lives here (scrolls with the rest of Home's content) rather than
// as fixed chrome, so it isn't sticky while scrolling.
export function Header({ name, avatarUrl }: HeaderProps) {
  return (
    <View className="ml-2 flex-row items-center justify-between">
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
        <View className="flex-row items-center gap-1">
          <AppText variant="heading">Ano ulam mo</AppText>
          <Image
            source={require("@/assets/today.gif")}
            style={{ width: 70, height: 30 }}
            contentFit="contain"
          />
        </View>
      </View>
      <Avatar name={name ?? "Guest"} imageUri={avatarUrl} size={48} />
    </View>
  );
}
