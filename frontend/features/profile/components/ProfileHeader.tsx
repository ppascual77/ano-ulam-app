import { type ComponentProps, ReactNode, useState } from "react";
import { Pressable, View } from "react-native";
import { Text, TextInput } from "@/frontend/components/ui/Text";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";
import { Camera, Pencil, Plus } from "lucide-react-native";
import { Avatar, Dropdown, Spinner, type DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// Matches the users.bio check in the database.
const BIO_LIMIT = 50;
// Kept short so it fits the header on one line (users.display_name allows 255).
const NAME_LIMIT = 40;
// The counter only shows once this few characters are left.
const COUNTER_FROM = 10;
/** The avatar's size in each layout. */
export const HEADER_AVATAR = { row: 64, hero: 92 } as const;

type ProfileHeaderProps = {
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Centered, with a bigger avatar (your own Profile, over the green
   *  header). Default: avatar beside the name (other profiles). */
  hero?: boolean;
  /** Hero only: the avatar's scroll effect (shrinks and drifts up). */
  avatarStyle?: ComponentProps<typeof Animated.View>["style"];
  /** Owner only: tap the bio to edit it inline. Omit for read-only.
   *  Resolves false if it didn't save (the editor stays open). */
  onSaveBio?: (bio: string) => Promise<boolean | void>;
  /** Owner only: tap the name to edit it inline, same as the bio. */
  onSaveName?: (name: string) => Promise<boolean | void>;
  /** Owner only: false when they have no name yet (`name` is the
   *  placeholder): shows "Add your name" instead. */
  hasName?: boolean;
  /** Replaces the generated avatar (the official profile's logo). */
  avatar?: ReactNode;
  /** Owner only: tapping the avatar opens these (change / remove photo),
   *  and a camera badge shows it can be tapped. Omit for read-only. */
  avatarItems?: DropdownItem[];
  /** A photo change is saving: dims the avatar under a spinner. */
  avatarBusy?: boolean;
  /** After the name (the official verified badge). */
  badge?: ReactNode;
  /** Replaces the plain name (Pro: ProName, in accent with the shimmer). */
  nameNode?: ReactNode;
  /** Under the bio (the stats row, the official profile's mail link). */
  children?: ReactNode;
};

/** The name's text style in each layout (ProName takes it too). */
export const HEADER_NAME_CLASS = {
  row: "font-inter-bold text-subheading text-ink-emphasis",
  hero: "font-inter-extrabold text-heading tracking-display text-ink-emphasis",
} as const;

// Avatar, name and bio. The owner edits the name and the bio in place: saves
// on return or blur, blocked while over the limit. An emptied name isn't
// saved (it just closes).
export function ProfileHeader({
  name,
  avatarUrl,
  bio,
  hero = false,
  avatarStyle,
  onSaveBio,
  onSaveName,
  hasName = true,
  avatar,
  avatarItems,
  avatarBusy = false,
  badge,
  nameNode,
  children,
}: ProfileHeaderProps) {
  const [editing, setEditing] = useState<"bio" | "name" | null>(null);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const limit = editing === "name" ? NAME_LIMIT : BIO_LIMIT;
  const remaining = limit - draft.length;
  const over = remaining < 0;
  const layout = hero ? "hero" : "row";

  const startEditing = (field: "bio" | "name") => {
    setDraft(field === "name" ? (hasName ? name : "") : (bio ?? ""));
    setEditing(field);
  };

  const save = async () => {
    if (over || saving || !editing) return;
    const next = draft.trim();
    const current = editing === "name" ? (hasName ? name : "") : (bio ?? "");
    if (next === current || (editing === "name" && !next)) return setEditing(null);
    setSaving(true);
    try {
      const onSave = editing === "name" ? onSaveName : onSaveBio;
      // false: it didn't save (the caller says so); stay open to retry.
      if ((await onSave?.(next)) === false) return;
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setEditing(null);
    } finally {
      setSaving(false);
    }
  };

  const editor = (
    <View className={hero ? "mt-2 w-full" : "mt-1"}>
      <View>
        <TextInput
          value={saving ? "" : draft}
          onChangeText={setDraft}
          onSubmitEditing={save}
          onBlur={save}
          editable={!saving}
          autoFocus
          returnKeyType="done"
          autoCapitalize={editing === "name" ? "words" : "sentences"}
          autoComplete={editing === "name" ? "name" : "off"}
          textContentType={editing === "name" ? "name" : "none"}
          placeholder={saving ? undefined : editing === "name" ? "Your name" : "Write a short bio..."}
          placeholderTextColor={colors.ink.placeholder}
          // Saving: no border and no text (the field stays only to hold
          // its place under the wave). It can't be over the limit then:
          // save refuses that.
          className={`rounded-xl border bg-ink-emphasis/5 px-3 py-2 font-inter-regular text-body ${hero ? "text-center" : ""} ${
            saving ? "border-transparent" : over ? "border-like text-like" : "border-primary text-ink-emphasis"
          }`}
        />
        {/* While saving: a short rolling accent wave, Button's loading state
            (Suggest Meals), in the middle of the field. */}
        {saving && (
          <Animated.View
            entering={FadeIn.duration(150)}
            exiting={FadeOut.duration(120)}
            pointerEvents="none"
            className="absolute inset-0 items-center justify-center"
          >
            <View className="w-24">
              <Spinner variant="wave" size={12} color={colors.accent} />
            </View>
          </Animated.View>
        )}
      </View>
      <View className="mt-1.5 h-3 flex-row items-center justify-between">
        {/* Only near the limit; over it, red with how far over. */}
        {remaining <= COUNTER_FROM ? (
          <Animated.Text allowFontScaling={false}
            entering={FadeIn.duration(180)}
            exiting={FadeOut.duration(120)}
            className={`font-inter-medium text-sub ${over ? "text-like" : "text-ink-subtle"}`}
          >
            {over ? `${-remaining} character${remaining === -1 ? "" : "s"} over` : `${remaining} left`}
          </Animated.Text>
        ) : (
          <View />
        )}
        {saving ? (
          <Text className="font-inter-medium text-sub text-ink-subtle">Saving…</Text>
        ) : (
          <Pressable onPress={() => setEditing(null)} hitSlop={8}>
            <Text className="font-inter-medium text-sub text-ink-subtle">Cancel</Text>
          </Pressable>
        )}
      </View>
    </View>
  );

  // The dashed "add" pill for an empty name or bio: something to fill in,
  // not placeholder text.
  const addPill = (label: string, field: "bio" | "name") => (
    <Pressable
      onPress={() => startEditing(field)}
      accessibilityRole="button"
      className={`mt-2 flex-row items-center gap-1 rounded-full border border-dashed border-ink-emphasis/25 px-3 py-1.5 active:bg-ink-emphasis/5 ${
        hero ? "self-center" : "self-start"
      }`}
    >
      <Plus color={colors.ink.subtle} size={13} />
      <Text className="font-inter-medium text-small text-ink-subtle">{label}</Text>
    </Pressable>
  );

  const avatarNode = avatar ?? <Avatar name={name} imageUri={avatarUrl ?? undefined} size={HEADER_AVATAR[layout]} />;
  const avatarBlock = avatarItems ? (
    <EditableAvatar items={avatarItems} busy={avatarBusy} large={hero}>
      {avatarNode}
    </EditableAvatar>
  ) : (
    avatarNode
  );

  const nameText = nameNode ?? (
    <Text numberOfLines={1} className={`shrink ${HEADER_NAME_CLASS[layout]}`}>
      {name}
    </Text>
  );
  const nameRow =
    editing === "name" ? (
      editor
    ) : onSaveName && !hasName ? (
      addPill("Add your name", "name")
    ) : onSaveName ? (
      <Pressable
        onPress={() => startEditing("name")}
        accessibilityLabel={`Name: ${name}. Tap to edit`}
        className={`flex-row items-center gap-1.5 ${hero ? "justify-center" : ""}`}
      >
        {nameText}
        {badge}
        <Pencil color={colors.ink.subtle} size={13} />
      </Pressable>
    ) : (
      <View className={`flex-row items-center gap-1.5 ${hero ? "justify-center" : ""}`}>
        {nameText}
        {badge}
      </View>
    );

  const bioBlock = editing === "bio" ? (
    editor
  ) : bio ? (
    <Pressable
      disabled={!onSaveBio}
      onPress={() => startEditing("bio")}
      accessibilityLabel={onSaveBio ? `Bio: ${bio}. Tap to edit` : undefined}
      className={`mt-1 flex-row items-center gap-1.5 ${hero ? "justify-center" : ""}`}
    >
      <Text className={`shrink font-inter-regular text-body text-ink-subtle ${hero ? "text-center" : ""}`}>{bio}</Text>
      {onSaveBio && <Pencil color={colors.ink.subtle} size={13} />}
    </Pressable>
  ) : onSaveBio ? (
    addPill("Add a bio", "bio")
  ) : (
    <Text className={`mt-1 font-inter-regular text-body text-ink-subtle ${hero ? "text-center" : ""}`}>No bio yet.</Text>
  );

  if (hero) {
    return (
      <View className="items-center px-5">
        {/* A white ring keeps the avatar crisp where it crosses the green
            header's edge. */}
        <Animated.View style={avatarStyle} className="rounded-full bg-white p-1 shadow-sm">
          {avatarBlock}
        </Animated.View>
        <View className="mt-3 w-full items-center">
          {nameRow}
          {bioBlock}
          {children}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-row items-center gap-4 px-5 pt-5">
      {avatarBlock}
      <View className="flex-1">
        {nameRow}
        {bioBlock}
        {children}
      </View>
    </View>
  );
}

// The owner's avatar: opens the photo menu, with a small camera badge on its
// corner. While saving, the menu is off and a spinner sits over the photo.
function EditableAvatar({ items, busy, large, children }: { items: DropdownItem[]; busy: boolean; large: boolean; children: ReactNode }) {
  const avatar = (
    <View>
      {children}
      {busy && (
        <View className="absolute inset-0 items-center justify-center rounded-full bg-ink-emphasis/40">
          <Spinner size={20} color={colors.white} />
        </View>
      )}
      {/* Light like the app's other small controls (Profile's floating +):
          a white disc with a soft edge and shadow, a thin green camera. */}
      <View
        className={`absolute items-center justify-center rounded-full border border-ink-emphasis/10 bg-white shadow-sm ${
          large ? "bottom-0.5 right-0.5 h-7 w-7" : "-bottom-0.5 -right-0.5 h-6 w-6"
        }`}
      >
        <Camera color={colors.primary} size={large ? 14 : 13} strokeWidth={2.2} />
      </View>
    </View>
  );
  if (busy) return avatar;
  return (
    <Dropdown
      trigger={avatar}
      items={items}
      align="left"
      onOpen={() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    />
  );
}
