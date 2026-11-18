// Narrates a meal's steps for cook mode: each step read by Google Cloud
// Text-to-Speech into its own MP3, stored in the public meal-audio bucket
// (<meal id>/<step>-<hash>.mp3), and the public URLs saved in step order to
// meals.procedure_audio. Made once per meal (the steps never carry amounts,
// so one recording fits every serving size); changing the steps clears the
// audio (a trigger, see 20261118000000_meal_step_audio.sql) and whoever
// saved them calls this again.
//
// Catalog meals only, never a user-submitted recipe. Admin screens and the
// /seed-meal skill only (it spends the Google quota): see
// _shared/requireAdmin.ts.
//
// POST { mealId, voice? }  ->  { urls, characters, voice }
// `voice` overrides the TTS_VOICE secret for this call (to try voices out).
import { createClient } from "npm:@supabase/supabase-js@2";
import { requireAdmin } from "../_shared/requireAdmin.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const GOOGLE_TTS_API_KEY = Deno.env.get("GOOGLE_TTS_API_KEY");
// Picked by Patrick from 8 samples (2026-11-18): Google's Chirp 3 HD male
// voice, the most natural, and clear on the Tagalog ingredient names.
// Overridable without a code change: `supabase secrets set TTS_VOICE=...`.
const DEFAULT_VOICE = Deno.env.get("TTS_VOICE") ?? "en-US-Chirp3-HD-Charon";
// A touch slower than normal: it's heard across a kitchen, hands busy.
const SPEAKING_RATE = Number(Deno.env.get("TTS_SPEAKING_RATE") ?? "0.95");
const TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize";
const BUCKET = "meal-audio";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

// Kitchen shorthand read out in full ("1 tbsp." would otherwise be spelled
// or clipped). Only abbreviations steps actually use.
function speakable(step: string): string {
  return step
    .replace(/\btbsps?\b\.?/gi, "tablespoons")
    .replace(/\btsps?\b\.?/gi, "teaspoons")
    .replace(/\bmins?\b\.?/gi, "minutes")
    .replace(/\bhrs?\b\.?/gi, "hours")
    .replace(/(\d)\s*°\s*C\b/g, "$1 degrees Celsius")
    .replace(/(\d)\s*°\s*F\b/g, "$1 degrees Fahrenheit")
    .replace(/\s+/g, " ")
    .trim();
}

// "en-US-Neural2-F" -> "en-US" (Google wants both).
const languageOf = (voice: string) => voice.split("-").slice(0, 2).join("-");

async function synthesize(text: string, voice: string): Promise<Uint8Array> {
  const res = await fetch(`${TTS_URL}?key=${GOOGLE_TTS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: languageOf(voice), name: voice },
      audioConfig: { audioEncoding: "MP3", speakingRate: SPEAKING_RATE },
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Google TTS ${res.status}: ${detail.slice(0, 300)}`);
  }
  const { audioContent } = (await res.json()) as { audioContent?: string };
  if (!audioContent) throw new Error("Google TTS returned no audio");
  return Uint8Array.from(atob(audioContent), (c) => c.charCodeAt(0));
}

// A short fingerprint of what was read and how, in the file name: a changed
// step or voice gets a new URL, so no phone or CDN plays a cached old one.
async function fingerprint(text: string, voice: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(`${voice}|${SPEAKING_RATE}|${text}`));
  return Array.from(new Uint8Array(digest))
    .slice(0, 5)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const denied = await requireAdmin(req);
  if (denied) return denied;
  if (!GOOGLE_TTS_API_KEY) return json({ error: "GOOGLE_TTS_API_KEY not configured" }, 500);

  try {
    const body = await req.json();
    const mealId = typeof body?.mealId === "string" ? body.mealId : null;
    const voice = typeof body?.voice === "string" && body.voice.trim() ? body.voice.trim() : DEFAULT_VOICE;
    if (!mealId) return json({ error: "mealId is required" }, 400);

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
    const { data: meal, error } = await db.from("meals").select("id, procedure, poster_id").eq("id", mealId).single();
    if (error || !meal) return json({ error: `No meal ${mealId}` }, 404);
    // Catalog meals only: recipes users submit (approved or not) are never
    // narrated (Patrick, 2026-11-18).
    if (meal.poster_id) return json({ error: "User-submitted recipes aren't narrated." }, 400);
    const steps = (meal.procedure ?? []).map((s: string) => s.trim()).filter(Boolean);

    // One step at a time: a meal is a handful of short requests, and Google's
    // per-minute quota stays comfortable even when a whole catalog runs.
    const paths: string[] = [];
    let characters = 0;
    for (const [i, step] of steps.entries()) {
      const text = speakable(step);
      characters += text.length;
      const audio = await synthesize(text, voice);
      const path = `${mealId}/${i + 1}-${await fingerprint(text, voice)}.mp3`;
      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, audio, { contentType: "audio/mpeg", cacheControl: "31536000", upsert: true });
      if (uploadError) throw new Error(`Upload failed for step ${i + 1}: ${uploadError.message}`);
      paths.push(path);
    }

    // The steps could have been edited while this ran: only save audio that
    // still matches them (the edit's own save narrates again).
    const { data: now } = await db.from("meals").select("procedure").eq("id", mealId).single();
    const stillSame = JSON.stringify((now?.procedure ?? []).map((s: string) => s.trim()).filter(Boolean)) === JSON.stringify(steps);
    if (!stillSame) return json({ error: "The steps changed while narrating. Run it again." }, 409);

    const urls = paths.map((path) => db.storage.from(BUCKET).getPublicUrl(path).data.publicUrl);
    const { error: updateError } = await db.from("meals").update({ procedure_audio: urls.length ? urls : null }).eq("id", mealId);
    if (updateError) throw new Error(`Couldn't save the audio: ${updateError.message}`);

    // Old recordings of this meal (earlier steps or voice) go.
    const { data: files } = await db.storage.from(BUCKET).list(mealId, { limit: 1000 });
    const keep = new Set(paths.map((p) => p.split("/")[1]));
    const stale = (files ?? []).map((f) => f.name).filter((name) => !keep.has(name));
    if (stale.length) await db.storage.from(BUCKET).remove(stale.map((name) => `${mealId}/${name}`));

    return json({ urls, characters, voice });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 422);
  }
});
