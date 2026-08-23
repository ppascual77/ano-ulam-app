import { ReactNode } from "react";
import { View, Pressable, PressableProps, StyleProp, ViewStyle } from "react-native";
import { AppText } from "./AppText";

// "social" is a neutral white/bordered button for third-party auth
// (Google, Apple) — the icon carries the brand identity, not our palette.
// "tinted" is a soft, low-emphasis fill (e.g. a meal card's "View Details").
// "muted" is a generic neutral white/bordered button (e.g. an icon-only
// filter trigger) — same treatment as "social" but not scoped to auth.
type Variant = "primary" | "secondary" | "outline" | "social" | "tinted" | "muted";
// "default" spans its parent's width (e.g. a carousel's bottom CTA).
// "pill" hugs its content and pushes to the left edge of its parent
// (align-self: flex-start gives both at once) — e.g. a corner "Get Started".
// "circle" is a fixed-size icon-only button (e.g. a carousel's next arrow).
// "fullPill" spans its parent's width like "default" but fully rounded.
type Shape = "default" | "pill" | "circle" | "fullPill";

const containerClasses: Record<Variant, string> = {
  primary: "bg-primary active:opacity-80",
  secondary: "bg-accent active:opacity-80",
  outline: "bg-transparent border border-primary active:bg-primary/5",
  social: "bg-white border border-ink-emphasis/10 active:bg-ink-emphasis/5",
  tinted: "bg-tinted-bg active:opacity-80",
  muted: "bg-white border border-ink-emphasis/10 active:bg-ink-emphasis/5",
};

const labelClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  social: "text-ink",
  // 14px + light weight, overriding the "title" AppText variant's default
  // subheading/semibold (last class wins on a shared property).
  tinted: "text-primary text-body font-inter-light",
  muted: "text-ink",
};

const shapeClasses: Record<Shape, string> = {
  default: "rounded-xl px-5 py-3.5",
  pill: "rounded-full self-start px-5 py-3.5",
  circle: "rounded-full w-14 h-14",
  // Radius set via inline style (10px isn't on Tailwind's rounded-* scale).
  fullPill: "px-5 py-2",
};

const shapeStyles: Partial<Record<Shape, { borderRadius: number }>> = {
  fullPill: { borderRadius: 10 },
};

type ButtonProps = Omit<PressableProps, "style"> & {
  label?: string;
  icon?: ReactNode;
  /** Which side of the label the icon renders on. Defaults to "left". */
  iconPosition?: "left" | "right";
  variant?: Variant;
  shape?: Shape;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  icon,
  iconPosition = "left",
  variant = "primary",
  shape = "default",
  style,
  ...props
}: ButtonProps) {
  // "fullPill" (currently only the "tinted" View Details button) centers its
  // label regardless of the icon, and pins the icon to the button's far edge.
  const isFullPill = shape === "fullPill";
  const labelNode = label && (
    <AppText variant="title" className={labelClasses[variant]}>
      {label}
    </AppText>
  );

  return (
    <Pressable
      className={`items-center justify-center ${containerClasses[variant]} ${shapeClasses[shape]}`}
      style={[shapeStyles[shape], style]}
      {...props}
    >
      {isFullPill ? (
        <View className="w-full flex-row items-center">
          <View className="flex-1 items-start">{iconPosition === "left" && icon}</View>
          {labelNode}
          <View className="flex-1 items-end">{iconPosition === "right" && icon}</View>
        </View>
      ) : (
        <View className="flex-row items-center gap-2">
          {iconPosition === "left" && icon}
          {labelNode}
          {iconPosition === "right" && icon}
        </View>
      )}
    </Pressable>
  );
}
