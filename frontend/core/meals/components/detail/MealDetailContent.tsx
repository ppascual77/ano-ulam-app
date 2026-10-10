import { ReactNode, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  FadeIn,
  SlideInLeft,
  SlideInRight,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Archive,
  Bookmark,
  Heart,
  ShieldCheck,
  Store,
  Clock3,
  Flame,
  ChefHat,
  Minus,
  Pencil,
  Plus,
  User2,
  Users,
  Leaf,
  Info,
  ArrowLeft,
  Trash2,
} from "lucide-react-native";
import {
  AppText,
  Button,
  Card,
  Chips,
  Confetti,
  NoticeBanner,
  SegmentedSwitch,
  Spinner,
  useBurstOnActivate,
} from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealInfoPill } from "../MealInfoPill";
import { MacroSection } from "./MacroSection";
import { MicronutrientList, hasMicronutrients, type Micronutrients } from "./MicronutrientList";
import { RelatedMeals } from "./RelatedMeals";
import { resolveMealImage } from "../../resolveMealImage";
import { ingredientCategoryIcon } from "../../ingredientCategory";
import { scaleIngredient } from "../../utils/scaleMeal";
import { DIETARY_ICONS, capitalize } from "../../utils/dietary";
import type { IngredientType, MealType } from "../../mealTypes";

// Small circular icon buttons (back/edit/like) and the servings +/- steppers
// are visually ~32-36px, under the ~44pt minimum recommended touch target —
// this was reported as taps "intermittently" not registering, which is
// exactly what a target that size feels like rather than an actual bug.
// hitSlop extends the tappable area without changing how the button looks.
const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

// Roughly the top third of the screen, like the reference design.
const HERO_HEIGHT = 320;
// How far the rounded details card rides up over the bottom of the photo.
const CARD_OVERLAP = 24;
// The card's rounded top: its own strip, outside the scroll, so it can hold
// still (round corners over the photo) while the details scroll under it.
const CARD_CAP = 20;
// The photo scrolls up with the card until this much of it is off screen,
// then both stop and the card's contents scroll instead.
const PHOTO_SCROLL_AWAY = 0.75;
// Back/like buttons are visually 44px.
const PHOTO_BUTTON_SIZE = 44;
// After the lock, this much more scrolling hands the photo strip over from
// the pills to the meal name (pills slide up and out, name slides up in).
const TITLE_HANDOFF = 48;
// How far each slides during the handoff.
const HANDOFF_SLIDE = 16;

function orderIngredients(ingredients: IngredientType[]) {
  const main = ingredients.filter((it) => it.type === "main");
  const oils = ingredients.filter((it) => it.type === "pantry" && /oil/i.test(it.name));
  const rest = ingredients.filter((it) => it.type === "pantry" && !/oil/i.test(it.name));
  return [...main, ...oils, ...rest];
}

type IngredientRowProps = {
  /** Already scaled (see scaleIngredient). */
  ingredient: IngredientType;
  /** Omitted when there's nothing to show in the detail sheet. */
  onPress?: () => void;
};

// Plain water ("Water", "hot water", "tubig", ...): free and nothing to look
// up, so its row shows no price/N/A and isn't tappable. Not "coconut water".
const PLAIN_WATER = /^((hot|cold|warm|boiling|tap|mainit na|malamig na)\s+)?(water|tubig)$/i;

function IngredientRow({ ingredient, onPress: onPressProp }: IngredientRowProps) {
  const isMain = ingredient.type === "main";
  const isWater = PLAIN_WATER.test(ingredient.name.trim());
  const onPress = isWater ? undefined : onPressProp;

  const content = (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 flex-row items-center gap-3 pr-2">
        {/* Category icon (meat, fish, vegetables, ...), fixed size so the
            names after it stay lined up. */}
        <Image source={ingredientCategoryIcon(ingredient)} style={{ width: 32, height: 32 }} contentFit="contain" />
        <View className="flex-1 gap-1">
          {/* Quantity right after the name, centered with it: a size smaller
              and a weight lighter so the name still leads. */}
          <View className="flex-row items-center gap-1.5">
            {/* Plain Text so semibold is the only weight (AppText's caption
                variant would bring its own regular weight). */}
            <Text className="shrink font-inter-semibold text-body leading-5 text-ink-subtle">{capitalize(ingredient.name)}</Text>
            <Text className="font-inter-light text-small text-ink-subtle">({ingredient.qty})</Text>
          </View>
          {/* Main / Pantry chip under the name, sized to its label. */}
          <View className={`self-start rounded-full px-2 py-1 ${isMain ? "bg-primary/10" : "bg-ink-emphasis/5"}`}>
            <Text className={`font-inter-semibold text-sub ${isMain ? "text-primary" : "text-ink-subtle"}`}>
              {isMain ? "Main" : "Pantry"}
            </Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        <View className="items-end">
          {/* Every ingredient counts toward the meal's price now, pantry
              included, so every card shows its share. */}
          {isWater ? null : ingredient.price != null && ingredient.price > 0 ? (
            // Plain Text so extrabold isn't fighting the caption variant's regular weight.
            <Text className="font-inter-extrabold text-body leading-5 text-primary">~₱{ingredient.price.toFixed(2)}</Text>
          ) : (
            <View className="flex-row items-center gap-0.5">
              <Info color={colors.ink.subtle} size={9} />
              <Text className="text-sub text-ink-subtle">N/A</Text>
            </View>
          )}
        </View>
        {onPress && <ChevronRight color={colors.ink.subtle} size={14} />}
      </View>
    </View>
  );

  // Each ingredient is its own card rather than a row in one bordered
  // table, so the list reads as separate items. Tapping opens
  // IngredientDetailSheet (via MealDetailSheet) instead of expanding here.
  return (
    <Card variant="outlined">{onPress ? <Pressable onPress={onPress}>{content}</Pressable> : content}</Card>
  );
}

type StatCardProps = {
  icon: ReactNode;
  value: string;
  label: string;
};

function StatCard({ icon, value, label }: StatCardProps) {
  return (
    <View className="flex-1 items-center gap-1 rounded-2xl border border-ink-emphasis/10 py-3">
      {icon}
      <AppText variant="bodyBold">{value}</AppText>
      <AppText variant="caption" className="text-sub">
        {label}
      </AppText>
    </View>
  );
}

type MealDetailContentProps = {
  meal: MealType;
  /** Consumer save state for the footer. `savedServings` is the servings
   *  the meal was saved at: changing the stepper away from it turns Unsave
   *  into "Update Meal". */
  saved?: {
    isSaved: boolean;
    savedServings?: number;
    /** A save/unsave request is in flight: the button shows a spinner and
     *  ignores taps. */
    busy?: boolean;
    onSave: (servings: number) => void;
    onUnsave: () => void;
    onUpdate: (servings: number) => void;
  };
  /** The viewer's own recipe (Profile > Created): a pending/draft recipe
   *  gets "Edit Recipe", a rejected one "Delete Recipe", instead of Save. */
  recipeOwner?: { onEditRecipe: () => void; onDeleteRecipe: () => void };
  /** Servings the stepper starts at (e.g. a saved meal's). Defaults to the
   *  meal's own serving_size. */
  initialServings?: number;
  onSelectMeal?: (meal: MealType) => void;
  /** The top-left arrow over the photo. MealDetailSheet steps back through
   *  related meals with it, then closes. Omitted (no arrow) in preview. */
  onBack?: () => void;
  /** "forward" (picked a related meal) slides in from the left; "back"
   *  slides in from the right; "none" (initial open) plays no slide —
   *  the sheet's own slide-up already covers that. Defaults to "none". */
  direction?: "none" | "forward" | "back";
  /** Admin-only — omitted for every consumer-facing usage of this
   *  component, which renders nothing extra when they're absent. */
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
  /** Tapping an ingredient card. Receives the ingredient already scaled to
   *  the current servings. MealDetailSheet opens IngredientDetailSheet. */
  onSelectIngredient?: (ingredient: IngredientType) => void;
  /** Controlled like state. When passed, the heart shows and toggles this
   *  instead of the sheet's own local state, so a caller that tracks likes
   *  (Discover's reel) stays in sync both ways. Omitted everywhere else. */
  like?: { liked: boolean; count: number; onToggle: () => void };
  /** Embedded preview (Add a Recipe's Preview step): no own ScrollView
   *  (it sits inside the form's), no Save footer, no related meals. The
   *  rest (servings, tappable ingredients) works as normal. */
  preview?: boolean;
  /** Admin review of a user-submitted recipe (Review Recipes): the footer
   *  shows Reject / Approve instead of Save, and consumer-only parts are
   *  hidden, same as the other admin actions. */
  review?: { onApprove: () => void; onReject: () => void; busy?: boolean };
};

// Title ending in an orange dot ("Nutrition.", "Chicken Adobo."), like the
// show reel: the meal name and each section header.
function SectionTitle({ children }: { children: string }) {
  return (
    <AppText variant="sectionTitle" dot>
      {children}
    </AppText>
  );
}

type ConsumerFooterProps = Pick<MealDetailContentProps, "meal" | "saved" | "recipeOwner"> & { servings: number };

// Which one button the footer shows, in priority order: own recipe still in
// review / rejected, then saved (Unsave, or Update Meal once the servings
// changed), then Save.
function ConsumerFooter({ meal, servings, saved, recipeOwner }: ConsumerFooterProps) {
  // Confetti when a save lands: once the spinner finishes, not on the
  // optimistic flip (and never for a save that failed and reverted).
  // MealDetailSheet keys the content by meal id, so opening an
  // already-saved related meal doesn't fire it.
  const saveBurstId = useBurstOnActivate(!!saved?.isSaved && !saved.busy);

  if (recipeOwner && (meal.status === "pending" || meal.status === "draft")) {
    return (
      <Button
        label="Edit Recipe"
        icon={<Pencil color={colors.white} size={15} />}
        iconPosition="right"
        onPress={recipeOwner.onEditRecipe}
      />
    );
  }
  if (recipeOwner && meal.status === "rejected") {
    return (
      <Pressable
        onPress={recipeOwner.onDeleteRecipe}
        className="flex-row items-center justify-center gap-2 rounded-xl border border-like py-3.5"
      >
        <Trash2 color={colors.like} size={15} />
        <AppText variant="title" className="text-like">
          Delete Recipe
        </AppText>
      </Pressable>
    );
  }
  if (!saved) return null;

  const servingsChanged = saved.isSaved && saved.savedServings != null && servings !== saved.savedServings;
  if (servingsChanged) {
    return (
      <Button
        label="Update Meal"
        variant="tinted"
        icon={<Bookmark color={colors.primary} size={16} fill={colors.primary} />}
        iconPosition="right"
        onPress={() => saved.onUpdate(servings)}
      />
    );
  }
  return (
    <View>
      <Confetti burstId={saveBurstId} direction="up" />
      <Button
        label={saved.isSaved ? "Unsave" : "Save Meal"}
        variant={saved.isSaved ? "primary" : "outline"}
        icon={
          saved.busy ? (
            <Spinner variant="spiral" size={16} color={saved.isSaved ? colors.white : colors.primary} />
          ) : (
            <Bookmark color={saved.isSaved ? colors.white : colors.primary} size={16} fill={saved.isSaved ? colors.white : "none"} />
          )
        }
        iconPosition="right"
        // Not `disabled`: that dims the button, but it's still the live state.
        onPress={() => {
          if (saved.busy) return;
          if (saved.isSaved) saved.onUnsave();
          else saved.onSave(servings);
        }}
      />
    </View>
  );
}

// The scrollable body rendered inside a full-screen BottomSheet (see
// MealDetailSheet): the photo at the very top, under the status bar, with a
// rounded white card holding the details riding up over its bottom edge.
// No backend yet — like/save are local UI state; servings scaling is pure
// math, no rice add-on / pantry-match / price-drop tracking (those need
// data this app doesn't have).
export function MealDetailContent({
  meal,
  saved,
  recipeOwner,
  initialServings,
  onSelectMeal,
  onBack,
  direction = "none",
  onEdit,
  onArchive,
  onDelete,
  onSelectIngredient,
  like,
  preview = false,
  review,
}: MealDetailContentProps) {
  // Any admin context (manage or review): no consumer-only Save / related
  // meals / Published chip.
  const isAdmin = !!(onEdit || onArchive || onDelete || review);
  // Full screen puts the photo under the status bar, so the buttons on it
  // drop below that. The embedded preview isn't full screen.
  const insets = useSafeAreaInsets();
  const photoButtonsTop = preview ? 16 : insets.top + 8;
  // How far the photo scrolls before stopping: 3/4 of it, but never so far
  // the card's top would slide under the back/like buttons (on notched
  // phones that wins, so a bit less of the photo scrolls away).
  const cardRest = HERO_HEIGHT - CARD_OVERLAP;
  const photoStop = Math.min(HERO_HEIGHT * PHOTO_SCROLL_AWAY, cardRest - (photoButtonsTop + PHOTO_BUTTON_SIZE + 8));
  // Where the card's top ends up once stopped.
  const cardPinTop = cardRest - photoStop;
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });
  // The photo and the card's cap: follow the scroll 1:1 up to photoStop,
  // then hold. Not clamped at 0, so a pull-down bounce drags them along.
  // 0 -> 1 over the TITLE_HANDOFF px of scrolling after the lock.
  const handoff = useDerivedValue(() =>
    Math.min(1, Math.max(0, (scrollY.value - photoStop) / TITLE_HANDOFF)),
  );
  const pillsStyle = useAnimatedStyle(() => ({
    opacity: 1 - handoff.value,
    transform: [{ translateY: -HANDOFF_SLIDE * handoff.value }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: handoff.value,
    transform: [{ translateY: HANDOFF_SLIDE * (1 - handoff.value) }],
  }));
  // Darkens the photo strip a little so the white name reads on any photo.
  const scrimStyle = useAnimatedStyle(() => ({ opacity: 0.5 * handoff.value }));
  // The name fits between the back button and the right-hand buttons
  // (whose width varies: like count, Edit, Published), never under them.
  const [rightButtonsWidth, setRightButtonsWidth] = useState(PHOTO_BUTTON_SIZE);
  const titleLeft = 16 + (onBack ? PHOTO_BUTTON_SIZE + 12 : 0);
  const titleRight = 16 + rightButtonsWidth + 12;

  const pinnedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -Math.min(scrollY.value, photoStop) }],
  }));
  const [isLiked, setIsLiked] = useState(meal.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(meal.like_count ?? 0);
  const [servings, setServings] = useState(initialServings ?? meal.serving_size ?? 1);

  const toggleLocalLike = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };
  const liked = like ? like.liked : isLiked;
  const shownLikeCount = like ? like.count : likeCount;
  const toggleLike = like ? like.onToggle : toggleLocalLike;

  const scale = servings / (meal.serving_size ?? 1);
  const displayCalories = Math.round(meal.calories * scale);
  const displayProtein = Number((meal.protein * scale).toFixed(1));
  const displayCarbs = Number((meal.carbs * scale).toFixed(1));
  const displayFats = Number((meal.fats * scale).toFixed(1));
  // Micronutrients per serving: the ingredients' own (quantity-based)
  // values summed, divided by the recipe's servings. Per serving rather than
  // the shown total, since "% of daily value" only means something for one
  // person's plate; so it doesn't change with the servings stepper.
  const [showMicros, setShowMicros] = useState(false);
  // Water is left out on both sides: no micronutrients to sum or be missing.
  const nonWater = (meal.ingredients ?? []).filter((it) => !PLAIN_WATER.test(it.name.trim()));
  const microIngredients = nonWater.filter(hasMicronutrients);
  const microPerServing = (key: keyof Micronutrients) =>
    microIngredients.some((it) => it[key] != null)
      ? microIngredients.reduce((sum, it) => sum + (it[key] ?? 0), 0) / (meal.serving_size ?? 1)
      : undefined;
  const mealMicros: Micronutrients = { fiber: microPerServing("fiber"), sugar: microPerServing("sugar"), sodium: microPerServing("sodium") };
  const totalIngredients = nonWater.length;

  // "Per serving" view of the Nutrition card: the same batch (ingredients,
  // price and servings stay as they are) with its nutrition split across
  // the servings, as a guide to one plate. Not the same as setting servings
  // to 1, which would also shrink the ingredients. Only offered for more
  // than one serving, since otherwise both views are identical.
  const [perServingView, setPerServingView] = useState(false);
  const showPerServing = perServingView && servings > 1;
  // A quick pop on the donut + legend (and the micronutrients, when open)
  // when the view switches, so the eye
  // catches that the numbers changed. Skipped on first render.
  const macroPulse = useSharedValue(1);
  const pulseReady = useRef(false);
  useEffect(() => {
    if (!pulseReady.current) {
      pulseReady.current = true;
      return;
    }
    macroPulse.value = withSequence(withTiming(1.06, { duration: 110 }), withSpring(1, { damping: 7, stiffness: 220, mass: 0.6 }));
  }, [showPerServing]);
  const macroPulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: macroPulse.value }] }));
  const nutritionDivisor = showPerServing ? servings : 1;
  const shownCalories = Math.round(displayCalories / nutritionDivisor);
  const shownProtein = Number((displayProtein / nutritionDivisor).toFixed(1));
  const shownCarbs = Number((displayCarbs / nutritionDivisor).toFixed(1));
  const shownFats = Number((displayFats / nutritionDivisor).toFixed(1));
  // Micros: amounts follow the view (whole batch or one serving), but the
  // % daily value always measures one serving, since a daily value is about
  // one person's day.
  const shownMicros: Micronutrients = showPerServing
    ? mealMicros
    : {
        fiber: mealMicros.fiber != null ? mealMicros.fiber * servings : undefined,
        sugar: mealMicros.sugar != null ? mealMicros.sugar * servings : undefined,
        sodium: mealMicros.sodium != null ? mealMicros.sodium * servings : undefined,
      };
  const displayPrice = Number((Number(meal.price) * scale).toFixed(2));
  const displayBufferPrice = meal.buffer_price
    ? Number((meal.buffer_price * scale).toFixed(2))
    : null;

  const isFastFood = meal.category === "fast_food";

  const heroPhoto = (
    <View style={{ height: HERO_HEIGHT }}>
      <Image source={resolveMealImage(meal)} style={{ width: "100%", height: HERO_HEIGHT }} contentFit="cover" />
      <Animated.View pointerEvents="none" className="absolute inset-0 bg-ink-emphasis" style={scrimStyle} />

      {/* Diet tags and the nutrition pills sit on the bottom of the photo,
          just above where the details card overlaps it. Once the card locks,
          they slide up and out to make way for the meal name. */}
      <Animated.View
        className="absolute left-4 right-4 flex-row flex-wrap items-center gap-1.5"
        style={[{ bottom: CARD_OVERLAP + 12 }, pillsStyle]}
      >
        {meal.dietary_tags?.map((tag) => {
          const Icon = DIETARY_ICONS[tag] ?? Leaf;
          return (
            <View key={tag} className="flex-row items-center gap-1 rounded-full bg-white/90 px-2 py-2">
              <Icon color={colors.primary} size={11} />
              <Text className="font-inter-medium text-caption text-primary">{capitalize(tag)}</Text>
            </View>
          );
        })}
        <MealInfoPill
          meal={{
            calories: displayCalories,
            protein: displayProtein,
            carbs: displayCarbs,
            fats: displayFats,
            total_time: meal.total_time,
          }}
        />
      </Animated.View>
    </View>
  );

  const topBar = (
    <>
      {/* Top bar over the photo: back on the left; Published / Edit /
          like on the right. */}
      {onBack && (
        <View className="absolute left-4" style={{ top: photoButtonsTop }}>
          <Pressable
            onPress={onBack}
            hitSlop={ICON_HIT_SLOP}
            className="h-11 w-11 items-center justify-center rounded-full bg-ink-emphasis/40"
          >
            <ArrowLeft color={colors.white} size={22} />
          </Pressable>
        </View>
      )}

      <View
        className="absolute right-4 flex-row items-center gap-2"
        style={{ top: photoButtonsTop }}
        onLayout={(e) => setRightButtonsWidth(e.nativeEvent.layout.width)}
      >
        {/* Only on the viewer's own recipe: every catalog meal is
            approved, so on anything else the chip says nothing. Never in
            admin context, where Edit sits here instead. */}
        {meal.status === "approved" && recipeOwner && !isAdmin && (
          <Chips label="Published" icon={<ShieldCheck color={colors.white} size={10} strokeWidth={2} />} />
        )}

        {onEdit && (
          <Pressable
            onPress={onEdit}
            hitSlop={ICON_HIT_SLOP}
            className="h-11 w-11 items-center justify-center rounded-full bg-ink-emphasis/40"
          >
            <Pencil color={colors.white} size={18} />
          </Pressable>
        )}

        {/* Grows into a pill with the count once there are likes. */}
        <Pressable
          onPress={toggleLike}
          hitSlop={ICON_HIT_SLOP}
          className={`h-11 min-w-11 flex-row items-center justify-center gap-1 rounded-full px-3 ${
            liked ? "bg-like" : "bg-ink-emphasis/40"
          }`}
        >
          <Heart color={colors.white} size={20} fill={liked ? colors.white : "none"} />
          {shownLikeCount > 0 && <Text className="font-inter-semibold text-body text-white">{shownLikeCount}</Text>}
        </Pressable>
      </View>
    </>
  );

  // Meal name through the steps: the rounded details card's contents.
  const cardBody = (
    <>
      <View className="flex-row items-start justify-between">
        <View className="flex-1 pr-3">
          <SectionTitle>{meal.name}</SectionTitle>

          <View className="mt-1.5 flex-row items-center gap-1.5 self-start">
            {!isFastFood ? (
              <>
                <Pressable
                  onPress={() => setServings((s) => Math.max(1, s - 1))}
                  hitSlop={ICON_HIT_SLOP}
                  className="h-8 w-8 items-center justify-center rounded-full border border-ink-emphasis/15"
                >
                  <Minus color={colors.ink.subtle} size={10} />
                </Pressable>
                <View
                  className="flex-row items-center justify-center gap-1 rounded-full border border-primary/20 bg-primary/10 py-2"
                  style={{ width: 120 }}
                >
                  {servings > 1 ? (
                    <Users color={colors.primary} size={12} />
                  ) : (
                    <User2 color={colors.primary} size={12} />
                  )}
                  <Text className="font-inter-medium text-caption text-primary">
                    {servings > 1 ? `${servings} Servings` : "Single Serve"}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setServings((s) => Math.min(5, s + 1))}
                  hitSlop={ICON_HIT_SLOP}
                  className="h-8 w-8 items-center justify-center rounded-full border border-ink-emphasis/15"
                >
                  <Plus color={colors.ink.subtle} size={10} />
                </Pressable>
              </>
            ) : (
              <>
                <View className="flex-row items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2 py-1">
                  <User2 color={colors.primary} size={12} />
                  <Text className="font-inter-medium text-sub text-primary">
                    Single Serve
                  </Text>
                </View>
                {meal.restaurant && (
                  <Chips
                    label={meal.restaurant}
                    icon={
                      <Store
                        color={colors.white}
                        size={10}
                        strokeWidth={2}
                      />
                    }
                    bgClassName="bg-accent"
                  />
                )}
              </>
            )}
          </View>
        </View>

        <View className="items-end">
          {/* Extra bold, like the ingredient prices. Plain Text so the
              title variant's own semibold doesn't compete with it. */}
          <Text className="font-inter-extrabold text-subheading text-primary">
            ₱{displayPrice.toFixed(2)}
            {displayBufferPrice ? ` – ₱${displayBufferPrice.toFixed(2)}` : ""}
          </Text>
          <AppText
            variant="caption"
            className="font-inter-light"
            style={{ fontSize: 13 }}
          >
            Estimated Price
          </AppText>
        </View>
      </View>

      <AppText variant="caption" className="mt-3 leading-5">
        {meal.description}
      </AppText>

      <View className="mt-4 flex-row gap-2">
        {!isFastFood && meal.prep_time != null && (
          <StatCard
            icon={<Clock3 color={colors.primary} size={18} />}
            value={`${meal.prep_time} min`}
            label="Prep time"
          />
        )}
        <StatCard
          icon={<Flame color={colors.like} size={18} />}
          value={`${displayCalories}`}
          label="Calories"
        />
        {meal.difficulty && (
          <StatCard
            icon={<ChefHat color={colors.primary} size={18} />}
            value={capitalize(meal.difficulty)}
            label="Difficulty"
          />
        )}
      </View>

      <View className="mt-5">
        <View className="flex-row items-center justify-between">
          <SectionTitle>Nutrition</SectionTitle>
          {servings > 1 && (
            <SegmentedSwitch
              options={[
                { value: "all", label: `All ${servings}` },
                { value: "perServing", label: "Per serving" },
              ]}
              value={perServingView ? "perServing" : "all"}
              onChange={(v) => setPerServingView(v === "perServing")}
            />
          )}
        </View>
        <View className="mt-2 rounded-2xl border border-ink-emphasis/10 p-3">
          <Animated.View style={macroPulseStyle}>
            <MacroSection calories={shownCalories} protein={shownProtein} carbs={shownCarbs} fats={shownFats} />
          </Animated.View>
          {/* Optional micronutrients, tucked under the macros. Hidden
              entirely when no ingredient has micronutrient data. */}
          {hasMicronutrients(mealMicros) && (
            <>
              <Pressable
                onPress={() => setShowMicros((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityState={{ expanded: showMicros }}
                className="mt-3 flex-row items-center justify-center gap-1 border-t border-ink-emphasis/10 pt-3"
              >
                <Text className="font-inter-semibold text-body text-primary">
                  {showMicros ? "Hide micronutrients" : "Show micronutrients"}
                </Text>
                {showMicros ? <ChevronUp color={colors.primary} size={16} /> : <ChevronDown color={colors.primary} size={16} />}
              </Pressable>
              {showMicros && (
                <Animated.View entering={FadeIn.duration(200)} className="mt-3 px-1">
                  {/* Same pop as the donut when All / Per serving switches. */}
                  <Animated.View style={macroPulseStyle}>
                    <Text className="mb-3 font-inter-regular text-small text-ink-subtle">
                      {showPerServing || servings === 1 ? "% of daily value, per serving." : `Totals for ${servings} servings.`}
                      {microIngredients.length < totalIngredients
                        ? ` From ${microIngredients.length} of ${totalIngredients} ingredients.`
                        : ""}
                    </Text>
                    <MicronutrientList
                      values={shownMicros}
                      shareOf={mealMicros}
                      shareNote={showPerServing || servings === 1 ? undefined : "per serving"}
                    />
                  </Animated.View>
                </Animated.View>
              )}
            </>
          )}
        </View>
      </View>

      {meal.ingredients && meal.ingredients.length > 0 && (
        <View className="mt-5">
          <View className="flex-row items-center justify-between">
            <SectionTitle>Ingredients</SectionTitle>
          </View>

          <View className="my-3">
            <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
              <AppText variant="caption" className="text-notice-text">
                Prices shown are for the exact quantities used in this recipe. Some items may only be available
                as a whole unit, so your actual spend may be higher.
              </AppText>
            </NoticeBanner>
          </View>

          <View className="mt-2 gap-2">
            {orderIngredients(meal.ingredients).map((ingredient, i) => {
              const scaled = scaleIngredient(ingredient, scale);
              return (
                <IngredientRow
                  key={i}
                  ingredient={scaled}
                  // Every ingredient has a sheet to show (at minimum its
                  // price source), so every card is tappable.
                  onPress={onSelectIngredient ? () => onSelectIngredient(scaled) : undefined}
                />
              );
            })}
          </View>
        </View>
      )}

      {meal.procedure && meal.procedure.length > 0 && (
        <View className="mt-5">
          <SectionTitle>Steps</SectionTitle>
          {/* A numbered green circle per step, joined to the next one by a
              line running down the left, like a timeline. */}
          <View className="mt-3 rounded-2xl border border-ink-emphasis/10 px-4 pt-4 pb-1">
            {meal.procedure.map((step, i) => {
              const last = i === meal.procedure!.length - 1;
              return (
                <View key={i} className="flex-row gap-3">
                  <View className="items-center">
                    <View className="h-8 w-8 items-center justify-center rounded-full bg-primary">
                      <Text className="font-inter-bold text-body text-white">{i + 1}</Text>
                    </View>
                    {!last && <View className="w-0.5 flex-1 bg-primary" />}
                  </View>
                  {/* Read mid-cook, so large and high-contrast. Plain Text, not
                      AppText: a variant's own text-body would fight
                      text-body-lg over the font size. */}
                  <Text className={`flex-1 pt-1 font-inter-regular text-body-lg text-ink ${last ? "pb-3" : "pb-7"}`}>
                    {step}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}
    </>
  );

  const related = (
    <>
      {/* RelatedMeals pulls from the mock catalog regardless of which
          meal is actually open (no backend for real relations yet) —
          meaningless in admin context, and tapping one would swap the
          sheet to fake data while Edit/Archive/Delete stay bound to the
          real meal being managed, a confusing mismatch. */}
      {!isAdmin && !preview && (
        <View className="mb-6">
          <RelatedMeals meal={meal} onSelectMeal={onSelectMeal} />
        </View>
      )}
    </>
  );

  return (
    <Animated.View
      entering={
        direction === "forward" ? SlideInLeft.duration(250) : direction === "back" ? SlideInRight.duration(250) : undefined
      }
      className={preview ? "" : "flex-1"}
    >
      {preview ? (
        <View>
          <View className="relative">
            {heroPhoto}
            {topBar}
          </View>
          <View className="rounded-t-3xl bg-white px-6 pt-5" style={{ marginTop: -CARD_OVERLAP }}>
            {cardBody}
          </View>
        </View>
      ) : (
        // Photo and card scroll up together until photoStop px have scrolled
        // by (3/4 of the photo off screen), then both stop: the photo and the
        // card's rounded cap are held there (pinnedStyle) while the details
        // scroll on under the cap. The cap lives outside the scroll area,
        // which starts right below where it stops: inside, the white content
        // scrolling past would fill in its round corners.
        <View className="flex-1">
          <Animated.View className="absolute left-0 right-0 top-0" style={pinnedStyle}>
            {heroPhoto}
          </Animated.View>
          <Animated.ScrollView
            onScroll={onScroll}
            scrollEventThrottle={16}
            showsVerticalScrollIndicator={false}
            style={{ position: "absolute", top: cardPinTop + CARD_CAP, left: 0, right: 0, bottom: 0 }}
          >
            {/* Transparent: the photo shows through until it's scrolled. */}
            <View style={{ height: photoStop }} />
            <View className="bg-white px-6">{cardBody}</View>
            <View className="bg-white px-6">{related}</View>
          </Animated.ScrollView>
          <Animated.View
            pointerEvents="none"
            className="absolute left-0 right-0 rounded-t-3xl bg-white"
            style={[{ top: cardRest, height: CARD_CAP }, pinnedStyle]}
          />
          {/* The meal name (and servings under it) on the photo strip once
              the card locks, level with the buttons and between them. */}
          <Animated.View
            pointerEvents="none"
            className="absolute justify-center"
            style={[{ top: photoButtonsTop, left: titleLeft, right: titleRight, height: PHOTO_BUTTON_SIZE }, titleStyle]}
          >
            <Text numberOfLines={1} className="font-inter-bold text-subheading leading-tight text-white">
              {meal.name}
            </Text>
            {/* The servings shown (follows the stepper), lighter and smaller. */}
            <Text numberOfLines={1} className="font-inter-regular text-small text-white/80">
              {servings > 1 ? `${servings} Servings` : "Single Serve"}
            </Text>
          </Animated.View>
          {/* After the scroll so it stays on top and tappable. */}
          {topBar}
        </View>
      )}

      {!preview && (
        <View className="border-t border-ink-emphasis/10 px-5 py-4 gap-2">
          {onArchive && (
            <Button
              label="Archive meal"
              variant="outline"
              icon={<Archive color={colors.primary} size={16} />}
              onPress={onArchive}
            />
          )}
          {onDelete && (
            <Pressable
              onPress={onDelete}
              className="flex-row items-center justify-center gap-2 rounded-xl border border-like py-3.5"
            >
              <Trash2 color={colors.like} size={16} />
              <AppText variant="title" className="text-like">
                Delete meal
              </AppText>
            </Pressable>
          )}
          {review && (
            <View className="flex-row gap-3">
              <View className="flex-1">
                <Button label="Reject" variant="outline" onPress={review.onReject} disabled={review.busy} />
              </View>
              <View className="flex-1">
                <Button label={review.busy ? "Approving..." : "Approve"} onPress={review.onApprove} disabled={review.busy} />
              </View>
            </View>
          )}
          {/* Consumer-only actions: admin context has Edit/Archive/Delete
              instead. */}
          {!isAdmin && <ConsumerFooter meal={meal} servings={servings} saved={saved} recipeOwner={recipeOwner} />}
        </View>
      )}
    </Animated.View>
  );
}
