import { useEffect, useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { Check, Database, ShoppingCart } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { useCountTo } from "@/frontend/core/prices/hooks/useCountTo";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";

// "Where our numbers come from": Look up, lock, add up. Staged like a reel,
// one focal point at a time, always centered.
//
//   0.0s   "Pork belly" types in, big and centered; its orange period lands
//   0.9s   it rises; USDA and FNRI chips appear under it
//   1.3s   a scan line sweeps across the chips, lighting each as it passes
//   2.0s   USDA locks (✓, green), FNRI dims; "380 kcal / 100 g" rolls in
//   3.0s   that result tucks into a tag under the word
//   3.3s   two price rows slide in, digits rolling: Dept. of Agriculture
//          ₱366/kg, Landers ₱419/kg
//   4.0s   a scan line sweeps down the rows; the cheapest locks in orange,
//          the other dims; "₱366 / kg" tucks into a second tag
//   5.2s   word and tags snap into one tidy card: one ingredient, done
//   6.5s   the card gives way to the dish: Pork Adobo's ingredients drop in
//          as checked lines, like a receipt filling up
//   7.7s   each line turns into a dot (its text fades, its check becomes
//          the dot), the dots move out into a ring and circle around
//   9.0s   the ring pulls in and merges into one green dot
//   9.6s   "Every ulam, backed by real data." comes in, and the dot flies
//          up to land as its period, turning orange
//   11.8s  crossfades to the summary (holds)
//
// Real numbers: "Pork belly, raw" (USDA, 380.45 kcal/100 g); the DA's Oct
// 10 2026 Liempo (Local) price (₱365.94/kg) and the Landers listing
// (₱419/kg), the only two prices it has. Re-check if those rows change.
// One clock (t, ms) drives it; counters run on the same start. Plays once
// per mount. Under reduce motion nothing moves or scales: no typing, no
// scan lines, no flight; parts fade in at their beats and locks just change
// color.

const STAGE_HEIGHT = 360;
const MAP_MS = 11800;
const MAP_EXIT_MS = 400;

const WORD = "Pork belly";
const TYPE_MS = 55;
const WORD_UP_AT = 900;
const WORD_UP_MS = 450;
const NUTRI_AT = 1000;
const NUTRI_SCAN_AT = 1300;
const NUTRI_SCAN_MS = 600;
const NUTRI_LOCK_AT = 2000;
const KCAL_AT = 2100;
const KCAL_MS = 700;
const NUTRI_TUCK_AT = 3000;
const PRICE_AT = 3300;
const PRICE_ROW_STAGGER = 120;
const PRICE_ROLL_MS = 700;
const PRICE_SCAN_AT = 4000;
const PRICE_SCAN_MS = 500;
const PRICE_LOCK_AT = 4600;
const PRICE_TUCK_AT = 4900;
const CARD_AT = 5200;
const DISH_AT = 6500;
const DISH_ROW_STAGGER = 110;
const DISH_DOTS_AT = 7700;
const DISH_DOTS_STAGGER = 40;
const RING_AT = 7900;
const RING_MOVE_MS = 650;
const COMBINE_AT = 9000;
const COMBINE_MS = 420;
const LINE_AT = 9600;
const FLIGHT_AT = 9800;
const FLIGHT_MS = 520;

// Where things sit (y, in the stage).
const WORD_START_Y = 150;
const WORD_Y = 52;
const CHIPS_Y = 132;
const RESULT_Y = 196;
const TAGS_Y = 98;
const PRICE_ROWS_Y = [150, 196];
const PRICE_ROW_W = 250;
const DISH_TOP = 34;
const DISH_ROW_H = 24;
const DOT_AT_Y = 150;
// The ring the ingredient dots circle in, around (center, DOT_AT_Y).
const RING_R = 58;
const RING_SPIN = 1;
const DISH_DOT = 12;
// The row's check circle (h-4 w-4), whose center a dot starts from.
const ROW_LEFT = 95;
const CHECK = 16;
const LINE_TOP = 238;

const DOT = 16;
const PERIOD = 7;

const DISH = ["Pork belly", "Garlic", "Bay leaf", "Vinegar", "Soy sauce", "Peppercorn", "Water", "Salt"];

const easeOut = Easing.out(Easing.cubic);
const easeIn = Easing.in(Easing.cubic);
const easeInOut = Easing.inOut(Easing.cubic);

function progress(t: number, at: number, ms: number) {
  "worklet";
  return Math.min(1, Math.max(0, (t - at) / ms));
}

type Beat = { t: SharedValue<number>; reduce: boolean };

// Shown from `at` (rising in), hidden from `until` (fading out), if given.
function useShown({ t, reduce }: Beat, at: number, until?: number, rise = 10) {
  return useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, at, 380));
    const out = until == null ? 0 : easeIn(progress(t.value, until, 300));
    return { opacity: p * (1 - out), transform: [{ translateY: reduce ? 0 : (1 - p) * rise }] };
  });
}

// ---- pieces ---------------------------------------------------------------------

// A source being checked: lights up as the scan passes, then either locks
// (✓, solid) or dims.
function SourceChip({ t, reduce, label, scanAt, lockAt, wins, hideAt }: Beat & { label: string; scanAt: number; lockAt: number; wins: boolean; hideAt: number }) {
  const lit = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * progress(t.value, scanAt, 300)) }));
  const lock = useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, lockAt, 300));
    if (wins) return { opacity: 1, transform: [{ scale: reduce ? 1 : 1 + 0.08 * Math.sin(Math.PI * p) }] };
    return { opacity: 1 - 0.65 * p, transform: [{ scale: 1 }] };
  });
  const solid = useAnimatedStyle(() => ({ opacity: wins ? easeOut(progress(t.value, lockAt, 250)) : 0 }));
  const shown = useShown({ t, reduce }, NUTRI_AT + (label === "USDA" ? 0 : 80), hideAt);
  return (
    <Animated.View style={shown}>
      <Animated.View style={lock} className="flex-row items-center gap-1.5 rounded-xl border border-ink-emphasis/15 bg-white px-3 py-2">
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -1, bottom: -1, left: -1, right: -1, borderRadius: 12, backgroundColor: `${colors.primary}14`, borderWidth: 1.5, borderColor: colors.primary }, lit]} />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -1, bottom: -1, left: -1, right: -1, borderRadius: 12, backgroundColor: `${colors.primary}1A`, borderWidth: 1.5, borderColor: colors.primary }, solid]} />
        {wins ? <LockIcon t={t} at={lockAt} color={colors.primary} Icon={Database} /> : <Database color={colors.ink.subtle} size={14} />}
        <Text className="font-inter-semibold text-body text-ink-emphasis">{label}</Text>
      </Animated.View>
    </Animated.View>
  );
}

// The source's icon, swapped for a ✓ when it locks.
function LockIcon({ t, at, color, Icon }: { t: SharedValue<number>; at: number; color: string; Icon: typeof Database }) {
  const before = useAnimatedStyle(() => ({ opacity: 1 - progress(t.value, at, 150) }));
  const after = useAnimatedStyle(() => ({ opacity: progress(t.value, at, 150) }));
  return (
    <View style={{ width: 14, height: 14 }}>
      <Animated.View style={[{ position: "absolute" }, before]}>
        <Icon color={colors.ink.subtle} size={14} />
      </Animated.View>
      <Animated.View style={[{ position: "absolute" }, after]}>
        <Check color={color} size={14} strokeWidth={3} />
      </Animated.View>
    </View>
  );
}

// A store's price per kg, digits rolling in, then checked by the scan and
// locked (cheapest) or dimmed.
function PriceRow({ t, reduce, store, perKg, at, scanAt, wins, hideAt, y }: Beat & { store: string; perKg: number; at: number; scanAt: number; wins: boolean; hideAt: number; y: number }) {
  const shown = useShown({ t, reduce }, at, hideAt, 14);
  const price = useCountTo(perKg * 0.6, perKg, at + 80, PRICE_ROLL_MS);
  const lit = useAnimatedStyle(() => ({ opacity: Math.sin(Math.PI * progress(t.value, scanAt, 280)) }));
  const lock = useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, PRICE_LOCK_AT, 300));
    return wins ? { opacity: 1, transform: [{ scale: reduce ? 1 : 1 + 0.05 * Math.sin(Math.PI * p) }] } : { opacity: 1 - 0.65 * p, transform: [{ scale: 1 }] };
  });
  const solid = useAnimatedStyle(() => ({ opacity: wins ? easeOut(progress(t.value, PRICE_LOCK_AT, 250)) : 0 }));
  return (
    <Animated.View style={[{ position: "absolute", top: y - 20, left: 0, right: 0, alignItems: "center" }, shown]}>
      <Animated.View style={[{ width: PRICE_ROW_W }, lock]} className="flex-row items-center gap-2 rounded-xl border border-ink-emphasis/15 bg-white px-3 py-2.5">
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -1, bottom: -1, left: -1, right: -1, borderRadius: 12, backgroundColor: `${colors.accent}14`, borderWidth: 1.5, borderColor: colors.accent }, lit]} />
        <Animated.View pointerEvents="none" style={[{ position: "absolute", top: -1, bottom: -1, left: -1, right: -1, borderRadius: 12, backgroundColor: `${colors.accent}1A`, borderWidth: 1.5, borderColor: colors.accent }, solid]} />
        {wins ? <LockIcon t={t} at={PRICE_LOCK_AT} color={colors.accent} Icon={ShoppingCart} /> : <ShoppingCart color={colors.ink.subtle} size={14} />}
        <Text numberOfLines={1} className="flex-1 font-inter-semibold text-body text-ink-emphasis">
          {store}
        </Text>
        <Text style={{ fontVariant: ["tabular-nums"] }} className="font-inter-bold text-body text-ink-emphasis">
          ₱{Math.round(price)}
          <Text className="font-inter-regular text-ink-subtle">/kg</Text>
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

// A thin glowing line sweeping across (`vertical`: a vertical line moving
// sideways over the chips) or down (a horizontal line over the rows).
function ScanLine({ t, at, ms, color, from, to, vertical }: { t: SharedValue<number>; at: number; ms: number; color: string; from: number; to: number; vertical: boolean }) {
  const style = useAnimatedStyle(() => {
    const p = progress(t.value, at, ms);
    const pos = from + (to - from) * easeInOut(p);
    const fade = Math.min(1, p * 8, (1 - p) * 8);
    return { opacity: p > 0 && p < 1 ? fade : 0, transform: vertical ? [{ translateX: pos - 1 }] : [{ translateY: pos - 1 }] };
  });
  const glow = { backgroundColor: color, shadowColor: color, shadowOpacity: 0.7, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } };
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        vertical
          ? { position: "absolute", left: 0, top: CHIPS_Y - 26, width: 2, height: 52, borderRadius: 1, ...glow }
          : { position: "absolute", left: 0, right: 0, top: 0, height: 2, borderRadius: 1, ...glow },
        style,
      ]}
    />
  );
}

// A small result tag under the word ("380 kcal / 100 g").
function Tag({ children, color }: { children: ReactNode; color: string }) {
  return (
    <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: `${color}1A` }}>
      <Check color={color} size={12} strokeWidth={3} />
      <Text className="font-inter-semibold text-small" style={{ color }}>
        {children}
      </Text>
    </View>
  );
}

// One line of the dish, dropping in checked. When it turns into a dot its
// content fades (DishDot takes over from its check circle).
function DishRow({ t, reduce, index, name, width }: Beat & { index: number; name: string; width: number }) {
  const at = DISH_AT + index * DISH_ROW_STAGGER;
  const y = DISH_TOP + index * DISH_ROW_H;
  const style = useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, at, 320));
    const out = easeIn(progress(t.value, DISH_DOTS_AT + index * DISH_DOTS_STAGGER, 220));
    return { opacity: p * (1 - out), transform: [{ translateY: reduce ? 0 : (1 - p) * -8 }] };
  });
  return (
    <Animated.View style={[{ position: "absolute", top: y, left: width / 2 - ROW_LEFT, width: 190, height: DISH_ROW_H }, style]} className="flex-row items-center gap-2">
      <View className="h-4 w-4 items-center justify-center rounded-full" style={{ backgroundColor: index === 0 ? colors.primary : `${colors.primary}26` }}>
        <Check color={index === 0 ? colors.white : colors.primary} size={10} strokeWidth={3.5} />
      </View>
      <Text className={`font-inter-semibold text-body ${index === 0 ? "text-ink-emphasis" : "text-ink"}`}>{name}</Text>
      <View className="flex-1 border-b border-dashed border-ink-emphasis/15" />
      <Text className="font-inter-regular text-small text-ink-subtle">checked</Text>
    </Animated.View>
  );
}

// An ingredient as a dot: appears on its line's check circle as the line
// fades, moves out to its place on a ring and circles with the others,
// then the ring pulls into the middle and they merge.
function DishDot({ t, reduce, index, width }: Beat & { index: number; width: number }) {
  const cx = width / 2;
  const start = { x: cx - ROW_LEFT + CHECK / 2, y: DISH_TOP + index * DISH_ROW_H + DISH_ROW_H / 2 };
  const style = useAnimatedStyle(() => {
    const appear = progress(t.value, DISH_DOTS_AT + index * DISH_DOTS_STAGGER, 200);
    const move = easeInOut(progress(t.value, RING_AT + index * DISH_DOTS_STAGGER, RING_MOVE_MS));
    const combine = easeIn(progress(t.value, COMBINE_AT, COMBINE_MS));
    const spin = reduce ? 0 : 2 * Math.PI * RING_SPIN * easeInOut(progress(t.value, RING_AT, COMBINE_AT + COMBINE_MS - RING_AT));
    const angle = -Math.PI / 2 + (2 * Math.PI * index) / DISH.length + spin;
    const r = RING_R * (1 - combine);
    const ringX = cx + r * Math.cos(angle);
    const ringY = DOT_AT_Y + r * Math.sin(angle);
    const m = reduce ? (move > 0 ? 1 : 0) : move;
    const x = start.x + (ringX - start.x) * m;
    const y = start.y + (ringY - start.y) * m;
    return {
      opacity: appear * (combine >= 1 ? 0 : 1),
      transform: [{ translateX: x - DISH_DOT / 2 }, { translateY: y - DISH_DOT / 2 }],
    };
  });
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: "absolute", left: 0, top: 0, width: DISH_DOT, height: DISH_DOT, borderRadius: DISH_DOT / 2, backgroundColor: index % 2 === 0 ? colors.primary : colors.accent },
        style,
      ]}
    />
  );
}

// ---- the scene --------------------------------------------------------------------

function MapScene({ width }: { width: number }) {
  const reduce = useReduceMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(MAP_MS, { duration: MAP_MS, easing: Easing.linear });
  }, [t]);
  const beat = { t, reduce };
  const cx = width / 2;

  // Typing, on its own clock (same start).
  const [typed, setTyped] = useState(reduce ? WORD.length : 0);
  useEffect(() => {
    if (reduce) return;
    const timers = Array.from({ length: WORD.length }, (_, i) => setTimeout(() => setTyped(i + 1), 150 + i * TYPE_MS));
    return () => timers.forEach(clearTimeout);
  }, [reduce]);
  const typedAll = 150 + WORD.length * TYPE_MS;

  const kcal = useCountTo(0, 380, KCAL_AT, KCAL_MS);

  // The word: rises after typing; part of the card; gives way to the dish.
  const wordStyle = useAnimatedStyle(() => {
    const up = easeInOut(progress(t.value, WORD_UP_AT, WORD_UP_MS));
    const out = easeIn(progress(t.value, DISH_AT - 300, 300));
    const y = reduce ? WORD_Y : WORD_START_Y + (WORD_Y - WORD_START_Y) * up;
    return { opacity: 1 - out, transform: [{ translateY: y - 20 }] };
  });
  const periodStyle = useAnimatedStyle(() => {
    const p = progress(t.value, typedAll, 220);
    return { opacity: p, transform: [{ scale: reduce ? 1 : 1 + 0.6 * Math.sin(Math.PI * p) }] };
  });

  const resultStyle = useShown(beat, KCAL_AT - 100, NUTRI_TUCK_AT);
  const tagsStyle = useAnimatedStyle(() => {
    const out = easeIn(progress(t.value, DISH_AT - 300, 300));
    return { opacity: 1 - out };
  });
  const kcalTag = useShown(beat, NUTRI_TUCK_AT + 150, undefined, 8);
  const priceTag = useShown(beat, PRICE_TUCK_AT + 150, undefined, 8);
  const cardStyle = useAnimatedStyle(() => {
    const p = easeOut(progress(t.value, CARD_AT, 350));
    const out = easeIn(progress(t.value, DISH_AT - 300, 300));
    return { opacity: p * (1 - out), transform: [{ scale: reduce ? 1 : 0.96 + 0.04 * p }] };
  });

  // The dish's dot: forms where the ring merges, then flies to the period
  // of the closing line, turning orange.
  const [period, setPeriod] = useState<{ x: number; y: number } | null>(null);
  const [row, setRow] = useState<{ x: number; y: number } | null>(null);
  const target = period && row ? { x: row.x + period.x + PERIOD / 2, y: LINE_TOP + row.y + period.y + PERIOD / 2 } : { x: cx, y: LINE_TOP + 40 };
  const dotStyle = useAnimatedStyle(() => {
    const appear = progress(t.value, COMBINE_AT + COMBINE_MS - 60, 160);
    const f = easeInOut(progress(t.value, FLIGHT_AT, FLIGHT_MS));
    const landed = progress(t.value, FLIGHT_AT + FLIGHT_MS, 1) >= 1;
    const x = reduce ? target.x : cx + (target.x - cx) * f;
    const y = reduce ? target.y : DOT_AT_Y + (target.y - DOT_AT_Y) * f - 50 * 4 * f * (1 - f);
    const size = reduce ? PERIOD : DOT + (PERIOD - DOT) * f;
    return {
      // Under reduce motion the line's own period is there; no dot flies.
      opacity: reduce ? 0 : appear * (landed ? 0 : 1),
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: interpolateColor(f, [0, 1], [colors.primary, colors.accent]),
      transform: [{ translateX: x - size / 2 }, { translateY: y - size / 2 }],
    };
  });
  // The period itself, from the moment the dot lands (with a little pulse).
  const landedStyle = useAnimatedStyle(() => {
    const p = progress(t.value, FLIGHT_AT + FLIGHT_MS, 300);
    return { opacity: reduce ? 0 : p > 0 ? 1 : 0, transform: [{ scale: reduce ? 1 : 1 + 0.8 * Math.sin(Math.PI * p) }] };
  });
  const lineStyle = useShown(beat, LINE_AT, undefined, 12);
  const exitStyle = useAnimatedStyle(() => ({ opacity: 1 - progress(t.value, MAP_MS - MAP_EXIT_MS, MAP_EXIT_MS) }));

  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, exitStyle]}>
      {/* The ingredient card's outline (word + tags). */}
      <Animated.View
        pointerEvents="none"
        style={[{ position: "absolute", left: cx - 130, width: 260, top: WORD_Y - 34, height: TAGS_Y - WORD_Y + 62, borderRadius: 18, borderWidth: 1, borderColor: `${colors.ink.emphasis}22` }, cardStyle]}
      />

      {/* The word, typing in. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: 0, left: 0, right: 0, alignItems: "center" }, wordStyle]}>
        <View className="flex-row items-end">
          <Text className="font-inter-extrabold text-heading-lg tracking-display text-primary">{WORD.slice(0, typed)}</Text>
          <Animated.View style={[{ width: PERIOD, height: PERIOD, borderRadius: PERIOD / 2, backgroundColor: colors.accent, marginLeft: 2, marginBottom: 8 }, periodStyle]} />
        </View>
      </Animated.View>

      {/* Nutrition lookup. */}
      <View style={{ position: "absolute", top: CHIPS_Y - 20, left: 0, right: 0, alignItems: "center" }}>
        <View className="flex-row gap-3">
          <SourceChip {...beat} label="USDA" scanAt={NUTRI_SCAN_AT + NUTRI_SCAN_MS * 0.3} lockAt={NUTRI_LOCK_AT} wins hideAt={NUTRI_TUCK_AT} />
          <SourceChip {...beat} label="FNRI" scanAt={NUTRI_SCAN_AT + NUTRI_SCAN_MS * 0.7} lockAt={NUTRI_LOCK_AT} wins={false} hideAt={NUTRI_TUCK_AT} />
        </View>
      </View>
      {!reduce && <ScanLine t={t} at={NUTRI_SCAN_AT} ms={NUTRI_SCAN_MS} color={colors.primary} from={cx - 110} to={cx + 110} vertical />}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: RESULT_Y - 22, left: 0, right: 0, alignItems: "center" }, resultStyle]}>
        <Text style={{ fontVariant: ["tabular-nums"] }} className="font-inter-extrabold text-heading-lg text-primary">
          {Math.round(kcal)} kcal
        </Text>
        <Text className="font-inter-medium text-body text-ink-subtle">per 100 g · from USDA</Text>
      </Animated.View>

      {/* Price lookup. */}
      <PriceRow {...beat} store="Dept. of Agriculture" perKg={366} at={PRICE_AT} scanAt={PRICE_SCAN_AT + PRICE_SCAN_MS * 0.25} wins hideAt={PRICE_TUCK_AT} y={PRICE_ROWS_Y[0]} />
      <PriceRow {...beat} store="Landers" perKg={419} at={PRICE_AT + PRICE_ROW_STAGGER} scanAt={PRICE_SCAN_AT + PRICE_SCAN_MS * 0.75} wins={false} hideAt={PRICE_TUCK_AT} y={PRICE_ROWS_Y[1]} />
      {!reduce && (
        <View pointerEvents="none" style={{ position: "absolute", top: 0, left: cx - PRICE_ROW_W / 2, width: PRICE_ROW_W }}>
          <ScanLine t={t} at={PRICE_SCAN_AT} ms={PRICE_SCAN_MS} color={colors.accent} from={PRICE_ROWS_Y[0] - 30} to={PRICE_ROWS_Y[1] + 30} vertical={false} />
        </View>
      )}

      {/* The two results, tucked under the word. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: TAGS_Y - 13, left: 0, right: 0, alignItems: "center" }, tagsStyle]}>
        <View className="flex-row gap-2">
          <Animated.View style={kcalTag}>
            <Tag color={colors.primary}>380 kcal / 100 g</Tag>
          </Animated.View>
          <Animated.View style={priceTag}>
            <Tag color={colors.accent}>₱366 / kg</Tag>
          </Animated.View>
        </View>
      </Animated.View>

      {/* The dish. */}
      {DISH.map((name, i) => (
        <DishRow key={name} {...beat} index={i} name={name} width={width} />
      ))}
      {DISH.map((name, i) => (
        <DishDot key={`dot-${name}`} {...beat} index={i} width={width} />
      ))}

      {/* The closing line; its period is where the dot lands. */}
      <Animated.View pointerEvents="none" style={[{ position: "absolute", top: LINE_TOP, left: 0, right: 0, alignItems: "center" }, lineStyle]}>
        <Text numberOfLines={1} className="font-inter-medium text-subheading text-ink-subtle">
          Every ulam,
        </Text>
        <View className="flex-row items-end" onLayout={(e) => setRow({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y })}>
          <Text numberOfLines={1} className="font-inter-extrabold text-heading tracking-display text-primary">
            backed by real data
          </Text>
          <Animated.View
            onLayout={(e) => setPeriod({ x: e.nativeEvent.layout.x, y: e.nativeEvent.layout.y })}
            style={[{ width: PERIOD, height: PERIOD, borderRadius: PERIOD / 2, backgroundColor: colors.accent, marginLeft: 2, marginBottom: 6 }, reduce ? null : landedStyle]}
          />
        </View>
      </Animated.View>
      <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0 }, dotStyle]} />
    </Animated.View>
  );
}

// ---- the summary ------------------------------------------------------------------

const SUMMARY = [
  { label: "Nutrition", source: "FNRI & USDA food data", detail: "per 100 g, scaled to the amount used", color: colors.primary },
  { label: "Prices", source: "Dept. of Agriculture & groceries", detail: "the cheapest per kg or liter", color: colors.accent },
  { label: "Totals", source: "every ingredient, added up", detail: "for the servings you cook", color: colors.primary },
];
const SUMMARY_ROWS_AT = 400;
const SUMMARY_STAGGER_MS = 220;

// 0 -> 1 after `delay`.
function useBeat(delay: number, duration = 450) {
  const v = useSharedValue(0);
  useEffect(() => {
    v.value = withDelay(delay, withTiming(1, { duration, easing: Easing.inOut(Easing.cubic) }));
  }, [v, delay, duration]);
  return v;
}

function SummaryScene({ at }: { at: number }) {
  const reduce = useReduceMotion();
  const shown = useBeat(at, 450);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: reduce ? 0 : (1 - shown.value) * 14 }] }));
  return (
    <Animated.View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, style]} className="items-center justify-center">
      <View className="items-center">
        <Text numberOfLines={1} adjustsFontSizeToFit className="font-inter-medium text-subheading text-ink-subtle">
          In short
        </Text>
        <Text numberOfLines={1} adjustsFontSizeToFit className="font-inter-extrabold text-heading tracking-display text-primary">
          Real data, added up<Text className="text-accent">.</Text>
        </Text>
      </View>
      {/* A small table: label column, then the source and how it's used. */}
      <View className="mt-5 w-full rounded-2xl border border-ink-emphasis/10 px-4">
        {SUMMARY.map((row, i) => (
          <SummaryRow key={row.label} at={at + SUMMARY_ROWS_AT + i * SUMMARY_STAGGER_MS} row={row} last={i === SUMMARY.length - 1} />
        ))}
      </View>
    </Animated.View>
  );
}

function SummaryRow({ at, row, last }: { at: number; row: (typeof SUMMARY)[number]; last: boolean }) {
  const reduce = useReduceMotion();
  const shown = useBeat(at, 350);
  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateY: reduce ? 0 : (1 - shown.value) * 10 }] }));
  return (
    <Animated.View style={style} className={`flex-row gap-3 py-3 ${last ? "" : "border-b border-ink-emphasis/10"}`}>
      <View className="w-24 flex-row items-center gap-2 self-start">
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
        <Text className="font-inter-bold text-body text-ink-emphasis">{row.label}</Text>
      </View>
      <View className="flex-1">
        <Text className="font-inter-semibold text-body text-ink-emphasis">{row.source}</Text>
        <Text className="font-inter-regular text-small text-ink-subtle">{row.detail}</Text>
      </View>
    </Animated.View>
  );
}

// ---- reel ---------------------------------------------------------------------------

export function NumbersReel() {
  const [width, setWidth] = useState(0);
  return (
    <View
      style={{ height: STAGE_HEIGHT }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      accessibilityLabel="Pork belly is looked up: its calories in USDA and FNRI food data (380 kcal per 100 g, from USDA), its price at the Department of Agriculture and Landers (the cheapest, ₱366 per kg). Then every ingredient of the dish is checked the same way. Every ulam is backed by real data: nutrition from FNRI and USDA, prices from the Department of Agriculture and groceries, every ingredient added up for the servings you cook."
    >
      {width > 0 && (
        <>
          <MapScene width={width} />
          <SummaryScene at={MAP_MS} />
        </>
      )}
    </View>
  );
}
