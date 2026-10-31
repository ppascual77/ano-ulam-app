import { View } from "react-native";
import { AppText, BottomSheet, DotMorphButton } from "@/frontend/components/ui";
import { NumbersReel } from "./NumbersReel";
import { type DotPoint } from "./NumbersDot";

type NumbersExplainerSheetProps = {
  visible: boolean;
  /** Backdrop tap or drag down: just closes. */
  onClose: () => void;
  /** "Got it": the button has become a dot at `from`; close the sheet and
   *  fly it home. Null under reduce motion (no dot). */
  onGotIt: (from: DotPoint | null) => void;
  reduceMotion: boolean;
};

// Onboarding's "Where do our numbers come from?": the reel (NumbersReel)
// plays on open and ends on its summary. Inline (not a native Modal) so the
// dot "Got it" turns into can fly over the closing sheet.
export function NumbersExplainerSheet({ visible, onClose, onGotIt, reduceMotion }: NumbersExplainerSheetProps) {
  return (
    <BottomSheet visible={visible} onClose={onClose} fitContent presentation="inline">
      <View className="gap-5 px-6 pb-10 pt-8">
        <AppText variant="sectionTitle" dot>
          Where our numbers come from
        </AppText>

        {/* Mounted only while open, so it plays from the start each time. */}
        {visible && <NumbersReel />}

        {visible && <DotMorphButton label="Got it" onDone={onGotIt} reduceMotion={reduceMotion} />}
      </View>
    </BottomSheet>
  );
}
