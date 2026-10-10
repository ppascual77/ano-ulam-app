import { Text } from "react-native";
import { Info } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { DA_PRICE_PAGE, NCR_MARKETS } from "../constants/markets";

const openDaPage = () => WebBrowser.openBrowserAsync(DA_PRICE_PAGE);

// "banner": the amber box at the top of Price Watch. "small": the plain
// footnote at the bottom of the ingredient detail sheet.
export function PriceDisclaimer({ variant, onOpenMarkets }: { variant: "banner" | "small"; onOpenMarkets: () => void }) {
  const isBanner = variant === "banner";
  const text = isBanner
    ? "font-inter-regular text-small text-notice-text"
    : "font-inter-regular text-sub leading-4 text-ink-subtle";
  const link = isBanner ? "font-inter-semibold text-primary underline" : "font-inter-medium text-ink underline";

  const body = (
    <Text className={text}>
      Prices are daily averages across{" "}
      <Text className={link} onPress={onOpenMarkets}>
        {NCR_MARKETS.length} NCR markets
      </Text>{" "}
      from DA reports. Prices may vary, so use them as a general guide for your grocery budget.{" "}
      <Text className={link} onPress={openDaPage}>
        See DA price monitoring →
      </Text>
    </Text>
  );

  return isBanner ? <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>{body}</NoticeBanner> : body;
}
