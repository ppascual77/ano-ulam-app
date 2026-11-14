import { ReactNode, useEffect, useState } from "react";
import { Keyboard, Platform, Pressable, ScrollView, View } from "react-native";
import { Text, TextInput } from "@/frontend/components/ui/Text";
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  LinearTransition,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Check, Gift, ImageIcon, X } from "lucide-react-native";
import { Avatar, BottomSheet, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useReduceMotion } from "@/frontend/core/preferences/store/useReduceMotionStore";
import { usePaysForPro } from "@/frontend/core/pro/store/useProStore";
import { useProRewardProgress } from "@/frontend/core/pro/hooks/useProRewardProgress";
import { POST_REWARD_DAYS } from "@/frontend/core/pro/proContent";
import { fetchLinkPreview, type FoodPost, type LinkFields, type PostInput } from "@/api/posts";
import type { KlipyKind } from "@/api/klipy";
import { LinkPreviewCard } from "./LinkPreviewCard";
import { KlipyPicker } from "./KlipyPicker";
import { compressPostPhoto } from "../utils/compressPostPhoto";

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
// `width`/`height`: a freshly picked photo's size (for compressing it).
type Attachment = { kind: "photo" | "gif" | "sticker"; uri: string; width?: number; height?: number } | null;

function ToolbarPill({
  label,
  icon,
  active = false,
  highlight = false,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  active?: boolean;
  /** Pro's accent (the Photo pill while a first photo post earns Pro). */
  highlight?: boolean;
  onPress: () => void;
}) {
  const tone = active
    ? "border-brand-green bg-brand-green/10"
    : highlight
      ? "border-accent bg-accent/5"
      : "border-web-divider";
  const text = active ? "text-brand-green" : highlight ? "text-accent" : "text-web-ink-soft";
  return (
    <Pressable onPress={onPress} className={`flex-row items-center gap-1.5 rounded-full border px-3 py-1.5 ${tone}`}>
      {icon}
      <Text className={`font-inter-semibold text-small ${text}`}>{label}</Text>
    </Pressable>
  );
}

// The gift on the reward bar: one small wiggle as it appears.
function WigglingGift({ reduceMotion }: { reduceMotion: boolean }) {
  const turn = useSharedValue(0);
  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withDelay(
      350,
      withSequence(
        withTiming(-14, { duration: 90 }),
        withTiming(12, { duration: 110 }),
        withTiming(-6, { duration: 90 }),
        withTiming(0, { duration: 110 }),
      ),
    );
    // Once, as it appears.
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  return (
    <Animated.View style={style}>
      <Gift color={colors.white} size={13} strokeWidth={2.5} />
    </Animated.View>
  );
}

// The check once a photo is in: pops in with a spring.
function PoppingCheck({ reduceMotion }: { reduceMotion: boolean }) {
  const pop = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) pop.value = withSpring(1, { damping: 9, stiffness: 220, mass: 0.6 });
    // Once, as it appears.
  }, []);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 0.3 + 0.7 * pop.value }] }));
  return (
    <Animated.View style={style}>
      <Check color={colors.white} size={13} strokeWidth={3} />
    </Animated.View>
  );
}

// A first post while the photo reward is open: just above the toolbar (so
// it rides on the keyboard), "Add a photo to earn 7 days of Pro" with an
// Add photo button; with a photo in, it turns into "Nice! This post earns
// you 7 days of Pro" with a check popping in. Crossfades in place.
function PhotoRewardBar({ hasPhoto, onAddPhoto }: { hasPhoto: boolean; onAddPhoto: () => void }) {
  const reduceMotion = useReduceMotion();
  return (
    <Animated.View layout={reduceMotion ? undefined : LinearTransition.duration(220)} className="mb-2">
      {hasPhoto ? (
        <Animated.View key="earned" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <View className="flex-row items-center gap-2.5 rounded-2xl bg-accent/10 px-3.5 py-2.5">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
              <PoppingCheck reduceMotion={reduceMotion} />
            </View>
            <Text className="flex-1 font-inter-semibold text-small text-accent">
              Nice! This post earns you {POST_REWARD_DAYS} days of Pro
            </Text>
          </View>
        </Animated.View>
      ) : (
        <Animated.View key="ask" entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)}>
          <View className="flex-row items-center gap-2.5 rounded-2xl border border-accent/25 bg-accent/5 py-2 pl-3.5 pr-2">
            <View className="h-6 w-6 items-center justify-center rounded-full bg-accent">
              <WigglingGift reduceMotion={reduceMotion} />
            </View>
            <Text className="flex-1 font-inter-semibold text-small text-ink-emphasis">
              Add a photo to earn <Text className="text-accent">{POST_REWARD_DAYS} days of Pro</Text>
            </Text>
            <Pressable
              onPress={onAddPhoto}
              accessibilityRole="button"
              className="rounded-full bg-accent px-3 py-1.5 active:opacity-80"
            >
              <Text className="font-inter-bold text-sub text-white">Add photo</Text>
            </Pressable>
          </View>
        </Animated.View>
      )}
    </Animated.View>
  );
}

// Links in the caption, Facebook style: the first one typed (finished with a
// space) or pasted leaves the text and becomes the post's preview card.
// "https://…", "www.…", or a bare domain on a common ending ("panlasangpinoy.com").
const URL_RE =
  /(?:https?:\/\/|www\.)\S+|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|ph|net|org|app|co|io|me|tv|info|blog|recipes|food)(?:\/\S*)?(?![\w-]|\.\w)/gi;

type FoundLink = { url: string; start: number; end: number };

/** The first link in `text`: not part of an email, without a sentence's closing punctuation. */
function findLink(text: string): FoundLink | null {
  for (const m of text.matchAll(URL_RE)) {
    const start = m.index ?? 0;
    if (start > 0 && /[@\w.]/.test(text[start - 1])) continue; // juan@gmail.com, or mid-word
    const url = m[0].replace(/[.,!?;:)"'\]]+$/, "");
    return { url, start, end: start + url.length };
  }
  return null;
}

/** `text` without the link and one space next to it. */
function withoutLink(text: string, { start, end }: FoundLink) {
  if (/\s/.test(text[end] ?? "")) end += 1;
  else if (start > 0 && /\s/.test(text[start - 1])) start -= 1;
  const rest = text.slice(0, start) + text.slice(end);
  return rest.trim() ? rest : "";
}

const withScheme = (url: string) => (/^https?:\/\//i.test(url) ? url : `https://${url}`);
const hostnameOf = (url: string) =>
  url
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .split("/")[0];

// The post's link: its address, and its preview once read (null while loading).
type AttachedLink = { url: string; preview: LinkFields | null };

// New-post composer (and editor, for your own posts). Caption plus at most
// one attachment among photo / GIF / sticker, with an optional link (taken
// from the caption, see findLink). Can post once there's a caption, a link or
// any attachment.
export function CreatePostSheet({ visible, onClose, editPost, author, onSubmit }: CreatePostSheetProps) {
  const [caption, setCaption] = useState("");
  const [link, setLink] = useState<AttachedLink | null>(null);
  const [attachment, setAttachment] = useState<Attachment>(null);
  // Which Klipy picker is open inline, if any.
  const [picker, setPicker] = useState<KlipyKind | null>(null);
  // While saving: "preparing" (compressing a picked photo), then "posting".
  const [phase, setPhase] = useState<"preparing" | "posting" | null>(null);
  const posting = phase !== null;
  // A first photo post earns Pro days: nudged while that's still open (new
  // posts only, not to paying subscribers).
  const paying = usePaysForPro();
  const { data: rewardProgress } = useProRewardProgress();
  const photoRewardOpen = !editPost && !paying && !!rewardProgress && !rewardProgress.hasPhotoPost;

  // Space under the toolbar that tracks the keyboard, so the Photo /
  // GIF / STK row rides right on top of it (like Facebook's composer).
  // Built on RN's own keyboard events: react-native-keyboard-controller
  // would be smoother but needs native code Expo Go doesn't ship. Both
  // platforms: Android no longer resizes the window for the keyboard now
  // that the app (and this sheet's Modal) draws edge to edge. iOS sends
  // "will" events (the spacer moves with the keyboard); Android only "did".
  const insets = useSafeAreaInsets();
  const keyboardSpace = useSharedValue(0);
  useEffect(() => {
    const ios = Platform.OS === "ios";
    const show = Keyboard.addListener(ios ? "keyboardWillShow" : "keyboardDidShow", (e) => {
      // The sheet already pads the home-indicator area at its bottom.
      keyboardSpace.value = withTiming(Math.max(0, e.endCoordinates.height - insets.bottom), {
        duration: e.duration || 250,
        easing: Easing.out(Easing.cubic),
      });
    });
    const hide = Keyboard.addListener(ios ? "keyboardWillHide" : "keyboardDidHide", (e) => {
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
    setLink(
      editPost?.link_url
        ? {
            url: editPost.link_url,
            preview: {
              link_url: editPost.link_url,
              link_title: editPost.link_title,
              link_description: editPost.link_description,
              link_image: editPost.link_image,
            },
          }
        : null,
    );
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
    setPhase(null);
  }, [visible, editPost]);

  const canPost = !posting && (caption.trim().length > 0 || !!attachment || !!link);

  // Attaches `found` as the post's link and reads its preview right away
  // (reused when posting, so the page isn't read twice).
  const attachLink = (found: FoundLink) => {
    const url = withScheme(found.url);
    setLink({ url, preview: null });
    fetchLinkPreview(url).then((preview) => setLink((current) => (current?.url === url ? { url, preview } : current)));
  };

  // Caption typing: the first finished link (a space after it, or pasted in
  // whole) moves out of the text into the preview. With a link already
  // attached, later ones stay as text.
  const changeCaption = (next: string) => {
    const pasted = next.length - caption.length >= 6;
    const found = link ? null : findLink(next);
    if (found && (pasted || /\s/.test(next[found.end] ?? ""))) {
      attachLink(found);
      setCaption(withoutLink(next, found));
    } else {
      setCaption(next);
    }
  };

  const pickPhoto = async () => {
    setPicker(null);
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setAttachment({ kind: "photo", uri: asset.uri, width: asset.width, height: asset.height });
  };

  const togglePicker = (kind: KlipyKind) => {
    // Out of the caption so the picker's grid isn't hidden behind the keyboard.
    Keyboard.dismiss();
    setPicker((open) => (open === kind ? null : kind));
  };

  const submit = async () => {
    if (!canPost) return;
    Keyboard.dismiss();
    setPicker(null);
    // A link typed last, with no space after it, still becomes the preview.
    let postCaption = caption;
    let postLink = link;
    const trailing = postLink ? null : findLink(caption);
    if (trailing) {
      postLink = { url: withScheme(trailing.url), preview: null };
      postCaption = withoutLink(caption, trailing);
    }
    try {
      // A newly picked photo is resized and compressed first (an existing
      // one, when editing, is already a hosted URL).
      let imageUri: string | null = attachment?.kind === "photo" ? attachment.uri : null;
      if (imageUri && !/^https?:\/\//i.test(imageUri)) {
        setPhase("preparing");
        imageUri = await compressPostPhoto(imageUri, attachment?.width, attachment?.height).catch(() => imageUri);
      }
      setPhase("posting");
      await onSubmit({
        caption: postCaption,
        image_uri: imageUri,
        gif_url: attachment?.kind === "gif" ? attachment.uri : null,
        sticker_url: attachment?.kind === "sticker" ? attachment.uri : null,
        link_url: postLink?.url ?? null,
        link_preview: postLink?.preview ?? null,
      });
    } finally {
      setPhase(null);
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

  // The Photo / GIF / STK toolbar, with the photo reward bar and a picker.
  // iPhone: at the bottom, riding on the keyboard (like Facebook's
  // composer), reward bar above, picker below. Android: right under the
  // header with a divider before the caption, picker straight under the
  // toolbar and the reward bar under that: Android's keyboard events only
  // arrive once it's open, so a toolbar riding on it lags behind, and up
  // here the picker's search box stays in view while typing.
  const toolsOnTop = Platform.OS === "android";
  // While saving, the toolbar becomes a status row: what's happening, in
  // words, until the sheet closes on success.
  const toolbar = posting ? (
    <Animated.View
      entering={FadeIn.duration(150)}
      className={`flex-row items-center justify-center gap-2.5 border-web-divider py-3.5 ${toolsOnTop ? "mt-3 border-b" : "border-t"}`}
      accessibilityLiveRegion="polite"
    >
      <Spinner variant="spiral" size={18} color={colors.brandGreen.DEFAULT} />
      <Text className="font-inter-semibold text-body text-web-ink">
        {phase === "preparing" ? "Preparing your photo…" : editPost ? "Saving…" : "Posting…"}
      </Text>
    </Animated.View>
  ) : (
    <View
      className={`flex-row flex-wrap gap-2 border-web-divider ${toolsOnTop ? "mt-3 border-b pb-3" : "border-t py-2"}`}
    >
      <ToolbarPill
        label="Photo"
        icon={
          <ImageIcon
            color={
              attachment?.kind === "photo"
                ? colors.brandGreen.DEFAULT
                : photoRewardOpen
                  ? colors.accent
                  : colors.webInk.soft
            }
            size={14}
          />
        }
        active={attachment?.kind === "photo"}
        highlight={photoRewardOpen}
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
  );
  const pickerView = picker && (
    <KlipyPicker
      key={picker}
      kind={picker}
      onSelect={(item) => {
        setAttachment({ kind: picker === "gifs" ? "gif" : "sticker", uri: item.url });
        setPicker(null);
      }}
    />
  );
  const rewardBar = (
    <PhotoRewardBar hasPhoto={attachment?.kind === "photo"} onAddPhoto={() => void pickPhoto()} />
  );

  return (
    // Can't be closed mid-save (the post would still go up, unseen).
    <BottomSheet visible={visible} onClose={posting ? () => {} : onClose} heightPercent={0.9}>
      <View className="flex-1 px-5 pt-10">
        <View className="flex-row items-center justify-between">
          <Pressable
            onPress={onClose}
            disabled={posting}
            accessibilityLabel="Close"
            className={`h-8 w-8 items-center justify-center rounded-full bg-web-divider ${posting ? "opacity-40" : ""}`}
          >
            <X color={colors.webInk.soft} size={16} />
          </Pressable>
          <Text className="font-inter-bold text-body text-web-ink">{editPost ? "Edit Post" : "New Post"}</Text>
          {/* Dimmed only when there's nothing to post: while saving, the
              spinner stays at full strength. */}
          <Pressable onPress={submit} disabled={!canPost} className={canPost || posting ? "" : "opacity-40"}>
            {posting ? (
              <Spinner variant="wave" size={16} color={colors.accent} />
            ) : (
              <Text className="font-inter-bold text-body text-brand-green">{editPost ? "Save" : "Post"}</Text>
            )}
          </Pressable>
        </View>

        {toolsOnTop && (
          <>
            {toolbar}
            {picker && !posting && <View className="pt-3">{pickerView}</View>}
            {photoRewardOpen && !posting && <View className="mt-3">{rewardBar}</View>}
          </>
        )}

        {/* Caption + link preview + attachments scroll between the header and
            the toolbar, so they stay reachable when the keyboard or a picker
            takes space. */}
        <ScrollView
          className={`flex-1 ${posting ? "opacity-50" : ""}`}
          pointerEvents={posting ? "none" : "auto"}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View className="mt-5 flex-row gap-3">
            <Avatar name={author.name} imageUri={author.avatarUrl ?? undefined} size={40} />
            <TextInput
              value={caption}
              onChangeText={changeCaption}
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

          {link && (
            <Animated.View entering={FadeIn.duration(150)} className="mt-4">
              <LinkPreviewCard
                url={link.url}
                title={link.preview?.link_title ?? hostnameOf(link.url)}
                description={link.preview ? link.preview.link_description : "Getting the preview…"}
                image={link.preview?.link_image ?? null}
                onRemove={() => setLink(null)}
              />
            </Animated.View>
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

        {!toolsOnTop && (
          <>
            {photoRewardOpen && !posting && rewardBar}
            {toolbar}
            {picker && !posting && pickerView}
          </>
        )}

        <Animated.View style={keyboardSpacerStyle} />
      </View>
    </BottomSheet>
  );
}
