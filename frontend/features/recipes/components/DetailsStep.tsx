import { useState } from "react";
import { Alert, Pressable, Text, TextInput, View } from "react-native";
import Animated, { interpolateColor, useAnimatedStyle } from "react-native-reanimated";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImagePlus } from "lucide-react-native";
import {
  AppText,
  OutsideLabel,
  SegmentedSwitch,
  Stepper,
  TextField,
  useFieldErrorAnimation,
} from "@/frontend/components/ui";
import { StepHeader } from "./StepHeader";
import { colors } from "@/frontend/constants/theme";
import {
  DIFFICULTIES,
  NAME_MAX,
  PREP_TIME_CHIPS,
  SERVINGS_MAX,
  servingsCount,
  type Difficulty,
  type RecipeDraft,
  type StepErrors,
} from "../types";

// The meal card's photo is 250 x 150, so the crop and the frame here are
// both 5:3: what people crop is what the card shows.
const COVER_ASPECT: [number, number] = [5, 3];
// The name counter only shows once you're this close to the limit.
const NAME_COUNTER_FROM = NAME_MAX - 10;

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ["images"],
  quality: 0.8,
  allowsEditing: true,
  aspect: COVER_ASPECT,
};

function PhotoButton({ label, Icon, onPress }: { label: string; Icon: typeof Camera; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-1 flex-row items-center justify-center gap-2 rounded-xl border border-ink-emphasis/15 bg-white py-2.5 active:bg-ink-emphasis/5"
    >
      <Icon color={colors.primary} size={16} />
      <Text className="font-inter-semibold text-body text-ink-emphasis">{label}</Text>
    </Pressable>
  );
}

function CoverPhoto({
  uri,
  onChange,
  error,
  shakeKey,
}: {
  uri: string | null;
  onChange: (uri: string | null) => void;
  /** Missing on Next: red border and a shake, like the other fields. */
  error: boolean;
  shakeKey: number;
}) {
  const { shakeStyle } = useFieldErrorAnimation(error, shakeKey);
  const fromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  };
  const fromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        "Camera is off for AnoUlam",
        "Turn on camera access in Settings, or choose a photo from your library.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync(PICKER_OPTIONS);
    if (!result.canceled && result.assets[0]) onChange(result.assets[0].uri);
  };

  if (uri) {
    return (
      <View>
        <Pressable
          onPress={fromLibrary}
          accessibilityLabel="Change cover photo"
          className="w-full overflow-hidden rounded-2xl"
          style={{ aspectRatio: COVER_ASPECT[0] / COVER_ASPECT[1] }}
        >
          {/* A restored draft's photo can be gone (the picker's cache was
              cleared): drop it rather than show an empty frame. */}
          <Image
            source={{ uri }}
            style={{ width: "100%", height: "100%" }}
            contentFit="cover"
            onError={() => onChange(null)}
          />
        </Pressable>
        <View className="mt-2 flex-row justify-end gap-4">
          <Pressable onPress={fromCamera} hitSlop={6}>
            <AppText variant="caption" className="font-inter-semibold text-primary">
              Retake
            </AppText>
          </Pressable>
          <Pressable onPress={fromLibrary} hitSlop={6}>
            <AppText variant="caption" className="font-inter-semibold text-primary">
              Change photo
            </AppText>
          </Pressable>
        </View>
      </View>
    );
  }

  // Empty: a tile at the card's shape, saying why it's needed, with both
  // ways to get a photo.
  return (
    <Animated.View style={shakeStyle}>
      <View
        className={`w-full items-center justify-center gap-4 rounded-2xl border border-dashed bg-ink-emphasis/5 px-5 ${
          error ? "border-like" : "border-ink-emphasis/20"
        }`}
        style={{ aspectRatio: COVER_ASPECT[0] / COVER_ASPECT[1] }}
      >
        <View className="items-center gap-1">
          <View className="mb-1 h-11 w-11 items-center justify-center rounded-full bg-primary/10">
            <ImagePlus color={colors.primary} size={20} />
          </View>
          <AppText variant="title">Add a cover photo</AppText>
          <Text className={`text-center font-inter-regular text-small ${error ? "text-like" : "text-ink-subtle"}`}>
            Required: it&apos;s the first thing people see
          </Text>
        </View>
        <View className="w-full flex-row gap-2">
          <PhotoButton label="Take photo" Icon={Camera} onPress={() => void fromCamera()} />
          <PhotoButton label="Library" Icon={ImagePlus} onPress={() => void fromLibrary()} />
        </View>
      </View>
    </Animated.View>
  );
}

// Unfocused field border (TextField's), faded to red on a missing value.
const CELL_BORDER = "rgba(43, 52, 55, 0.1)";
const CELL = "h-12 items-center justify-center rounded-xl border";

// Prep time as one row of equal cells: the common times, then Custom, which
// turns into the minutes field itself (no second field to fill). A typed
// time that isn't one of the presets opens in Custom.
function PrepTimePicker({
  value,
  onChange,
  error,
  shakeKey,
}: {
  value: string;
  onChange: (prepTime: string) => void;
  error: boolean;
  shakeKey: number;
}) {
  const isPreset = PREP_TIME_CHIPS.some((m) => String(m) === value);
  const [custom, setCustom] = useState(!!value && !isPreset);
  const { errorProgress, shakeStyle } = useFieldErrorAnimation(error, shakeKey);
  const borderStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(errorProgress.value, [0, 1], [CELL_BORDER, colors.like]),
  }));

  return (
    <Animated.View style={shakeStyle}>
      <OutsideLabel>Prep time (minutes)</OutsideLabel>
      <View className="flex-row gap-1.5" accessibilityRole="radiogroup">
        {PREP_TIME_CHIPS.map((minutes) => {
          const selected = !custom && value === String(minutes);
          return (
            <Pressable
              key={minutes}
              onPress={() => {
                setCustom(false);
                onChange(String(minutes));
              }}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${minutes} minutes`}
              className="flex-1"
            >
              <Animated.View
                style={selected ? undefined : borderStyle}
                className={`${CELL} ${selected ? "border-primary bg-primary" : "bg-white"}`}
              >
                <Text className={`font-inter-semibold text-body ${selected ? "text-white" : "text-ink-emphasis"}`}>
                  {minutes}
                </Text>
              </Animated.View>
            </Pressable>
          );
        })}
        {custom ? (
          <View className={`${CELL} flex-[1.8] flex-row border-primary bg-white px-2`}>
            <TextInput
              value={value}
              onChangeText={(text) => onChange(text.replace(/[^0-9]/g, ""))}
              autoFocus
              keyboardType="number-pad"
              maxLength={3}
              placeholder="0"
              placeholderTextColor={colors.ink.placeholder}
              accessibilityLabel="Prep time in minutes"
              className="min-w-6 text-center font-inter-semibold text-body text-ink-emphasis"
              style={{ padding: 0 }}
            />
            <Text className="ml-1 font-inter-regular text-small text-ink-subtle">min</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              setCustom(true);
              onChange("");
            }}
            accessibilityRole="radio"
            accessibilityState={{ selected: false }}
            accessibilityLabel="Custom prep time"
            className="flex-[1.8]"
          >
            <Animated.View style={borderStyle} className={`${CELL} bg-white`}>
              <Text className="font-inter-semibold text-body text-ink-emphasis">Custom</Text>
            </Animated.View>
          </Pressable>
        )}
      </View>
    </Animated.View>
  );
}

type DetailsStepProps = {
  draft: RecipeDraft;
  onChange: (patch: Partial<RecipeDraft>) => void;
  errors: StepErrors;
  /** Next-attempt count: invalid fields shake again on each failed Next. */
  shakeKey: number;
};

// Step 1: what the recipe is. One level of labels (the field's own), and
// taps over typing wherever the answer is one of a few: difficulty is a
// switch, servings a stepper, prep time a row of presets plus Custom.
// Everything is required, the cover photo included (every meal card and page
// leads with it). Tags aren't asked for: they're computed from the recipe
// (see utils/recipeTags.ts). A missing field gets a red border and a shake.
export function DetailsStep({ draft, onChange, errors, shakeKey }: DetailsStepProps) {
  return (
    <View className="gap-6">
      <StepHeader title="The basics" subtitle="What it is, how long it takes and how many it feeds." />

      <CoverPhoto
        uri={draft.coverPhotoUri}
        onChange={(coverPhotoUri) => onChange({ coverPhotoUri })}
        error={!!errors.coverPhoto}
        shakeKey={shakeKey}
      />

      <View>
        <TextField
          label="Recipe name"
          labelPosition="outside"
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="e.g. Chicken Adobo"
          maxLength={NAME_MAX}
          error={!!errors.name}
          shakeKey={shakeKey}
        />
        {draft.name.length >= NAME_COUNTER_FROM && (
          <AppText variant="caption" className={`mt-1 self-end ${draft.name.length >= NAME_MAX ? "text-like" : ""}`}>
            {draft.name.length}/{NAME_MAX}
          </AppText>
        )}
      </View>

      <TextField
        label="Description"
        labelPosition="outside"
        value={draft.description}
        onChangeText={(description) => onChange({ description })}
        placeholder="Flavor, where it's from, your tips..."
        multiline
        error={!!errors.description}
        shakeKey={shakeKey}
      />

      <PrepTimePicker
        value={draft.prepTime}
        onChange={(prepTime) => onChange({ prepTime })}
        error={!!errors.prepTime}
        shakeKey={shakeKey}
      />

      {/* Side by side, label above each, like the fields above them. */}
      <View className="flex-row gap-4">
        <View className="flex-1">
          <OutsideLabel>Difficulty</OutsideLabel>
          <View className="h-12 justify-center">
            <SegmentedSwitch
              options={DIFFICULTIES.map((d) => ({ value: d.id, label: d.label }))}
              value={draft.difficulty}
              onChange={(difficulty: Difficulty) => onChange({ difficulty })}
            />
          </View>
        </View>
        <View>
          <OutsideLabel>Servings</OutsideLabel>
          <View className="h-12 justify-center">
            <Stepper
              value={servingsCount(draft)}
              onChange={(n) => onChange({ servings: String(n) })}
              min={1}
              max={SERVINGS_MAX}
              decrementLabel="Fewer servings"
              incrementLabel="More servings"
            />
          </View>
        </View>
      </View>
    </View>
  );
}
