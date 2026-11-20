import { useEffect, useState } from "react";
import { FlatList, RefreshControl, View } from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Mail, Shield } from "lucide-react-native";
import { Text } from "@/frontend/components/ui/Text";
import { AppText, Avatar, Button, ErrorState, LoadingState, Screen, SearchBar, Spinner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { ADMIN_USERS_PAGE, listAdminUsers, type AdminUser } from "@/api/adminUsers";
import { AdminHeader } from "../components/AdminHeader";
import { FilterPill } from "../components/FilterPill";

// Admin > Manage Users: every account, newest first, read-only (the same
// list as the web admin's Manage Users page): name, email, plan, admin,
// joined, last sign-in, newsletter. Search by email or name, filter Free /
// Pro, 50 at a time.

const PLAN_OPTIONS = [
  { id: "free", label: "Free" },
  { id: "pro", label: "Pro" },
];

const SEARCH_DEBOUNCE_MS = 300;

/** "3h ago", "12d ago", "never". */
function timeAgo(iso: string | null): string {
  if (!iso) return "never";
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months}mo ago` : `${Math.floor(months / 12)}y ago`;
}

const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });

function Badge({ label, tone }: { label: string; tone: "pro" | "earned" | "admin" | "free" }) {
  const styles = {
    pro: { bg: "bg-primary/10", text: "text-primary" },
    earned: { bg: "bg-accent/10", text: "text-accent" },
    admin: { bg: "bg-ink-emphasis/5", text: "text-ink-emphasis" },
    free: { bg: "bg-ink-emphasis/5", text: "text-ink-subtle" },
  }[tone];
  return (
    <View className={`flex-row items-center gap-1 rounded-full px-2 py-0.5 ${styles.bg}`}>
      {tone === "admin" && <Shield color={colors.ink.emphasis} size={10} />}
      <Text className={`font-inter-bold text-sub uppercase tracking-wide ${styles.text}`}>{label}</Text>
    </View>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const name = user.displayName?.trim() || null;
  return (
    <View className="flex-row gap-3 border-b border-ink-emphasis/10 px-5 py-3.5">
      <Avatar name={name ?? user.email ?? "User"} imageUri={user.avatarUrl ?? undefined} size={40} />
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-1.5">
          <Text numberOfLines={1} className={`shrink font-inter-semibold text-body ${name ? "text-ink-emphasis" : "text-ink-subtle"}`}>
            {name ?? "(no name)"}
          </Text>
          {user.plan === "subscriber" && <Badge label="Pro" tone="pro" />}
          {user.plan === "earned" && <Badge label="Earned Pro" tone="earned" />}
          {user.plan === "free" && <Badge label="Free" tone="free" />}
          {user.isAdmin && <Badge label="Admin" tone="admin" />}
        </View>
        <Text numberOfLines={1} className="font-inter-regular text-small text-ink-subtle">
          {user.email ?? "No email"}
        </Text>
        <View className="flex-row flex-wrap items-center gap-x-2 gap-y-0.5">
          <Text className="font-inter-regular text-small text-ink-subtle">Joined {formatDate(user.createdAt)}</Text>
          <Text className="font-inter-regular text-small text-ink-subtle">· Last sign-in {timeAgo(user.lastSignInAt)}</Text>
          {user.newsletterSubscribed && (
            <View className="flex-row items-center gap-1">
              <Mail color={colors.primary} size={11} />
              <Text className="font-inter-medium text-small text-primary">Newsletter</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

export default function ManageUsersScreen() {
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [plan, setPlan] = useState<"free" | "pro" | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [search]);

  const users = useInfiniteQuery({
    queryKey: ["admin", "users", query, plan ?? "all"],
    queryFn: ({ pageParam }) => listAdminUsers({ query, plan, offset: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => {
      const loaded = pages.reduce((n, page) => n + page.users.length, 0);
      return last.users.length === ADMIN_USERS_PAGE && loaded < last.total ? loaded : undefined;
    },
  });

  const rows = users.data?.pages.flatMap((page) => page.users) ?? [];
  const total = users.data?.pages[0]?.total ?? 0;
  const filtered = !!query || !!plan;
  const subtitle = users.isLoading ? "Loading…" : `${total} ${filtered ? "matching" : total === 1 ? "user" : "users"}`;

  return (
    <Screen padded={false}>
      <AdminHeader title="Manage Users" subtitle={subtitle} />
      <View className="gap-3 px-5 pb-3">
        <SearchBar value={search} onChangeText={setSearch} onClear={() => setSearch("")} placeholder="Search by email or name" autoCapitalize="none" autoCorrect={false} />
        <View className="flex-row">
          <FilterPill label="plans" value={plan} options={PLAN_OPTIONS} onChange={(value) => setPlan(value as "free" | "pro" | undefined)} />
        </View>
      </View>
      {users.isError ? (
        <ErrorState message="Couldn't load users. Check your connection and try again." onRetry={() => void users.refetch()} />
      ) : users.isLoading ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(user) => user.id}
          renderItem={({ item }) => <UserRow user={item} />}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={users.isRefetching && !users.isFetchingNextPage} onRefresh={() => void users.refetch()} />}
          contentContainerStyle={{ paddingBottom: 40 }}
          ListEmptyComponent={
            <AppText variant="body" className="mt-8 px-5 text-center">
              No users match these filters.
            </AppText>
          }
          ListFooterComponent={
            users.hasNextPage ? (
              <View className="items-center px-5 pt-5">
                {users.isFetchingNextPage ? (
                  <Spinner color={colors.primary} />
                ) : (
                  <Button label="Load more" variant="outline" shape="pill" onPress={() => void users.fetchNextPage()} />
                )}
              </View>
            ) : undefined
          }
        />
      )}
    </Screen>
  );
}
