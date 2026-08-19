import { Text, TextProps } from "react-native";

// Ordered by visual hierarchy, largest first, so the list reads top-to-bottom
// the same way the styles render on screen.
type Variant =
  | "display"
  | "heading"
  | "title"
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "caption";

const variantClasses: Record<Variant, string> = {
  // Hero/marketing headline (e.g. onboarding screens). Usually built from
  // nested <Text> spans for per-word color, not used as a single flat color.
  display: "font-inter-extrabold text-hero text-ink-emphasis",
  heading: "font-inter-bold text-heading text-ink-emphasis",
  title: "font-inter-semibold text-subheading text-ink-emphasis",
  body: "font-inter-regular text-body text-ink",
  bodyMedium: "font-inter-medium text-body text-ink",
  bodyBold: "font-inter-bold text-body text-ink",
  caption: "font-inter-regular text-sub text-ink-subtle",
};

type AppTextProps = TextProps & {
  variant?: Variant;
  className?: string;
};

export function AppText({ variant = "body", className = "", ...props }: AppTextProps) {
  return <Text className={`${variantClasses[variant]} ${className}`} {...props} />;
}
