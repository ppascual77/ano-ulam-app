import { Text, View } from "react-native";
import { RollingText } from "@/frontend/components/ui";

// A Button label with a number that rolls when it changes ("Show 12 meals",
// "Add 8 staples"), passed through Button's `icon` slot since its `label`
// is plain text. Same type as Button's label (AppText "title").
export function CountLabel({
  before,
  count,
  after,
  tone,
}: {
  before?: string;
  count: number;
  after?: string;
  /** "onPrimary": white, on a filled button. "primary": an outline button. */
  tone: "onPrimary" | "primary";
}) {
  const cls = `font-inter-semibold text-subheading ${tone === "onPrimary" ? "text-white" : "text-primary"}`;
  return (
    <View className="flex-row items-center">
      {before && <Text className={cls}>{before} </Text>}
      <RollingText value={count} rank={count} className={cls} />
      {after && <Text className={cls}> {after}</Text>}
    </View>
  );
}
