import { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Bookmark, Heart, Link } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// 44px circle used for every rail button: translucent "glass" by default,
// filled with the action's color when active. (No blur: expo-blur isn't
// installed, and the translucent fill reads fine over the dark gradient.)
function RailButton({
  onPress,
  active = false,
  activeClassName = "",
  busy = false,
  children,
  label,
}: {
  onPress: () => void;
  active?: boolean;
  activeClassName?: string;
  busy?: boolean;
  children: ReactNode;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityLabel={label}
      className={`h-11 w-11 items-center justify-center rounded-full border ${
        active ? activeClassName : "border-white/20 bg-white/15"
      } ${busy ? "opacity-60" : ""}`}
    >
      {busy ? <ActivityIndicator size="small" color={colors.white} /> : children}
    </Pressable>
  );
}

type ActionRailProps = {
  liked: boolean;
  likeCount: number;
  saved: boolean;
  /** Like/save request in flight for the active meal. */
  busy: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
};

// Right-side vertical rail on the Recipes reel. Each button sits in a
// fixed-height column so the rail doesn't shift when the like count appears.
export function ActionRail({ liked, likeCount, saved, busy, onLike, onSave, onShare }: ActionRailProps) {
  return (
    <View className="items-center gap-5">
      <View className="h-16 items-center gap-1">
        <RailButton onPress={onLike} active={liked} activeClassName="border-like bg-like" busy={busy} label="Like">
          <Heart color={colors.white} fill={liked ? colors.white : "none"} size={20} />
        </RailButton>
        {/* Space kept even at 0 so the rail doesn't jump. */}
        <Text className={`font-inter-semibold text-small text-white ${likeCount > 0 ? "" : "opacity-0"}`}>
          {likeCount}
        </Text>
      </View>
      <View className="h-16 items-center">
        <RailButton
          onPress={onSave}
          active={saved}
          activeClassName="border-brand-green bg-brand-green"
          busy={busy}
          label="Save"
        >
          <Bookmark color={colors.white} fill={saved ? colors.white : "none"} size={20} />
        </RailButton>
      </View>
      <View className="h-16 items-center">
        <RailButton onPress={onShare} label="Share">
          <Link color={colors.white} size={18} />
        </RailButton>
      </View>
    </View>
  );
}
