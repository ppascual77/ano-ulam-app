import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type AdminHeaderProps = {
  title: string;
  /** After "Admin ·", e.g. "120 ingredients". */
  subtitle?: string;
  /** Right side, e.g. an action button. */
  right?: ReactNode;
};

// Every admin screen's top: a round back button and the page title in the
// app's dotted section-title style ("Manage Meals."), with an
// "Admin · …" line under it.
export function AdminHeader({ title, subtitle, right }: AdminHeaderProps) {
  return (
    <View className="flex-row items-center gap-3 px-5 pb-4 pt-2">
      <Pressable
        onPress={() => router.back()}
        hitSlop={8}
        accessibilityLabel="Back"
        className="h-10 w-10 items-center justify-center rounded-full border border-ink-emphasis/10 active:bg-ink-emphasis/5"
      >
        <ArrowLeft color={colors.ink.emphasis} size={20} />
      </Pressable>
      <View className="flex-1">
        <AppText variant="sectionTitle" dot>
          {title}
        </AppText>
        <Text className="font-inter-medium text-body text-ink-subtle">
          Admin{subtitle ? ` · ${subtitle}` : ""}
        </Text>
      </View>
      {right}
    </View>
  );
}
