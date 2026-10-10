import { Text, View } from "react-native";
import { BottomSheet } from "@/frontend/components/ui";
import { NCR_MARKETS } from "../constants/markets";

type MarketsSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** "inline" when opened from inside another sheet (two native Modals
   *  don't stack, see BottomSheet's overlay prop). */
  presentation?: "modal" | "inline";
};

export function MarketsSheet({ visible, onClose, presentation = "modal" }: MarketsSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent heightPercent={0.85} presentation={presentation}>
      <View className="px-5 pb-8 pt-5">
        <Text className="mb-1 font-inter-bold text-body text-ink-emphasis">NCR Markets Covered</Text>
        <Text className="mb-4 font-inter-regular text-small text-ink-subtle">
          {NCR_MARKETS.length} wet markets monitored by the Department of Agriculture
        </Text>
        {NCR_MARKETS.map((market, i) => (
          <Text
            key={market}
            className={`py-2 font-inter-regular text-body text-ink ${
              i < NCR_MARKETS.length - 1 ? "border-b border-ink-emphasis/5" : ""
            }`}
          >
            {market}
          </Text>
        ))}
      </View>
    </BottomSheet>
  );
}
