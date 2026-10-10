import { Minus, TrendingDown, TrendingUp } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { trendOf } from "@/frontend/core/prices/utils/prices";

// Cheaper = green down, pricier = red up, unchanged/unknown = yellow dash.
export function TrendIcon({ pct, size = 14 }: { pct: number | null; size?: number }) {
  const trend = trendOf(pct);
  const Icon = trend === "down" ? TrendingDown : trend === "up" ? TrendingUp : Minus;
  return <Icon color={colors.trend[trend]} size={size} />;
}

export const TREND_TEXT = { down: "text-trend-down", up: "text-trend-up", flat: "text-trend-flat" } as const;
