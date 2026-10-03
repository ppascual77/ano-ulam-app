import { useState } from "react";
import { Screen, Toast, type ToastState } from "@/frontend/components/ui";
import { BackRow } from "../components/BackRow";
import { OfficialProfileView } from "../components/official/OfficialProfileView";

// /profile/anoulam: the official AnoUlam profile, opened from an official
// meal or post.
export default function OfficialProfileScreen() {
  const [toast, setToast] = useState<ToastState | null>(null);

  return (
    <Screen padded={false} edges={["top"]} dismissKeyboardOnTap={false}>
      <BackRow />
      <OfficialProfileView onToast={(message, tone) => setToast({ id: Date.now(), message, tone })} />
      <Toast toast={toast} onHide={() => setToast(null)} />
    </Screen>
  );
}
