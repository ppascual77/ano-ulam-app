import { Pressable, Text, View } from "react-native";
import { AlertTriangle, Clock3, FileText } from "lucide-react-native";
import { Avatar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { CatalogStatus } from "@/frontend/core/saved/types";

const CATALOG_STRIPS: Partial<Record<NonNullable<CatalogStatus>, { bg: string; label: string }>> = {
  deleted: { bg: "bg-like/50", label: "Removed by creator" },
  pending: { bg: "bg-notice-icon/50", label: "Update under review" },
  updated: { bg: "bg-info/50", label: "Updated by creator" },
};

// Saved card's bottom-edge strip: what happened to the original recipe
// since it was saved. Nothing for active.
export function CatalogStatusStrip({ status }: { status: CatalogStatus }) {
  const strip = status ? CATALOG_STRIPS[status] : undefined;
  if (!strip) return null;
  return (
    <View className={`items-center px-2 py-1 ${strip.bg}`}>
      <Text className="font-inter-semibold text-sub text-white">{strip.label}</Text>
    </View>
  );
}

// "Created by" chip on a community recipe's photo; tap for the poster's
// profile. Meals don't carry the poster's name yet, so it's the same
// generic label PosterRow uses.
export function PosterChip({ name = "Community cook", onPress }: { name?: string; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={4} className="flex-row items-center gap-1.5 rounded-full bg-black/40 py-0.5 pl-0.5 pr-2">
      <Avatar name={name} size={20} />
      <View>
        <Text className="font-inter-regular text-sub text-white/60">Created by</Text>
        <Text numberOfLines={1} className="font-inter-medium text-sub text-white">
          {name}
        </Text>
      </View>
    </Pressable>
  );
}

// Top-left badge on the user's own recipe card. Nothing once approved.
export function RecipeStatusBadge({ status, reason }: { status?: string; reason?: string | null }) {
  if (status === "pending") {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-notice-icon px-2 py-0.5">
        <Clock3 color={colors.white} size={9} />
        <Text className="font-inter-semibold text-sub text-white">Under Review</Text>
      </View>
    );
  }
  if (status === "draft") {
    return (
      <View className="flex-row items-center gap-1 rounded-full bg-web-ink-body px-2 py-0.5">
        <FileText color={colors.white} size={9} />
        <Text className="font-inter-semibold text-sub text-white">Draft</Text>
      </View>
    );
  }
  if (status === "rejected") {
    return (
      <View className="max-w-[140px] rounded-xl bg-like px-2 py-1">
        <View className="flex-row items-center gap-1">
          <AlertTriangle color={colors.white} size={9} />
          <Text className="font-inter-semibold text-sub text-white">Not Published</Text>
        </View>
        {!!reason && (
          <Text numberOfLines={2} className="mt-0.5 font-inter-regular text-sub text-white/80">
            {reason}
          </Text>
        )}
      </View>
    );
  }
  return null;
}
