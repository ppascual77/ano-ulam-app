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

type PriceDisclaimerProps =
  /** The one-line source chip at the top of Price Watch. Tapping it opens
   *  the Markets sheet, which holds the full caveat and the DA link. */
  | { variant: "chip"; asOf?: string; onOpenMarkets: () => void }
  /** The plain footnote at the bottom of the ingredient detail sheet. */
  | { variant: "small"; onOpenMarkets: () => void };

export function PriceDisclaimer(props: PriceDisclaimerProps) {
  if (props.variant === "chip") {
    const parts = ["DA daily prices", `${NCR_MARKETS.length} NCR markets`, ...(props.asOf ? [asOfLabel(props.asOf)] : [])];
    return (
      <Pressable
        onPress={props.onOpenMarkets}
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

  const link = "font-inter-medium text-ink underline";
  return (
    <Text className="font-inter-regular text-sub leading-4 text-ink-subtle">
      Prices are daily averages across{" "}
      <Text className={link} onPress={props.onOpenMarkets}>
        {NCR_MARKETS.length} NCR markets
      </Text>{" "}
      from DA reports. Prices may vary, so use them as a general guide for your grocery budget.{" "}
      <Text className={link} onPress={openDaPage}>
        See DA price monitoring →
      </Text>
    </Text>
  );
}
