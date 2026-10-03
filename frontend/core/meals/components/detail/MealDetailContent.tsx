import { ReactNode, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, { SlideInLeft, SlideInRight } from "react-native-reanimated";
import {
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
  ChevronRight,
  ArrowLeft,
  Trash2,
} from "lucide-react-native";
import { AppText, Button, Card, Chips, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealInfoPill } from "../MealInfoPill";
import { MacroSection } from "./MacroSection";
import { RelatedMeals } from "./RelatedMeals";
import { resolveMealImage } from "../../resolveMealImage";
import { formatCount, multiplyQty } from "../../utils/multiplyQty";
import { DIETARY_ICONS, capitalize } from "../../utils/dietary";
import type { IngredientType, MealType } from "../../mealTypes";

// Small circular icon buttons (back/edit/like) and the servings +/- steppers
// are visually ~32-36px, under the ~44pt minimum recommended touch target —
// this was reported as taps "intermittently" not registering, which is
// exactly what a target that size feels like rather than an actual bug.
// hitSlop extends the tappable area without changing how the button looks.
const ICON_HIT_SLOP = { top: 10, bottom: 10, left: 10, right: 10 };

function orderIngredients(ingredients: IngredientType[]) {
  const main = ingredients.filter((it) => it.type === "main");
  const oils = ingredients.filter((it) => it.type === "pantry" && /oil/i.test(it.name));
  const rest = ingredients.filter((it) => it.type === "pantry" && !/oil/i.test(it.name));
  return [...main, ...oils, ...rest];
}

// The ingredient as it should read at the current servings: quantity,
// price and macros all multiplied by `scale`. Built once here so the card
// and the detail sheet it opens can't disagree (the old inline panel once
// showed unscaled macros next to a scaled price).
function scaleIngredient(ingredient: IngredientType, scale: number): IngredientType {
  return {
    ...ingredient,
    // A generated count re-pluralizes ("1 clove" -> "2 cloves"); free-text
    // quantities only get their leading number scaled.
    qty: ingredient.count
      ? formatCount(ingredient.count.amount * scale, ingredient.count.label)
      : multiplyQty(ingredient.qty, scale),
    price: ingredient.price != null ? ingredient.price * scale : ingredient.price,
    calories: ingredient.calories != null ? ingredient.calories * scale : undefined,
    protein: ingredient.protein != null ? ingredient.protein * scale : undefined,
    carbs: ingredient.carbs != null ? ingredient.carbs * scale : undefined,
    fats: ingredient.fats != null ? ingredient.fats * scale : undefined,
  };
}

type IngredientRowProps = {
  /** Already scaled (see scaleIngredient). */
  ingredient: IngredientType;
  /** Omitted when there's nothing to show in the detail sheet. */
  onPress?: () => void;
};

function IngredientRow({ ingredient, onPress }: IngredientRowProps) {
  const isMain = ingredient.type === "main";

  const content = (
    <View className="flex-row items-center justify-between">
      <View className="flex-1 flex-row flex-wrap items-center gap-1.5 pr-2">
        <AppText variant="caption">{capitalize(ingredient.name)}</AppText>
        <View className={`rounded-full px-2 py-2 ${isMain ? "bg-primary/10" : "bg-ink-emphasis/5"}`}>
          <Text className={`font-inter-semibold text-sub ${isMain ? "text-primary" : "text-ink-subtle"}`}>
            {isMain ? "Main" : "Pantry"}
          </Text>
        </View>
      </View>

      <View className="flex-row items-center gap-2">
        {/* Quantity stacked above price, right-aligned, so the two don't
            compete for width on one line. */}
        <View className="items-end">
          <AppText variant="caption">{ingredient.qty}</AppText>
          {/* Every ingredient counts toward the meal's price now, pantry
              included, so every card shows its share. */}
          {ingredient.price != null && ingredient.price > 0 ? (
            <AppText variant="caption" className="font-inter-semibold text-primary">
              ~₱{ingredient.price.toFixed(2)}
            </AppText>
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
  isSaved?: boolean;
  onSave?: () => void;
  onSelectMeal?: (meal: MealType) => void;
  /** Present only when this meal was reached via "related meals" — lets the
   *  user return to whatever they originally opened. */
  onBack?: () => void;
  /** "forward" (picked a related meal) slides in from the left; "back"
   *  slides in from the right; "none" (initial open) plays no slide —
   *  BottomSheet's own slide-up already covers that. Defaults to "none". */
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

function ScrollBody({ children }: { children: ReactNode }) {
  return <ScrollView showsVerticalScrollIndicator={false}>{children}</ScrollView>;
}

function PlainBody({ children }: { children: ReactNode }) {
  return <View>{children}</View>;
}

// The scrollable body rendered inside a BottomSheet (see MealDetailSheet).
// No backend yet — like/save are local UI state; servings scaling is pure
// math, no rice add-on / pantry-match / price-drop tracking (those need
// data this app doesn't have).
export function MealDetailContent({
  meal,
  isSaved = false,
  onSave,
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
  const Body = preview ? PlainBody : ScrollBody;
  const [isLiked, setIsLiked] = useState(meal.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(meal.like_count ?? 0);
  const [servings, setServings] = useState(meal.serving_size ?? 1);

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
  const displayPrice = Number((Number(meal.price) * scale).toFixed(2));
  const displayBufferPrice = meal.buffer_price
    ? Number((meal.buffer_price * scale).toFixed(2))
    : null;

  const isFastFood = meal.category === "fast_food";

  return (
    <Animated.View
      entering={
        direction === "forward" ? SlideInLeft.duration(250) : direction === "back" ? SlideInRight.duration(250) : undefined
      }
      className={preview ? "" : "flex-1"}
    >
      <Body>
        <View className="relative">
          <Image
            source={resolveMealImage(meal)}
            style={{ width: "100%", height: 220 }}
            contentFit="cover"
          />

          {onBack && (
            <View className="absolute left-4 top-4">
              <Pressable
                onPress={onBack}
                hitSlop={ICON_HIT_SLOP}
                className="h-9 w-9 items-center justify-center rounded-full bg-primary/90"
              >
                <ArrowLeft color={colors.white} size={18} />
              </Pressable>
            </View>
          )}

          {/* Consumer-only affordance — in admin context (onEdit present)
              this sat at the exact same top-right spot as the Edit button
              below, overlapping it whenever a meal was already published
              (the normal case for anything reaching Manage Meals), which is
              what made Edit intermittently untappable. */}
          {meal.status === "approved" && !isAdmin && (
            <View className="absolute right-4 top-4">
              <Chips
                label="Published"
                icon={
                  <ShieldCheck color={colors.white} size={10} strokeWidth={2} />
                }
              />
            </View>
          )}

          {onEdit && (
            <View className="absolute right-4 top-4">
              <Pressable
                onPress={onEdit}
                hitSlop={ICON_HIT_SLOP}
                className="h-9 w-9 items-center justify-center rounded-full bg-ink-emphasis/50"
              >
                <Pencil color={colors.white} size={16} />
              </Pressable>
            </View>
          )}

          <View className="absolute bottom-3 right-3">
            <Pressable onPress={toggleLike} hitSlop={ICON_HIT_SLOP} className="items-center gap-0.5">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full border ${
                  liked
                    ? "border-like bg-like"
                    : "border-white/20 bg-white/15"
                }`}
              >
                <Heart
                  color={colors.white}
                  size={16}
                  fill={liked ? colors.white : "none"}
                />
              </View>
              <Text
                className={`text-[10px] font-semibold leading-none text-white ${
                  shownLikeCount > 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                {shownLikeCount}
              </Text>
            </Pressable>
          </View>
        </View>

        <View className="px-6 pt-4">
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <AppText variant="title">{meal.name}</AppText>

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
              <AppText
                variant="title"
                className="font-inter-semibold text-primary"
              >
                ₱{displayPrice.toFixed(2)}
                {displayBufferPrice ? ` – ₱${displayBufferPrice.toFixed(2)}` : ""}
              </AppText>
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

          <View className="mt-3 flex-row flex-wrap items-center gap-1.5">
            {meal.dietary_tags?.map((tag) => {
              const Icon = DIETARY_ICONS[tag] ?? Leaf;
              return (
                <View
                  key={tag}
                  className="flex-row items-center gap-1 rounded-full bg-primary/10 px-2 py-2"
                >
                  <Icon color={colors.primary} size={11} />
                  <Text className="font-inter-medium text-caption text-primary">
                    {capitalize(tag)}
                  </Text>
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
          </View>

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
            <AppText variant="title">Macros</AppText>
            <View className="mt-2 rounded-2xl border border-ink-emphasis/10 p-3">
              <MacroSection
                calories={displayCalories}
                protein={displayProtein}
                carbs={displayCarbs}
                fats={displayFats}
              />
            </View>
          </View>

          {meal.ingredients && meal.ingredients.length > 0 && (
            <View className="mt-5">
              <View className="flex-row items-center justify-between">
                <AppText variant="title">Ingredients</AppText>
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
              <AppText variant="title">Steps</AppText>
              <View className="mt-2 rounded-2xl border border-ink-emphasis/10 px-4 py-3">
                {meal.procedure.map((step, i) => (
                  <View key={i} className="flex-row items-center gap-3 px-1 py-3">
                    <AppText variant="heading" className="text-primary mr-3">
                      {i + 1}
                    </AppText>
                    <AppText variant="caption" className="flex-1 leading-5">
                      {step}
                    </AppText>
                  </View>
                ))}
              </View>
            </View>
          )}

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
        </View>
      </Body>

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
          {/* Consumer-only action — admin context has Edit/Archive/Delete
              instead, and there's no consumer "saved list" concept of this
              meal from the admin's own account. */}
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
          {!isAdmin && (
            <Button
              label={isSaved ? "Unsave" : "Save Meal"}
              variant={isSaved ? "primary" : "outline"}
              icon={
                <Bookmark
                  color={isSaved ? colors.white : colors.primary}
                  size={16}
                  fill={isSaved ? colors.white : "none"}
                />
              }
              iconPosition="right"
              onPress={onSave}
            />
          )}
        </View>
      )}
    </Animated.View>
  );
}
