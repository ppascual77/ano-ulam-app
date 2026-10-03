import { ReactNode, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Pencil } from "lucide-react-native";
import { Avatar } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { BIO_LIMIT } from "../mock/api";

type ProfileHeaderProps = {
  name: string;
  avatarUrl: string | null;
  bio: string | null;
  /** Owner only: tap the bio to edit it inline. Omit for read-only. */
  onSaveBio?: (bio: string) => Promise<void>;
  /** Replaces the generated avatar (the official profile's logo). */
  avatar?: ReactNode;
  /** After the name (the official verified badge). */
  badge?: ReactNode;
  /** Under the bio (the official profile's mail link). */
  children?: ReactNode;
};

// Avatar, name and bio. The owner edits the bio in place: saves on return
// or blur, blocked while over the 50-character limit.
export function ProfileHeader({ name, avatarUrl, bio, onSaveBio, avatar, badge, children }: ProfileHeaderProps) {
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

  return (
    <View className="flex-row items-center gap-4 px-5 pt-5">
      {avatar ?? <Avatar name={name} imageUri={avatarUrl ?? undefined} size={64} />}
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          <Text numberOfLines={1} className="shrink font-inter-bold text-subheading text-web-ink">
            {name}
          </Text>
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
