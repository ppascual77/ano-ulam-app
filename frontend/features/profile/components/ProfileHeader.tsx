import { ReactNode, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Camera, Pencil } from "lucide-react-native";
import { Avatar, Dropdown, Spinner, type DropdownItem } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";

// Matches the users.bio check in the database.
const BIO_LIMIT = 50;

type ProfileHeaderProps = {
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Owner only: tap the bio to edit it inline. Omit for read-only. */
  onSaveBio?: (bio: string) => Promise<void>;
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
  /** Under the bio (the official profile's mail link). */
  children?: ReactNode;
};

// Avatar, name and bio. The owner edits the bio in place: saves on return
// or blur, blocked while over the 50-character limit.
export function ProfileHeader({
  name,
  avatarUrl,
  bio,
  onSaveBio,
  avatar,
  avatarItems,
  avatarBusy = false,
  badge,
  nameNode,
  children,
}: ProfileHeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const remaining = BIO_LIMIT - draft.length;
  const over = remaining < 0;

  const startEditing = () => {
    setDraft(bio ?? "");
    setEditing(true);
  };

  const save = async () => {
    if (over || saving) return;
    const next = draft.trim();
    if (next === (bio ?? "")) return setEditing(false);
    setSaving(true);
    try {
      await onSaveBio?.(next);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const avatarNode = avatar ?? <Avatar name={name} imageUri={avatarUrl ?? undefined} size={64} />;

  return (
    <View className="flex-row items-center gap-4 px-5 pt-5">
      {avatarItems ? (
        <EditableAvatar items={avatarItems} busy={avatarBusy}>
          {avatarNode}
        </EditableAvatar>
      ) : (
        avatarNode
      )}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          {nameNode ?? (
            <Text numberOfLines={1} className="shrink font-inter-bold text-subheading text-web-ink">
              {name}
            </Text>
          )}
          {badge}
        </View>

        {editing ? (
          <View className="mt-1">
            <TextInput
              value={draft}
              onChangeText={setDraft}
              onSubmitEditing={save}
              onBlur={save}
              editable={!saving}
              autoFocus
              returnKeyType="done"
              placeholder="Write a short bio..."
              placeholderTextColor={colors.ink.placeholder}
              className={`rounded-lg border bg-web-divider/50 px-2.5 py-1.5 font-inter-regular text-body ${
                over ? "border-like text-like" : "border-brand-green text-web-ink"
              }`}
            />
            <View className="mt-1 flex-row justify-between">
              <Text className={`font-inter-regular text-sub ${over ? "text-like" : "text-web-ink-muted"}`}>
                {over ? `${-remaining} character${remaining === -1 ? "" : "s"} over limit` : `${remaining} left`}
              </Text>
              <Pressable onPress={() => setEditing(false)} hitSlop={8}>
                <Text className="font-inter-regular text-sub text-web-ink-muted">Cancel</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Pressable
            disabled={!onSaveBio}
            onPress={startEditing}
            className="mt-1 flex-row items-center gap-1.5"
          >
            <Text className="shrink font-inter-regular text-body text-web-ink-muted">
              {bio || (onSaveBio ? "Add a bio..." : "No bio yet.")}
            </Text>
            {onSaveBio && <Pencil color={colors.webInk.faint} size={12} />}
          </Pressable>
        )}
        {children}
      </View>
    </View>
  );
}

// The owner's avatar: opens the photo menu, with a small camera badge on its
// corner. While saving, the menu is off and a spinner sits over the photo.
function EditableAvatar({ items, busy, children }: { items: DropdownItem[]; busy: boolean; children: ReactNode }) {
  const avatar = (
    <View>
      {children}
      {busy && (
        <View className="absolute inset-0 items-center justify-center rounded-full bg-web-ink/40">
          <Spinner size={20} color={colors.white} />
        </View>
      )}
      {/* Light like the app's other small controls (Profile's floating +):
          a white disc with a soft edge and shadow, a thin green camera. */}
      <View className="absolute -bottom-0.5 -right-0.5 h-6 w-6 items-center justify-center rounded-full border border-ink-emphasis/10 bg-white shadow-sm">
        <Camera color={colors.primary} size={13} strokeWidth={2.2} />
      </View>
    </View>
  );
  if (busy) return avatar;
  return <Dropdown trigger={avatar} items={items} align="left" />;
}
