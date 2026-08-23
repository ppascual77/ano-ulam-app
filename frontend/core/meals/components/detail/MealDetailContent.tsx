import { ReactNode, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import Animated, {
  FadeIn,
  FadeOut,
  LinearTransition,
  SlideInLeft,
  SlideInRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import {
  Bookmark,
  Heart,
  ShieldCheck,
  Store,
  Clock3,
  Flame,
  ChefHat,
  Minus,
  Plus,
  User2,
  Users,
  Leaf,
  Info,
  ChevronDown,
  ArrowLeft,
} from "lucide-react-native";
import { AppText, Button, Chips, NoticeBanner, Toggle } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MealInfoPill } from "../MealInfoPill";
import { MacroSection } from "./MacroSection";
import { IngredientDetailPanel } from "./IngredientDetailPanel";
import { RelatedMeals } from "./RelatedMeals";
import { resolveMealImage } from "../../resolveMealImage";
import { multiplyQty } from "../../utils/multiplyQty";
import { DIETARY_ICONS, capitalize } from "../../utils/dietary";
import type { IngredientType, MealType } from "../../mealTypes";

// A pantry item counts as having a detail worth expanding only if it's
// cooking oil with known calories — most pantry items (salt, pepper) don't.
function isOilWithCalories(item: IngredientType) {
  return item.type === "pantry" && /oil/i.test(item.name) && item.calories != null;
}

function orderIngredients(ingredients: IngredientType[]) {
  const main = ingredients.filter((it) => it.type === "main");
  const oils = ingredients.filter(isOilWithCalories);
  const rest = ingredients.filter((it) => it.type === "pantry" && !isOilWithCalories(it));
  return [...main, ...oils, ...rest];
}

type IngredientRowProps = {
  ingredient: IngredientType;
  scale: number;
  showDetails: boolean;
  isLast: boolean;
};

function IngredientRow({ ingredient, scale, showDetails, isLast }: IngredientRowProps) {
  const isMain = ingredient.type === "main";
  const hasDetail = (isMain || isOilWithCalories(ingredient)) && ingredient.calories != null;
  const interactive = showDetails && hasDetail;

  const [expanded, setExpanded] = useState(false);

  // Follow "Show details": turning it on expands immediately, turning it
  // off collapses immediately. A row can still be tapped individually
  // afterward without waiting for the next toggle flip.
  useEffect(() => {
    setExpanded(showDetails);
  }, [showDetails]);

  const rotation = useSharedValue(0);
  useEffect(() => {
    rotation.value = withTiming(expanded ? 180 : 0, { duration: 200 });
  }, [expanded, rotation]);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const rowClassName = `px-4 py-4 ${!isLast ? "border-b border-ink-emphasis/10" : ""}`;

  const content = (
    <>
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
          <AppText variant="caption">{multiplyQty(ingredient.qty, scale)}</AppText>
          {showDetails &&
            isMain &&
            (ingredient.price != null && ingredient.price > 0 ? (
              <AppText variant="caption" className="font-inter-semibold text-primary">
                ~₱{Math.round(ingredient.price * scale)}
              </AppText>
            ) : (
              <View className="flex-row items-center gap-0.5">
                <Info color={colors.ink.subtle} size={9} />
                <Text className="text-sub text-ink-subtle">N/A</Text>
              </View>
            ))}
          {showDetails && hasDetail && (
            <Animated.View style={chevronStyle}>
              <ChevronDown color={colors.ink.subtle} size={14} />
            </Animated.View>
          )}
        </View>
      </View>

      {hasDetail && expanded && (
        <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(120)}>
          <IngredientDetailPanel item={ingredient} />
        </Animated.View>
      )}
    </>
  );

  return (
    <Animated.View layout={LinearTransition.duration(200)} className={rowClassName}>
      {interactive ? <Pressable onPress={() => setExpanded((prev) => !prev)}>{content}</Pressable> : content}
    </Animated.View>
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
};

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
}: MealDetailContentProps) {
  const [isLiked, setIsLiked] = useState(meal.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(meal.like_count ?? 0);
  const [servings, setServings] = useState(meal.serving_size ?? 1);
  const [showDetails, setShowDetails] = useState(false);

  const toggleLike = () => {
    setIsLiked((prev) => !prev);
    setLikeCount((prev) => (isLiked ? prev - 1 : prev + 1));
  };

  const scale = servings / (meal.serving_size ?? 1);
  const displayCalories = Math.round(meal.calories * scale);
  const displayProtein = Math.round(meal.protein * scale);
  const displayCarbs = Math.round(meal.carbs * scale);
  const displayFats = parseFloat((meal.fats * scale).toFixed(1));
  const displayPrice = Math.round(Number(meal.price) * scale);
  const displayBufferPrice = meal.buffer_price
    ? Math.round(meal.buffer_price * scale)
    : null;

  const isFastFood = meal.category === "fast_food";

  return (
    <Animated.View
      entering={
        direction === "forward" ? SlideInLeft.duration(250) : direction === "back" ? SlideInRight.duration(250) : undefined
      }
      className="flex-1"
    >
      <ScrollView showsVerticalScrollIndicator={false}>
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
                className="h-9 w-9 items-center justify-center rounded-full bg-primary/90"
              >
                <ArrowLeft color={colors.white} size={18} />
              </Pressable>
            </View>
          )}

          {meal.status === "approved" && (
            <View className="absolute right-4 top-4">
              <Chips
                label="Published"
                icon={
                  <ShieldCheck color={colors.white} size={10} strokeWidth={2} />
                }
              />
            </View>
          )}

          <View className="absolute bottom-3 right-3">
            <Pressable onPress={toggleLike} className="items-center gap-0.5">
              <View
                className={`h-9 w-9 items-center justify-center rounded-full border ${
                  isLiked
                    ? "border-like bg-like"
                    : "border-white/20 bg-white/15"
                }`}
              >
                <Heart
                  color={colors.white}
                  size={16}
                  fill={isLiked ? colors.white : "none"}
                />
              </View>
              <Text
                className={`text-[10px] font-semibold leading-none text-white ${
                  likeCount > 0 ? "opacity-100" : "opacity-0"
                }`}
              >
                {likeCount}
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
                ₱{displayPrice}
                {displayBufferPrice ? ` – ₱${displayBufferPrice}` : ""}
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
                <Toggle checked={showDetails} onChange={setShowDetails} label="Show details" />
              </View>

              <View className="my-3">
                <NoticeBanner icon={<Info color={colors.notice.icon} size={15} />}>
                  <AppText variant="caption" className="text-notice-text">
                    Prices shown are for the exact quantities used in this recipe. Some items may only be available
                    as a whole unit, so your actual spend may be higher.
                  </AppText>
                </NoticeBanner>
              </View>

              <Animated.View layout={LinearTransition.duration(200)} className="mt-2 rounded-2xl border border-ink-emphasis/10">
                {orderIngredients(meal.ingredients).map((ingredient, i, ordered) => (
                  <IngredientRow
                    key={i}
                    ingredient={ingredient}
                    scale={scale}
                    showDetails={showDetails}
                    isLast={i === ordered.length - 1}
                  />
                ))}
              </Animated.View>
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

          <View className="mb-6">
            <RelatedMeals meal={meal} onSelectMeal={onSelectMeal} />
          </View>
        </View>
      </ScrollView>

      <View className="border-t border-ink-emphasis/10 px-5 py-4">
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
      </View>
    </Animated.View>
  );
}
