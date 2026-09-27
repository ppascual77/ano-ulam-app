// Generates an appetizing product photo for a meal, for EditMealScreen's
// "Generate with AI" option next to the existing manual photo picker.
//
// If a reference photo is given (a meal's `reference_image_url`, the
// original recipe photo captured at import time in import-meal-from-url),
// this deliberately does NOT feed it into an image-edit/img2img call — that
// would produce a close derivative of the actual pixels, which is exactly
// the "copied" outcome the admin asked to avoid. Instead: a vision-capable
// chat model looks at the reference photo and writes a short, neutral text
// description of its plating/composition style (no image data, no
// brand/watermark/text, no attempt to reproduce it exactly), and ONLY that
// text — never the image itself — is handed to the image generator. The
// final image is generated from scratch, informed by the description, not
// derived from the source photo's pixels.
//
// Returns a draft only (base64 image data) — same "grounding never silently
// applies" principle as this project's other AI features. The caller shows
// a preview and only uploads it to Storage once the admin accepts it.

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CHAT_URL = "https://api.openai.com/v1/chat/completions";
const IMAGE_URL = "https://api.openai.com/v1/images/generations";

// Verbatim from the admin — this is deliberately not paraphrased or
// "cleaned up" here, since it's a creative brief they iterated on
// themselves, not a spec with a single correct phrasing.
const BASE_PROMPT = `Generate image based from description of the dish. No sides, make the table setup for pinoy approriate with meal. Add smoke. No drinks. No rice. Light background. Dish only. Make image as realistic as possible. Add table decorations like veggies or condiments or utensils, garnishes. Make variations with shot angles and background. Single shot darker background. Smaller serving with garnish small serving. One photo Zoom it in. Make it appetizing just 3/4 of the meal is shown because zoomed in.`;

async function describeReferenceStyle(referenceImageUrl: string): Promise<string | null> {
  try {
    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content:
              "You describe a food photo's visual style in neutral, generic terms, for use as creative inspiration when generating a completely different, original photo — never to reproduce this one. In 2-3 short sentences, describe only: plating style, key visible garnishes/textures, color palette, and camera angle/framing. Never mention or describe any watermark, logo, on-image text, brand, or website. Never say anything that would let someone identify or recreate the exact source photo.",
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Describe this dish photo's visual style." },
              { type: "image_url", image_url: { url: referenceImageUrl } },
            ],
          },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    return typeof text === "string" && text.trim() ? text.trim() : null;
  } catch {
    // Best-effort only — a reference photo that's unreachable, blocked, or
    // otherwise fails to describe just means generation proceeds from the
    // meal's own name/description alone, not a hard failure.
    return null;
  }
}

async function generateImage(prompt: string): Promise<{ imageBase64: string; mimeType: string }> {
  const res = await fetch(IMAGE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1536x1024",
      quality: "medium",
      n: 1,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI image request failed: ${res.status} ${body}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (typeof b64 === "string" && b64) {
    return { imageBase64: b64, mimeType: "image/png" };
  }

  // gpt-image-1 always returns b64_json, but fall back to fetching a url if
  // a future response shape ever includes one instead.
  const url = data.data?.[0]?.url;
  if (typeof url === "string" && url) {
    const imgRes = await fetch(url);
    const buf = await imgRes.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    return { imageBase64: base64, mimeType: imgRes.headers.get("content-type") ?? "image/png" };
  }

  throw new Error("OpenAI returned no image data");
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "POST only" }), { status: 405 });
  }
  if (!OPENAI_API_KEY) {
    return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), { status: 500 });
  }

  try {
    const body = await req.json();
    const name = body?.name as string | undefined;
    const description = body?.description as string | null | undefined;
    const referenceImageUrl = body?.referenceImageUrl as string | null | undefined;
    if (!name || !name.trim()) {
      return new Response(JSON.stringify({ error: "name is required" }), { status: 400 });
    }

    const styleDescription = referenceImageUrl ? await describeReferenceStyle(referenceImageUrl) : null;

    const prompt = [
      BASE_PROMPT,
      "",
      `Dish: ${name.trim()}${description ? ` — ${description.trim()}` : ""}`,
      styleDescription
        ? `For creative inspiration only (do not copy or reproduce any specific photo, brand, watermark, or text) — general visual style cues from a reference photo of a similar dish: ${styleDescription}`
        : "",
    ]
      .filter(Boolean)
      .join("\n");

    const image = await generateImage(prompt);

    return new Response(JSON.stringify(image), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), { status: 422 });
  }
});
