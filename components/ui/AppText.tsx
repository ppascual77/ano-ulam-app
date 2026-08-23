import { Text, TextProps } from "react-native";

// Ordered by visual hierarchy, largest first, so the list reads top-to-bottom
// the same way the styles render on screen.
type Variant =
  | "display"
  | "heading"
  | "headingMedium"
  | "title"
  | "body"
  | "bodyMedium"
  | "bodyBold"
  | "caption"
  | "eyebrow"
  | "subhero"
  | "navLabel";

const variantClasses: Record<Variant, string> = {
  // Hero/marketing headline (e.g. onboarding screens). Usually built from
  // nested <Text> spans for per-word color, not used as a single flat color.
  display: "font-inter-extrabold text-hero text-ink-emphasis",
  heading: "font-inter-bold text-heading text-ink-emphasis",
  // Same size as "heading", medium weight instead of bold.
  headingMedium: "font-inter-medium text-heading text-ink-emphasis",
  subhero: "font-inter-extrabold text-subhero text-ink-emphasis",
  title: "font-inter-semibold text-subheading text-ink-emphasis",
  body: "font-inter-regular text-body text-ink",
  bodyMedium: "font-inter-medium text-body text-ink",
  bodyBold: "font-inter-bold text-body text-ink",
  caption: "font-inter-regular text-body text-ink-subtle leading-5",
  // Small label sitting above a headline (e.g. intro/onboarding screens).
  // Semibold, not bold — RN can't synthetically bold a static font file, so
  // "bold" at this size needs the actual *_Bold font, and reads too heavy
  // that small anyway. Uppercase is applied here, not in the copy itself.
  eyebrow:
    "font-inter-semibold text-[14px] tracking-[2px] text-ink-subtle uppercase",
  // Tab bar label (e.g. BottomNav). Pass className="text-primary" to
  // override the default ink color for an active tab.
  navLabel: "font-inter-medium text-sub text-ink",
};

type AppTextProps = TextProps & {
  variant?: Variant;
  className?: string;
};

export function AppText({
  variant = "body",
  className = "",
  ...props
}: AppTextProps) {
  return (
    <Text className={`${variantClasses[variant]} ${className}`} {...props} />
  );
}
