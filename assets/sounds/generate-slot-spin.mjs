// Generates slot-spin.wav: the "Surprise me" slot reel's whole spin as ONE
// sound, every tick placed exactly where a name crosses the reel's center,
// ending in a soft bubble pop at the landing. The app plays it once when the spin starts
// (see SlotPicker.tsx). Playing a separate click per name lagged: each one
// had to hop from the animation thread to JS and start its own playback.
//
// The spin is deterministic, so this must match SlotPicker.tsx. If you change
// SPIN_ITEMS, SPIN_MS or SPIN_EASE_POWER there, update these and re-run:
//   node assets/sounds/generate-slot-spin.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SPIN_ITEMS = 30; // SlotPicker's SPIN_ITEMS
const SPIN_MS = 1800; // SlotPicker's SPIN_MS
const EASE_POWER = 2; // SlotPicker's SPIN_EASE_POWER

const SR = 44100;
const TAU = Math.PI * 2;
const LAND_AT = SPIN_ITEMS - 1; // the reel stops with this row centered
const SPIN_S = SPIN_MS / 1000;
const TAIL_S = 0.35; // room for the landing pop to finish
// The file's last stretch eases to silence, so it trails off smoothly
// instead of just stopping.
const FADE_OUT_S = 0.2;
// The landing pop's peak, relative to the loudest click. Kept below 1, and
// the pop is short and rounded, so it reads as a subtle "pop" rather than a hit.
const POP_LEVEL = 0.9;
// Clicks are normalized to their own peak (not the file's), then driven
// into the soft-clip by this much: keeps them exactly as loud as they were
// with the old ding, whatever the landing sound is.
const CLICK_DRIVE = 1.157;

// Reel position (rows) over time: pos(p) = LAND_AT * (1 - (1 - p)^EASE_POWER).
// A name crosses the center when pos passes r - 0.5, the same moment the app
// fires its haptic (Math.floor(pos + 0.5) changes). Invert for the time.
const tickTimes = [];
for (let r = 1; r < LAND_AT; r++) {
  const share = (r - 0.5) / LAND_AT;
  tickTimes.push(SPIN_S * (1 - Math.pow(1 - share, 1 / EASE_POWER)));
}

let seed = 7;
const noise = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return (seed / 4294967296) * 2 - 1;
};

const N = Math.ceil((SPIN_S + TAIL_S) * SR);
const out = new Float32Array(N);

// One tick: a short mechanical click (bright snap + small wooden body).
// Ticks crowd together at full speed and spread out as it slows, like a reel.
function addTick(at, gain) {
  const start = Math.round(at * SR);
  let prev = 0;
  for (let i = 0; i < Math.round(0.045 * SR) && start + i < N; i++) {
    const t = i / SR;
    const n = noise();
    const snap = (Math.sin(TAU * 2400 * t) * 0.55 + (n - prev) * 0.5) * Math.exp(-t * 260);
    prev = n;
    const body = Math.sin(TAU * 190 * t) * 0.45 * Math.exp(-t * 90);
    out[start + i] += (snap + body) * gain;
  }
}
// Landing: a soft bubble pop, built separately so it can be leveled against
// the clicks. A rounded tone whose pitch sweeps quickly up, like a bubble
// surfacing ("bloop"), then fades fast.
function renderPop() {
  const len = Math.round(0.25 * SR);
  const pop = new Float32Array(len);
  let ph = 0;
  for (let i = 0; i < len; i++) {
    const t = i / SR;
    ph += (380 + 520 * (1 - Math.exp(-t * 70))) / SR;
    pop[i] = Math.sin(TAU * ph) * Math.min(1, t / 0.003) * Math.exp(-t * 32);
  }
  return pop;
}

// Early ticks are only ~10ms apart; quieter there so they blur into a
// rattle, full strength as each click becomes distinct.
tickTimes.forEach((at, i) => {
  const gap = i ? at - tickTimes[i - 1] : 0.01;
  addTick(at, 0.35 + 0.65 * Math.min(1, gap / 0.08));
});
// Level the pop against the clicks, then drop it in where the reel stops.
let clickPeak = 0;
for (let i = 0; i < Math.round(SPIN_S * SR); i++) clickPeak = Math.max(clickPeak, Math.abs(out[i]));
const pop = renderPop();
let popPeak = 0;
for (const v of pop) popPeak = Math.max(popPeak, Math.abs(v));
const landStart = Math.round(SPIN_S * SR);
pop.forEach((v, i) => {
  if (landStart + i < N) out[landStart + i] += (v / popPeak) * clickPeak * POP_LEVEL;
});

// Normalize to the clicks, soft-clip, fade out the tail, write 16-bit mono WAV.
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
  // Cosine ease from full volume to silence over the last FADE_OUT_S.
  const left = (N - i) / SR;
  const fade = left >= FADE_OUT_S ? 1 : 0.5 - 0.5 * Math.cos((Math.PI * left) / FADE_OUT_S);
  const v = Math.tanh((out[i] / clickPeak) * CLICK_DRIVE) * 0.89 * fade;
  buf.writeInt16LE(Math.round(v * 32767), 44 + i * 2);
}
const dest = join(dirname(fileURLToPath(import.meta.url)), "slot-spin.wav");
writeFileSync(dest, buf);
console.log(`wrote ${dest}: ${tickTimes.length} ticks, landing at ${SPIN_S}s, ${(N / SR).toFixed(2)}s long`);
