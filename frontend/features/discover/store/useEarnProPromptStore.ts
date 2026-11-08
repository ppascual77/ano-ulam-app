import { create } from "zustand";
import { getEarnProPrompt, setEarnProPrompt, type EarnProPrompt } from "@/api/proRewards";

// Discover's "Your recipe could earn you Pro" sheet: at most once a day, and
// never again after it's been dismissed MAX_DISMISSALS times. Remembered on
// the account (users.earn_pro_prompt), so it follows the user across phones
// and reinstalls. Only signed-in users see the sheet.
const MAX_DISMISSALS = 3;

type EarnProPromptState = EarnProPrompt & {
  /** Whose record is loaded (null: none yet). */
  userId: string | null;
  load: (userId: string) => Promise<void>;
  markShown: () => void;
  /** Closed without picking an action. */
  markDismissed: () => void;
};

// The local calendar day, so "once a day" follows the user's own midnight.
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

export const useEarnProPromptStore = create<EarnProPromptState>((set, get) => {
  const persist = () => {
    const { userId, lastShownDay, dismissals } = get();
    if (userId) setEarnProPrompt(userId, { lastShownDay, dismissals }).catch(() => {});
  };
  return {
    lastShownDay: null,
    dismissals: 0,
    userId: null,
    load: async (userId) => {
      if (get().userId === userId) return;
      try {
        set({ ...(await getEarnProPrompt(userId)), userId });
      } catch {
        // Unreadable: stay unloaded, so the sheet just doesn't show.
      }
    },
    markShown: () => {
      set({ lastShownDay: today() });
      persist();
    },
    markDismissed: () => {
      set({ dismissals: get().dismissals + 1 });
      persist();
    },
  };
});

/** Whether the sheet may show now for this user (their record loaded, not
 *  shown today, not given up on). */
export function canShowEarnProPrompt(userId: string) {
  const { userId: loadedFor, lastShownDay, dismissals } = useEarnProPromptStore.getState();
  return loadedFor === userId && lastShownDay !== today() && dismissals < MAX_DISMISSALS;
}
