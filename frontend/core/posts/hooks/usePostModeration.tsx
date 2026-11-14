import { useState } from "react";
import { Text } from "@/frontend/components/ui/Text";
import { ConfirmSheet } from "@/frontend/components/ui";
import type { FoodPost } from "@/api/posts";
import { useAuth } from "@/frontend/features/auth/hooks/useAuth";
import { ReportPostSheet } from "../components/ReportPostSheet";
import type { usePostList } from "./usePosts";

type PostList = Pick<ReturnType<typeof usePostList>, "report" | "block" | "adminRemove">;

// Reporting and admin removal for a list of Food Posts, the same wherever
// posts show (Community, someone's profile): `actionsFor(post)` gives the
// card its menu actions (Report and Block on others' posts; Remove post for
// admins), and `sheets` renders the report sheet and the confirmations.
export function usePostModeration(list: PostList, viewerId: string | null, onToast: (message: string, tone: "success" | "error") => void) {
  const { isAdmin } = useAuth();
  const [reporting, setReporting] = useState<FoodPost | null>(null);
  const [removing, setRemoving] = useState<FoodPost | null>(null);
  const [blocking, setBlocking] = useState<FoodPost | null>(null);

  const actionsFor = (post: FoodPost) => {
    const own = !!viewerId && post.user_id === viewerId;
    return {
      onReport: !own && viewerId ? () => setReporting(post) : undefined,
      onBlock: !own && viewerId ? () => setBlocking(post) : undefined,
      onAdminRemove: isAdmin && !own ? () => setRemoving(post) : undefined,
    };
  };

  const submitReport = async (reason: Parameters<PostList["report"]>[1], note: string) => {
    if (!reporting) return;
    const ok = await list.report(reporting, reason, note);
    setReporting(null);
    onToast(ok ? "Thanks for reporting. We'll take a look." : "Couldn't send your report. Please try again.", ok ? "success" : "error");
  };

  const confirmBlock = async () => {
    const post = blocking;
    setBlocking(null);
    if (!post) return;
    const ok = await list.block(post);
    const name = post.display_name ?? "them";
    onToast(ok ? `Blocked ${name}. You won't see their posts.` : "Couldn't block. Please try again.", ok ? "success" : "error");
  };

  const confirmRemove = async () => {
    const post = removing;
    setRemoving(null);
    if (!post) return;
    const ok = await list.adminRemove(post);
    onToast(ok ? "Post removed. It's hidden for everyone." : "Couldn't remove the post. Please try again.", ok ? "success" : "error");
  };

  const sheets = (
    <>
      <ReportPostSheet post={reporting} onClose={() => setReporting(null)} onSubmit={submitReport} />
      <ConfirmSheet
        visible={!!blocking}
        title={`Block ${blocking?.display_name ?? "this person"}?`}
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
            You won&apos;t see their posts anymore. They won&apos;t be told. You can unblock them anytime in Settings → Blocked
            accounts.
          </Text>
        }
        confirmLabel="Block"
        onCancel={() => setBlocking(null)}
        onConfirm={() => void confirmBlock()}
      />
      <ConfirmSheet
        visible={!!removing}
        title="Remove this post?"
        body={
          <Text className="mt-1 text-center font-inter-regular text-body text-web-ink-muted">
            It&apos;ll be hidden for everyone. Its poster still sees it, marked as removed. You can restore it from Reported Posts
            if it was reported.
          </Text>
        }
        confirmLabel="Remove post"
        onCancel={() => setRemoving(null)}
        onConfirm={() => void confirmRemove()}
      />
    </>
  );

  return { actionsFor, sheets };
}
