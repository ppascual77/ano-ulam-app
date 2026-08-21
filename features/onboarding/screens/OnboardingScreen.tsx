import { useRef, useState } from "react";
import {
  View,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from "react-native";
import { router } from "expo-router";
import * as Haptics from "expo-haptics";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Check } from "lucide-react-native";
import { Button, CarouselIndicator } from "@/components/ui";
import { colors } from "@/constants/theme";
import { ContentSlide } from "../components/ContentSlide";
import { PreferencesSlide } from "../components/PreferencesSlide";
import { PreferenceGroupsSlide } from "../components/PreferenceGroupsSlide";
import { AccountPitchSlide } from "../components/AccountPitchSlide";
import { RotatingBlob, type RotatingBlobHandle } from "../components/RotatingBlob";
import { onboardingSlides, type OnboardingSlideData } from "../slides";

function renderSlide(slide: OnboardingSlideData, width: number) {
  switch (slide.type) {
    case "preferences":
      return <PreferencesSlide key={slide.id} slide={slide} width={width} />;
    case "preferenceGroups":
      return <PreferenceGroupsSlide key={slide.id} slide={slide} width={width} />;
    case "accountPitch":
      return <AccountPitchSlide key={slide.id} slide={slide} width={width} />;
    case "content":
      return <ContentSlide key={slide.id} slide={slide} width={width} />;
  }
}

export default function OnboardingScreen() {
  const { width } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);
  const topBlobRef = useRef<RotatingBlobHandle>(null);
  const bottomBlobRef = useRef<RotatingBlobHandle>(null);
  const [index, setIndex] = useState(0);
  const isLast = index === onboardingSlides.length - 1;

  // Fires the blob speed-boost partway through a slide transition (tap or
  // swipe) rather than waiting for it to fully settle, so it lands closer
  // to the tail end of the motion instead of right after it stops.
  const scrollStartOffsetRef = useRef(0);
  const hasPulsedRef = useRef(false);
  const PULSE_TRIGGER_FRACTION = 0.7;

  const pulseBlobs = () => {
    topBlobRef.current?.pulse();
    bottomBlobRef.current?.pulse();
  };

  const goToHome = () => router.replace("/home");

  const handleScrollBeginDrag = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollStartOffsetRef.current = e.nativeEvent.contentOffset.x;
    hasPulsedRef.current = false;
  };

  const handleScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (hasPulsedRef.current) return;
    const distanceTraveled = Math.abs(
      e.nativeEvent.contentOffset.x - scrollStartOffsetRef.current,
    );
    if (distanceTraveled > width * PULSE_TRIGGER_FRACTION) {
      hasPulsedRef.current = true;
      pulseBlobs();
    }
  };

  const handleScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIndex(Math.round(e.nativeEvent.contentOffset.x / width));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleNext = () => {
    if (isLast) {
      goToHome();
      return;
    }
    scrollStartOffsetRef.current = width * index;
    hasPulsedRef.current = false;
    scrollRef.current?.scrollTo({ x: width * (index + 1), animated: true });
  };

  return (
    <View style={{ flex: 1 }} className="bg-white">
      <View className="absolute inset-0">
        <RotatingBlob
          ref={topBlobRef}
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          top="-110%"
          height={2000}
        />
        <RotatingBlob
          ref={bottomBlobRef}
          source={require("@/assets/onboarding/blob-bg/circular-blob.png")}
          aspectRatio={1800 / 1755}
          bottom="-110%"
          height={2000}
        />
      </View>
      <SafeAreaView edges={["top", "bottom"]} style={{ flex: 1 }}>
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScrollBeginDrag={handleScrollBeginDrag}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          onMomentumScrollEnd={handleScrollEnd}
          className="flex-1"
          contentContainerStyle={{ flexGrow: 1 }}
        >
          {onboardingSlides.map((slide) => renderSlide(slide, width))}
        </ScrollView>

        <View className="flex-row items-center justify-between px-10 mb-6">
          <CarouselIndicator
            total={onboardingSlides.length}
            activeIndex={index}
          />
          <Button
            icon={
              isLast ? (
                <Check color={colors.white} size={24} />
              ) : (
                <ArrowRight color={colors.white} size={24} />
              )
            }
            variant="primary"
            shape="circle"
            onPress={handleNext}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
