import { useEffect, useState } from "react";
import { FlatList, Pressable, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import { useQuery } from "@tanstack/react-query";
import { Search, X } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";
import { fetchKlipy, type KlipyItem, type KlipyKind } from "@/api/klipy";

const SEARCH_DEBOUNCE_MS = 500;
const GRID_HEIGHT = 240;

const LABELS: Record<KlipyKind, { placeholder: string; empty: string }> = {
  gifs: { placeholder: "Search GIFs…", empty: "No GIFs found" },
  stickers: { placeholder: "Search stickers…", empty: "No stickers found" },
};

type KlipyPickerProps = {
  kind: KlipyKind;
  onSelect: (item: KlipyItem) => void;
};

// Inline GIF/sticker picker for the post composer (rendered inside it, not
// as its own sheet, so there's never a second Modal). Trending on open,
// search as you type. Port of the web app's KlipyGifPicker/StickerPicker.
export function KlipyPicker({ kind, onSelect }: KlipyPickerProps) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["klipy", kind, debouncedQuery.trim()],
    queryFn: () => fetchKlipy(kind, debouncedQuery),
    staleTime: 5 * 60 * 1000,
  });
  const items = data ?? [];

  return (
    <View className="pb-1">
      <View className="flex-row items-center gap-2 rounded-xl bg-web-divider px-3 py-2">
        <Search color={colors.webInk.muted} size={14} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={LABELS[kind].placeholder}
          placeholderTextColor={colors.webInk.muted}
          autoCorrect={false}
          className="flex-1 font-inter-regular text-body text-web-ink"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8} accessibilityLabel="Clear search">
            <X color={colors.webInk.muted} size={14} />
          </Pressable>
        )}
      </View>

      <View className="mt-2" style={{ height: GRID_HEIGHT }}>
        {isLoading ? (
          <View className="flex-row flex-wrap gap-1">
            {Array.from({ length: 9 }).map((_, i) => (
              <View key={i} className="rounded-lg bg-web-divider" style={{ width: "32.6%", aspectRatio: 1 }} />
            ))}
          </View>
        ) : isError || items.length === 0 ? (
          <View className="flex-1 items-center justify-center">
            <Text className="font-inter-regular text-body text-web-ink-muted">
              {isError ? "Couldn't load. Try again." : LABELS[kind].empty}
            </Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.slug}
            numColumns={3}
            columnWrapperStyle={{ gap: 4 }}
            contentContainerStyle={{ gap: 4 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <Pressable
                onPress={() => onSelect(item)}
                className="flex-1 overflow-hidden rounded-lg bg-web-divider active:opacity-70"
                style={{ aspectRatio: 1, maxWidth: "33%" }}
              >
                <Image
                  source={{ uri: item.previewUrl }}
                  style={{ flex: 1 }}
                  contentFit={kind === "stickers" ? "contain" : "cover"}
                  accessibilityLabel={item.title}
                />
              </Pressable>
            )}
          />
        )}
      </View>

      {/* Attribution: required by Klipy (same as the web app). */}
      <Text className="mt-1.5 self-end font-inter-medium text-sub uppercase tracking-wide text-web-ink-muted">
        Powered by KLIPY
      </Text>
    </View>
  );
}
