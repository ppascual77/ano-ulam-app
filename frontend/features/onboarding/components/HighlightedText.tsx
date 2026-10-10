import { Text } from "react-native";

type HighlightedTextProps = {
  /** Wrap key phrases in **double asterisks** to highlight them. */
  children: string;
  className?: string;
};

// Onboarding's explanation text: 16px body ink, with the slide's key
// phrases (marked **like this** in slides.ts) in semibold brand green, so a
// quick skim still catches the point.
export function HighlightedText({ children, className = "" }: HighlightedTextProps) {
  // Splitting on the markers alternates plain, highlighted, plain, ...
  const parts = children.split("**");
  return (
    <Text className={`font-inter-regular text-body-lg text-ink ${className}`}>
      {parts.map((part, i) =>
        i % 2 === 1 ? (
          <Text key={i} className="font-inter-semibold text-primary">
            {part}
          </Text>
        ) : (
          part
        ),
      )}
    </Text>
  );
}
