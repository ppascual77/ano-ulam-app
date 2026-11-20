// The OpenAI text model the admin AI tools use (import-meal-from-url,
// estimate-ingredient-ai, verify-meal-ingredients, estimate-pack-sizes and
// generate-meal-image's style note). One place, so the next model change is
// `supabase secrets set OPENAI_TEXT_MODEL=<model>` with no code change or
// redeploy. gpt-4o-mini shuts down on 2027-01-14; gpt-5-mini is the model
// ground-ingredient-prices already runs on.
export const TEXT_MODEL = Deno.env.get("OPENAI_TEXT_MODEL") ?? "gpt-5-mini";

// gpt-5 models are reasoning models: they reject a custom `temperature`
// (only the default) and think before answering. These tools only extract,
// format or check, so the least thinking is enough and keeps them as fast
// and cheap as gpt-4o-mini was. Spread into a chat completions body.
export const TEXT_MODEL_OPTIONS = TEXT_MODEL.startsWith("gpt-5") ? { reasoning_effort: "minimal" } : {};
