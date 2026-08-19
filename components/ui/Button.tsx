import { ReactNode } from "react";
import { View, Pressable, PressableProps } from "react-native";
import { AppText } from "./AppText";

// "social" is a neutral white/bordered button for third-party auth
// (Google, Apple) — the icon carries the brand identity, not our palette.
type Variant = "primary" | "secondary" | "outline" | "social";
// "default" spans its parent's width (e.g. a carousel's bottom CTA).
// "pill" hugs its content and pushes to the left edge of its parent
// (align-self: flex-start gives both at once) — e.g. a corner "Get Started".
// "circle" is a fixed-size icon-only button (e.g. a carousel's next arrow).
type Shape = "default" | "pill" | "circle";

const containerClasses: Record<Variant, string> = {
  primary: "bg-primary active:opacity-80",
  secondary: "bg-accent active:opacity-80",
  outline: "bg-transparent border border-primary active:bg-primary/5",
  social: "bg-white border border-ink-emphasis/10 active:bg-ink-emphasis/5",
};

const labelClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
  social: "text-ink",
};

const shapeClasses: Record<Shape, string> = {
  default: "rounded-xl px-5 py-3.5",
  pill: "rounded-full self-start px-5 py-3.5",
  circle: "rounded-full w-14 h-14",
};

type ButtonProps = PressableProps & {
  label?: string;
  icon?: ReactNode;
  variant?: Variant;
  shape?: Shape;
};

export function Button({ label, icon, variant = "primary", shape = "default", ...props }: ButtonProps) {
  return (
    <Pressable
      className={`items-center justify-center ${containerClasses[variant]} ${shapeClasses[shape]}`}
      {...props}
    >
      <View className="flex-row items-center gap-2">
        {icon}
        {label && (
          <AppText variant="bodyBold" className={labelClasses[variant]}>
            {label}
          </AppText>
        )}
      </View>
    </Pressable>
  );
}
