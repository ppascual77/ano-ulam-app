import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Bookmark, Link } from "lucide-react-native";
import { Confetti, Spinner, useBurstOnActivate } from "@/frontend/components/ui";
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
      {/* Web app's small button spinner (w-4 h-4, border-white/40). */}
      {busy ? <Spinner size={16} trackColor="rgba(255,255,255,0.4)" /> : children}
    </Pressable>
  );
}

type ActionRailProps = {
  saved: boolean;
  /** How many people saved the meal (meals.save_count). */
  saveCount: number;
  /** Save request in flight for the active meal. */
  busy: boolean;
  onSave: () => void;
  onShare: () => void;
};

// Right-side vertical rail on the Recipes reel. Each button sits in a
// fixed-height column so the rail doesn't shift when the save count appears.
// A save bursts confetti when it lands; the screen keys this by meal so
// swiping onto an already-saved meal doesn't count as a new save.
export function ActionRail({ saved, saveCount, busy, onSave, onShare }: ActionRailProps) {
  const saveBurstId = useBurstOnActivate(saved);

  return (
    <View className="items-center gap-5">
      <View className="h-16 items-center gap-1">
        <View>
          <Confetti burstId={saveBurstId} />
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
        {/* How many people saved it; space kept even at 0 so the rail
            doesn't jump. */}
        <Text className={`font-inter-semibold text-small text-white ${saveCount > 0 ? "" : "opacity-0"}`}>{saveCount}</Text>
      </View>
      <View className="h-16 items-center">
        <RailButton onPress={onShare} label="Share">
          <Link color={colors.white} size={18} />
        </RailButton>
      </View>
    </View>
  );
}
