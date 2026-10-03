import { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera } from "lucide-react-native";
import { AppText, Dropdown, SelectField, TextField } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { DIFFICULTIES, NAME_MAX, SERVINGS_MAX, type Difficulty, type RecipeDraft, type StepErrors } from "../types";

// Small uppercase heading above each group of fields. For single-field
// sections (name, description) it's the field's only label.
function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View>
      <Text className="mb-2 font-inter-semibold text-small uppercase tracking-wide text-ink-subtle">{label}</Text>
      {children}
    </View>
  );
}

type DetailsStepProps = {
  draft: RecipeDraft;
  onChange: (patch: Partial<RecipeDraft>) => void;
  errors: StepErrors;
  /** Next-attempt count: invalid fields shake again on each failed Next. */
  shakeKey: number;
};

// Step 1: what the recipe is. Cover photo is optional (as on the web);
// everything else here is required. Tags aren't asked for: they're
// computed from the recipe (see utils/recipeTags.ts). Labels sit outside
// the fields here (labelPosition="outside"), unlike the app's usual
// floating labels, since this form has several short side-by-side fields.
// A missing field gets a red border and a shake rather than red text; the
// only rules left are "required" (name length and the servings cap are
// enforced while typing).
export function DetailsStep({ draft, onChange, errors, shakeKey }: DetailsStepProps) {
  const pickCover = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) onChange({ coverPhotoUri: result.assets[0].uri });
  };

  return (
    <View className="gap-5">
      <Section label="Cover photo">
        <Pressable
          onPress={pickCover}
          className="w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-ink-emphasis/20"
          style={{ aspectRatio: 5 / 2 }}
        >
          {draft.coverPhotoUri ? (
            <Image source={{ uri: draft.coverPhotoUri }} style={{ width: "100%", height: "100%" }} contentFit="cover" />
          ) : (
            <View className="items-center gap-1.5">
              <Camera color={colors.ink.subtle} size={22} />
              <AppText variant="body">Add a cover photo</AppText>
              <Text className="font-inter-regular text-sub text-ink-subtle">Optional · JPG, PNG, WebP</Text>
            </View>
          )}
        </Pressable>
        {draft.coverPhotoUri && (
          <Pressable onPress={pickCover} className="mt-1.5 self-end">
            <AppText variant="caption" className="text-primary">
              Change photo
            </AppText>
          </Pressable>
        )}
      </Section>

      <Section label="Recipe name">
        <TextField
          label=""
          accessibilityLabel="Recipe name"
          labelPosition="outside"
          value={draft.name}
          onChangeText={(name) => onChange({ name })}
          placeholder="e.g. Chicken Adobo"
          maxLength={NAME_MAX}
          error={!!errors.name}
          shakeKey={shakeKey}
        />
        <AppText variant="caption" className="mt-1 self-end">
          {draft.name.length}/{NAME_MAX}
        </AppText>
      </Section>

      <Section label="Description">
        <TextField
          label=""
          accessibilityLabel="Description"
          labelPosition="outside"
          value={draft.description}
          onChangeText={(description) => onChange({ description })}
          placeholder="Describe your recipe: flavor, origin, tips..."
          multiline
          error={!!errors.description}
          shakeKey={shakeKey}
        />
      </Section>

      <Section label="Quick info">
        <View className="flex-row items-start gap-3">
          <View className="flex-1">
            <TextField
              label="Prep Time"
              labelPosition="outside"
              suffix="mins"
              value={draft.prepTime}
              onChangeText={(prepTime) => onChange({ prepTime: prepTime.replace(/[^0-9]/g, "") })}
              placeholder="45"
              keyboardType="number-pad"
              maxLength={3}
              error={!!errors.prepTime}
              shakeKey={shakeKey}
            />
          </View>
          <View className="flex-1">
            <Dropdown
              trigger={
                <SelectField
                  label="Difficulty"
                  labelPosition="outside"
                  valueLabel={DIFFICULTIES.find((d) => d.id === draft.difficulty)?.label ?? ""}
                />
              }
              items={DIFFICULTIES.map((d) => ({ label: d.label, onPress: () => onChange({ difficulty: d.id as Difficulty }) }))}
              matchTriggerWidth
            />
          </View>
          <View className="w-20">
            <TextField
              label="Servings"
              labelPosition="outside"
              value={draft.servings}
              // Capped while typing, so "over the max" never needs an error.
              onChangeText={(text) => {
                const digits = text.replace(/[^0-9]/g, "");
                onChange({ servings: digits && Number(digits) > SERVINGS_MAX ? String(SERVINGS_MAX) : digits });
              }}
              placeholder="4"
              keyboardType="number-pad"
              maxLength={2}
              error={!!errors.servings}
              shakeKey={shakeKey}
            />
          </View>
        </View>
      </Section>
    </View>
  );
}
