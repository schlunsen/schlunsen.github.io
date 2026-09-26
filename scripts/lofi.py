# /// script
# dependencies = ["numpy", "scipy"]
# ///
"""Synthesize a subtle, original 60 s lofi loop for the reel (no samples, no licences).

Usage: uv run scripts/lofi.py out.wav [seconds]
"""
import sys
import numpy as np
from scipy.signal import butter, sosfilt
from scipy.io import wavfile

OUT = sys.argv[1]
DUR = float(sys.argv[2]) if len(sys.argv) > 2 else 60.0
SR = 44100
BPM = 72
BEAT = 60 / BPM
N = int(DUR * SR)
rng = np.random.default_rng(7)
t_all = np.arange(N) / SR


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


def add(buf, start_s, sig):
    i = int(start_s * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += sig[: j - i]


def lp(x, hz, order=2):
    return sosfilt(butter(order, hz, 'low', fs=SR, output='sos'), x)


def hp(x, hz, order=2):
    return sosfilt(butter(order, hz, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


# ---------- electric piano (soft FM, Rhodes-ish) ----------
def epiano(f, dur, vel=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    idx = 1.1 * np.exp(-t * 6) + 0.15           # bell on the attack, mellow tail
    y = np.sin(2 * np.pi * f * t + idx * np.sin(2 * np.pi * f * t))
    y += 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 3)
    env = (1 - np.exp(-t * 180)) * np.exp(-t * 1.1)
    rel = np.clip((dur - t) / 0.25, 0, 1)        # soft release at the end
    return y * env * rel * vel


chords = [  # Fmaj9, Em7, Dm9, Cmaj7 (MIDI)
    [41, 53, 57, 60, 64, 67],
    [40, 52, 55, 59, 62, 67],
    [38, 50, 53, 57, 60, 64],
    [36, 48, 52, 55, 59, 64],
]

keys = np.zeros(N)
bass = np.zeros(N)
bar = 4 * BEAT
nbars = int(np.ceil(DUR / bar))
for b in range(nbars):
    ch = chords[b % 4]
    t0 = b * bar
    root, notes = ch[0], ch[1:]
    for hit, (off, length, vel) in enumerate([(0, 2.4 * BEAT, 0.34), (2.5 * BEAT, 1.5 * BEAT, 0.2)]):
        for k, n in enumerate(notes):
            add(keys, t0 + off + k * 0.018 + rng.uniform(0, 0.006), epiano(midi(n), length, vel * rng.uniform(0.85, 1.0)))
    # bass: root on 1, fifth-ish walk on the and-of-3
    for off, n, length in [(0, root, 1.8 * BEAT), (2.5 * BEAT, root + (7 if b % 2 else 12), 1.2 * BEAT)]:
        nn = int(length * SR)
        tt = np.arange(nn) / SR
        s = np.sin(2 * np.pi * midi(n + 12) * tt) + 0.2 * np.sin(2 * np.pi * midi(n + 24) * tt)
        s *= (1 - np.exp(-tt * 90)) * np.exp(-tt * 1.6) * np.clip((length - tt) / 0.08, 0, 1)
        add(bass, t0 + off, np.tanh(s * 1.4) * 0.35)

# tremolo on the keys
keys *= 1 - 0.14 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.2 * t_all))

# ---------- drums (boom-bap, swung) ----------
def kick():
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = 45 + 75 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def snare():
    n = int(0.25 * SR); t = np.arange(n) / SR
    noise = bp(rng.standard_normal(n), 1200, 5000) * np.exp(-t * 18)
    tone = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30)
    return (noise * 0.7 + tone * 0.35)


def hat(open_=False):
    n = int((0.12 if open_ else 0.045) * SR); t = np.arange(n) / SR
    return hp(rng.standard_normal(n), 7000) * np.exp(-t * (25 if open_ else 80))


drums = np.zeros(N)
duck = np.ones(N)
swing = 0.62
drum_start = 2 * bar                   # two bars of just keys first
drum_end = DUR - 1.5 * bar             # drums drop out for the tail
for b in range(nbars):
    t0 = b * bar
    if t0 < drum_start or t0 >= drum_end:
        continue
    for off in ([0, 1.5 * BEAT, 2.75 * BEAT] if b % 2 else [0, 2.5 * BEAT]):
        add(drums, t0 + off, kick() * 0.55)
        i = int((t0 + off) * SR); m = int(0.25 * SR)
        if i < N:
            env = 1 - 0.22 * np.exp(-np.arange(min(m, N - i)) / SR * 10)
            duck[i:i + len(env)] = np.minimum(duck[i:i + len(env)], env)
    for off in [1 * BEAT, 3 * BEAT]:
        add(drums, t0 + off + 0.012, snare() * 0.22)
    for e in range(8):
        pos = (e // 2) * BEAT + (swing * BEAT if e % 2 else 0)
        add(drums, t0 + pos, hat(open_=(e == 7 and b % 4 == 3)) * (0.05 if e % 2 else 0.075) * rng.uniform(0.7, 1.0))

drums = lp(drums, 6000)

# ---------- vinyl ----------
crackle = np.zeros(N)
pops = rng.random(N) < 0.00035
crackle[pops] = rng.standard_normal(pops.sum()) * 0.6
crackle = bp(crackle, 1500, 6000) * 0.12
hiss = lp(hp(rng.standard_normal(N), 3000), 9000) * 0.004

# ---------- mix ----------
music = lp(keys, 3200) * 0.9 * duck + lp(bass, 600) * duck + drums
# gentle wow: a slowly wobbling delay line
wow = (0.0018 * (0.5 + 0.5 * np.sin(2 * np.pi * 0.33 * t_all)) * SR)
idx = np.clip(np.arange(N) - wow, 0, N - 1)
music = np.interp(idx, np.arange(N), music)
mix = music + crackle + hiss
mix = lp(mix, 5000, 1)                 # dusty top end

# fade in/out so it loops politely with the video
fade = np.ones(N)
fi, fo = int(1.5 * SR), int(3.0 * SR)
fade[:fi] = np.linspace(0, 1, fi) ** 2
fade[-fo:] = np.linspace(1, 0, fo) ** 1.5
mix *= fade

# subtle: RMS around -24 dBFS, peaks well under 0
rms = np.sqrt(np.mean(mix[int(5 * SR):int((DUR - 5) * SR)] ** 2))
mix *= (10 ** (-24 / 20)) / max(rms, 1e-9)
peak = np.max(np.abs(mix))
if peak > 0.7:
    mix *= 0.7 / peak
stereo = np.stack([mix, np.interp(np.clip(np.arange(N) - 12, 0, N - 1), np.arange(N), mix)], axis=1)  # tiny Haas width
wavfile.write(OUT, SR, (stereo * 32767).astype(np.int16))
print(f'wrote {OUT}: {DUR:.1f}s, peak {np.max(np.abs(stereo)):.2f}')
