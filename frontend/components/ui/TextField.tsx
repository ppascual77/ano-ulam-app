import { ReactNode, useEffect, useState } from "react";
import { Text, TextInput, TextInputProps, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
  interpolateColor,
  interpolate,
} from "react-native-reanimated";
import { colors } from "@/frontend/constants/theme";

type TextFieldProps = TextInputProps & {
  /** The field's label. Where it shows depends on labelPosition. */
  label: string;
  icon?: ReactNode;
  /** "floating" (default): the label sits inside as a placeholder and
   *  animates up/small once focused or filled. "outside": a static label
   *  above the box (forms with several short fields, e.g. Add a Recipe);
   *  `placeholder` is only used in this mode. */
  labelPosition?: "floating" | "outside";
  /** Short unit text inside the box on the right, e.g. "mins". */
  suffix?: string;
  /** Invalid: the border fades to red (and back once valid). Used instead
   *  of red error text, which reads like a system error. */
  error?: boolean;
  /** Bump (e.g. a form's submit-attempt count) to shake the field again
   *  while it's still invalid. */
  shakeKey?: number;
};

// Red-border fade + shake for an invalid field, shared by TextField and any
// custom input that needs the same error behavior (e.g. Add a Recipe's
// quantity boxes). Interpolate `errorProgress` into the border color and
// apply `shakeStyle` to the field's outer view.
export function useFieldErrorAnimation(error: boolean, shakeKey: number) {
  const errorProgress = useSharedValue(error ? 1 : 0);
  const shake = useSharedValue(0);

  useEffect(() => {
    errorProgress.value = withTiming(error ? 1 : 0, { duration: 220 });
  }, [error, errorProgress]);

  // A quick nudge left, then a loose spring back through center: reads as
  // a left-right shake that settles, to catch the eye without alarming.
  useEffect(() => {
    if (!error) return;
    shake.value = withSequence(
      withTiming(-10, { duration: 50 }),
      withSpring(0, { damping: 4, stiffness: 400, mass: 0.5 }),
    );
    // Shake when the field becomes invalid, and again per submit attempt.
  }, [error, shakeKey, shake]);

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  return { errorProgress, shakeStyle };
}

// Label above a field: shared by TextField and SelectField's "outside" mode
// so the two line up in the same row.
export function OutsideLabel({ children }: { children: string }) {
  return <Text className="mb-1.5 font-inter-semibold text-small text-ink-subtle">{children}</Text>;
}

// No fill out of focus — just the border; focused fills white for contrast
// against the primary border.
const UNFOCUSED_BG = "rgba(0, 0, 0, 0)";
const UNFOCUSED_BORDER = "rgba(43, 52, 55, 0.1)";

export function TextField({
  label,
  icon,
  value,
  onFocus,
  onBlur,
  className = "",
  multiline,
  numberOfLines,
  labelPosition = "floating",
  suffix,
  placeholder,
  error = false,
  shakeKey = 0,
  ...props
}: TextFieldProps) {
  const { errorProgress, shakeStyle } = useFieldErrorAnimation(error, shakeKey);
  const [isFocused, setIsFocused] = useState(false);
  const isFloating = isFocused || !!value;
  // Label position reacts to isFloating (focus OR has a value, so it never
  // overlaps a prepopulated value); border/background color reacts to
  // isFocused alone, so a prepopulated-but-unfocused field doesn't look
  // focused.
  const labelProgress = useSharedValue(isFloating ? 1 : 0);
  const focusProgress = useSharedValue(isFocused ? 1 : 0);

  useEffect(() => {
    labelProgress.value = withTiming(isFloating ? 1 : 0, { duration: 180 });
  }, [isFloating, labelProgress]);

  useEffect(() => {
    focusProgress.value = withTiming(isFocused ? 1 : 0, { duration: 180 });
  }, [isFocused, focusProgress]);

  const containerStyle = useAnimatedStyle(() => {
    const baseBorder = interpolateColor(focusProgress.value, [0, 1], [UNFOCUSED_BORDER, colors.primary]);
    return {
      backgroundColor: interpolateColor(focusProgress.value, [0, 1], [UNFOCUSED_BG, colors.white]),
      borderColor: interpolateColor(errorProgress.value, [0, 1], [baseBorder, colors.like]),
    };
  });

  const labelStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(labelProgress.value, [0, 1], [0, -12]) },
      { scale: interpolate(labelProgress.value, [0, 1], [1, 0.72]) },
    ],
  }));

  const focusHandlers = {
    onFocus: (e: Parameters<NonNullable<TextInputProps["onFocus"]>>[0]) => {
      setIsFocused(true);
      onFocus?.(e);
    },
    onBlur: (e: Parameters<NonNullable<TextInputProps["onBlur"]>>[0]) => {
      setIsFocused(false);
      onBlur?.(e);
    },
  };

  // Static label above a compact box: same focus border/fill as floating.
  if (labelPosition === "outside") {
    return (
      <Animated.View style={shakeStyle} className={className}>
        {/* Empty label: a heading above already names the field (pass
            accessibilityLabel instead). */}
        {!!label && <OutsideLabel>{label}</OutsideLabel>}
        <Animated.View
          style={[
            // Same 55px height / 18px value as the floating-label fields.
            multiline ? { borderRadius: 12, borderWidth: 1, minHeight: 104 } : { borderRadius: 12, borderWidth: 1, height: 55 },
            containerStyle,
          ]}
          className={`flex-row px-4 ${multiline ? "items-start py-3" : "items-center"}`}
        >
          {icon}
          <TextInput
            value={value}
            {...focusHandlers}
            placeholder={placeholder}
            placeholderTextColor={colors.ink.placeholder}
            multiline={multiline}
            numberOfLines={numberOfLines}
            textAlignVertical={multiline ? "top" : undefined}
            // Semibold once there's a value; regular while empty, since RN
            // draws the placeholder in the input's own font and it should
            // stay clearly secondary.
            className={`flex-1 text-subheading text-ink-emphasis ${value ? "font-inter-semibold" : "font-inter-regular"} ${
              icon ? "ml-2" : ""
            }`}
            style={{ padding: 0 }}
            {...props}
          />
          {suffix && <Text className="ml-2 font-inter-regular text-body text-ink-subtle">{suffix}</Text>}
        </Animated.View>
      </Animated.View>
    );
  }

  // Multiline fields (procedure steps, descriptions) shouldn't clip to the
  // single-line height — the container grows with content instead of
  // fixing it, so a long step is fully visible rather than scrolling
  // inside a tiny box.
  return (
    <Animated.View
      style={[
        multiline ? { borderRadius: 16, borderWidth: 1, minHeight: 55 } : { borderRadius: 16, borderWidth: 1, height: 55 },
        containerStyle,
        shakeStyle,
      ]}
      className={`flex-row items-center px-4 ${multiline ? "py-3" : ""} ${className}`}
    >
      {icon}
      <View
        className={`ml-2 flex-1 ${multiline ? "" : "justify-center"}`}
        style={multiline ? { minHeight: 44 } : { height: 44 }}
      >
        <Animated.View
          style={[
            { position: "absolute", left: 0, right: 0, transformOrigin: "left" },
            labelStyle,
          ]}
        >
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            className="font-inter-medium text-body text-ink-subtle"
          >
            {label}
          </Text>
        </Animated.View>
        <TextInput
          value={value}
          {...focusHandlers}
          multiline={multiline}
          numberOfLines={numberOfLines}
          textAlignVertical={multiline ? "top" : undefined}
          className="font-inter-regular text-subheading text-ink-emphasis"
          style={{ marginTop: isFloating ? 16 : 0, padding: 0 }}
          {...props}
        />
      </View>
      {suffix && <Text className="ml-2 font-inter-regular text-small text-ink-subtle">{suffix}</Text>}
    </Animated.View>
  );
}
