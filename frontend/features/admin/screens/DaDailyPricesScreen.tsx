import { useState } from "react";
import { View, Pressable } from "react-native";
import { router } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { DaImportPanel } from "../components/DaImportPanel";
import { DaLinkPanel } from "../components/DaLinkPanel";

type Tab = "import" | "link";

export default function DaDailyPricesScreen() {
  const [tab, setTab] = useState<Tab>("import");

  return (
    <Screen padded={false}>
      <View className="px-5 pt-2 pb-4 flex-row items-center gap-2">
        <Pressable onPress={() => router.back()} className="h-9 w-9 items-center justify-center">
          <ArrowLeft color={colors.ink.emphasis} size={18} />
        </Pressable>
        <View>
          <AppText variant="eyebrow">Admin</AppText>
          <AppText variant="heading">DA Daily Prices</AppText>
        </View>
      </View>

      <View className="flex-row gap-5 px-5 border-b border-ink-emphasis/10 mb-4">
        {(
          [
            { id: "import", label: "Import" },
            { id: "link", label: "Link to Ingredients" },
          ] as const
        ).map((t) => (
          <Pressable key={t.id} onPress={() => setTab(t.id)} className="pb-3">
            <AppText
              variant={tab === t.id ? "bodyBold" : "body"}
              className={tab === t.id ? "text-primary" : "text-ink-subtle"}
            >
              {t.label}
            </AppText>
          </Pressable>
        ))}
      </View>

      {tab === "import" ? <DaImportPanel /> : <DaLinkPanel />}
    </Screen>
  );
}
