import { Linking, Pressable, ScrollView, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ArrowLeft } from "lucide-react-native";
import { AppText, Screen } from "@/frontend/components/ui";
import { colors } from "@/frontend/constants/theme";
import type { LegalBlock, LegalDocument } from "../content";

// **bold** and [label](url), the only inline formatting in content.ts.
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function RichText({ children }: { children: string }) {
  return (
    <Text className="font-inter-regular text-body leading-6 text-ink">
      {children.split(INLINE).map((part, i) => {
        if (part.startsWith("**")) {
          return (
            <Text key={i} className="font-inter-semibold text-ink-emphasis">
              {part.slice(2, -2)}
            </Text>
          );
        }
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return (
            <Text key={i} onPress={() => void Linking.openURL(link[2])} className="font-inter-semibold text-primary underline">
              {link[1]}
            </Text>
          );
        }
        return part;
      })}
    </Text>
  );
}

function Block({ block }: { block: LegalBlock }) {
  if ("paragraph" in block) return <RichText>{block.paragraph}</RichText>;
  return (
    <View className="gap-2">
      {block.bullets.map((bullet, i) => (
        <View key={i} className="flex-row gap-3">
          <View className="mt-2 h-1.5 w-1.5 rounded-full bg-accent" />
          <View className="flex-1">
            <RichText>{bullet}</RichText>
          </View>
        </View>
      ))}
    </View>
  );
}

// A legal page (Terms, Privacy) in the app's own style: back arrow and a
// dotted title like Settings, then numbered dotted sections.
export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const insets = useSafeAreaInsets();
  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <View className="flex-row items-center gap-3 px-5 pb-2 pt-4">
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Back">
          <ArrowLeft color={colors.ink.emphasis} size={22} />
        </Pressable>
        <AppText variant="sectionTitle" dot>
          {document.title}
        </AppText>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Bottom padding clears the home indicator (top-only safe area). */}
        <View className="gap-8 px-5" style={{ paddingBottom: insets.bottom + 40 }}>
          <AppText variant="caption">Last updated: {document.updated}</AppText>
          {document.sections.map((section, i) => (
            <View key={section.title} className="gap-3">
              <AppText variant="sectionSubtitle" dot>
                {`${i + 1}. ${section.title}`}
              </AppText>
              {section.blocks.map((block, j) => (
                <Block key={j} block={block} />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </Screen>
  );
}
