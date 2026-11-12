import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { EMPTY_DRAFT, hasContent, type RecipeDraft } from "../types";

// Add a Recipe's work in progress, kept on the device so closing the screen,
// swiping back or the app being killed in the background never loses a
// recipe someone spent ten minutes typing. One draft per account. Saved
// (debounced) as they type, and flushed right away when the app goes to the
// background or the screen closes.

const SAVE_DEBOUNCE_MS = 500;
const storageKey = (userId: string) => `anoulam.recipeDraft.${userId}`;

type StoredDraft = { v: 1; draft: RecipeDraft; step: number; savedAt: number };

/** "loading": reading storage. "resume": a saved draft is waiting for
 *  Continue / Start over (see `saved`). "ready": editing. */
export type DraftStatus = "loading" | "resume" | "ready";

export function useRecipeDraft(userId: string | null, lastStep: number) {
  const [draft, setDraft] = useState<RecipeDraft>(EMPTY_DRAFT);
  const [step, setStep] = useState(0);
  const [status, setStatus] = useState<DraftStatus>(userId ? "loading" : "ready");
  const [saved, setSaved] = useState<StoredDraft | null>(null);

  // What a flush writes, kept current every render. `stopped`: submitted or
  // discarded, so nothing writes the draft back afterwards.
  const latest = useRef({ draft, step, status, userId });
  latest.current = { draft, step, status, userId };
  const stopped = useRef(false);

  const flush = useCallback(() => {
    const { draft: d, step: s, status: st, userId: id } = latest.current;
    if (!id || st !== "ready" || stopped.current) return;
    const key = storageKey(id);
    const write = hasContent(d)
      ? AsyncStorage.setItem(key, JSON.stringify({ v: 1, draft: d, step: s, savedAt: Date.now() } satisfies StoredDraft))
      : AsyncStorage.removeItem(key);
    write.catch(() => {});
  }, []);

  // Read any saved draft once per account.
  useEffect(() => {
    if (!userId) {
      setStatus("ready");
      return;
    }
    let cancelled = false;
    setStatus("loading");
    AsyncStorage.getItem(storageKey(userId))
      .then((raw) => {
        if (cancelled) return;
        const stored = raw ? (JSON.parse(raw) as StoredDraft) : null;
        if (stored?.v === 1 && stored.draft && hasContent({ ...EMPTY_DRAFT, ...stored.draft })) {
          setSaved({ ...stored, draft: { ...EMPTY_DRAFT, ...stored.draft } });
          setStatus("resume");
        } else {
          setStatus("ready");
        }
      })
      .catch(() => !cancelled && setStatus("ready"));
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced save while editing.
  useEffect(() => {
    if (status !== "ready") return;
    const timer = setTimeout(flush, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [draft, step, status, flush]);

  // Right away when the app leaves the foreground, and when the screen closes
  // (a pending debounce would otherwise be dropped).
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => state !== "active" && flush());
    return () => {
      sub.remove();
      flush();
    };
  }, [flush]);

  const resume = useCallback(() => {
    if (saved) {
      setDraft(saved.draft);
      setStep(Math.min(Math.max(0, saved.step), lastStep));
    }
    setSaved(null);
    setStatus("ready");
  }, [saved, lastStep]);

  const remove = useCallback(() => {
    if (latest.current.userId) AsyncStorage.removeItem(storageKey(latest.current.userId)).catch(() => {});
  }, []);

  const startOver = useCallback(() => {
    remove();
    setSaved(null);
    setDraft(EMPTY_DRAFT);
    setStep(0);
    setStatus("ready");
  }, [remove]);

  /** Submitted or discarded: forget it and stop saving. */
  const clear = useCallback(() => {
    stopped.current = true;
    remove();
  }, [remove]);

  return { draft, setDraft, step, setStep, status, saved, resume, startOver, clear };
}
