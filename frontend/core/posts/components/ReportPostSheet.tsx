import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Check } from "lucide-react-native";
import { AppText, BottomSheet, Button } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { FoodPost, ReportReason } from "@/api/posts";

const REASONS: { value: ReportReason; label: string; detail: string }[] = [
  { value: "spam", label: "Spam", detail: "Ads, scams or the same post over and over" },
  { value: "not_food", label: "Not about food", detail: "Off-topic for the community" },
  { value: "offensive", label: "Offensive or inappropriate", detail: "Hateful, explicit or harassing" },
  { value: "misleading", label: "Misleading", detail: "False prices, health claims or info" },
  { value: "other", label: "Something else", detail: "Tell us below" },
];
// Matches post_reports.note's limit in the database.
const NOTE_LIMIT = 300;

type ReportPostSheetProps = {
  /** null closes the sheet. */
  post: FoodPost | null;
  onClose: () => void;
  /** Resolves once sent; the sheet shows a spinner until then. */
  onSubmit: (reason: ReportReason, note: string) => Promise<void>;
};

// Reporting someone's Food Post: pick a reason (one), an optional note,
// send. Reports are anonymous to the poster; the post leaves the
// reporter's feed once sent (usePostModeration).
export function ReportPostSheet({ post, onClose, onSubmit }: ReportPostSheetProps) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);

  // Fresh for each post.
  useEffect(() => {
    if (!post) return;
    setReason(null);
    setNote("");
    setSending(false);
  }, [post?.id]);

  const send = async () => {
    if (!reason || sending) return;
    setSending(true);
    try {
      await onSubmit(reason, note);
    } finally {
      setSending(false);
    }
  };

  return (
    <BottomSheet visible={!!post} onClose={onClose} heightPercent={0.9} fitContent>
      <View className="px-6 pb-6 pt-10">
        <AppText variant="sectionTitle" dot>
          Report this post
        </AppText>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
          It&apos;s anonymous. We&apos;ll review it, and you won&apos;t see this post again.
        </Text>

        <View className="mt-5 overflow-hidden rounded-2xl border border-ink-emphasis/10">
          {REASONS.map((option, i) => {
            const selected = reason === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setReason(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                className={`flex-row items-center gap-3 px-4 py-3.5 active:bg-ink-emphasis/5 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}
              >
                <View className="flex-1">
                  <Text className="font-inter-semibold text-body text-ink-emphasis">{option.label}</Text>
                  <Text className="mt-0.5 font-inter-regular text-small text-ink-subtle">{option.detail}</Text>
                </View>
                <View className={`h-5 w-5 items-center justify-center rounded-full ${selected ? "bg-primary" : "border-2 border-ink-emphasis/15"}`}>
                  {selected && <Check color={colors.white} size={12} strokeWidth={3} />}
                </View>
              </Pressable>
            );
          })}
        </View>

        <TextInput
          value={note}
          onChangeText={(text) => setNote(text.slice(0, NOTE_LIMIT))}
          placeholder={reason === "other" ? "What's wrong with it?" : "Anything else we should know? (optional)"}
          placeholderTextColor={colors.ink.placeholder}
          multiline
          style={{ minHeight: 72 }}
          className="mt-4 rounded-2xl border border-ink-emphasis/10 px-4 py-3 font-inter-regular text-body text-ink-emphasis"
        />

        <View className="mt-5">
          <Button label="Send report" onPress={() => void send()} disabled={!reason} loading={sending} celebrate={false} />
        </View>
      </View>
    </BottomSheet>
  );
}
