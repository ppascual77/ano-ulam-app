import { View } from "react-native";
import { AppText } from "./AppText";
import { Button } from "./Button";

type ErrorStateProps = {
  message?: string;
  onRetry?: () => void;
};

// Full-bleed centered error message for a screen/section whose query failed
// (e.g. useMeals() after exhausting retries). Pass onRetry to show a button
// that calls the query's refetch.
export function ErrorState({
  message = "Something went wrong. Please try again.",
  onRetry,
}: ErrorStateProps) {
  return (
    <View className="flex-1 items-center justify-center gap-4 py-12 px-6">
      <AppText variant="body" className="text-center">
        {message}
      </AppText>
      {onRetry && <Button label="Retry" variant="outline" shape="pill" onPress={onRetry} />}
    </View>
  );
}
