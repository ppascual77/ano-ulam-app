import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { router } from "expo-router";
import { Lock, Users, Utensils, Carrot, Sprout, User } from "lucide-react-native";
import { AppText, Avatar, Dropdown } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// TODO: replace with a real check (e.g. profile.tier === "admin") once the
// backend session is reliably testable — hardcoded true for now so the admin
// menu can be built/tested ahead of that.
const isAdmin = true;

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
      {isAdmin ? (
        <Dropdown
          trigger={<Avatar name={name ?? "Guest"} imageUri={avatarUrl} size={48} />}
          headerLabel="Admin"
          headerIcon={<Lock color={colors.ink.subtle} size={16} />}
          items={[
            {
              label: "Manage Users",
              icon: <Users color={colors.ink.subtle} size={18} />,
              // TODO: no admin screens built yet — wire up once needed.
              onPress: () => console.log("TODO: Manage Users"),
            },
            {
              label: "Manage Meals",
              icon: <Utensils color={colors.ink.subtle} size={18} />,
              onPress: () => console.log("TODO: Manage Meals"),
            },
            {
              label: "Manage Ingredients",
              icon: <Carrot color={colors.ink.subtle} size={18} />,
              onPress: () => console.log("TODO: Manage Ingredients"),
            },
            {
              label: "Seed Meal",
              icon: <Sprout color={colors.ink.subtle} size={18} />,
              onPress: () => console.log("TODO: Seed Meal"),
            },
            {
              label: "Visit Profile",
              icon: <User color={colors.ink.subtle} size={18} />,
              onPress: () => router.push("/profile"),
            },
          ]}
        />
      ) : (
        <Pressable onPress={() => router.push("/profile")}>
          <Avatar name={name ?? "Guest"} imageUri={avatarUrl} size={48} />
        </Pressable>
      )}
    </View>
  );
}
