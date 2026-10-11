import { type RefObject, useCallback, useRef } from "react";
import { View } from "react-native";
import { AppText } from "./AppText";
import { Confetti } from "./Confetti";
import { useDotHandoff } from "./DotHandoff";

export type LandingDot = {
  /** The period: a page intro's dot flies here and lands on it
   *  (see usePageIntro's targetRef). */
  dotRef?: RefObject<View | null>;
  /** false hides the period until the intro's dot has landed. */
  showDot?: boolean;
  /** Bump to burst doodle confetti out of the period (e.g. on landing). */
  burstId?: number;
};

type LandingTitleProps = LandingDot & {
  children: string;
  className?: string;
};

// A page title in the dotted section-title style ("Price Watch.",
// "Browse."), but with a real dot View as its period instead of a "."
// glyph, so a PageIntro has a spot to land on, and the dot can fly between
// screens' titles (see DotHandoff).
export function LandingTitle({ children, dotRef, showDot = true, burstId = 0, className = "" }: LandingTitleProps) {
  const ownRef = useRef<View | null>(null);
  // One View, two refs: the intro's (when there is one) and the handoff's.
  const setRef = useCallback(
    (node: View | null) => {
      ownRef.current = node;
      if (dotRef) dotRef.current = node;
    },
    [dotRef],
  );
  // While the intro is due to land the dot, it doesn't get handed one.
  const handedOff = useDotHandoff(ownRef, () => showDot);

  return (
    <View className={`flex-row items-end ${className}`}>
      <AppText variant="sectionTitle">{children}</AppText>
      <View
        ref={setRef}
        collapsable={false}
        className="mb-1.5 ml-0.5 h-1.5 w-1.5 rounded-full bg-accent"
        style={{ opacity: showDot && !handedOff ? 1 : 0 }}
      >
        <Confetti burstId={burstId} direction="up" />
      </View>
    </View>
  );
}
