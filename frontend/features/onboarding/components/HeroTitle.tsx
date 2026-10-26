import { type ReactNode, useState } from "react";
import { Text, View, type TextLayoutEvent } from "react-native";
import type { HeroSegment } from "../slides";

type TextLayoutLine = TextLayoutEvent["nativeEvent"]["lines"][number];

const heroColorClass = {
  primary: "text-primary",
  accent: "text-accent",
} as const;

type HeroTitleProps = {
  segments: HeroSegment[];
  /** Size/alignment, e.g. "text-hero" or "text-heading text-center". */
  className?: string;
  /** Drawn exactly over the "." (which turns invisible but keeps the
   *  spacing), e.g. a real dot View something can land on: a glyph can't
   *  be measured. `periodSize` is its box. */
  period?: ReactNode;
  periodSize?: number;
};

// An onboarding headline in the app's title style: extrabold, tight display
// tracking, per-segment brand colors, and the orange period, unless it
// already ends in punctuation ("?", "!").
export function HeroTitle({ segments, className = "", period, periodSize = 12 }: HeroTitleProps) {
  const last = segments[segments.length - 1]?.text ?? "";
  const endsInWord = /[A-Za-z0-9À-ɏ]\s*$/.test(last);
  const overlay = endsInWord && period != null;

  // Where the "." ends up: the last line's end, minus half the glyph's own
  // width; it sits on that line's baseline.
  const [lastLine, setLastLine] = useState<TextLayoutLine | null>(null);
  const [periodWidth, setPeriodWidth] = useState(0);

  return (
    <View>
      <Text
        className={`font-inter-extrabold tracking-display ${className}`}
        onTextLayout={overlay ? (e) => setLastLine(e.nativeEvent.lines[e.nativeEvent.lines.length - 1] ?? null) : undefined}
      >
        {segments.map((segment, i) => (
          <Text key={i}>
            <Text className={segment.color ? heroColorClass[segment.color] : "text-ink-emphasis"}>{segment.text}</Text>
            {segment.breakAfter && "\n"}
          </Text>
        ))}
        {endsInWord && <Text className={overlay ? "text-transparent" : "text-accent"}>.</Text>}
      </Text>

      {overlay && (
        <>
          {/* Measures one "." in the same type. */}
          <Text
            className={`absolute opacity-0 font-inter-extrabold tracking-display ${className}`}
            onLayout={(e) => setPeriodWidth(e.nativeEvent.layout.width)}
          >
            .
          </Text>
          {lastLine && periodWidth > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                left: lastLine.x + lastLine.width - periodWidth / 2 - periodSize / 2,
                top: lastLine.y + lastLine.ascender - periodSize,
                width: periodSize,
                height: periodSize,
              }}
            >
              {period}
            </View>
          )}
        </>
      )}
    </View>
  );
}
