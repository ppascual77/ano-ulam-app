import { Image, Linking, Pressable, Text, View } from "react-native";
import { WEB_APP_URL } from "@/frontend/core/posts/components/OfficialPostCard";

const SOCIALS = [
  // Same icon files as the web footer (lucide has no brand marks).
  { label: "Facebook", icon: require("@/assets/icons/social/fb_icon.png"), url: "https://www.facebook.com/people/AnoUlam/61589833562404/" },
  { label: "Instagram", icon: require("@/assets/icons/social/ig_icon.png"), url: "https://www.instagram.com/anoulam.app/" },
  { label: "TikTok", icon: require("@/assets/icons/social/tt_icon.png"), url: "https://www.tiktok.com/@anoulamapp?lang=en" },
];

const LINKS = [
  { label: "Terms of Service", url: `${WEB_APP_URL}/terms` },
  { label: "Privacy Policy", url: `${WEB_APP_URL}/privacy` },
  { label: "Help", url: "mailto:anoulam.app@gmail.com" },
];

// Socials, legal links and copyright at the bottom of Profile.
export function ProfileFooter() {
  return (
    <View className="mt-5 items-center gap-2 bg-web-divider/50 px-4 pb-10 pt-6">
      <View className="flex-row gap-5 opacity-50">
        {SOCIALS.map(({ label, icon, url }) => (
          <Pressable key={label} accessibilityLabel={label} onPress={() => Linking.openURL(url)} hitSlop={8}>
            <Image source={icon} style={{ width: 15, height: 15 }} />
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center gap-1.5">
        {LINKS.map((link, i) => (
          <View key={link.label} className="flex-row items-center gap-1.5">
            {i > 0 && <Text className="font-inter-light text-sub text-web-ink-muted">·</Text>}
            <Pressable onPress={() => Linking.openURL(link.url)} hitSlop={6}>
              <Text className="font-inter-light text-sub text-web-ink-muted">{link.label}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text className="font-inter-light text-sub text-web-ink-muted">© 2026 Ano Ulam. All rights reserved.</Text>
    </View>
  );
}
