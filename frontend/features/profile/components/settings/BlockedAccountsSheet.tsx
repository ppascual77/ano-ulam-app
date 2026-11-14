import { View } from "react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, Avatar, BottomSheet, Button, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { useBlockedUsers } from "@/frontend/core/posts/hooks/useBlockedUsers";

type BlockedAccountsSheetProps = {
  visible: boolean;
  onClose: () => void;
  onToast: (message: string, tone: "success" | "error") => void;
};

// Settings → Blocked accounts: everyone you blocked from a post's menu, each
// with Unblock. Unblocking brings their posts back.
export function BlockedAccountsSheet({ visible, onClose, onToast }: BlockedAccountsSheetProps) {
  const { users, loading, error, unblock } = useBlockedUsers(visible);

  const handleUnblock = async (userId: string, name: string | null) => {
    const ok = await unblock(userId);
    onToast(ok ? `Unblocked ${name ?? "them"}.` : "Couldn't unblock. Please try again.", ok ? "success" : "error");
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} heightPercent={0.75} fitContent>
      <View className="px-6 pb-6 pt-10">
        <AppText variant="sectionTitle" dot>
          Blocked accounts
        </AppText>
        <Text className="mt-1 font-inter-regular text-body text-ink-subtle">
          You don&apos;t see posts from these people. They aren&apos;t told.
        </Text>

        <View className="mt-5">
          {loading ? (
            <View className="items-center py-6">
              <Spinner variant="wave" size={18} color={colors.brandGreen.DEFAULT} />
            </View>
          ) : error ? (
            <Text className="py-4 font-inter-regular text-body text-ink-subtle">Couldn&apos;t load your blocked accounts.</Text>
          ) : users.length === 0 ? (
            <Text className="py-4 font-inter-regular text-body text-ink-subtle">You haven&apos;t blocked anyone.</Text>
          ) : (
            users.map((user, i) => (
              <View
                key={user.user_id}
                className={`flex-row items-center gap-3 py-3 ${i > 0 ? "border-t border-ink-emphasis/10" : ""}`}
              >
                <Avatar name={user.display_name ?? "?"} imageUri={user.avatar_url ?? undefined} size={36} />
                <Text className="flex-1 font-inter-semibold text-body text-ink-emphasis" numberOfLines={1}>
                  {user.display_name ?? "AnoUlam user"}
                </Text>
                <Button
                  label="Unblock"
                  variant="outline"
                  shape="pill"
                  onPress={() => void handleUnblock(user.user_id, user.display_name)}
                />
              </View>
            ))
          )}
        </View>
      </View>
    </BottomSheet>
  );
}
