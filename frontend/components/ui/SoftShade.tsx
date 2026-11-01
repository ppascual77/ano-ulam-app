import { useId, type ReactNode } from "react";
import { View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { colors } from "@/frontend/constants/theme";

type SoftShadeProps = {
  children: ReactNode;
  /** Diameter of the shade; it spills past the content without affecting
   *  layout. */
  size?: number;
  /** Darkness at the center, fading to nothing at the edge. */
  strength?: number;
};

// A faint, round dark shade behind small white text over a photo (a save
// count), so it stays readable on light images without a hard chip edge.
export function SoftShade({ children, size = 32, strength = 0.45 }: SoftShadeProps) {
  // SVG ids must be unique per instance and plain characters.
  const id = `shade${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View className="items-center justify-center">
      <View
        pointerEvents="none"
        style={{ position: "absolute", width: size, height: size, left: "50%", top: "50%", marginLeft: -size / 2, marginTop: -size / 2 }}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id={id} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={colors.black} stopOpacity={strength} />
              <Stop offset="0.5" stopColor={colors.black} stopOpacity={strength * 0.6} />
              <Stop offset="1" stopColor={colors.black} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Ellipse cx={size / 2} cy={size / 2} rx={size / 2} ry={size / 2} fill={`url(#${id})`} />
        </Svg>
      </View>
      {children}
    </View>
  );
}
