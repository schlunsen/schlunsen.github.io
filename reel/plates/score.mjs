// score.mjs: the plates reel's own score, synthesised in plain JavaScript → assets/score.wav (60 s, 44.1 kHz stereo).
//   node score.mjs [--out=assets/score.wav]
// D minor, 80 bpm (a beat every 0.75 s; every cut lands on a beat). The sound of a plate being made: a low drone
// (the ember), a burin tick on the sixteenths, FM bells for the drawn lines, a felt-thud for every rubber stamp. Each
// plate gets its own texture; hits are placed on the reel's events (see STORYBOARD.md). The mix is circular: whatever
// rings past 60 s wraps to the start, so the loop point is seamless.
import fs from 'node:fs';

const args = Object.fromEntries(process.argv.slice(2).map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v ?? true]; }));
const SR = 44100, DUR = 60, N = SR * DUR, TAU = Math.PI * 2, BEAT = .75, S16 = BEAT / 4;
const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);
let seed = 2010;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
const noise = () => rnd() * 2 - 1;
const mtof = m => 440 * 2 ** ((m - 69) / 12);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const seg = (t, a, b) => clamp((t - a) / (b - a));
function svf() { let low = 0, band = 0; return (x, f, q = .7) => { const F = 2 * Math.sin(Math.PI * Math.min(f, SR / 6) / SR); low += F * band; const high = x - low - q * band; band += F * high; return { low, band, high }; }; }

// place a signal at t0 (seconds), equal-power pan, some of it to the reverb; wraps around the loop
function place(t0, sig, gain, pan = 0, verb = .25) {
  const i0 = Math.round(t0 * SR), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < sig.length; k++) {
    const i = ((i0 + k) % N + N) % N, s = sig[k];
    L[i] += s * gl; R[i] += s * gr; VL[i] += s * gl * verb; VR[i] += s * gr * verb;
  }
}
const buf = len => new Float32Array(Math.floor(len * SR));

// ---------------------------------------------------------------- instruments
// FM bell: the drawn line. ratio 3.5 gives the engraved-metal edge.
function bell(f, vel = 1, len = 3, o = {}) {
  const out = buf(len), ratio = o.ratio ?? 3.5, idx = o.idx ?? 2.2, d = o.decay ?? 1.4;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, env = Math.exp(-t * d) * Math.min(1, t / .002);
    out[i] = Math.sin(TAU * f * t + idx * Math.exp(-t * 3) * Math.sin(TAU * f * ratio * t)) * env * vel
      + .25 * Math.sin(TAU * f * 2.001 * t) * Math.exp(-t * d * 2.2) * vel;
  }
  return out;
}
// the burin: a short bright tick
function tick(vel = 1, bright = 7000) {
  const out = buf(.06), f = svf();
  for (let i = 0; i < out.length; i++) { const t = i / SR; out[i] = f(noise(), bright, .35).band * Math.exp(-t * 90) * vel * 1.6; }
  return out;
}
// kick: a sine sweep
function kick(vel = 1, len = .5, f0 = 110, f1 = 42) {
  const out = buf(len); let ph = 0;
  for (let i = 0; i < out.length; i++) { const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t * 28); ph += TAU * f / SR; out[i] = Math.tanh(1.6 * Math.sin(ph)) * Math.exp(-t * 7) * vel; }
  return out;
}
// rubber stamp: a felt thud, a woody knock and a paper slap
function stamp(vel = 1) {
  const out = buf(.7), k = kick(1, .7, 95, 38), f = svf();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR;
    out[i] = (.9 * k[i] + .5 * Math.sin(TAU * 190 * t) * Math.exp(-t * 38) + .55 * f(noise(), 1400, .8).low * Math.exp(-t * 30)) * vel;
  }
  return out;
}
// paper snare: bandpassed noise with a body
function paper(vel = 1) {
  const out = buf(.3), f = svf();
  for (let i = 0; i < out.length; i++) { const t = i / SR; out[i] = (f(noise(), 2600, .9).band * 1.4 * Math.exp(-t * 22) + .3 * Math.sin(TAU * 210 * t) * Math.exp(-t * 40)) * vel; }
  return out;
}
// shackle: inharmonic metal
function clank(vel = 1) {
  const out = buf(1.6), P = [[523, 1, 3], [1311, .6, 4.5], [2097, .45, 6], [3180, .3, 8], [4417, .2, 11]];
  for (let i = 0; i < out.length; i++) { const t = i / SR; let s = noise() * Math.exp(-t * 200) * .6; for (const [f, a, d] of P) s += a * Math.sin(TAU * f * t) * Math.exp(-t * d); out[i] = s * vel * .5; }
  return out;
}
// keyboard click for the prompt
function key(vel = 1) {
  const out = buf(.05), f = svf();
  for (let i = 0; i < out.length; i++) { const t = i / SR; out[i] = (f(noise(), 3800, .5).band + .4 * Math.sin(TAU * 1400 * t)) * Math.exp(-t * 140) * vel; }
  return out;
}
// bass: sine + a rounded saw through a closing filter
function bass(f, len, vel = 1, o = {}) {
  const out = buf(len + .15), fl = svf(), cut = o.cut ?? 700;
  for (let i = 0; i < out.length; i++) {
    const t = i / SR, saw = 2 * ((f * t) % 1) - 1, rel = t > len ? Math.exp(-(t - len) * 40) : 1;
    const x = .8 * Math.sin(TAU * f * t) + .45 * fl(saw, 120 + cut * Math.exp(-t * 6), .6).low;
    out[i] = Math.tanh(1.3 * x) * Math.min(1, t / .004) * rel * vel;
  }
  return out;
}
// pad: detuned saws, slow in and out, a low-pass that can open over the note
function pad(notes, len, vel = 1, o = {}) {
  const att = o.att ?? .8, rel = o.rel ?? 1.5, out = buf(len + rel), c0 = o.c0 ?? 900, c1 = o.c1 ?? c0;
  const V = notes.flatMap(m => [-.07, .07].map(dt => ({ f: mtof(m + dt), ph: rnd() })));
  const flt = svf();
  for (let i = 0; i < out.length; i++) {
    const t = i / SR; let s = 0;
    for (const v of V) { v.ph = (v.ph + v.f / SR) % 1; s += 2 * v.ph - 1; }
    const env = Math.min(1, t / att) * (t > len ? Math.exp(-(t - len) * 3 / rel) : 1);
    out[i] = flt(s / V.length, c0 + (c1 - c0) * seg(t, 0, len), .5).low * env * vel;
  }
  return out;
}
// a noise riser (bandpass sweeping up), or a fall with up = false
function riser(len, vel = 1, up = true) {
  const out = buf(len), f = svf();
  for (let i = 0; i < out.length; i++) { const k = i / out.length, e = up ? k : 1 - k; out[i] = f(noise(), 300 + 7000 * e * e, .4).band * e ** 1.6 * vel * Math.min(1, (out.length - i) / (.02 * SR)); }
  return out;
}

// ---------------------------------------------------------------- the ember drone (runs the whole reel)
// D2 and A2, chosen so both complete whole cycles in 60 s: the loop point has no seam.
{
  const fD = 4405 / 60, fA = 6600 / 60;
  const lvl = t => .16 + .1 * (1 - seg(t, 5, 6.5)) + .12 * seg(t, 53.25, 56) + .06 * (1 - seg(t, 22.5, 24)) * seg(t, 22, 22.5)
    - .08 * seg(t, 12, 12.5) * (1 - seg(t, 17, 17.25));
  for (let i = 0; i < N; i++) {
    const t = i / SR, sw = 1 + .15 * Math.sin(TAU * t / 15);
    const s = (Math.sin(TAU * fD * t) + .35 * Math.sin(TAU * fD * 2 * t) * sw + .22 * Math.sin(TAU * fA * t)) * lvl(t);
    L[i] += s * .5; R[i] += s * .5; VL[i] += s * .08; VR[i] += s * .08;
  }
}

// ---------------------------------------------------------------- harmony: one chord per bar-ish (MIDI)
const D = 50, CH = {
  Dm9: [50, 57, 60, 64, 65], Bbmaj7: [46, 53, 57, 62], F: [53, 57, 60, 65], C: [48, 55, 60, 64], Gm7: [43, 50, 53, 58, 62],
  Am: [45, 52, 57, 60], Eb: [51, 55, 58, 63], Fadd9: [53, 57, 60, 67, 69], Dm: [50, 57, 62, 65], A: [45, 52, 57, 61],
};
const ROOT = { Dm9: 38, Dm: 38, Bbmaj7: 34, F: 41, C: 36, Gm7: 43, Am: 45, Eb: 39, Fadd9: 41, A: 45 };

// ================================================================= OPEN 0–6: the ember, the grid, the engraving
place(.75, bell(mtof(86), .5, 3, { decay: 1.1 }), .22, .3, .5);           // grid pops on
place(1.5, bell(mtof(62), .9), .3, -.2, .45);                              // "Fifteen"
place(2.25, bell(mtof(69), .9), .3, .2, .45);                              // "years."
place(3.0, bell(mtof(72), .7), .22, -.1, .45); place(3.75, bell(mtof(76), .8, 4), .26, .15, .5);   // "Building what's next."
for (let i = 0; i < 24; i++) { const t = .75 + i * S16 * 1; if (t > 5.9) break; place(t, tick(.4 + .3 * (i % 4 === 0)), .12 * seg(t, .75, 2.7) + .02, (i % 2 ? .3 : -.3), .15); }  // the burin engraving him
place(0, pad(CH.Dm9, 5.2, 1, { att: 2, c0: 400, c1: 1300 }), .16, 0, .5);
place(4.5, riser(1.5, 1), .08, 0, .3);

// ================================================================= SECURITY 6–12: the lock
place(6, kick(1), .6); place(6, bass(mtof(38), 1.4, 1), .32);
for (let b = 0; b < 8; b++) {                               // a low, careful pulse: 8ths
  const t = 6 + b * BEAT; place(t, kick(.7, .35), b % 2 ? .25 : .38);
  for (let s = 0; s < 4; s++) place(t + s * S16, tick(s === 2 ? .8 : .35, 5500), .09, s % 2 ? .35 : -.35, .1);
  place(t + BEAT / 2, bass(mtof(b < 4 ? 38 : 34), .3, .7, { cut: 500 }), .26);
}
place(6, pad(CH.Dm, 3, 1, { c0: 500, c1: 900 }), .12, 0, .4); place(9, pad(CH.Bbmaj7, 3, 1, { c0: 600, c1: 1100 }), .12, 0, .4);
place(8.35, stamp(1), .62, -.25, .3);                        // stamp: 2010
place(9.0, clank(1), .38, .35, .45);                         // the shackle opens
place(9.0, bell(mtof(74), .8, 3), .2, .3, .5);
place(10.5, riser(1.5, 1), .06);

// ================================================================= UNITY 12–17.25: blueprint on paper (light, airy)
place(12, bell(mtof(58), 1, 4), .36, -.3, .5);
place(12, pad(CH.Bbmaj7.map(m => m + 12), 3.2, 1, { att: .3, c0: 1800 }), .14, 0, .6);
place(15, pad(CH.F.map(m => m + 12), 2.25, 1, { att: .3, c0: 1800 }), .14, 0, .6);
{ const arp = [70, 74, 77, 81, 77, 74, 72, 77, 81, 84, 81, 77]; for (let i = 0; i < 28; i++) { const t = 12 + i * S16; if (t >= 17.2) break; const m = i < 16 ? arp[i % 12] : [72, 77, 81, 84][i % 4]; place(t, bell(mtof(m), .55, 1.2, { decay: 3.2, idx: 1.2 }), .13, i % 2 ? .45 : -.45, .45); } }
place(13.8, bell(mtof(93), .6, 2.5), .12, .5, .6);           // the cap lands
place(15.25, stamp(.5), .25, 0, .4);
place(15.75, riser(1.5, 1), .07);

// ================================================================= AGENCY 17.25–22.5: full stack, full speed
for (let b = 0; b < 7; b++) {
  const t = 17.25 + b * BEAT;
  place(t, kick(1, .4), .5); if (b % 2) place(t, paper(1), .3, .15, .15);
  for (let s = 0; s < 4; s++) place(t + s * S16, tick(s % 2 ? .5 : 1, 8000), .11, s % 2 ? .4 : -.4, .05);
  const root = b < 4 ? 43 : 36; for (let s = 0; s < 4; s++) place(t + s * S16, bass(mtof(root + (s === 3 ? 12 : 0)), S16 * .8, .8, { cut: 1400 }), .2);
}
place(17.25, pad(CH.Gm7, 3, 1, { att: .05, c0: 1200 }), .1, 0, .3); place(20.25, pad(CH.C, 2.25, 1, { att: .05, c0: 1200 }), .1, 0, .3);
[[17.25 + 2.2, 79], [17.25 + 2.35, 82], [17.25 + 2.5, 86]].forEach(([t, m]) => place(t, bell(mtof(m), .6, 1.4, { decay: 3 }), .12, .4, .4));   // latency readout drops
place(21, riser(1.5, 1.2), .1);

// ================================================================= ORBISCADA 22.5–33: one turbine, then fifteen hundred
place(22.5, kick(1, .8, 80, 36), .7); place(22.5, bell(mtof(50), 1, 5, { decay: .6 }), .3, 0, .6);
{ // wind: a slow bandpassed noise swell across the plate
  const out = buf(10.5), f = svf();
  for (let i = 0; i < out.length; i++) { const t = i / SR, w = .5 + .5 * Math.sin(TAU * t / 3.7); out[i] = f(noise(), 400 + 500 * w + 900 * seg(t, 3.75, 8.25), .6).band * (.25 + .3 * seg(t, 3.75, 8.25)) * Math.min(1, t / 1.5) * (1 - seg(t, 9.5, 10.5)); }
  place(22.5, out, .28, 0, .4);
}
place(22.5, pad(CH.Dm9, 3.75, 1, { att: 1.5, c0: 500, c1: 900 }), .13, 0, .5);
// from 26.25 the count runs: bars stack up (Dm C Bb A), the arp gets denser and brighter as turbines multiply
const orbisBars = [['Dm', 26.25], ['C', 27.75], ['Bbmaj7', 29.25], ['A', 30.75]];
orbisBars.forEach(([c, t], j) => { place(t, pad(CH[c], 1.5, 1, { att: .05, c0: 700 + j * 500 }), .12 + j * .02, 0, .4); place(t, bass(mtof(ROOT[c]), 1.3, 1, { cut: 600 + j * 200 }), .3); });
for (let i = 0; i < 24; i++) {
  const t = 26.25 + i * S16, bar = orbisBars[Math.min(3, Math.floor(i / 8))][0], ns = CH[bar].map(m => m + 24);
  place(t, bell(mtof(ns[(i * 3) % ns.length]), .5 + .4 * i / 24, .8, { decay: 4, idx: 1 + i / 12 }), .07 + .05 * i / 24, (i % 2 ? .5 : -.5), .4);
  place(t, tick(.4 + .6 * i / 24, 6000 + 150 * i), .05 + .05 * i / 24, 0, .1);
  if (i % 2 === 0) place(t, kick(.6 + .4 * i / 24, .3), .2 + .2 * i / 24);
}
[1.0, .9].forEach((v, j) => place(26.25 + j * 1.5 + 1.2, bell(mtof(81 + j * 5), v, 2), .1, j ? .4 : -.4, .5));
place(29.25, riser(2.25, 1.4), .12);
place(30.75, kick(1, 1, 90, 34), .7); place(30.75, bell(mtof(62), 1, 4), .25, 0, .6);   // 1,500+
place(31.5, stamp(1.1), .7, .3, .35);                         // stamp: Børsen Gazelle 2018
place(31.5, pad([62, 69, 73, 76], 1.5, 1, { att: .02, c0: 2400 }), .13, 0, .6);   // A major: a small triumph
place(31.5, bell(mtof(81), 1, 3), .2, .3, .6); place(31.65, bell(mtof(85), .8, 3), .16, -.3, .6);

// ================================================================= CLOVR 33–39.75: following the money (tight, phrygian)
place(33, kick(1, .6), .55); place(33, bass(mtof(38), 3, .9, { cut: 400 }), .3); place(36, bass(mtof(39), 2.25, .9, { cut: 400 }), .3);
place(33, pad(CH.Dm, 3, 1, { att: .6, c0: 500 }), .12, 0, .5); place(36, pad(CH.Eb, 3.75, 1, { att: .3, c0: 500, c1: 1200 }), .12, 0, .5);
for (let b = 0; b < 9; b++) { const t = 33 + b * BEAT; place(t, kick(.6, .3), .28); place(t + S16 * 2, tick(.7, 4500), .1, .3, .1); place(t + S16 * 3, tick(.35, 9000), .06, -.3, .05); }
for (let i = 1; i <= 6; i++) {                               // each hop of the trace pings a little higher
  const t = 33 + 1.1 + i * .55; place(t, bell(mtof(69 + [0, 3, 5, 7, 8, 10][i - 1]), .8, 1.5, { decay: 2.4 }), .15, (i % 2 ? .4 : -.4), .4);
  place(t, tick(1, 7000), .1);
}
place(37.5, stamp(1.1), .7, .3, .35);                         // FOUND
place(37.5, bell(mtof(74), 1, 3), .22, 0, .55); place(37.5, clank(.5), .15, -.4, .5);
place(38.25, riser(1.5, .8), .05, 0, .3);

// ================================================================= N0 39.75–45: the prompt, then the workspace
place(39.75, pad(CH.Gm7, 2.25, 1, { att: .3, c0: 600 }), .12, 0, .5);
[.15, .25, .35, .45, .55, .65, .75, .85, .95, 1.1, 1.25, 1.4, 1.6].forEach((dt, i) => place(39.75 + dt, key(.8 + .2 * (i % 3 === 0)), .12, (hashPan(i)), .08));
function hashPan(i) { return ((i * 7919) % 11) / 11 - .45; }
place(40.8, riser(1.2, 1.1), .09);
place(42.0, kick(1, .9, 90, 36), .6); place(42.0, stamp(.6), .3);   // ⏎: the window opens
place(42.0, pad(CH.Fadd9, 3, 1, { att: .04, c0: 900, c1: 3000 }), .17, 0, .6);
place(42.0, bass(mtof(41), 2.8, 1, { cut: 500 }), .3);
[[42.0, 77], [42.19, 81], [42.38, 84], [42.56, 88], [42.75, 89]].forEach(([t, m], i) => place(t, bell(mtof(m), .8, 2.5, { decay: 1.8 }), .13, i % 2 ? .4 : -.4, .6));
for (let i = 0; i < 12; i++) { const t = 42.1 + .15 + i * .17; place(t + .42, tick(.6, 5000), .07, i % 2 ? .5 : -.5, .2); }   // people, agents, apps land
place(44.25, bell(mtof(72), .9, 2), .2, 0, .6); place(44.25, kick(.8, .5), .35);   // all pulse together
place(44.25, riser(.75, 1), .08);

// ================================================================= WORKSHOP 45–53.25: always building, always shipping (the groove)
const wsBars = [['Dm', 45], ['Bbmaj7', 48], ['F', 51], ['C', 52.5]];
wsBars.forEach(([c, t], j) => { const len = (wsBars[j + 1]?.[1] ?? 53.25) - t; place(t, pad(CH[c], len, 1, { att: .05, c0: 1400 }), .1, 0, .35); });
for (let b = 0; b < 11; b++) {
  const t = 45 + b * BEAT, c = wsBars.filter(([, s]) => s <= t + 1e-6).pop()[0], root = ROOT[c];
  place(t, kick(1, .4), .5); if (b % 2) place(t, paper(1.1), .32, .1, .2);
  for (let s = 0; s < 4; s++) place(t + s * S16, tick(s % 2 ? .45 : .9, 7500), .1, s % 2 ? .4 : -.4, .05);
  [0, 3].forEach(s => place(t + s * S16, bass(mtof(root + (s ? 12 : 0)), S16 * 1.6, .9, { cut: 1100 }), .25));
}
for (let i = 0; i < 9; i++) { const t = 45 + .9 + i * .375 + .18; place(t, tick(1, 3000), .14, (i % 3 - 1) * .5, .15); place(t, bell(mtof([74, 77, 81, 74, 77, 81, 74, 79, 84][i]), .6, 1, { decay: 3.5 }), .09, (i % 3 - 1) * .5, .4); }   // cards land
for (let i = 0; i < 9; i++) place(45 + 4.5 + i * .2 + .1, stamp(.8 + .02 * i), .38, (i % 3 - 1) * .45, .25);   // SHIPPED × 9
place(51.3, bell(mtof(86), 1, 3), .2, 0, .6);
place(51.9, riser(1.35, 1), .08);

// ================================================================= END 53.25–60: serious code, clear thinking; back to the ember
place(53.25, kick(1, 1, 85, 34), .55);
const endBars = [['Bbmaj7', 53.25, 1.5], ['F', 54.75, 1.5], ['C', 56.25, 1.5], ['Dm9', 57.75, 2.25]];
endBars.forEach(([c, t, len]) => { place(t, pad(CH[c], len, 1, { att: .25, c0: 900, rel: 2 }), .14, 0, .6); place(t, bass(mtof(ROOT[c]), len - .1, .8, { cut: 300 }), .22); });
[[53.55, 74], [53.95, 77], [55.15, 81], [55.9, 79], [56.9, 76], [57.75, 74], [58.5, 69]].forEach(([t, m], i) => place(t, bell(mtof(m), .8, 3.5, { decay: 1 }), .17, (i % 2 ? .3 : -.3), .6));  // "Serious code. Clear thinking."
for (let i = 0; i < 14; i++) { const t = 58.95 + i * S16 / 3; if (t > 59.8) break; place(t, tick(.3 + .05 * i, 5000 + 400 * i), .06, (i % 2 ? .3 : -.3), .3); }   // the burin, un-engraving
place(58.95, riser(1.0, .7), .05, 0, .6);

// ---------------------------------------------------------------- reverb (Freeverb-lite, circular) and master
function reverb(inp, combs, aps, fb = .83, damp = .25) {
  const out = new Float32Array(N);
  for (const d of combs) { const b = new Float32Array(d); let j = 0, lp = 0;
    for (let pass = 0; pass < 2; pass++) for (let i = 0; i < N; i++) { const y = b[j]; lp = y * (1 - damp) + lp * damp; b[j] = inp[i] + lp * fb; j = (j + 1) % d; if (pass) out[i] += y; } }
  for (const d of aps) { const b = new Float32Array(d); let j = 0;   // warm on the tail first, so the loop point has no seam
    for (let i = N - SR; i < N; i++) { b[j] = out[i] + b[j] * .5; j = (j + 1) % d; }
    for (let i = 0; i < N; i++) { const y = b[j], x = out[i]; b[j] = x + y * .5; out[i] = y - x * .5; j = (j + 1) % d; } }
  return out;
}
const rl = reverb(VL, [1557, 1617, 1491, 1422, 1277, 1356], [556, 441, 341]), rr = reverb(VR, [1580, 1640, 1514, 1445, 1300, 1379], [579, 464, 364]);
let peak = 0; const hp = [svf(), svf()];
// warm the high-pass on the tail so its state at sample 0 matches the end (no seam at the loop point)
for (let i = N - 2 * SR; i < N; i++) { hp[0](L[i] + rl[i] * .18, 28, .7); hp[1](R[i] + rr[i] * .18, 28, .7); }
for (let i = 0; i < N; i++) {
  let l = L[i] + rl[i] * .18, r = R[i] + rr[i] * .18;
  l = hp[0](l, 28, .7).high; r = hp[1](r, 28, .7).high;
  L[i] = Math.tanh(l * 1.1); R[i] = Math.tanh(r * 1.1); peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
}
const g = .89 / peak * (+args.gain || .78),   // ≈ −17 LUFS: present on the site without shouting
      out = Buffer.alloc(44 + N * 4);
out.write('RIFF', 0); out.writeUInt32LE(36 + N * 4, 4); out.write('WAVE', 8); out.write('fmt ', 12);
out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(2, 22); out.writeUInt32LE(SR, 24);
out.writeUInt32LE(SR * 4, 28); out.writeUInt16LE(4, 32); out.writeUInt16LE(16, 34); out.write('data', 36); out.writeUInt32LE(N * 4, 40);
for (let i = 0; i < N; i++) { out.writeInt16LE(Math.round(L[i] * g * 32767), 44 + i * 4); out.writeInt16LE(Math.round(R[i] * g * 32767), 46 + i * 4); }
const file = args.out || new URL('./assets/score.wav', import.meta.url);
fs.writeFileSync(file, out);
console.log('wrote', String(file).replace(/^file:\/\//, ''), `(${DUR} s, peak gain ${g.toFixed(2)})`);
