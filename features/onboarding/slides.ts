// Placeholder copy — swap title/description for real content per slide.
// Once GIFs are dropped into assets/onboarding/, wire them in as:
//   image: require("@/assets/onboarding/slide-1.gif")

export type OnboardingSlideData = {
  id: string;
  title: string;
  description: string;
  image?: number;
};

export const onboardingSlides: OnboardingSlideData[] = [
  { id: "1", title: "Slide 1 headline", description: "Placeholder description — swap with real copy." },
  { id: "2", title: "Slide 2 headline", description: "Placeholder description — swap with real copy." },
  { id: "3", title: "Slide 3 headline", description: "Placeholder description — swap with real copy." },
  { id: "4", title: "Slide 4 headline", description: "Placeholder description — swap with real copy." },
  { id: "5", title: "Slide 5 headline", description: "Placeholder description — swap with real copy." },
  { id: "6", title: "Slide 6 headline", description: "Placeholder description — swap with real copy." },
  { id: "7", title: "Slide 7 headline", description: "Placeholder description — swap with real copy." },
];
