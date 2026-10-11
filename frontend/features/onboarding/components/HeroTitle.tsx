import { Text } from "react-native";
import type { HeroSegment } from "../slides";

const heroColorClass = {
  primary: "text-primary",
  accent: "text-accent",
} as const;

type HeroTitleProps = {
  segments: HeroSegment[];
  /** Size/alignment, e.g. "text-hero" or "text-heading text-center". */
  className?: string;
};

// An onboarding headline in the app's title style: extrabold, tight display
// tracking, per-segment brand colors, and the orange period, unless it
// already ends in punctuation ("?", "!").
export function HeroTitle({ segments, className = "" }: HeroTitleProps) {
  const last = segments[segments.length - 1]?.text ?? "";
  const endsInWord = /[A-Za-z0-9À-ɏ]\s*$/.test(last);
  return (
    <Text className={`font-inter-extrabold tracking-display ${className}`}>
      {segments.map((segment, i) => (
        <Text key={i}>
          <Text className={segment.color ? heroColorClass[segment.color] : "text-ink-emphasis"}>{segment.text}</Text>
          {segment.breakAfter && "\n"}
        </Text>
      ))}
      {endsInWord && <Text className="text-accent">.</Text>}
    </Text>
  );
}
