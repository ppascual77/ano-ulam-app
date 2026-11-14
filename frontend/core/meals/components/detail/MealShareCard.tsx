import { useEffect, useRef, useState } from "react";
import { Platform, Share, View, type ViewInstance } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { Image } from "expo-image";
import { Clock3, Flame, Users } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { resolveMealImage } from "../../resolveMealImage";
import type { MealType } from "../../mealTypes";
import { APP_STORE_URL } from "@/frontend/core/app/storeLinks";

// 4:5, the shape that fills a post in most feeds and chats.
const CARD_W = 360;
const CARD_H = 450;
const PHOTO_H = 250;
// Longest wait for the photo before capturing anyway (e.g. offline).
const PHOTO_TIMEOUT_MS = 2500;

export function perServingPrice(meal: MealType): number {
  return Number(meal.price) / Math.max(1, meal.serving_size ?? 1);
}

function Fact({ Icon, label }: { Icon: typeof Clock3; label: string }) {
  return (
    <View className="flex-row items-center gap-1.5">
      <Icon color={colors.ink.subtle} size={14} />
      <Text className="font-inter-medium text-small text-ink-subtle">{label}</Text>
    </View>
  );
}

// The picture a shared meal becomes: its photo, the name, what one serving
// costs ("₱47 per serving", the hook for a budget app), a few facts and the
// AnoUlam mark. Drawn off screen, captured to a PNG, then shared.
function ShareCardView({ meal, onPhotoReady }: { meal: MealType; onPhotoReady: () => void }) {
  const servings = meal.serving_size ?? 1;
  const perServing = Math.round(perServingPrice(meal));
  const kcalPerServing = Math.round(meal.calories / Math.max(1, servings));
  return (
    <View style={{ width: CARD_W, height: CARD_H }} className="overflow-hidden bg-white">
      <Image
        source={resolveMealImage(meal)}
        style={{ width: CARD_W, height: PHOTO_H }}
        contentFit="cover"
        onLoad={onPhotoReady}
        onError={onPhotoReady}
      />
      <View className="flex-1 justify-between px-6 pb-5 pt-4">
        <View>
          <Text numberOfLines={2} className="font-inter-extrabold text-heading tracking-display text-ink-emphasis">
            {meal.name}
            <Text className="text-accent">.</Text>
          </Text>
          <View className="mt-1 flex-row items-baseline gap-1.5">
            <Text className="font-inter-extrabold text-heading text-primary">₱{perServing}</Text>
            <Text className="font-inter-medium text-body text-ink-subtle">per serving</Text>
          </View>
          <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
            <Fact Icon={Flame} label={`${kcalPerServing} kcal`} />
            {meal.prep_time != null && <Fact Icon={Clock3} label={`${meal.prep_time} min`} />}
            <Fact Icon={Users} label={`Serves ${servings}`} />
          </View>
        </View>
        <View className="flex-row items-center gap-2 border-t border-ink-emphasis/10 pt-3">
          <Image source={require("@/assets/icons/logo_clean.png")} style={{ width: 16, height: 22 }} contentFit="contain" />
          <Text className="font-inter-extrabold text-body text-ink-emphasis">
            AnoUlam<Text className="text-accent">.</Text>
          </Text>
          <Text className="ml-auto font-inter-regular text-small text-ink-subtle">What every ulam costs to cook</Text>
        </View>
      </View>
    </View>
  );
}

// Mounted when Share is tapped: renders the card off screen, waits for its
// photo, captures it and opens the share sheet, then reports back (done
// either way; `false` if it couldn't share).
export function MealShareCapture({ meal, onDone }: { meal: MealType; onDone: (shared: boolean) => void }) {
  const ref = useRef<ViewInstance>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setPhotoReady(true), PHOTO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!photoReady || started.current) return;
    started.current = true;
    (async () => {
      try {
        // A frame for the photo to paint after it loads.
        await new Promise((resolve) => setTimeout(resolve, 80));
        // Loaded here, not at the top: expo-sharing throws on import in a
        // build without it (see nativeFeatures.ts).
        const { captureRef } = require("react-native-view-shot") as typeof import("react-native-view-shot");
        const Sharing = require("expo-sharing") as typeof import("expo-sharing");
        const uri = await captureRef(ref, { format: "png", quality: 1, result: "tmpfile" });
        if (Platform.OS === "ios") {
          // iOS: the card and a line with the App Store link, together.
          const message = `${meal.name} on AnoUlam: ₱${Math.round(perServingPrice(meal))} per serving. ${APP_STORE_URL}`;
          await Share.share({ url: uri, message });
          return onDone(true);
        }
        // Android's share sheet takes an image or text, not both: the card.
        // (Add the Play link as text once AnoUlam is on Google Play.)
        if (!(await Sharing.isAvailableAsync())) return onDone(false);
        await Sharing.shareAsync(uri, { mimeType: "image/png", UTI: "public.png", dialogTitle: `Share ${meal.name}` });
        onDone(true);
      } catch {
        onDone(false);
      }
    })();
  }, [photoReady]);

  return (
    // Off screen but laid out, so it can be captured.
    <View pointerEvents="none" style={{ position: "absolute", left: -CARD_W * 3, top: 0 }}>
      <View ref={ref} collapsable={false} style={{ width: CARD_W, height: CARD_H }}>
        <ShareCardView meal={meal} onPhotoReady={() => setPhotoReady(true)} />
      </View>
    </View>
  );
}
