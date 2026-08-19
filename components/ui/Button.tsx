import { Pressable, PressableProps } from "react-native";
import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "outline";

const containerClasses: Record<Variant, string> = {
  primary: "bg-primary active:opacity-80",
  secondary: "bg-accent active:opacity-80",
  outline: "bg-transparent border border-primary active:bg-primary/5",
};

const labelClasses: Record<Variant, string> = {
  primary: "text-white",
  secondary: "text-white",
  outline: "text-primary",
};

type ButtonProps = PressableProps & {
  label: string;
  variant?: Variant;
};

export function Button({ label, variant = "primary", ...props }: ButtonProps) {
  return (
    <Pressable
      className={`rounded-xl px-5 py-3.5 items-center justify-center ${containerClasses[variant]}`}
      {...props}
    >
      <AppText variant="bodyBold" className={labelClasses[variant]}>
        {label}
      </AppText>
    </Pressable>
  );
}
