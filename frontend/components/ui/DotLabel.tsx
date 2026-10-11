import { View } from "react-native";
import { AppText } from "./AppText";

// "● MEAT": eyebrow label with the accent dot as its bullet. Labels a card
// or block inside a sheet (Price Watch's detail, the saved-meals summary).
export function DotLabel({ children, className = "" }: { children: string; className?: string }) {
  return (
    <View className={`flex-row items-center gap-2 ${className}`}>
      <View className="h-2 w-2 rounded-full bg-accent" />
      <AppText variant="eyebrow">{children}</AppText>
    </View>
  );
}
