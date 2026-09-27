import { useState } from "react";
import { View, Pressable, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Camera, ImageOff, Sparkles, X } from "lucide-react-native";
import { AppText, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { generateMealImage } from "@/api/meals";
import { useUploadMealImage } from "../hooks/useMeals";
import { base64ToTempFile, compressImageForUpload } from "../utils/imageCompression";

const IMAGE_HEIGHT = 200;

type Props = {
  imageUrl: string | null;
  mealId: string;
  mealName: string;
  mealDescription: string | null;
  // The recipe's original photo, captured at import time — reference-only
  // context for the AI generator, never displayed here directly.
  referenceImageUrl?: string | null;
  onImageChange: (url: string) => void;
};

// Camera icon (existing manual pick) and a new Sparkles icon (AI generate)
// sit side by side over the image, same corner treatment as before. AI
// generation never overwrites the current photo directly — it shows a
// local, not-yet-uploaded preview the admin explicitly accepts (Use this
// photo), discards, or regenerates, same "nothing auto-applies" principle
// as this project's other AI features. Both the manual pick and an accepted
// AI photo go through the same compress-then-upload pipeline before
// reaching Storage.
export function MealImageEditor({
  imageUrl,
  mealId,
  mealName,
  mealDescription,
  referenceImageUrl,
  onImageChange,
}: Props) {
  const uploadMealImage = useUploadMealImage();
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  const handlePickImage = async () => {
    setError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError("Photo library access is needed to change the image.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (result.canceled || !result.assets[0]) return;

    try {
      const compressed = await compressImageForUpload(result.assets[0].uri);
      const uploaded = await uploadMealImage.mutateAsync({ localUri: compressed, mealId });
      onImageChange(uploaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setPreviewUri(null);
    try {
      const { imageBase64, mimeType } = await generateMealImage({
        name: mealName,
        description: mealDescription,
        referenceImageUrl,
      });
      const extension = mimeType.includes("png") ? "png" : "jpg";
      const tempFile = await base64ToTempFile(imageBase64, extension);
      setPreviewUri(tempFile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handleAcceptPreview = async () => {
    if (!previewUri) return;
    setApplying(true);
    setError(null);
    try {
      const compressed = await compressImageForUpload(previewUri);
      const uploaded = await uploadMealImage.mutateAsync({ localUri: compressed, mealId });
      onImageChange(uploaded);
      setPreviewUri(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setApplying(false);
    }
  };

  const displayUri = previewUri ?? imageUrl;
  const busy = uploadMealImage.isPending || generating || applying;

  return (
    <View className="mb-6">
      <View className="relative rounded-2xl overflow-hidden">
        {displayUri ? (
          <Image source={{ uri: displayUri }} style={{ width: "100%", height: IMAGE_HEIGHT }} contentFit="cover" />
        ) : (
          <View style={{ height: IMAGE_HEIGHT }} className="items-center justify-center bg-ink-emphasis/5">
            <ImageOff color={colors.ink.subtle} size={28} />
          </View>
        )}

        {generating && (
          <View
            style={{ height: IMAGE_HEIGHT }}
            className="absolute inset-0 items-center justify-center bg-ink-emphasis/40"
          >
            <ActivityIndicator size="small" color={colors.white} />
            <AppText variant="caption" className="text-white mt-2">
              Generating...
            </AppText>
          </View>
        )}

        {!previewUri && !generating && (
          <View className="absolute top-3 right-3 flex-row gap-2">
            <Pressable
              onPress={handlePickImage}
              disabled={busy}
              className={`rounded-full p-2.5 ${busy ? "bg-ink-emphasis/70" : "bg-ink-emphasis/50"}`}
            >
              <Camera color={colors.white} size={16} />
            </Pressable>
            <Pressable
              onPress={handleGenerate}
              disabled={busy}
              className={`rounded-full p-2.5 ${busy ? "bg-ink-emphasis/70" : "bg-ink-emphasis/50"}`}
            >
              <Sparkles color={colors.white} size={16} />
            </Pressable>
          </View>
        )}
      </View>

      {uploadMealImage.isPending && (
        <AppText variant="caption" className="text-ink-subtle mt-2">
          Uploading image...
        </AppText>
      )}
      {error && (
        <AppText variant="caption" className="text-like mt-2">
          {error}
        </AppText>
      )}

      {previewUri && !generating && (
        <View className="flex-row items-center gap-2 mt-3">
          <View className="flex-1">
            <Button label={applying ? "Using..." : "Use this photo"} disabled={applying} onPress={handleAcceptPreview} />
          </View>
          <View className="flex-1">
            <Button label="Regenerate" variant="outline" disabled={applying} onPress={handleGenerate} />
          </View>
          <Pressable
            onPress={() => setPreviewUri(null)}
            disabled={applying}
            className="h-9 w-9 items-center justify-center"
          >
            <X color={colors.ink.subtle} size={18} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
