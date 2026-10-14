// Renders teaser.html frame by frame and encodes it with its soundtrack.
//   node assets/teaser/capture.mjs                 -> assets/teaser/anoulam-teaser.mp4
//   node assets/teaser/capture.mjs --stills 0.5,3.1 -> PNG stills in --out dir
// Needs: npm install (for the fonts), ffmpeg, python3 + numpy, and
// Playwright's Chromium (global `playwright` package is fine).
import { spawn, execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, mkdirSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../..");
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : def; };
const FPS = Number(opt("--fps", 60));
const outDir = resolve(opt("--out", here));
mkdirSync(outDir, { recursive: true });

let chromium;
try { ({ chromium } = await import("playwright")); }
catch { ({ chromium } = createRequire(execFileSync("npm", ["root", "-g"]).toString().trim() + "/")("playwright")); }

// Tiny static server over the repo root, so the page can load fonts/icons.
const TYPES = { ".html": "text/html", ".png": "image/png", ".ttf": "font/ttf", ".js": "text/javascript" };
const server = createServer((req, res) => {
  const p = join(root, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!p.startsWith(root) || !existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[extname(p)] || "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/assets/teaser/teaser.html#capture`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
page.on("console", (m) => console.log("[page]", m.text()));
page.on("pageerror", (e) => console.error("[page error]", e));
await page.goto(url);
await page.waitForFunction(() => window.ready === true, null, { timeout: 30000 });

// Each frame blends 6 sub-frames (motion blur), see renderFrame.
const grab = (t) => page.evaluate(([t, fps]) => { window.renderFrame(t, fps, 6); return document.getElementById("c").toDataURL("image/png").split(",")[1]; }, [t, FPS]);

const stills = opt("--stills");
if (stills) {
  for (const t of stills.split(",").map(Number)) {
    writeFileSync(join(outDir, `still-${t.toFixed(2)}.png`), Buffer.from(await grab(t), "base64"));
  }
} else {
  const duration = await page.evaluate(() => window.DURATION);
  // Intermediates (cue list, soundtrack) go to a temp dir, not the repo.
  const tmp = mkdtempSync(join(tmpdir(), "teaser-"));
  writeFileSync(join(tmp, "cues.json"), JSON.stringify(await page.evaluate(() => window.CUES())));
  const wav = join(tmp, "soundtrack.wav");
  execFileSync("python3", ["-I", join(here, "synth-audio.py"), join(tmp, "cues.json"), wav, String(duration)], { stdio: "inherit" });

  const mp4 = join(outDir, "anoulam-teaser.mp4");
  const ff = spawn("ffmpeg", [
    "-y", "-loglevel", "error",
    "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
    "-i", wav,
    "-c:v", "libx264", "-preset", "slow", "-crf", "17", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
    // Social-platform loudness (about -16 LUFS), peaks kept under -1.5 dB.
    "-af", "loudnorm=I=-16:TP=-1.5:LRA=11", "-ar", "48000",
    "-c:a", "aac", "-b:a", "192k", "-shortest", mp4,
  ], { stdio: ["pipe", "inherit", "inherit"] });
  const frames = Math.round(duration * FPS);
  for (let f = 0; f < frames; f++) {
    const buf = Buffer.from(await grab(f / FPS), "base64");
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
    if (f % 60 === 0) process.stdout.write(`\rframe ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on("close", r));
  console.log(`\nwrote ${mp4}`);
}
await browser.close();
server.close();
