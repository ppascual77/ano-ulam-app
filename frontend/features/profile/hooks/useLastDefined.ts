import { useRef } from "react";

// The last non-null value seen. For sheet text that would otherwise go
// blank while the sheet animates closed (its state is cleared on close).
export function useLastDefined<T>(value: T | null | undefined): T | undefined {
  const last = useRef<T | undefined>(undefined);
  if (value != null) last.current = value;
  return last.current;
}
