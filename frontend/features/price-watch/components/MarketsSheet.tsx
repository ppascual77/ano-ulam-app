import { Pressable, Text, View } from "react-native";
import { ExternalLink } from "lucide-react-native";
import { AppText, BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { NCR_MARKETS } from "../constants/markets";
import { openDaPage } from "./PriceDisclaimer";

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
        {/* About these prices: the caveat and DA link that used to crowd the
            Price Watch banner (now a one-line chip that opens this). */}
        <AppText variant="sectionTitle" dot className="mb-2">
          About these prices
        </AppText>
        <Text className="font-inter-regular text-body-lg text-ink-subtle">
          Daily averages from the Department of Agriculture&apos;s price monitoring. Prices may vary by market and stall,
          so use them as a general guide for your grocery budget.
        </Text>
        <Pressable onPress={openDaPage} hitSlop={8} className="mb-6 mt-2 flex-row items-center gap-1 self-start">
          <Text className="font-inter-semibold text-body-lg text-primary">See DA price monitoring</Text>
          <ExternalLink color={colors.primary} size={14} />
        </Pressable>

        <AppText variant="sectionTitle" dot className="mb-2">
          NCR markets covered
        </AppText>
        <Text className="mb-4 font-inter-regular text-body-lg text-ink-subtle">
          {NCR_MARKETS.length} wet markets monitored by the Department of Agriculture
        </Text>
        {NCR_MARKETS.map((market, i) => (
          <Text
            key={market}
            className={`py-2.5 font-inter-regular text-body-lg text-ink ${
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
