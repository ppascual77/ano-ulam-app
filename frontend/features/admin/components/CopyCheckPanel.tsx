import { View } from "react-native";
import { AlertTriangle, CheckCircle2 } from "lucide-react-native";
import { AppText, NoticeBanner } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import { MIN_COPIED_WORDS, type CopiedRun } from "../utils/verbatimCheck";

type CopyCheckPanelProps = {
  /** null: the import didn't return the source text (an older deploy of
   *  import-meal-from-url), so there's nothing to compare against. */
  runs: CopiedRun[] | null;
};

// Seed Meal's copy check (see verbatimCheck.ts): lists text in the
// description or steps that matches the source page word for word, to be
// rewritten before saving. Updates as the admin edits.
export function CopyCheckPanel({ runs }: CopyCheckPanelProps) {
  const summary =
    runs === null
      ? { ok: false, title: "Can't check this import", detail: "Redeploy import-meal-from-url, then import the recipe again." }
      : runs.length > 0
        ? { ok: false, title: `${runs.length} copied ${runs.length === 1 ? "passage" : "passages"} to rewrite`, detail: "Reword these in the description or steps. Saving is blocked until they're gone." }
        : { ok: true, title: "Description and steps are in our own words", detail: null };

  return (
    <View className="mb-6 gap-4 rounded-2xl border border-ink-emphasis/10 p-5">
      <View className="gap-1">
        <AppText variant="sectionSubtitle" dot>
          Copy check
        </AppText>
        <AppText variant="caption" className="text-ink-subtle">
          Updates as you edit. Flags {MIN_COPIED_WORDS}+ words in a row taken from the source page. Ingredients aren't checked.
        </AppText>
      </View>

      <NoticeBanner
        tone={summary.ok ? "positive" : "notice"}
        icon={summary.ok ? <CheckCircle2 color={colors.primary} size={18} /> : <AlertTriangle color={colors.notice.icon} size={18} />}
      >
        <AppText variant="bodyBold" className={summary.ok ? "text-primary" : "text-notice-text"}>
          {summary.title}
        </AppText>
        {!!summary.detail && (
          <AppText variant="caption" className="text-notice-text">
            {summary.detail}
          </AppText>
        )}
      </NoticeBanner>

      {runs && runs.length > 0 && (
        <View className="gap-3">
          {runs.map((run, i) => (
            <View key={i} className="gap-1 border-b border-ink-emphasis/5 pb-3">
              <AppText variant="bodyBold">{run.label}</AppText>
              <AppText variant="body" className="text-ink-subtle">
                “{run.phrase}”
              </AppText>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
