import { Pressable, Text } from "react-native";
import { ChevronRight, Store } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { colors } from "@/frontend/constants/theme";
import { addDays, formatShortDate, toIsoDate } from "@/frontend/core/prices/utils/prices";
import { DA_PRICE_PAGE, NCR_MARKETS } from "../constants/markets";

export const openDaPage = () => WebBrowser.openBrowserAsync(DA_PRICE_PAGE);

// "Today", "Yesterday", or "Oct 9".
function asOfLabel(iso: string) {
  const today = toIsoDate(new Date());
  if (iso === today) return "Today";
  if (iso === addDays(today, -1)) return "Yesterday";
  return formatShortDate(iso);
}

type PriceDisclaimerProps = {
  /** Latest DA publish date (ISO); shown as Today / Yesterday / "Oct 9". */
  asOf?: string;
  onOpenMarkets: () => void;
};

// The one-line source chip at the top of Price Watch. Tapping it opens the
// Markets sheet, which holds the full caveat and the DA link.
export function PriceDisclaimer({ asOf, onOpenMarkets }: PriceDisclaimerProps) {
  const parts = ["DA daily prices", `${NCR_MARKETS.length} NCR markets`, ...(asOf ? [asOfLabel(asOf)] : [])];
  return (
    <Pressable
      onPress={onOpenMarkets}
      accessibilityRole="button"
      accessibilityLabel={`${parts.join(", ")}. About these prices`}
      className="flex-row items-center gap-2 self-start rounded-full border border-ink-emphasis/10 bg-notice-positive-bg py-2 pl-3 pr-2"
    >
      <Store color={colors.primary} size={14} />
      <Text numberOfLines={1} className="shrink font-inter-medium text-small text-ink-emphasis">
        {parts.join(" · ")}
      </Text>
      <ChevronRight color={colors.ink.subtle} size={14} />
    </Pressable>
  );
}
