import OnboardingScreen from "./OnboardingScreen";

// Settings' "How AnoUlam works": onboarding's slides again, as a tour you
// can skip (see OnboardingScreen's `tour`). Opens over Settings.
export default function OnboardingTourScreen() {
  return <OnboardingScreen tour />;
}
