// Terms of Service and Privacy Policy, from the web app's pages
// (ano-ulam-reference/frontend/src/pages/legal), adapted where the mobile
// app differs: account deletion is in Settings, and GIF search goes
// through Klipy. Keep both apps' copies in sync when either changes.
//
// Inline formatting: **bold** and [label](url) (https: or mailto:).

export type LegalBlock = { paragraph: string } | { bullets: string[] };
export type LegalSection = { title: string; blocks: LegalBlock[] };
export type LegalDocument = { title: string; updated: string; sections: LegalSection[] };

const CONTACT_EMAIL = "anoulam.app@gmail.com";
const CONTACT_LINK = `[${CONTACT_EMAIL}](mailto:${CONTACT_EMAIL})`;

export const TERMS: LegalDocument = {
  title: "Terms of Service",
  updated: "October 2026",
  sections: [
    {
      title: "Acceptance of Terms",
      blocks: [
        {
          paragraph:
            'By accessing or using Ano Ulam ("the app"), on mobile or at **anoulam.app**, you agree to be bound by these Terms of Service. If you do not agree, please do not use the app.',
        },
      ],
    },
    {
      title: "Description of Service",
      blocks: [
        {
          paragraph:
            "Ano Ulam is a meal discovery app that helps users explore Filipino food based on their budget and nutritional preferences. Registered users may also share food-related content, including photos, captions, recipes, and general posts about food, with the community through the Community tab. The app is provided free of charge and is intended for personal, non-commercial use.",
        },
      ],
    },
    {
      title: "User Accounts",
      blocks: [
        {
          bullets: [
            "You must provide accurate information when creating an account.",
            "You are responsible for maintaining the confidentiality of your account credentials.",
            "You may not use another person's account without permission.",
            "You must be at least 13 years old to use the app.",
          ],
        },
      ],
    },
    {
      title: "Google Sign-In",
      blocks: [
        {
          paragraph:
            "You may choose to sign in using your Google account. By doing so, you authorize Ano Ulam to receive your name and email address from Google. Your use of Google Sign-In is also governed by [Google's Terms of Service](https://policies.google.com/terms).",
        },
      ],
    },
    {
      title: "User-Generated Content",
      blocks: [
        {
          paragraph:
            "Registered users may publish food-related content, including photos, captions, recipes, meal ideas, and any other food-related posts, which become visible to all users of the app through the Community tab and public post pages.",
        },
        {
          bullets: [
            "By submitting content, you grant Ano Ulam a non-exclusive, royalty-free license to display, store, and distribute that content within the app, including on publicly shareable post pages.",
            "You represent that you own or have the necessary rights to all content you submit, including any images uploaded.",
            "**Images:** We strongly advise against uploading images you do not own or have explicit permission to use. Uploading copyrighted images without authorization may infringe third-party rights. Ano Ulam is not responsible for any copyright claims arising from user-uploaded images.",
            "Your display name and avatar will be shown alongside any content you publish in the Community tab.",
            "We reserve the right to remove any content that violates these Terms or is otherwise objectionable, at our sole discretion.",
          ],
        },
      ],
    },
    {
      title: "Acceptable Use",
      blocks: [
        { paragraph: "You agree not to:" },
        {
          bullets: [
            "Use the app for any unlawful purpose.",
            "Submit content that is false, misleading, offensive, or infringes the intellectual property rights of any third party.",
            "Upload images or materials that you do not have the right to use.",
            "Attempt to gain unauthorized access to any part of the app or its infrastructure.",
            "Scrape, reproduce, or redistribute app content without permission.",
            "Interfere with the app's normal operation.",
          ],
        },
      ],
    },
    {
      title: "Intellectual Property",
      blocks: [
        {
          paragraph:
            "All original content, branding, and code in Ano Ulam are the property of the app's developers. User-submitted content, including recipes, food posts, photos, and captions, remains the property of its respective creator. You may not copy, modify, or distribute any part of the app without prior written consent.",
        },
      ],
    },
    {
      title: "Disclaimer of Warranties",
      blocks: [
        {
          paragraph:
            'The app is provided "as is" without warranties of any kind. We do not guarantee that the app will be available at all times, error-free, or that meal suggestions will meet your specific dietary needs. Community content is submitted by users and has not been independently verified for accuracy, safety, or nutritional correctness. Always consult a qualified professional for medical or nutritional advice.',
        },
      ],
    },
    {
      title: "Limitation of Liability",
      blocks: [
        {
          paragraph:
            "To the fullest extent permitted by law, Ano Ulam and its developers shall not be liable for any indirect, incidental, or consequential damages arising from your use of the app, including any claims arising from user-generated content such as food posts, photos, captions, or recipes posted by other users. We are not responsible for the accuracy, legality, or appropriateness of content submitted by users.",
        },
      ],
    },
    {
      title: "Termination",
      blocks: [
        {
          paragraph:
            "We reserve the right to suspend or terminate your account at any time if you violate these Terms. You may delete your account at any time from **Settings**, or by contacting us.",
        },
      ],
    },
    {
      title: "Changes to These Terms",
      blocks: [
        {
          paragraph:
            "We may update these Terms of Service from time to time. Changes will be posted on this page with an updated date. Continued use of the app after changes constitutes acceptance of the revised terms.",
        },
      ],
    },
    {
      title: "Contact",
      blocks: [{ paragraph: `If you have questions about these Terms, contact us at ${CONTACT_LINK}.` }],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  title: "Privacy Policy",
  updated: "October 2026",
  sections: [
    {
      title: "About Ano Ulam",
      blocks: [
        {
          paragraph:
            "Ano Ulam is a meal discovery app that helps users explore Filipino food based on their budget and nutritional preferences. Registered users may also share food-related content, such as photos, captions, recipes, and general food posts, with the community. This Privacy Policy explains how we collect, use, and protect your information when you use the Ano Ulam app or our website at **anoulam.app**.",
        },
      ],
    },
    {
      title: "Information We Collect",
      blocks: [
        {
          bullets: [
            "**Account information:** Your email address and display name, provided during sign-up or via Google Sign-In.",
            "**Meal preferences:** Dietary preferences and saved meals you choose to store.",
            "**User-submitted content:** Food posts, photos, captions, recipes, and any other food-related content you choose to upload and publish in the Community tab.",
            "**Usage data:** Anonymous analytics on how features of our website are used, to improve the service. No personally identifiable information is included.",
          ],
        },
      ],
    },
    {
      title: "How We Use Your Information",
      blocks: [
        {
          bullets: [
            "To create and manage your account.",
            "To save and display your meal preferences and history.",
            "To generate personalized meal suggestions.",
            "To display your published food posts and recipes to other users in the Community tab and on shareable public post pages.",
            "To improve the app based on aggregated usage patterns.",
          ],
        },
      ],
    },
    {
      title: "User-Published Content & Public Visibility",
      blocks: [
        {
          paragraph:
            "When you publish content in the Community tab, the following information becomes publicly visible to all users of Ano Ulam, including on shareable public post pages:",
        },
        {
          bullets: [
            "Your display name and profile photo.",
            "Any photo and caption you include in the post.",
            "The like count on the post.",
            "For recipes: the meal name, description, ingredients, and steps.",
          ],
        },
        {
          paragraph:
            "You may delete your own community posts at any time from your profile. Recipes require approval before appearing publicly. You may also request removal of any published content by contacting us.",
        },
      ],
    },
    {
      title: "Saved Meals Privacy",
      blocks: [
        {
          paragraph:
            "Your saved meals list is private by default and visible only to you. You may choose to make your saved meals list public from your profile settings at any time, and you can turn this off again whenever you like. When public, other users visiting your profile can see which meals you have saved.",
        },
      ],
    },
    {
      title: "Google Sign-In",
      blocks: [
        {
          paragraph:
            "If you sign in with Google, we receive your name and email address from Google. We do not receive your Google password or any other Google account data. Your use of Google Sign-In is also governed by [Google's Privacy Policy](https://policies.google.com/privacy).",
        },
      ],
    },
    {
      title: "Data Sharing",
      blocks: [
        {
          paragraph:
            "We do not sell, trade, or rent your personal information to third parties. We use the following trusted services to operate the app:",
        },
        {
          bullets: [
            "**Supabase**: authentication, database storage, and file storage for user-uploaded images.",
            "**PostHog**: anonymous product analytics on our website.",
            "**Klipy**: GIF search when you add a GIF to a post. Your search terms are sent to Klipy.",
          ],
        },
      ],
    },
    {
      title: "Data Retention",
      blocks: [
        {
          paragraph:
            "Your account data is retained for as long as your account is active. Published content, including food posts, photos, captions, and recipes, is retained until you delete it or request removal. You can delete your account and all associated data at any time from **Settings**, or by contacting us.",
        },
      ],
    },
    {
      title: "Security",
      blocks: [
        {
          paragraph:
            "We use industry-standard security practices including encrypted connections (HTTPS) and secure authentication tokens. We do not store passwords in plain text. User-uploaded images are stored in a secure, access-controlled storage bucket.",
        },
      ],
    },
    {
      title: "Children's Privacy",
      blocks: [
        {
          paragraph:
            "Ano Ulam is not directed at children under 13. We do not knowingly collect personal information from children under 13.",
        },
      ],
    },
    {
      title: "Changes to This Policy",
      blocks: [
        {
          paragraph:
            "We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated date. Continued use of the app after changes constitutes acceptance.",
        },
      ],
    },
    {
      title: "Contact",
      blocks: [
        {
          paragraph: `If you have questions about this Privacy Policy or want to request data deletion, contact us at ${CONTACT_LINK}.`,
        },
      ],
    },
  ],
};
