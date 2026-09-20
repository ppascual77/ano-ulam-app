import { ReactNode, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, View, useWindowDimensions } from "react-native";
import { AppText } from "./AppText";

export type DropdownItem = {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
};

type DropdownProps = {
  trigger: ReactNode;
  items: DropdownItem[];
  /** Optional header row above the items (e.g. "Admin" + a lock icon). */
  headerLabel?: string;
  headerIcon?: ReactNode;
  /** Size the menu to the trigger's own width instead of its content —
   *  use when the trigger is a full-width field (e.g. a select-style
   *  dropdown) so the menu aligns with its container instead of sizing to
   *  its (possibly much wider) label text and running off-screen. */
  matchTriggerWidth?: boolean;
};

const SCREEN_MARGIN = 16;

// Generic anchored menu — measures the trigger's on-screen position so the
// menu opens right below/aligned to it, rather than a full-screen sheet.
export function Dropdown({ trigger, items, headerLabel, headerIcon, matchTriggerWidth }: DropdownProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0, left: 0, width: 0, maxHeight: 400 });
  const triggerRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      const top = y + height + 8;
      // Clamp to the space actually left below the trigger so a long list
      // scrolls internally instead of rendering past the bottom of the
      // screen where it can't be read or tapped.
      const maxHeight = Math.max(120, screenHeight - top - SCREEN_MARGIN);
      setPosition({ top, right: screenWidth - (x + width), left: x, width, maxHeight });
      setVisible(true);
    });
  };

  const selectItem = (item: DropdownItem) => {
    setVisible(false);
    item.onPress();
  };

  return (
    <>
      <View ref={triggerRef} collapsable={false}>
        <Pressable onPress={open}>{trigger}</Pressable>
      </View>

      <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
        <Pressable className="flex-1" onPress={() => setVisible(false)}>
          <Pressable
            onPress={() => {}}
            style={[
              { position: "absolute", top: position.top, maxHeight: position.maxHeight },
              matchTriggerWidth
                ? { left: position.left, width: position.width }
                : { right: position.right },
            ]}
            className={`rounded-2xl border border-ink-emphasis/10 bg-white py-2 ${matchTriggerWidth ? "" : "min-w-[200px]"}`}
          >
            {headerLabel && (
              <View className="flex-row items-center gap-2 border-b border-ink-emphasis/10 px-4 py-2.5">
                {headerIcon}
                <AppText variant="bodyBold">{headerLabel}</AppText>
              </View>
            )}
            <ScrollView bounces={false}>
              {items.map((item, i) => (
                <Pressable
                  key={i}
                  onPress={() => selectItem(item)}
                  className="flex-row items-center gap-3 px-4 py-3 active:bg-ink-emphasis/5"
                >
                  {item.icon}
                  <AppText variant="body">{item.label}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
