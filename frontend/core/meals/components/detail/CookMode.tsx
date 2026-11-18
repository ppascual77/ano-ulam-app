import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { FlatList, Pressable, ScrollView, View, useWindowDimensions, type FlatListInstance, type LayoutChangeEvent, type ViewInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { StatusBar } from "expo-status-bar";
import { canKeepAwake } from "../../nativeFeatures";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInDown,
  SlideOutDown,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { ChevronLeft, ChevronRight, ChevronUp, Hand, Lock, RotateCcw, ShoppingBasket, VolumeX, X } from "lucide-react-native";
import { router } from "expo-router";
import { useIsPro } from "@/frontend/core/pro/store/useProStore";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { useDailyLimit } from "@/frontend/core/pro/dailyLimits";
import { FREE_DAILY_NARRATIONS, GUEST_DAILY_NARRATIONS, dailyLimitFor } from "@/frontend/core/pro/proContent";
import { ProFeatureSheet } from "@/frontend/core/pro/components/ProFeatureSheet";
import { track } from "@/frontend/core/analytics/analytics";
import { getMealNarration } from "@/api/meals";
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useNarration } from "@/frontend/core/preferences/store/useNarrationStore";
import { AppText, BottomSheet, Button, DotLabel, SpeakingIcon, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { capitalize } from "../../utils/dietary";
import { cookIngredientGroups, findMentions, shortMealName, splitStep, type StepSegment } from "../../utils/cookStep";
import type { IngredientType } from "../../mealTypes";

const EASE = Easing.out(Easing.cubic);

function ProgressSegment({ filled }: { filled: boolean }) {
  const fill = useSharedValue(filled ? 1 : 0);
  useEffect(() => {
    fill.value = withTiming(filled ? 1 : 0, { duration: 250, easing: EASE });
  }, [filled]);
  const style = useAnimatedStyle(() => ({ width: `${fill.value * 100}%` }));
  return (
    <View className="h-1 flex-1 overflow-hidden rounded-full bg-ink-emphasis/10">
      <Animated.View style={[{ height: "100%", borderRadius: 999, backgroundColor: colors.primary }, style]} />
    </View>
  );
}

// A step's text with the words that name an ingredient highlighted. Amounts
// live in the All ingredients list, not in the step. Each word is its own
// piece (so a highlight can be drawn and animated behind it); words that run
// together ("garlic,") stay one unit so they wrap together, and the space
// inside a multi-word ingredient ("soy sauce") keeps the highlight going.
type Piece = { text: string; highlighted: boolean };

function toUnits(segments: StepSegment[]): Piece[][] {
  const units: Piece[][] = [[]];
  const add = (piece: Piece) => {
    const unit = units[units.length - 1];
    const prev = unit[unit.length - 1];
    if (prev && prev.highlighted === piece.highlighted) prev.text += piece.text;
    else unit.push({ ...piece });
  };
  for (const segment of segments) {
    const parts = segment.text.split(/(\s+)/);
    parts.forEach((part, k) => {
      if (!part) return;
      if (/^\s+$/.test(part)) {
        // Between two words of the same ingredient: the highlight continues.
        if (segment.keys && k > 0 && k < parts.length - 1) add({ text: " ", highlighted: true });
        else add({ text: " ", highlighted: false });
        units.push([]);
      } else {
        add({ text: part, highlighted: !!segment.keys });
      }
    });
  }
  return units.filter((unit) => unit.length > 0);
}

// Highlights sweep in from the right, all of a step's at once, on a smooth
// ease-in-out bezier (no overshoot); with Reduce motion they fade in.
const HIGHLIGHT_EASING = Easing.bezier(0.65, 0, 0.35, 1);
const HIGHLIGHT_DURATION = 650;
const HIGHLIGHT_DELAY = 150;

function Highlight({ progress, reduceMotion }: { progress: SharedValue<number>; reduceMotion: boolean }) {
  const style = useAnimatedStyle(() =>
    reduceMotion ? { opacity: progress.value } : { transform: [{ scaleX: progress.value }] },
  );
  return (
    // Position and color in style, not className: NativeWind classes don't
    // reach an animated view's style here (theme.ts's tintedBg is for
    // exactly this).
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: "absolute",
          left: 0,
          right: 0,
          top: 2,
          bottom: 2,
          borderRadius: 2,
          backgroundColor: colors.tintedBg,
          transformOrigin: "right",
        },
        style,
      ]}
    />
  );
}

// Read-along: while a step is narrated, its words start faint and darken one
// by one at the voice's pace, as if being read out (`read` is 0 -> 1 over the
// recording; each word darkens as the share of the step's letters before it
// is reached). A rough match to the voice, not word-perfect timing.
const FAINT = 0.28;

function ReadWord({ read, start, end, children }: { read: SharedValue<number>; start: number; end: number; children: React.ReactNode }) {
  const style = useAnimatedStyle(() => {
    const t = Math.min(Math.max((read.value - start) / Math.max(end - start, 0.0001), 0), 1);
    return { opacity: FAINT + (1 - FAINT) * t };
  });
  // Row direction in style: NativeWind classes don't reach an animated view.
  return <Animated.View style={[{ flexDirection: "row" }, style]}>{children}</Animated.View>;
}

// The headline's period: a real "." in orange (the app's dotted-title
// style), the same font and size as the headline, so it sits on the
// baseline like any period at every text size. The loader's dot lands on it.
// How big the glyph's dot is, as a share of the line's font height (ascender
// + descender), for landing the flying dot exactly on it.
const PERIOD_DOT_SHARE = 0.13;

/** Where the headline's period glyph is drawn, in its own box: its dot's
 *  center height and size (from the line's font metrics; React Native
 *  centers the font inside the line height). */
type PeriodGlyph = { centerY: number; size: number };

type TextLine = { y: number; height: number; ascender: number; descender: number };

function periodGlyphOf(line: TextLine): PeriodGlyph {
  const font = line.ascender + line.descender;
  const baseline = line.y + (line.height - font) / 2 + line.ascender;
  const size = font * PERIOD_DOT_SHARE;
  return { centerY: baseline - size / 2, size };
}

/** Whether the headline ends with a period the orange dot can stand in for. */
const endsWithPeriod = (segments: StepSegment[]) => /\.\s*$/.test(segments.map((s) => s.text).join(""));

function StepText({
  segments,
  textClass,
  progress,
  reduceMotion,
  read,
  from,
  total,
  period,
}: {
  segments: StepSegment[];
  textClass: string;
  progress: SharedValue<number>;
  reduceMotion: boolean;
  read: SharedValue<number>;
  /** Where this text starts within the whole step, in letters (the lead
   *  comes first, then the detail). */
  from: number;
  /** The whole step's length in letters. */
  total: number;
  /** The headline: its final "." drawn as the orange dot, shown when
   *  `show` (hidden while the loader's dot is on its way to it). */
  period?: { ref: Ref<ViewInstance>; show: boolean; onGlyph: (glyph: PeriodGlyph) => void };
}) {
  const units = toUnits(segments);
  // The final "." comes off the last word; the dot is drawn after it.
  if (period && units.length > 0) {
    const lastUnit = units[units.length - 1];
    const lastPiece = lastUnit[lastUnit.length - 1];
    lastUnit[lastUnit.length - 1] = { ...lastPiece, text: lastPiece.text.replace(/\.\s*$/, "") };
  }
  let at = from;
  return (
    <View className="mt-4 flex-row flex-wrap" accessible accessibilityLabel={segments.map((s) => s.text).join("")}>
      {units.map((unit, u) => {
        const length = unit.reduce((n, piece) => n + piece.text.length, 0);
        const start = at / total;
        at += length;
        const word = (
          <ReadWord key={u} read={read} start={start} end={at / total}>
            {unit.map((piece, p) =>
              piece.highlighted ? (
                <View key={p}>
                  <Highlight progress={progress} reduceMotion={reduceMotion} />
                  <Text className={`${textClass} text-ink-emphasis`}>{piece.text}</Text>
                </View>
              ) : (
                <Text key={p} className={textClass}>
                  {piece.text}
                </Text>
              ),
            )}
          </ReadWord>
        );
        if (!period || u !== units.length - 1) return word;
        // The last word and its dot wrap together. The dot sits outside the
        // read-along's fade: it's full orange from the moment it lands.
        return (
          <View key={u} style={{ flexDirection: "row" }}>
            {word}
            <View ref={period.ref} collapsable={false} style={{ opacity: period.show ? 1 : 0 }}>
              <Text
                className={`${textClass} text-accent`}
                onTextLayout={(e) => {
                  const line = e.nativeEvent.lines[0];
                  if (line) period.onGlyph(periodGlyphOf(line));
                }}
              >
                .
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

// The loader's dot flying to the headline's period: thrown up and falling
// under gravity (steady sideways speed, a parabola up and down), shrinking
// from its loader size to the period's, then a small squash as it lands (no
// bounce) before the real period takes over.
const FLY_DOT = 7;
// The wave's straighten-and-squeeze takes about 0.4s; if it hasn't handed
// over well after that, the step shows anyway.
const WAVE_HANDOFF_GIVE_UP_MS = 900;
const FLIGHT_MS = 560;
const FLIGHT_ARC = 70;
const LAND_SQUASH_MS = 90;
const LAND_SETTLE_MS = 150;

type Point = { x: number; y: number };

function FlyingDot({ from, to, landSize, onLanded }: { from: Point; to: Point | null; landSize: number; onLanded: () => void }) {
  const t = useSharedValue(0);
  const squash = useSharedValue(0);
  const landedRef = useRef(onLanded);
  landedRef.current = onLanded;
  useEffect(() => {
    if (!to) return;
    t.value = withTiming(1, { duration: FLIGHT_MS, easing: Easing.linear });
    squash.value = withDelay(
      FLIGHT_MS,
      withSequence(withTiming(1, { duration: LAND_SQUASH_MS, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: LAND_SETTLE_MS, easing: Easing.inOut(Easing.quad) })),
    );
    const timer = setTimeout(() => landedRef.current(), FLIGHT_MS + LAND_SQUASH_MS + LAND_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [to]);
  const style = useAnimatedStyle(() => {
    const target = to ?? from;
    const p = t.value;
    const x = from.x + (target.x - from.x) * p;
    // Gravity: a parabola in time, up from the start and down onto the dot.
    const y = from.y + (target.y - from.y) * p - FLIGHT_ARC * 4 * p * (1 - p);
    const scale = 1 + (landSize / FLY_DOT - 1) * p;
    const s = squash.value;
    return {
      transform: [
        { translateX: x - FLY_DOT / 2 },
        // Squashed flat onto the line it landed on, then round again.
        { translateY: y - FLY_DOT / 2 + (FLY_DOT * scale * 0.2 * s) / 2 },
        { scaleX: scale * (1 + 0.3 * s) },
        { scaleY: scale * (1 - 0.3 * s) },
      ],
    };
  }, [from, to, landSize]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: 0, top: 0, width: FLY_DOT, height: FLY_DOT, borderRadius: FLY_DOT / 2, backgroundColor: colors.accent }, style]}
    />
  );
}

type Page = { lead: StepSegment[]; detail: StepSegment[] | null };

const segmentsLength = (segments: StepSegment[] | null) => (segments ?? []).reduce((n, s) => n + s.text.length, 0);

// While a step's recording downloads: the same rolling squiggle as Suggest
// meals' button (Patrick, 2026-11-18: it keeps the app's character; it
// replaced shimmering skeleton bars). Once the voice starts it straightens
// and squeezes into a dot that hops onto the headline's period (FlyingDot);
// with Reduce motion, or no period to land on, it just fades.
function StepWave({
  done,
  onDone,
  dot,
  waveRef,
  onLayout,
}: {
  done: boolean;
  onDone: () => void;
  dot: boolean;
  waveRef: Ref<ViewInstance>;
  onLayout: (e: LayoutChangeEvent) => void;
}) {
  return (
    <View ref={waveRef} collapsable={false} onLayout={onLayout} accessible accessibilityLabel="Loading this step" className="mt-8" style={{ width: "85%" }}>
      <Spinner variant="wave" size={14} color={colors.accent} done={done} outro={dot ? "dot" : "fade"} dotSize={FLY_DOT} onDone={onDone} />
    </View>
  );
}


function StepPage({
  page,
  number,
  active,
  width,
  reduceMotion,
  read,
  loading,
}: {
  page: Page;
  number: number;
  active: boolean;
  width: number;
  reduceMotion: boolean;
  /** The read-along's progress for this page (see ReadWord). */
  read: SharedValue<number>;
  /** Its recording is still downloading: the skeleton shows. */
  loading: boolean;
}) {
  const leadLength = segmentsLength(page.lead);
  const total = Math.max(leadLength + segmentsLength(page.detail), 1);
  const hasPeriod = endsWithPeriod(page.lead);
  const flies = hasPeriod && !reduceMotion;
  // "loading": the wave rolls (and, once loading ends, straightens and
  // squeezes into a dot). "flight": the text is in and the dot hops onto the
  // headline's period. "shown": done. The wave outlives `loading`, so this
  // is set during render (like Button's wave, there on loading's first
  // frame).
  const [phase, setPhase] = useState<"loading" | "flight" | "shown">(loading ? "loading" : "shown");
  if (loading && phase !== "loading") setPhase("loading");
  const rootRef = useRef<ViewInstance>(null);
  const waveRef = useRef<ViewInstance>(null);
  const periodRef = useRef<ViewInstance>(null);
  const [flight, setFlight] = useState<{ from: Point; to: Point | null; size: number } | null>(null);
  const skipFlight = () => {
    setFlight(null);
    setPhase("shown");
  };
  // Where the wave sits within this page's content, from its own layout
  // (it's a direct child of the root): the squeezed dot is at its middle.
  const waveCenter = useRef<Point | null>(null);
  // The wave has become a dot: it takes off from there (held in place until
  // the period below has been laid out and measured). Without a known spot
  // the text just shows.
  const onWaveDone = () => {
    if (phase !== "loading") return;
    if (!flies || !waveCenter.current) return skipFlight();
    setFlight({ from: waveCenter.current, to: null, size: FLY_DOT });
    setPhase("flight");
  };
  // Safety net: the reading has started but the wave never handed over
  // (its outro didn't report back): show the step anyway.
  useEffect(() => {
    if (loading || phase !== "loading") return;
    const timer = setTimeout(onWaveDone, WAVE_HANDOFF_GIVE_UP_MS);
    return () => clearTimeout(timer);
  }, [loading, phase]);
  // Never left hanging: no period measured soon after take-off, the dot
  // just goes and the period shows.
  useEffect(() => {
    if (phase !== "flight" || flight?.to) return;
    const timer = setTimeout(skipFlight, 600);
    return () => clearTimeout(timer);
  }, [phase, flight?.to]);
  // The period glyph has been laid out: aim for its dot (its box's middle
  // across, the glyph's own height down), landing at the glyph's size.
  const onPeriodGlyph = (glyph: PeriodGlyph) => {
    if (phase !== "flight" || !flight || flight.to) return;
    const root = rootRef.current;
    const node = periodRef.current;
    if (!root || !node) return skipFlight();
    root.measureInWindow((rx, ry) =>
      node.measureInWindow((x, y, w) => setFlight((f) => (f ? { ...f, to: { x: x - rx + w / 2, y: y - ry + glyph.centerY }, size: glyph.size } : f))),
    );
  };
  // 0 -> 1 each time this step comes into view; back to 0 once it's left.
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = active
      ? withDelay(HIGHLIGHT_DELAY, withTiming(1, { duration: reduceMotion ? 250 : HIGHLIGHT_DURATION, easing: HIGHLIGHT_EASING }))
      : 0;
  }, [active, reduceMotion]);
  return (
    // Sits high rather than centered, so a short step doesn't float in empty
    // space; scrolls if a long one at the largest text size runs past the
    // footer.
    <ScrollView style={{ width }} contentContainerClassName="px-7 pb-8 pt-10" showsVerticalScrollIndicator={false}>
      <View ref={rootRef} collapsable={false}>
        <DotLabel>{`Step ${number}`}</DotLabel>
        {phase === "loading" ? (
          <StepWave
          done={!loading}
          onDone={onWaveDone}
          dot={flies}
          waveRef={waveRef}
          onLayout={(e) => {
            const { x, y, width, height } = e.nativeEvent.layout;
            waveCenter.current = { x: x + width / 2, y: y + height / 2 };
          }}
        />
        ) : (
          // The first sentence as the headline, read from arm's length; the
          // rest a size down. Fades in as the loader's dot takes off.
          <Animated.View key="text" entering={active ? FadeIn.duration(200) : undefined}>
            <StepText
              segments={page.lead}
              textClass="font-inter-bold text-heading leading-8 text-ink-emphasis"
              progress={progress}
              reduceMotion={reduceMotion}
              read={read}
              from={0}
              total={total}
              period={hasPeriod ? { ref: periodRef, show: phase === "shown", onGlyph: onPeriodGlyph } : undefined}
            />
            {page.detail && (
              <StepText
                segments={page.detail}
                textClass="font-inter-regular text-subheading leading-7 text-ink"
                progress={progress}
                reduceMotion={reduceMotion}
                read={read}
                from={leadLength}
                total={total}
              />
            )}
          </Animated.View>
        )}
        {phase === "flight" && flight && (
          <FlyingDot
            from={flight.from}
            to={flight.to}
            landSize={flight.size}
            onLanded={() => {
              setFlight(null);
              setPhase("shown");
            }}
          />
        )}
      </View>
    </ScrollView>
  );
}

type CookModeProps = {
  mealName: string;
  steps: string[];
  /** Each step read aloud, in step order (narrate-meal). The speaker button
   *  shows only when every step has one. */
  stepAudio?: string[] | null;
  /** Already scaled to `servings` (see scaleIngredient). */
  ingredients: IngredientType[];
  servings: number;
  /** For the daily narration limit: the same meal again that day is free. */
  mealId?: string;
  /** Unlock Pro from the narration limit sheet: cook mode closes first,
   *  then this opens the Pro page (meal details' own, see onLockedPro). */
  onOpenPro?: () => void;
  onClose: () => void;
};

// "Start cooking" from meal details: one step at a time, large enough to
// read from the counter, swipe or tap Next to move on. The screen stays
// awake while it's open. Rendered over the meal page (inside the same
// sheet), so the meal is right where it was on close.
const KEEP_AWAKE_TAG = "cook-mode";
// Cook mode's entrance: a slide up, or a fade with Reduce motion.
const ENTER_SLIDE_MS = 320;
const ENTER_FADE_MS = 200;
// Hands-free: Next step fills up over this long after a step's reading,
// then holds full this long before moving on.
const AUTO_NEXT_FILL_MS = 5000;
const AUTO_NEXT_HOLD_MS = 1000;
// A step's recording still not playing after this long: show the text
// anyway instead of the skeleton.
const LOADING_GIVE_UP_MS = 2500;
// Once it's full, the button presses itself: down to this size and back.
const PRESS_SCALE = 0.95;
const PRESS_DOWN_MS = 110;
const PRESS_UP_MS = 220;

// Narration: with the speaker on, each step is read aloud as it comes into
// view (and the current one at once when it's turned on). Moving to another
// step stops the one playing; closing cook mode stops it too. It plays with
// the phone on silent (someone turned it on, so they want to hear it) and
// lowers any music rather than stopping it.
// While a step plays, `read` runs 0 -> 1 at the recording's pace (the
// read-along, see ReadWord); `finished` turns true once the current step's
// reading has ended, for the Replay / Next step split and moving on by
// itself. With the speaker off, `read` sits at 1 (plain text).
// `ready`: cook mode has finished opening; the first step isn't read during
// the slide-up. `allowed`: today's narrated meal is this one, or Pro (see
// CookMode's daily limit).
function useStepNarration(urls: string[] | null, index: number, ready: boolean, allowed: boolean) {
  const { on } = useNarration();
  const player = useAudioPlayer(null);
  const status = useAudioPlayerStatus(player);
  const active = on && !!urls && allowed;
  const read = useSharedValue(active ? 0 : 1);
  const [finishedAt, setFinishedAt] = useState<number | null>(null);
  // The step whose recording has started playing: until then it's still
  // downloading (the skeleton shows), and the end of the previous one can't
  // count as this one finishing.
  const [startedAt, setStartedAt] = useState<number | null>(null);
  // Taking too long (slow connection): show the step anyway, the voice
  // catches up when it can.
  const [stalledAt, setStalledAt] = useState<number | null>(null);
  const indexRef = useRef(index);
  indexRef.current = index;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers", shouldPlayInBackground: false }).catch(() => {});
    return () => {
      // Back to the app's usual: UI sounds follow the silent switch.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers", shouldPlayInBackground: false }).catch(() => {});
    };
  }, [active]);

  useEffect(() => {
    setFinishedAt(null);
    startedRef.current = false;
    cancelAnimation(read);
    if (!active) {
      player.pause();
      read.value = 1;
      return;
    }
    const url = urls![index];
    if (!url) {
      read.value = 1;
      return;
    }
    read.value = 0;
    if (!ready) return;
    player.replace({ uri: url });
    player.play();
    const stall = setTimeout(() => setStalledAt(index), LOADING_GIVE_UP_MS);
    return () => clearTimeout(stall);
  }, [active, index, ready]);

  // The words darken over what's left of the recording while it plays, and
  // hold where they are if it stalls (loading, an interruption).
  useEffect(() => {
    if (!active) return;
    // The voice counts as started the moment it plays, whether or not the
    // recording's length is known yet (a streamed MP3 can report it late,
    // which kept the loader up while the voice was already talking).
    if (status.playing) {
      startedRef.current = true;
      setStartedAt(indexRef.current);
    }
    if (status.playing && status.duration > 0) {
      const left = Math.max(status.duration - status.currentTime, 0);
      read.value = withTiming(1, { duration: left * 1000, easing: Easing.linear });
    } else {
      cancelAnimation(read);
    }
  }, [active, status.playing, status.duration]);

  // The reading ended: everything is dark, and the step counts as heard.
  const ended = status.didJustFinish || (!status.playing && status.duration > 0 && status.currentTime >= status.duration - 0.15);
  useEffect(() => {
    if (!active || !ended || !startedRef.current) return;
    cancelAnimation(read);
    read.value = withTiming(1, { duration: 150 });
    setFinishedAt(indexRef.current);
  }, [active, ended]);

  const replay = () => {
    if (!active) return;
    setFinishedAt(null);
    startedRef.current = false;
    cancelAnimation(read);
    read.value = 0;
    void player.seekTo(0).then(() => player.play());
  };

  return {
    available: !!urls,
    on: active,
    // The voice is actually going (for the speaker's sound bars).
    speaking: active && status.playing,
    read,
    finished: active && finishedAt === index,
    // Downloading this step's recording (the skeleton shows instead of
    // the text), unless it's taking too long.
    loading: active && !!urls?.[index] && startedAt !== index && finishedAt !== index && stalledAt !== index,
    replay,
  };
}

export type CookModeHandle = { open: () => void };

/** Cook mode with its own open/closed state, opened through `ref.open()`:
 *  tapping Start cooking re-renders only this, not the whole meal page it
 *  sits in (that re-render held the slide-up back). */
export function CookModeHost({ ref, ...props }: Omit<CookModeProps, "onClose"> & { ref: Ref<CookModeHandle> }) {
  const [open, setOpen] = useState(false);
  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }), []);
  // A meal opened from an older snapshot (a saved meal from before
  // narration) has no audio: use the meal's current narration, but only if
  // it was made for these same steps.
  const [liveAudio, setLiveAudio] = useState<string[] | null>(null);
  const needsLookup = open && !props.stepAudio?.length && !!props.mealId;
  useEffect(() => {
    if (!needsLookup) return;
    let cancelled = false;
    getMealNarration(props.mealId!)
      .then((live) => {
        if (cancelled || !live?.procedure_audio) return;
        const same = JSON.stringify(live.procedure.map((s) => s.trim())) === JSON.stringify(props.steps.map((s) => s.trim()));
        if (same) setLiveAudio(live.procedure_audio);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [needsLookup, props.mealId]);
  if (!open) return null;
  return <CookMode {...props} stepAudio={props.stepAudio?.length ? props.stepAudio : liveAudio} onClose={() => setOpen(false)} />;
}

export function CookMode({ mealName, steps, stepAudio, ingredients, servings, mealId, onOpenPro, onClose }: CookModeProps) {
  // The screen stays on while cooking. Loaded lazily: expo-keep-awake throws
  // on import in a build without it (see nativeFeatures.ts).
  useEffect(() => {
    if (!canKeepAwake) return;
    const KeepAwake = require("expo-keep-awake") as typeof import("expo-keep-awake");
    void KeepAwake.activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => void KeepAwake.deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
  }, []);
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  // Opens at once with skeleton bars; the steps' real text (an animated
  // view per word, for the read-along) is built once the slide-up is over,
  // so it never holds the slide back.
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), reduceMotion ? ENTER_FADE_MS : ENTER_SLIDE_MS);
    return () => clearTimeout(timer);
  }, []);
  const [listOpen, setListOpen] = useState(false);
  const list = useRef<FlatListInstance>(null);
  const last = index === steps.length - 1;
  const urls = stepAudio && stepAudio.length === steps.length ? stepAudio : null;

  // Narration is Pro, with a daily taste: free accounts and guests get 1
  // narrated meal a day (the same meal again that day is free), counted the
  // moment it would start reading (the speaker setting already on, or
  // tapped on). After that, cook mode still opens and the steps read as
  // plain text; a "Read aloud · PRO" chip takes the speaker's place and
  // opens the narration feature sheet.
  const isPro = useIsPro();
  const { isSignedIn } = useAuth();
  const daily = useDailyLimit("narration", dailyLimitFor({ isPro, isGuest: !isSignedIn }, GUEST_DAILY_NARRATIONS, FREE_DAILY_NARRATIONS));
  const { on: narrateSetting, setOn: setNarrateSetting } = useNarration();
  // null: not asked yet for this meal.
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  useEffect(() => {
    if (limitOpen) track("limit_sheet_shown", { kind: "narration" });
  }, [limitOpen]);
  const askAllowance = async () => {
    const ok = await daily.use(mealId ?? mealName);
    setAllowed(ok);
    return ok;
  };
  useEffect(() => {
    if (!urls || !narrateSetting || allowed !== null) return;
    void askAllowance();
  }, [narrateSetting, !!urls]);
  // Asking (only a moment): the loader shows instead of plain text.
  const checkingAllowance = !!urls && narrateSetting && allowed === null;
  const narrationLocked = !!urls && allowed === false;
  const narration = useStepNarration(urls, index, ready, allowed === true);
  const toggleNarration = () => {
    void Haptics.selectionAsync();
    if (narrationLocked) return setLimitOpen(true);
    if (narrateSetting) return setNarrateSetting(false);
    if (allowed) return setNarrateSetting(true);
    void askAllowance().then((ok) => (ok ? setNarrateSetting(true) : setLimitOpen(true)));
  };
  // The pages not on screen: faint while narrating (they'll be read when
  // reached), plain otherwise.
  const unread = useSharedValue(0);
  const plain = useSharedValue(1);

  // Hands-free: once a step's reading ends, Next step fills up over 5
  // seconds, holds a second, then moves on by itself. On every time cook
  // mode opens; switching it off lasts only until it's closed.
  const [handsFree, setHandsFree] = useState(true);
  const toggleHandsFree = () => {
    void Haptics.selectionAsync();
    setHandsFree((v) => !v);
  };
  const autoFill = useSharedValue(0);
  // Once full: the button presses itself, dipping a little and coming back
  // like a finger tapped it (with a light tap), saying "here we go". Eased,
  // no bounce; just the tap with Reduce motion.
  const nudge = useSharedValue(1);
  const countingDown = narration.finished && handsFree && !last;
  useEffect(() => {
    cancelAnimation(autoFill);
    cancelAnimation(nudge);
    autoFill.value = 0;
    nudge.value = 1;
    if (!countingDown) return;
    autoFill.value = withTiming(1, { duration: AUTO_NEXT_FILL_MS, easing: Easing.linear });
    const full = setTimeout(() => {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (reduceMotion) return;
      nudge.value = withSequence(
        withTiming(PRESS_SCALE, { duration: PRESS_DOWN_MS, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: PRESS_UP_MS, easing: Easing.inOut(Easing.quad) }),
      );
    }, AUTO_NEXT_FILL_MS);
    const advance = setTimeout(() => goTo(index + 1), AUTO_NEXT_FILL_MS + AUTO_NEXT_HOLD_MS);
    return () => {
      clearTimeout(full);
      clearTimeout(advance);
    };
  }, [countingDown, index]);
  const nudgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: nudge.value }] }));
  const replay = () => {
    void Haptics.selectionAsync();
    narration.replay();
  };

  // Each step split into its headline and the rest, with the ingredient
  // words found once up front.
  const { groups, pages } = useMemo(() => {
    const { groups, terms } = cookIngredientGroups(ingredients);
    const qtyByKey = new Map(groups.flatMap((g) => g.items.map((it) => [it.key, it.qty] as const)));
    const pages = steps.map((step) => {
      const { lead, detail } = splitStep(step);
      const { parts, mentioned } = findMentions(detail ? [lead, detail] : [lead], terms, qtyByKey);
      return { lead: parts[0], detail: parts[1] ?? null, mentioned };
    });
    return { groups, pages };
  }, [steps, ingredients]);
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);
  const mentioned = pages[index]?.mentioned ?? new Set<string>();

  // A light tick each time the step changes (swipe or button).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void Haptics.selectionAsync();
  }, [index]);

  // The countdown's fill and nudge clear the moment the step changes, not
  // in an effect after the next step has drawn (that left a flash of full
  // green on it).
  const changeStep = (target: number) => {
    if (target === index) return;
    cancelAnimation(autoFill);
    cancelAnimation(nudge);
    autoFill.value = 0;
    nudge.value = 1;
    setIndex(target);
  };

  const goTo = (i: number) => {
    const target = Math.max(0, Math.min(steps.length - 1, i));
    list.current?.scrollToIndex({ index: target, animated: !reduceMotion });
    changeStep(target);
  };

  const openList = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setListOpen(true);
  };

  return (
    <Animated.View
      entering={reduceMotion ? FadeIn.duration(ENTER_FADE_MS) : SlideInDown.duration(ENTER_SLIDE_MS).easing(EASE)}
      exiting={reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(260).easing(EASE)}
      className="absolute inset-0 bg-white"
      style={{ paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }}
    >
      <StatusBar style="dark" />
      <View className="flex-row items-center gap-3 px-5">
        <Pressable
          onPress={onClose}
          hitSlop={10}
          accessibilityLabel="Close cook mode"
          className="h-10 w-10 items-center justify-center rounded-full bg-ink-emphasis/5"
        >
          <X color={colors.ink.emphasis} size={20} />
        </Pressable>
        <View className="flex-1">
          <Text numberOfLines={1} className="font-inter-semibold text-body text-ink-emphasis">
            {shortMealName(mealName)}
          </Text>
          <Text className="font-inter-regular text-small text-ink-subtle">
            Step {index + 1} of {steps.length}
          </Text>
        </View>
        {narration.on && (
          <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(150)}>
            <Pressable
              onPress={toggleHandsFree}
              hitSlop={6}
              accessibilityRole="switch"
              accessibilityState={{ checked: handsFree }}
              accessibilityLabel="Hands-free: go to the next step on its own after each one is read"
              className={`h-10 flex-row items-center gap-1.5 rounded-full border px-3 ${
                handsFree ? "border-primary bg-primary/10" : "border-ink-emphasis/10 bg-white"
              }`}
            >
              <Hand color={handsFree ? colors.primary : colors.ink.subtle} size={16} />
              <Text className={`font-inter-semibold text-small ${handsFree ? "text-primary" : "text-ink-subtle"}`}>Hands-free</Text>
            </Pressable>
          </Animated.View>
        )}
        {narrationLocked && (
          // Today's free narrated meal is used: a "Read aloud" chip with the
          // Pro lock, opening the narration feature sheet.
          <Animated.View entering={FadeIn.duration(200)}>
            <Pressable
              onPress={toggleNarration}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Read aloud, a Pro feature. Today's free narrated meal is used."
              className="h-10 flex-row items-center gap-2 rounded-full border border-ink-emphasis/10 bg-white pl-3 pr-1.5 active:bg-ink-emphasis/5"
            >
              <VolumeX color={colors.ink.subtle} size={16} />
              <Text className="font-inter-semibold text-small text-ink-emphasis">Read aloud</Text>
              <View className="h-6 flex-row items-center gap-1 rounded-full bg-accent px-2">
                <Lock color={colors.white} size={10} strokeWidth={2.75} />
                <Text className="font-inter-bold text-sub text-white">PRO</Text>
              </View>
            </Pressable>
          </Animated.View>
        )}
        {narration.available && !narrationLocked && (
          <Pressable
            onPress={toggleNarration}
            hitSlop={10}
            accessibilityRole="switch"
            accessibilityState={{ checked: narration.on }}
            accessibilityLabel="Read steps aloud"
            className={`h-10 w-10 items-center justify-center rounded-full ${narration.on ? "bg-primary" : "bg-ink-emphasis/5"}`}
          >
            {/* On: the volume icon, morphing into sound bars while a step
                is being spoken (the same as the Pro feature reel). */}
            {narration.on ? (
              <SpeakingIcon speaking={narration.speaking && !reduceMotion} size={20} color={colors.white} />
            ) : (
              <VolumeX color={colors.ink.emphasis} size={20} />
            )}
          </Pressable>
        )}
      </View>
      <View className="mt-4 flex-row gap-1.5 px-5">
        {steps.map((_, i) => (
          <ProgressSegment key={i} filled={i <= index} />
        ))}
      </View>

      <FlatList
        ref={list}
        data={pages}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => changeStep(Math.round(e.nativeEvent.contentOffset.x / width))}
        className="flex-1"
        extraData={`${index}:${narration.on}:${narration.loading}:${ready}:${checkingAllowance}`}
        // Only the step on screen and its neighbours are built.
        initialNumToRender={1}
        maxToRenderPerBatch={1}
        windowSize={3}
        renderItem={({ item, index: i }) => (
          <StepPage
            page={item}
            number={i + 1}
            active={i === index}
            width={width}
            reduceMotion={reduceMotion}
            read={i === index ? narration.read : narration.on ? unread : plain}
            loading={!ready || (i === index && (narration.loading || checkingAllowance))}
          />
        )}
      />

      <View className="gap-3 px-5 pt-2">
        {itemCount > 0 && (
          <Pressable
            onPress={openList}
            accessibilityRole="button"
            accessibilityLabel={`All ingredients, ${itemCount} items`}
            className="flex-row items-center gap-3 rounded-2xl border border-primary/10 bg-white px-3.5 py-3 active:bg-primary/5"
          >
            <View className="h-9 w-9 items-center justify-center rounded-xl bg-tinted-bg">
              <ShoppingBasket color={colors.primary} size={18} />
            </View>
            <View className="flex-1">
              <Text className="font-inter-semibold text-body text-ink-emphasis">All ingredients</Text>
              <Text className="font-inter-regular text-small text-ink-subtle">
                {itemCount} items · for {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
            </View>
            <ChevronUp color={colors.ink.subtle} size={18} />
          </Pressable>
        )}
        <View className="flex-row items-center gap-3">
          <Button
            variant="muted"
            shape="circle"
            icon={<ChevronLeft color={colors.ink.emphasis} size={22} />}
            accessibilityLabel="Previous step"
            onPress={() => goTo(index - 1)}
            disabled={index === 0}
          />
          {/* Once a narrated step's reading ends, the button splits: Replay
              slides in beside a narrower Next step (filling up when
              hands-free). Eased, no bounce. */}
          {narration.finished && (
            <Animated.View
              entering={reduceMotion ? FadeIn.duration(150) : FadeIn.duration(260).easing(EASE)}
              exiting={FadeOut.duration(150)}
              layout={reduceMotion ? undefined : LinearTransition.duration(280).easing(EASE)}
            >
              <Button
                variant="muted"
                label="Replay"
                icon={<RotateCcw color={colors.ink.emphasis} size={16} />}
                accessibilityLabel="Read this step again"
                onPress={replay}
              />
            </Animated.View>
          )}
          <Animated.View className="flex-1" layout={reduceMotion ? undefined : LinearTransition.duration(280).easing(EASE)}>
            {last ? (
              <Button label="Done" variant={narration.on && !narration.finished ? "outline" : "primary"} onPress={onClose} />
            ) : narration.on ? (
              // Narrating: a bordered Next step, so the reading leads; it
              // fills up once the reading ends (hands-free).
              <Animated.View style={nudgeStyle}>
                <Button
                  variant="outline"
                  label="Next step"
                  icon={<ChevronRight color={colors.primary} size={18} />}
                  fillIcon={<ChevronRight color={colors.white} size={18} />}
                  iconPosition="right"
                  fill={autoFill}
                  accessibilityHint={countingDown ? "Moves on by itself in a few seconds" : undefined}
                  onPress={() => goTo(index + 1)}
                />
              </Animated.View>
            ) : (
              <Button
                label="Next step"
                icon={<ChevronRight color={colors.white} size={18} />}
                iconPosition="right"
                onPress={() => goTo(index + 1)}
              />
            )}
          </Animated.View>
        </View>
      </View>

      {/* The full list in recipe order, nothing moved or filtered out.
          Lines the step's text names share its highlight; that says what
          the text names, not everything the step needs. */}
      {/* Out of today's free narration: the narration feature sheet (the
          same reel as Settings > Pro features); Get Pro closes cook mode and
          opens the Pro page. */}
      <ProFeatureSheet
        feature={limitOpen ? "narration" : null}
        presentation="inline"
        onClose={() => setLimitOpen(false)}
        onOpenPro={(copy) => {
          onClose();
          if (onOpenPro) onOpenPro();
          else router.push({ pathname: "/pro", params: copy ? { ...copy, source: "feature" } : { source: "feature" } });
        }}
      />

      <BottomSheet visible={listOpen} onClose={() => setListOpen(false)} presentation="inline" fitContent heightPercent={0.8}>
        <View className="px-6 pb-4 pt-10">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <AppText variant="sectionTitle" dot>
                Ingredients
              </AppText>
              <Text className="mt-0.5 font-inter-regular text-body text-ink-subtle">
                For {servings} {servings === 1 ? "serving" : "servings"}
              </Text>
            </View>
            <Pressable
              onPress={() => setListOpen(false)}
              hitSlop={10}
              accessibilityLabel="Close ingredients"
              className="h-9 w-9 items-center justify-center rounded-full bg-ink-emphasis/5"
            >
              <X color={colors.ink.emphasis} size={16} />
            </Pressable>
          </View>
          {mentioned.size > 0 && (
            <View className="mt-3 flex-row items-center gap-2">
              <View className="h-2 w-3.5 rounded-sm bg-tinted-bg" />
              <Text className="font-inter-regular text-small text-ink-subtle">Highlighted: named in step {index + 1}'s text</Text>
            </View>
          )}
          <View className="mt-2">
            {groups.map((group, gi) => (
              <View key={gi}>
                {group.section && (
                  <Text className="mb-1 mt-4 px-3 font-inter-semibold text-body text-ink-subtle">{group.section}</Text>
                )}
                {group.items.map((item) => {
                  const named = mentioned.has(item.key);
                  return (
                    // Named in the step: the name and amount carry the step
                    // text's highlight (nested Text, so it sits behind the
                    // words only).
                    <View key={item.key} className="flex-row items-center justify-between gap-4 px-3 py-3">
                      <Text className="flex-1 font-inter-medium text-body-lg text-ink-emphasis">
                        <Text className={named ? "bg-tinted-bg" : ""}>{capitalize(item.name)}</Text>
                      </Text>
                      <Text className="text-body">
                        <Text className={named ? "bg-tinted-bg font-inter-semibold text-ink-emphasis" : "font-inter-regular text-ink-subtle"}>
                          {item.qty}
                        </Text>
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      </BottomSheet>
    </Animated.View>
  );
}
