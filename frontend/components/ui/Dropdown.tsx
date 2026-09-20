import { ReactNode, useRef, useState } from "react";
import { Modal, Pressable, View, useWindowDimensions } from "react-native";
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
};

// Generic anchored menu — measures the trigger's on-screen position so the
// menu opens right below/aligned to it, rather than a full-screen sheet.
export function Dropdown({ trigger, items, headerLabel, headerIcon }: DropdownProps) {
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const triggerRef = useRef<View>(null);
  const { width: screenWidth } = useWindowDimensions();

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setPosition({ top: y + height + 8, right: screenWidth - (x + width) });
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
            style={{ position: "absolute", top: position.top, right: position.right }}
            className="min-w-[200px] rounded-2xl border border-ink-emphasis/10 bg-white py-2"
          >
            {headerLabel && (
              <View className="flex-row items-center gap-2 border-b border-ink-emphasis/10 px-4 py-2.5">
                {headerIcon}
                <AppText variant="bodyBold">{headerLabel}</AppText>
              </View>
            )}
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
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
