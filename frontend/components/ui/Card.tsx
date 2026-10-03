import { ReactNode } from "react";
import { View } from "react-native";

// Background/border live in the variant (not the base classes) so a variant
// can change them; a conflicting color passed via className doesn't
// reliably win over one already in the base string.
// "outlined": 1px border, no shadow. For cards repeated in a list (e.g. a
// meal's ingredients), where a shadow on every item gets visually busy.
// "highlighted": tinted fill + stronger border, to single one card out of
// a list (e.g. the cheapest price source).
const variantClass = {
  elevated: "bg-white border-primary/10 shadow-sm",
  outlined: "bg-white border-primary/10",
  highlighted: "bg-primary/5 border-primary/30",
} as const;

type CardProps = {
  children: ReactNode;
  className?: string;
  variant?: keyof typeof variantClass;
};

export function Card({ children, className = "", variant = "elevated" }: CardProps) {
  return <View className={`rounded-2xl p-4 border ${variantClass[variant]} ${className}`}>{children}</View>;
}
