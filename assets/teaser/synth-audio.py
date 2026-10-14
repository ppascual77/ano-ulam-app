# Soundtrack for the teaser, built from the cue list teaser.html exports
# (capture.mjs writes it to cues.json), so every hit lands on its frame.
# Usage: python3 synth-audio.py cues.json out.wav DURATION
# Soft, wooden, playful: marimba plucks, boings and pops over a light beat,
# reusing the app's own confetti.wav for the "ta-da" moments.
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
rng = np.random.default_rng(7)
TAU = 2 * np.pi


def tt(sec):
    return np.arange(int(sec * SR)) / SR


def add(at, sig, gain=1.0, pan=0.0):
    i = int(at * SR)
    if i >= N or i + len(sig) <= 0:
        return
    sig = sig[: N - i]
    L[i : i + len(sig)] += sig * gain * (1 - max(0, pan))
    R[i : i + len(sig)] += sig * gain * (1 + min(0, pan))


def note(n):  # MIDI -> Hz
    return 440 * 2 ** ((n - 69) / 12)


def marimba(f, dur=0.6, bright=0.4):
    t = tt(dur)
    s = np.sin(TAU * f * t) * np.exp(-t * 9) + bright * np.sin(TAU * f * 4 * t) * np.exp(-t * 45) + 0.25 * np.sin(TAU * f * 0.5 * t) * np.exp(-t * 14)
    return s * np.minimum(1, np.arange(len(t)) / 30)


def sweep(f0, f1, dur, decay=6, shape="exp"):
    t = tt(dur)
    f = f0 * (f1 / f0) ** (t / dur) if shape == "exp" else np.linspace(f0, f1, len(t))
    ph = np.cumsum(f) / SR * TAU
    return np.sin(ph) * np.exp(-t * decay)


def noise(dur):
    return rng.standard_normal(int(dur * SR))


def lowpass(x, a):  # one-pole; a in (0,1], smaller = darker. a can be array.
    y = np.zeros_like(x)
    a = np.broadcast_to(a, x.shape)
    acc = 0.0
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def whoosh(dur, up=True, gain=1.0):
    t = tt(dur)
    env = np.sin(np.pi * t / dur) ** 2
    a = np.linspace(0.02, 0.35, len(t)) if up else np.linspace(0.35, 0.02, len(t))
    return lowpass(noise(dur), a) * env * gain * 3


def kick():
    t = tt(0.35)
    return sweep(150, 45, 0.35, decay=9) * 1.0 + 0.3 * noise(0.35) * np.exp(-t * 120)


def hat():
    t = tt(0.06)
    n = noise(0.06)
    return (n - lowpass(n, 0.5)) * np.exp(-t * 70) * 0.5


def tock(f=1800):
    t = tt(0.05)
    return np.sin(TAU * f * t) * np.exp(-t * 110)


def pop():
    t = tt(0.12)
    return sweep(500, 1400, 0.12, decay=30) * 0.9 + 0.2 * noise(0.12) * np.exp(-t * 200)


def boing():
    t = tt(0.55)
    f = 120 + 160 * (1 - np.exp(-t * 6)) + 25 * np.sin(TAU * 14 * t) * np.exp(-t * 4)
    return np.sin(np.cumsum(f) / SR * TAU) * np.exp(-t * 5)


def load_wav(p):
    with wave.open(str(p)) as w:
        x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16) / 32768
    return x


confetti = load_wav(Path(__file__).resolve().parent.parent / "sounds" / "confetti.wav")

PENTA = [72, 74, 76, 79, 81, 84, 86, 88, 91, 93]  # C major pentatonic from C5

for cue in cues:
    at, name = cue[0], cue[1]
    arg = cue[2] if len(cue) > 2 else 0
    if name == "fall":
        add(at, sweep(1400, 500, 0.38, decay=3) * 0.18, pan=0)
    elif name == "boing":
        add(at, boing(), 0.7)
        add(at, kick(), 0.5)
    elif name == "whooshUp":
        add(at, whoosh(0.35, True), 0.35)
    elif name == "bounce":
        add(at, marimba(note(PENTA[2 + arg])), 0.55, pan=-0.3 + arg * 0.2)
        add(at, tock(), 0.15)
    elif name == "whoosh":
        add(at, whoosh(0.2, True), 0.4, pan=0.4)
    elif name == "thud":
        add(at, kick(), 0.9)
        add(at, marimba(note(48), 0.6, 0.1), 0.5)
    elif name == "tada":
        add(at, confetti, 0.6)
    elif name == "riser":
        d = float(arg)
        t = tt(d)
        add(at, (sweep(200, 1600, d, decay=0) * 0.15 + whoosh(d, True) * 0.6) * (t / d) ** 2, 0.7)
    elif name == "kick":
        add(at, kick(), 0.8)
    elif name == "tick":
        add(at, tock(2400), 0.11, pan=0.15)
        add(at, marimba(note(96), 0.08, 0), 0.22, pan=0.15)
    elif name == "ding":
        for k, n in enumerate([84, 88, 91]):
            add(at + k * 0.03, marimba(note(n), 1.0, 0.6), 0.32)
    elif name == "swoosh":
        add(at, whoosh(0.42, True), 0.5)
    elif name == "hop":
        add(at, marimba(note([79, 81, 84][arg]), 0.7), 0.6, pan=[-0.3, 0, 0.3][arg])
        add(at, pop(), 0.2)
    elif name == "suck":
        add(at, whoosh(0.4, False), 0.45)
        add(at, sweep(900, 150, 0.4, decay=4) * 0.2)
    elif name == "windup":
        d = float(arg)
        t = tt(d)
        add(at, sweep(300, 900, d, decay=0) * (t / d) * 0.18)
    elif name == "boom":
        t = tt(1.4)
        add(at, sweep(90, 35, 1.4, decay=3.5), 1.0)
        add(at, lowpass(noise(1.4), 0.08) * np.exp(-t * 4) * 1.4, 0.8)
        for k, n in enumerate([60, 67, 72, 76, 79]):
            add(at + 0.02 * k, marimba(note(n), 1.4, 0.3), 0.3)
    elif name == "plink":
        add(at, marimba(note(PENTA[arg % len(PENTA)] + 12), 0.25, 0.5), 0.22, pan=-0.5 + (arg % 7) / 7)
    elif name == "pop":
        add(at, pop(), 0.5)
    elif name == "hopUp":
        add(at, sweep(500, 1500, 0.22, decay=6) * 0.25)
    elif name == "chord":
        t = tt(2.3)
        for n in [60, 64, 67, 72, 76]:
            f = note(n)
            add(at, (np.sin(TAU * f * t) + 0.3 * np.sin(TAU * 2 * f * t)) * np.exp(-t * 1.6) * np.minimum(1, t * 40), 0.12)
    elif name == "pops":
        for k in range(14):
            add(at + rng.uniform(0, 0.35), pop() * rng.uniform(0.3, 0.7), 0.4, pan=rng.choice([-0.7, 0.7]))

# Music bed: a light, bouncy beat from the orange reel to the payoff.
BPM = 120
beat = 60 / BPM
start, stop = 3.8, 12.9
bass = [48, 48, 55, 52, 45, 45, 52, 50]
b = 0
x = start
while x < stop - 0.01:
    add(x, kick(), 0.42)
    add(x + beat / 2, hat(), 0.5, pan=0.3)
    if b % 2 == 1:
        add(x, tock(1200), 0.12, pan=-0.3)
    add(x + beat / 2, marimba(note(bass[b % len(bass)]), 0.35, 0.05), 0.35)
    b += 1
    x += beat
# Intro: soft shaker on 8ths.
x = 0.5
while x < 3.4:
    add(x, hat(), 0.18, pan=-0.2)
    x += beat / 2

mix = np.stack([L, R], 1)[: int(DUR * SR)]
# Soft clip, normalize, short fade-out.
mix = np.tanh(mix * 1.2)
mix /= np.max(np.abs(mix)) + 1e-9
mix *= 0.79  # headroom so the AAC encode doesn't clip
fade = int(0.35 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype(np.int16).tobytes())
print("wrote", out_path)
