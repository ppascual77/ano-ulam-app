import { useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppText, Avatar, Button, ErrorState, LoadingState, Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { dismissPostReports, getReportedPosts, removePost, type ReportedPost } from "@/api/moderation";
import type { ReportReason } from "@/api/posts";
import { AdminHeader } from "../components/AdminHeader";

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  not_food: "Not about food",
  offensive: "Offensive",
  misleading: "Misleading",
  other: "Something else",
};

const reportedKey = ["admin", "reportedPosts"] as const;

// "3× Spam · 1× Offensive": how often each reason came up.
function reasonSummary(reasons: ReportReason[]) {
  const counts = new Map<ReportReason, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([r, n]) => `${n}× ${REASON_LABELS[r]}`)
    .join(" · ");
}

function ReportedPostCard({ post, busy, onRemove, onDismiss }: { post: ReportedPost; busy: boolean; onRemove: () => void; onDismiss: () => void }) {
  const media = post.imageUrl ?? post.gifUrl ?? post.stickerUrl;
  return (
    <View className="overflow-hidden rounded-2xl border border-ink-emphasis/10 bg-white">
      <View className="flex-row items-center gap-2.5 px-4 pt-4">
        <Avatar name={post.displayName ?? "User"} imageUri={post.avatarUrl ?? undefined} size={32} />
        <View className="flex-1">
          <Text className="font-inter-semibold text-body text-ink-emphasis">{post.displayName ?? "User"}</Text>
          <Text className="font-inter-regular text-sub text-ink-subtle">
            Posted {new Date(post.createdAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
          </Text>
        </View>
        <View className={`rounded-full px-2.5 py-1 ${post.hidden ? "bg-like-soft" : "bg-ink-emphasis/5"}`}>
          <Text className={`font-inter-bold text-sub ${post.hidden ? "text-like" : "text-ink-subtle"}`}>{post.hidden ? "HIDDEN" : "VISIBLE"}</Text>
        </View>
      </View>

      {!!post.caption && <Text className="mt-2.5 px-4 font-inter-regular text-body text-ink-emphasis">{post.caption}</Text>}
      {!!post.linkUrl && (
        <Text numberOfLines={1} className="mt-1 px-4 font-inter-medium text-small text-primary">
          {post.linkUrl}
        </Text>
      )}
      {media && (
        <View className="mx-4 mt-3 overflow-hidden rounded-xl bg-ink-emphasis/5" style={{ aspectRatio: 16 / 9 }}>
          <Image source={{ uri: media }} style={{ flex: 1 }} contentFit={post.stickerUrl ? "contain" : "cover"} />
        </View>
      )}

      <View className="mx-4 mt-3 gap-1 rounded-xl bg-like-soft px-3 py-2.5">
        <Text className="font-inter-bold text-small text-like">
          {post.reportCount} {post.reportCount === 1 ? "report" : "reports"}: {reasonSummary(post.reasons)}
        </Text>
        {post.notes.map((note, i) => (
          <Text key={i} className="font-inter-regular text-small text-ink-emphasis">
            “{note}”
          </Text>
        ))}
      </View>

      <View className="flex-row gap-2 p-4">
        <View className="flex-1">
          <Button label={post.hidden ? "Keep removed" : "Remove"} onPress={onRemove} disabled={busy} />
        </View>
        <View className="flex-1">
          <Button label={post.hidden ? "Restore" : "Dismiss"} variant="outline" onPress={onDismiss} disabled={busy} />
        </View>
      </View>
    </View>
  );
}

// Admin > Reported Posts: Food Posts with open reports, most reported
// first, each with its reasons and notes. Remove hides it for everyone and
// closes the reports; Dismiss (Restore, when 3 reports already hid it)
// closes them and shows the post again.
export default function ReportedPostsScreen() {
  const queryClient = useQueryClient();
  const { data: posts, isLoading, isError, refetch, isRefetching } = useQuery({ queryKey: reportedKey, queryFn: getReportedPosts });
  const [toast, setToast] = useState<ToastState | null>(null);
  const showToast = (message: string, tone: ToastState["tone"] = "success") => setToast({ id: Date.now(), message, tone });

  const act = useMutation({
    mutationFn: async ({ post, action }: { post: ReportedPost; action: "remove" | "dismiss" }) =>
      action === "remove" ? removePost(post.id) : dismissPostReports(post.id),
    onSuccess: (_, { action }) => {
      showToast(action === "remove" ? "Post removed for everyone" : "Reports dismissed, post visible");
      void queryClient.invalidateQueries({ queryKey: reportedKey });
      // Every feed and profile list picks up the change.
      void queryClient.invalidateQueries({ queryKey: ["posts"] });
    },
    onError: () => showToast("That didn't go through. Please try again.", "error"),
  });

  return (
    <Screen padded={false}>
      <AdminHeader title="Reported Posts" subtitle={`${posts?.length ?? 0} waiting for review`} />
      {isError ? (
        <ErrorState onRetry={refetch} />
      ) : isLoading ? (
        <LoadingState />
      ) : (
        <ScrollView
          className="flex-1 px-5"
          contentContainerStyle={{ paddingBottom: 40, gap: 16 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} />}
        >
          {posts?.length === 0 ? (
            <AppText variant="body" className="mt-8 text-center">
              No reported posts. All clear.
            </AppText>
          ) : (
            posts?.map((post) => (
              <ReportedPostCard
                key={post.id}
                post={post}
                busy={act.isPending && act.variables?.post.id === post.id}
                onRemove={() => act.mutate({ post, action: "remove" })}
                onDismiss={() => act.mutate({ post, action: "dismiss" })}
              />
            ))
          )}
        </ScrollView>
      )}
      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
