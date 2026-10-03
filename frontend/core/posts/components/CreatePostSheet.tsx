import { ReactNode, useEffect, useState } from "react";
import { ActivityIndicator, Keyboard, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ImageIcon, Link2, X } from "lucide-react-native";
import { Avatar, BottomSheet } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { FoodPost, PostInput } from "@/frontend/core/posts/mock/posts";
import type { KlipyKind } from "@/api/klipy";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { KlipyPicker } from "./KlipyPicker";

type CreatePostSheetProps = {
  visible: boolean;
  onClose: () => void;
  /** Present = editing that post (prefilled, "Save"); absent = a new post. */
  editPost?: FoodPost | null;
  author: { name: string; avatarUrl: string | null };
  /** Resolves when saved; the sheet shows a spinner until then. */
  onSubmit: (input: PostInput) => Promise<void>;
};

// Photo, GIF and sticker are mutually exclusive: picking one clears the
// others, same as the web app.
type Attachment = { kind: "photo" | "gif" | "sticker"; uri: string } | null;

function ToolbarPill({
  label,
  icon,
  active = false,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${
        active ? "border-brand-green bg-brand-green/10" : "border-web-divider"
      }`}
    >
      {icon}
      <Text className={`font-inter-semibold text-small ${active ? "text-brand-green" : "text-web-ink-soft"}`}>
        {label}
      </Text>
    </Pressable>
  );
}

// A link worth previewing: something with a dot in it, like "example.com".
const looksLikeLink = (value: string) => /\S+\.\S+/.test(value.trim());

// New-post composer (and editor, for your own posts). Caption plus at most
// one attachment among photo / GIF / sticker, with an optional link. Can
// post once there's a caption or any attachment.
export function CreatePostSheet({ visible, onClose, editPost, author, onSubmit }: CreatePostSheetProps) {
  const [caption, setCaption] = useState("");
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState("");
  const [attachment, setAttachment] = useState<Attachment>(null);
  // Which Klipy picker is open inline, if any.
  const [picker, setPicker] = useState<KlipyKind | null>(null);
  const [posting, setPosting] = useState(false);

  // Space under the toolbar that tracks the keyboard, so the Link / Photo /
  // GIF / STK row rides right on top of it (like Facebook's composer).
  // Built on RN's own keyboard events: react-native-keyboard-controller
  // would be smoother but needs native code Expo Go doesn't ship. iOS only:
  // on Android the system already resizes the window for the keyboard, so a
  // spacer there would double the offset.
  const insets = useSafeAreaInsets();
  const keyboardSpace = useSharedValue(0);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    const show = Keyboard.addListener("keyboardWillShow", (e) => {
      // The sheet already pads the home-indicator area at its bottom.
      keyboardSpace.value = withTiming(Math.max(0, e.endCoordinates.height - insets.bottom), {
        duration: e.duration || 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const hide = Keyboard.addListener("keyboardWillHide", (e) => {
      keyboardSpace.value = withTiming(0, { duration: e.duration || 250, easing: Easing.out(Easing.cubic) });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [insets.bottom, keyboardSpace]);
  const keyboardSpacerStyle = useAnimatedStyle(() => ({ height: keyboardSpace.value }));

  // Fresh form each time it opens, prefilled when editing.
  useEffect(() => {
    if (!visible) return;
    setCaption(editPost?.caption ?? "");
    setLink(editPost?.link_url ?? "");
    setLinkOpen(!!editPost?.link_url);
    setAttachment(
      editPost?.image_url
        ? { kind: "photo", uri: editPost.image_url }
        : editPost?.gif_url
          ? { kind: "gif", uri: editPost.gif_url }
          : editPost?.sticker_url
            ? { kind: "sticker", uri: editPost.sticker_url }
            : null,
    );
    setPicker(null);
    setPosting(false);
  }, [visible, editPost]);

  const hasLink = linkOpen && looksLikeLink(link);
  const canPost = !posting && (caption.trim().length > 0 || !!attachment || hasLink);

  const pickPhoto = async () => {
    setPicker(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    setAttachment({ kind: "photo", uri: result.assets[0].uri });
  };

  const togglePicker = (kind: KlipyKind) => {
    // Out of the caption so the picker's grid isn't hidden behind the keyboard.
    Keyboard.dismiss();
    setPicker((open) => (open === kind ? null : kind));
  };

  const submit = async () => {
    if (!canPost) return;
    setPosting(true);
    try {
      await onSubmit({
        caption,
        image_uri: attachment?.kind === "photo" ? attachment.uri : null,
        gif_url: attachment?.kind === "gif" ? attachment.uri : null,
        sticker_url: attachment?.kind === "sticker" ? attachment.uri : null,
        link_url: hasLink ? link.trim() : null,
      });
    } finally {
      setPosting(false);
    }
  };

  const removeAttachmentButton = (
    <Pressable
      onPress={() => setAttachment(null)}
      accessibilityLabel="Remove attachment"
      className="absolute right-2 top-2 h-8 w-8 items-center justify-center rounded-full bg-web-ink/70"
    >
      <X color={colors.white} size={16} />
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.9}>
      <View className="flex-1 px-5 pt-10">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={onClose}
            accessibilityLabel="Close"
            className="h-8 w-8 items-center justify-center rounded-full bg-web-divider"
          >
            <X color={colors.webInk.soft} size={16} />
          </Pressable>
          <Text className="font-inter-bold text-body text-web-ink">{editPost ? "Edit Post" : "New Post"}</Text>
          <Pressable onPress={submit} disabled={!canPost} className={canPost ? "" : "opacity-40"}>
            {posting ? (
              <ActivityIndicator color={colors.brandGreen.DEFAULT} />
            ) : (
              <Text className="font-inter-bold text-body text-brand-green">{editPost ? "Save" : "Post"}</Text>
            )}
          </Pressable>
        </View>

        {/* Caption + link + attachment previews scroll above the toolbar,
            so they stay reachable when the keyboard or a picker takes space. */}
        <ScrollView className="flex-1" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View className="mt-5 flex-row gap-3">
            <Avatar name={author.name} imageUri={author.avatarUrl ?? undefined} size={40} />
            <TextInput
              value={caption}
              onChangeText={setCaption}
              placeholder="What did you eat?"
              placeholderTextColor={colors.webInk.muted}
              multiline
              autoFocus
              // Typing again closes a GIF/sticker picker: the keyboard takes
              // its place under the toolbar.
              onFocus={() => setPicker(null)}
              className="flex-1 pt-2 font-inter-regular text-body text-web-ink"
            />
          </View>

          {linkOpen && (
            <View className="mt-4 gap-2">
              <TextInput
                value={link}
                onChangeText={setLink}
                placeholder="Paste a link…"
                placeholderTextColor={colors.webInk.muted}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                className="rounded-xl border border-web-divider px-3 py-2.5 font-inter-regular text-body text-web-ink"
              />
              {hasLink && (
                <LinkPreviewCard
                  url={link.trim().startsWith("http") ? link.trim() : `https://${link.trim()}`}
                  title={link.trim().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0]}
                  description={null}
                  image={null}
                />
              )}
            </View>
          )}

          {attachment?.kind === "photo" && (
            <View className="mt-4 overflow-hidden rounded-2xl" style={{ aspectRatio: 16 / 9 }}>
              <Image source={{ uri: attachment.uri }} style={{ flex: 1 }} contentFit="cover" />
              {removeAttachmentButton}
            </View>
          )}
          {attachment?.kind === "gif" && (
            <View className="mt-4 overflow-hidden rounded-2xl" style={{ aspectRatio: 4 / 3 }}>
              <Image source={{ uri: attachment.uri }} style={{ flex: 1 }} contentFit="cover" />
              {removeAttachmentButton}
            </View>
          )}
          {attachment?.kind === "sticker" && (
            <View className="mt-4 h-32 w-32 self-center">
              <Image source={{ uri: attachment.uri }} style={{ flex: 1 }} contentFit="contain" />
              {removeAttachmentButton}
            </View>
          )}

        </ScrollView>

        {/* Toolbar: sits on top of the keyboard while it's open, otherwise
            at the bottom of the sheet (with a picker under it, if open). */}
        <View className="flex-row flex-wrap gap-2 border-t border-web-divider py-2">
          <ToolbarPill
            label="Link"
            icon={<Link2 color={linkOpen ? colors.brandGreen.DEFAULT : colors.webInk.soft} size={14} />}
            active={linkOpen}
            onPress={() => {
              if (linkOpen) setLink("");
              setLinkOpen((open) => !open);
            }}
          />
          <ToolbarPill
            label="Photo"
            icon={
              <ImageIcon color={attachment?.kind === "photo" ? colors.brandGreen.DEFAULT : colors.webInk.soft} size={14} />
            }
            active={attachment?.kind === "photo"}
            onPress={pickPhoto}
          />
          <ToolbarPill
            label="GIF"
            active={picker === "gifs" || attachment?.kind === "gif"}
            onPress={() => togglePicker("gifs")}
          />
          <ToolbarPill
            label="STK"
            active={picker === "stickers" || attachment?.kind === "sticker"}
            onPress={() => togglePicker("stickers")}
          />
        </View>

        {picker && (
          <KlipyPicker
            key={picker}
            kind={picker}
            onSelect={(item) => {
              setAttachment({ kind: picker === "gifs" ? "gif" : "sticker", uri: item.url });
              setPicker(null);
            }}
          />
        )}

        <Animated.View style={keyboardSpacerStyle} />
      </View>
    </BottomSheet>
  );
}
