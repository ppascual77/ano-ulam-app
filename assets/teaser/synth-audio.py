# Soundtrack for the teaser, built from the cue list teaser.html exports
# (capture.mjs writes it to cues.json), so every hit lands on its frame.
# Usage: python3 synth-audio.py cues.json out.wav DURATION
# Deliberately quiet and clean: pure tones only (no noise), a soft
# wooden "tok" per landing scaled by how hard the dot hit, and a warm pad.
import json, sys, wave
from pathlib import Path
import numpy as np

SR = 44100
cues = json.load(open(sys.argv[1]))
out_path = sys.argv[2]
DUR = float(sys.argv[3])
N = int(DUR * SR) + SR
L = np.zeros(N)
R = np.zeros(N)
TAU = 2 * np.pi


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def add(at, sig, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 - pan))
    R[i : i + len(sig)] += sig * gain * np.sqrt(0.5 * (1 + pan))


def hz(n):
    return 440 * 2 ** ((n - 69) / 12)


def mallet(f, dur=0.9, bright=0.3, decay=7):
    """Soft marimba-like note, as in assets/sounds/generate-confetti.mjs."""
    t = tt(dur)
    s = (np.sin(TAU * f * t) * np.exp(-t * decay)
         + bright * np.sin(TAU * f * 4 * t) * np.exp(-t * 40)
         + 0.2 * np.sin(TAU * f * 0.5 * t) * np.exp(-t * 10))
    return s * np.minimum(1, np.arange(len(t)) / 40)


def tok(f=220, dur=0.25):
    """Rounded wooden thud for the dot landing."""
    t = tt(dur)
    pitch = f * (1 + 0.6 * np.exp(-t * 60))
    return np.sin(np.cumsum(TAU * pitch / SR)) * np.exp(-t * 22) * np.minimum(1, np.arange(len(t)) / 20)


def glide(f0, f1, dur, gain_curve=None):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur)
    env = np.sin(np.pi * t / dur) ** 2 if gain_curve is None else gain_curve(t)
    return np.sin(np.cumsum(TAU * f / SR)) * env


def pad(notes, dur, attack=0.6, release=1.2):
    t = tt(dur)
    s = np.zeros(len(t))
    for n in notes:
        f = hz(n)
        # Two slightly detuned sines + a soft octave: warm, no buzz.
        s += np.sin(TAU * f * t) + np.sin(TAU * f * 1.003 * t + 1.0) + 0.25 * np.sin(TAU * 2 * f * t)
    env = np.minimum(1, t / attack) * np.minimum(1, (dur - t) / release)
    return s * np.clip(env, 0, 1) / (2.25 * len(notes))


def load_wav(p):
    with wave.open(str(p)) as w:
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16) / 32768


confetti = load_wav(Path(__file__).resolve().parent.parent / "sounds" / "confetti.wav")

# Landings climb a C-major pentatonic as the story moves on; the opening
# bounces all share one pitch and just get quieter, like a real ball.
LAND_NOTES = {"drop": 79, 0: 79, 1: 81, 2: 84, 3: 86, 4: 88}
drop_count = sum(1 for c in cues if c[1] == "land") - 6  # the bounce train
for at, name, strength, idx in cues:
    if name == "land":
        if idx < drop_count:
            add(at, tok(180), 0.55 * strength)
            add(at, mallet(hz(79), 0.6, 0.15), 0.22 * strength)
        else:
            k = idx - drop_count
            note = [76, 79, 81, 84, 88, 91][k]
            add(at, tok(200), 0.35 * max(0.4, strength))
            add(at, mallet(hz(note), 1.0, 0.25), 0.38, pan=[-0.2, 0.15, -0.1, 0.2, 0, 0.1][k])
    elif name == "lift":
        add(at - 0.04, glide(300, 620, 0.16), 0.06)
    elif name == "grow":
        add(at, mallet(hz(91), 1.2, 0.3), 0.16, pan=0.3)
    elif name == "fall":
        add(at, glide(700, 260, 0.6), 0.06)
    elif name == "reveal":
        add(at, confetti, 0.42)
        add(at, glide(65, 55, 1.6, lambda t: np.exp(-t * 2.2) * np.minimum(1, t * 30)), 0.5)
        for k, n in enumerate([60, 67, 72, 76]):
            add(at + 0.035 * k, mallet(hz(n), 1.6, 0.2, 3), 0.17, pan=-0.3 + 0.2 * k)
    elif name == "soon":
        for k, n in enumerate([72, 76, 79, 84]):
            add(at + 0.06 * k, mallet(hz(n), 1.4, 0.2, 4), 0.12, pan=-0.2 + 0.15 * k)

# Warm pad bed: C -> Am -> F -> G -> C, swelling under the story.
chords = [
    (2.3, 3.0, [48, 55, 64, 67]),   # C
    (5.2, 2.7, [45, 52, 60, 64]),   # Am
    (7.8, 2.4, [41, 48, 57, 64]),   # Fmaj7
    (10.0, 2.2, [43, 50, 59, 62]),  # G
    (12.1, 2.9, [48, 55, 64, 67, 71]),  # Cmaj7
]
for at, d, notes in chords:
    add(at, pad(notes, d + 0.8, attack=0.5, release=0.9), 0.16)

# Soft pulse under the features: muted plucks on 8ths at 100 BPM.
step = 60 / 100 / 2
arp = [60, 67, 72, 67, 64, 67, 72, 76]
x, k = 5.95, 0
while x < 10.6:
    add(x, mallet(hz(arp[k % len(arp)]), 0.3, 0.05, 14), 0.05, pan=0.25 if k % 2 else -0.25)
    x += step
    k += 1

mix = np.stack([L, R], 1)[: int(DUR * SR)]
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.8
fade = int(0.6 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None] ** 2
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", out_path)
