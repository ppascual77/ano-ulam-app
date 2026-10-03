import { Pressable, Text, View } from "react-native";
import { BottomSheet } from "@/frontend/components/ui";

export type CreateChoice = "post" | "recipe";

type CreateSheetProps = {
  visible: boolean;
  onClose: () => void;
  onChoose: (choice: CreateChoice) => void;
  /** Fires once the close animation finishes: open the next sheet from here
   *  so two Modals are never presented at once (see BottomSheet). */
  onClosed?: () => void;
};

const ROWS: { choice: CreateChoice; title: string; subtitle: string }[] = [
  { choice: "post", title: "Share a Food Post", subtitle: "Post a photo and caption about anything food." },
  { choice: "recipe", title: "Add a Recipe", subtitle: "Share ingredients, macros & pricing with the community." },
];

// "Create" chooser, opened by the Create button's second tap.
export function CreateSheet({ visible, onClose, onChoose, onClosed }: CreateSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} onClosed={onClosed} heightPercent={0.5} fitContent>
      <View className="px-6 pb-6 pt-12">
        <Text className="mb-2 font-inter-bold text-subheading text-web-ink">Create</Text>
        {ROWS.map((row, i) => (
          <Pressable
            key={row.choice}
            onPress={() => onChoose(row.choice)}
            className={`py-4 ${i > 0 ? "border-t border-web-divider" : ""}`}
          >
            <Text className="font-inter-semibold text-body text-web-ink">{row.title}</Text>
            <Text className="mt-0.5 font-inter-regular text-small text-web-ink-muted">{row.subtitle}</Text>
          </Pressable>
        ))}
      </View>
    </BottomSheet>
  );
}
