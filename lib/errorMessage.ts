// Supabase/PostgREST errors are plain objects ({ message, details, hint,
// code }), not Error instances, so `String(err)` renders them as
// "[object Object]". Pull the message out of either shape.
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err && typeof err.message === "string") {
    const details = "details" in err && typeof err.details === "string" && err.details ? ` (${err.details})` : "";
    return `${err.message}${details}`;
  }
  return String(err);
}
