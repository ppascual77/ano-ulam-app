import { View } from "react-native";
import { Check } from "lucide-react-native";
import { colors } from "@/frontend/constants/theme";

// Display-only checkbox for admin pick lists; the row around it handles the
// press, so the whole row is the touch target.
export function Checkbox({ checked }: { checked: boolean }) {
  return (
    <View
      className={`w-6 h-6 mt-0.5 rounded-md items-center justify-center ${checked ? "bg-primary" : "border border-primary/20"}`}
    >
      {checked && <Check color={colors.white} size={14} />}
    </View>
  );
}
