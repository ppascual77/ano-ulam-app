// Generates confetti.wav: the "Surprise me" confetti's sound, kept subtle: a
// soft wooden "ta-da", two marimba-like notes going up (E6 then A6).
// Played when the meal card lands face up (MealRevealCard).
// Re-run after tweaking:  node assets/sounds/generate-confetti.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SR = 44100;
const LENGTH_S = 0.9;
// [start (s), pitch (Hz), loudness]: the second, higher note answers the
// first and is the stronger of the two.
const NOTES = [
  [0, 1318.5, 0.85],
  [0.13, 1760, 1],
];
const TAU = Math.PI * 2;

const N = Math.ceil(LENGTH_S * SR);
const out = new Float32Array(N);

// One soft mallet note: the main tone with a slow decay, a quick bright
// overtone for the "tok" of the mallet, and a faint low body for warmth.
for (const [at, f, gain] of NOTES) {
  const start = Math.round(at * SR);
  for (let s = 0; start + s < N; s++) {
    const t = s / SR;
    const tone =
      Math.sin(TAU * f * t) * Math.exp(-t * 7) +
      0.4 * Math.sin(TAU * f * 4 * t) * Math.exp(-t * 40) +
      0.2 * Math.sin(TAU * f * 0.5 * t) * Math.exp(-t * 12);
    out[start + s] += tone * Math.min(1, s / 30) * gain;
  }
}

// Normalize, cosine fade over the last stretch, write 16-bit mono WAV.
let peak = 0;
for (const v of out) peak = Math.max(peak, Math.abs(v));
const fadeS = 0.3;
const buf = Buffer.alloc(44 + N * 2);
buf.write("RIFF", 0);
buf.writeUInt32LE(36 + N * 2, 4);
buf.write("WAVE", 8);
buf.write("fmt ", 12);
buf.writeUInt32LE(16, 16);
buf.writeUInt16LE(1, 20);
buf.writeUInt16LE(1, 22);
buf.writeUInt32LE(SR, 24);
buf.writeUInt32LE(SR * 2, 28);
buf.writeUInt16LE(2, 32);
buf.writeUInt16LE(16, 34);
buf.write("data", 36);
buf.writeUInt32LE(N * 2, 40);
for (let i = 0; i < N; i++) {
  const left = (N - i) / SR;
  const fade = left >= fadeS ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * left) / fadeS);
  buf.writeInt16LE(Math.round((out[i] / peak) * 0.89 * fade * 32767), 44 + i * 2);
}
const dest = join(dirname(fileURLToPath(import.meta.url)), "confetti.wav");
writeFileSync(dest, buf);
console.log(`wrote ${dest}: ${LENGTH_S}s wooden ta-da`);
