import { useEffect } from "react";
import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { ChevronRight } from "lucide-react-native";
import { Button, DotLabel, SpeakingIcon } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { REEL_HEIGHT, useReelTick } from "./useReelTick";

// Cook mode, read aloud: a small cook mode card. The step's words start
// faint and darken one by one as if read out, then Next step fills green,
// presses itself and the next step comes up, over and over. Reduce motion:
// a finished step with the button full.
const BEAT_MS = 340;
const STEPS = [
  { number: 3, words: "Add the pork and simmer for 40 minutes".split(" ") },
  { number: 4, words: "Drop in the kangkong and serve hot".split(" ") },
];
// After the words: a pause, the fill, the press, the change.
const FILL_BEATS = 5;
const TAIL_BEATS = 3;
const FAINT = 0.28;

// The speaker: the volume icon at the start of each step, the scribbled
// tangle while it's read (SpeakingIcon; cook mode shows the same tangle as
// the bigger VoiceOrb under the step).
function Speaker({ playing }: { playing: boolean }) {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
      <SpeakingIcon speaking={playing} size={16} color={colors.white} />
    </View>
  );
}

function Word({ word, read, last }: { word: string; read: boolean; last: boolean }) {
  const opacity = useSharedValue(read ? 1 : FAINT);
  useEffect(() => {
    opacity.value = withTiming(read ? 1 : FAINT, { duration: 220, easing: Easing.out(Easing.quad) });
  }, [read]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return (
    <Animated.View style={[{ flexDirection: "row" }, style]}>
      <Text className="font-inter-bold text-subheading text-ink-emphasis">{word}</Text>
      {last ? <Text className="font-inter-bold text-subheading text-accent">.</Text> : <Text className="font-inter-bold text-subheading"> </Text>}
    </Animated.View>
  );
}

export function NarrationReel({ active, reduceMotion }: { active: boolean; reduceMotion: boolean }) {
  const tick = useReelTick(active && !reduceMotion, BEAT_MS);
  const beatsPerStep = STEPS[0].words.length + FILL_BEATS + TAIL_BEATS;
  const step = reduceMotion ? STEPS[0] : STEPS[Math.floor(tick / beatsPerStep) % STEPS.length];
  const beat = reduceMotion ? beatsPerStep - 1 : tick % beatsPerStep;
  const readCount = Math.min(beat + 1, step.words.length);
  const fillFrom = step.words.length + 1;
  const pressAt = fillFrom + FILL_BEATS;

  const fill = useSharedValue(reduceMotion ? 1 : 0);
  const press = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) return;
    if (beat === 0) fill.value = 0;
    if (beat === fillFrom) fill.value = withTiming(1, { duration: FILL_BEATS * BEAT_MS, easing: Easing.linear });
    if (beat === pressAt) {
      press.value = withSequence(
        withTiming(0.95, { duration: 110, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 220, easing: Easing.inOut(Easing.quad) }),
      );
    }
  }, [beat, reduceMotion]);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: press.value }] }));

  return (
    <View style={{ height: REEL_HEIGHT }} className="justify-center overflow-hidden rounded-3xl bg-mood-bg px-5">
      <View className="gap-4 rounded-2xl bg-white p-4 shadow-sm">
        <View className="flex-row items-center justify-between">
          <DotLabel>{`Step ${step.number}`}</DotLabel>
          {/* Volume icon at the start of each step, sound bars while it's
              read, the icon again once it's done. */}
          <Speaker playing={!reduceMotion && beat >= 1 && beat <= step.words.length} />
        </View>
        <View className="flex-row flex-wrap" style={{ minHeight: 52 }}>
          {step.words.map((word, i) => (
            <Word key={`${step.number}-${i}`} word={word} read={i < readCount} last={i === step.words.length - 1} />
          ))}
        </View>
        <Animated.View style={pressStyle}>
          <Button
            variant="outline"
            label="Next step"
            icon={<ChevronRight color={colors.primary} size={18} />}
            fillIcon={<ChevronRight color={colors.white} size={18} />}
            iconPosition="right"
            fill={fill}
            accessible={false}
          />
        </Animated.View>
      </View>
    </View>
  );
}
