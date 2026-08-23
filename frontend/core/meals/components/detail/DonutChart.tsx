import { View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { AppText } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

type DonutChartProps = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  size?: number;
};

const SEGMENT_COLORS = {
  protein: colors.macro.protein,
  fats: colors.macro.fats,
  carbs: colors.macro.carbs,
};

const STROKE_WIDTH = 13;
const GAP = 20;

export function DonutChart({ calories, protein, carbs, fats, size = 110 }: DonutChartProps) {
  const total = protein + carbs + fats;
  const radius = size / 2;
  const normalizedRadius = radius - STROKE_WIDTH / 2;
  const circumference = 2 * Math.PI * normalizedRadius;
  const getLength = (value: number) => (total ? (value / total) * circumference : 0);

  const segments = (
    [
      { key: "protein", color: SEGMENT_COLORS.protein, value: protein },
      { key: "fats", color: SEGMENT_COLORS.fats, value: fats },
      { key: "carbs", color: SEGMENT_COLORS.carbs, value: carbs },
    ] as const
  )
    .filter((s) => s.value > 0)
    .map((s) => ({ ...s, len: Math.max(getLength(s.value) - GAP, 0) }));

  let offset = 0;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} originX={radius} originY={radius}>
          {segments.map((s) => {
            const dashOffset = -offset;
            offset += s.len + GAP;
            return (
              <Circle
                key={s.key}
                stroke={s.color}
                fill="transparent"
                strokeWidth={STROKE_WIDTH}
                strokeLinecap="round"
                strokeDasharray={`${s.len} ${circumference}`}
                strokeDashoffset={dashOffset}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            );
          })}
        </G>
      </Svg>
      <View className="absolute inset-0 items-center justify-center">
        <AppText variant="bodyBold">{calories}</AppText>
        <AppText variant="caption">Cal</AppText>
      </View>
    </View>
  );
}
