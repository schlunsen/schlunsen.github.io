/* Rasmus Schlünsen — reel score, synthesised in plain JavaScript.
 * A quiet, hopeful piece: felt piano, a warm pad, a soft pulse that enters
 * with OrbiSCADA, a round bass, and small ticks on the counters. Everything
 * goes through a gentle reverb. renderAudio(sampleRate) → { L, R, sr }. */
(function (g) {
  function renderAudio(sr) {
    const T = g.RST, N = Math.ceil(T.DUR * sr), TAU = Math.PI * 2;
    const L = new Float32Array(N), R = new Float32Array(N), VL = new Float32Array(N), VR = new Float32Array(N);
    let seed = 1984;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
    function place(t0, sig, gain, pan, verb = 0.3) {
      const i0 = Math.round(t0 * sr), gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
      for (let k = 0; k < sig.length; k++) {
        const i = i0 + k; if (i < 0) continue; if (i >= N) break;
        L[i] += sig[k] * gl; R[i] += sig[k] * gr; VL[i] += sig[k] * gl * verb; VR[i] += sig[k] * gr * verb;
      }
    }
    function svf() { let low = 0, band = 0; return (x, f, q) => { const F = 2 * Math.sin(Math.PI * Math.min(f, sr / 6) / sr); low += F * band; const high = x - low - q * band; band += F * high; return low; }; }

    // felt piano: a few inharmonic partials, a soft hammer, a felt low-pass
    function piano(freq, len, vel = 1) {
      const n = Math.floor((len + 1.2) * sr), out = new Float32Array(n), flt = svf();
      const parts = [[1, 1, 1.1], [2.001, 0.42, 1.9], [3.004, 0.18, 2.8], [4.01, 0.08, 3.6], [5.02, 0.04, 4.5]];
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s = 0;
        for (const [r, a, d] of parts) s += a * Math.sin(TAU * freq * r * t) * Math.exp(-t * d * (0.9 + freq / 900));
        const hammer = (rnd() * 2 - 1) * Math.exp(-t * 300) * 0.25;
        const damp = t > len ? Math.exp(-(t - len) * 7) : 1;
        out[i] = flt(s + hammer, 900 + 2200 * vel * Math.exp(-t * 3), 0.7) * Math.min(1, t / 0.004) * damp * vel;
      }
      return out;
    }
    function pad(freqs, len) {
      const n = Math.floor((len + 2.5) * sr), out = new Float32Array(n);
      const vs = []; freqs.forEach((f) => [-0.06, 0.06].forEach((dt) => vs.push({ f: f * Math.pow(2, dt / 12), ph: rnd(), flt: svf() })));
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        let s = 0;
        for (const v of vs) { v.ph += v.f / sr; if (v.ph >= 1) v.ph -= 1; s += v.flt(2 * v.ph - 1, 700 + 300 * Math.sin(t * 0.7), 0.8); }
        const env = Math.min(1, t / 1.6) * (t > len ? Math.max(0, 1 - (t - len) / 2.5) : 1);
        out[i] = s / vs.length * env;
      }
      return out;
    }
    function pulse(freq) {
      const n = Math.floor(0.3 * sr), out = new Float32Array(n), flt = svf();
      let ph = rnd();
      for (let i = 0; i < n; i++) { const t = i / sr; ph += freq / sr; if (ph >= 1) ph -= 1; out[i] = flt(2 * ph - 1, 300 + 1600 * Math.exp(-t * 25), 0.5) * Math.exp(-t * 11); }
      return out;
    }
    function bass(freq, len) {
      const n = Math.floor((len + 0.5) * sr), out = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / sr; out[i] = (Math.sin(TAU * freq * t) + 0.2 * Math.sin(TAU * 2 * freq * t)) * Math.min(1, t / 0.01) * Math.exp(-t * 0.9) * (t > len ? Math.max(0, 1 - (t - len) / 0.5) : 1); }
      return out;
    }
    function tick(f) {
      const n = Math.floor(0.05 * sr), out = new Float32Array(n);
      for (let i = 0; i < n; i++) { const t = i / sr; out[i] = Math.sin(TAU * f * t) * Math.exp(-t * 120); }
      return out;
    }
    function swish() {
      const n = Math.floor(0.5 * sr), out = new Float32Array(n), flt = svf();
      for (let i = 0; i < n; i++) { const k = i / n; out[i] = flt(rnd() * 2 - 1, 400 + 3000 * k, 0.6) * Math.sin(Math.PI * k) ** 2; }
      return out;
    }

    // ── harmony: Fmaj7 · Am7 · Dm7 · C(add9), a bar of 2.4 s (100 bpm) ──
    const BAR = 2.4, BEAT = 0.6;
    const CH = [
      { root: 41, pad: [53, 57, 60, 64], arp: [65, 69, 72, 76] },
      { root: 45, pad: [52, 55, 57, 60], arp: [64, 67, 69, 72] },
      { root: 38, pad: [53, 57, 60, 62], arp: [62, 65, 69, 72] },
      { root: 36, pad: [52, 55, 60, 62], arp: [64, 67, 72, 74] },
    ];
    const bars = Math.ceil(T.DUR / BAR);
    for (let b = 0; b < bars; b++) {
      const t0 = b * BAR, c = CH[b % 4];
      const last = t0 >= 53;
      if (t0 >= 57.6) break;
      // piano: sparse at first, flowing from the freelance years on
      const flow = t0 >= 22 && t0 < 53;
      const notes = flow ? [0, 2, 1, 3, 2, 1, 3, 2] : [0, null, 2, null, 1, null, 3, null];
      notes.forEach((k, e) => { if (k === null) return; if (t0 < 2.4 && e > 3) return; place(t0 + e * BEAT / 2, piano(midi(c.arp[k]), 0.5, e === 0 ? 0.85 : 0.55), 0.2, (k - 1.5) * 0.25, 0.45); });
      // left hand
      place(t0, piano(midi(c.root + 12), 1.8, 0.7), 0.22, -0.2, 0.4);
      // pad from the 3D years on
      if (t0 >= 12) place(t0, pad(c.pad.map(midi), BAR), 0.13, 0, 0.6);
      // pulse + bass for OrbiSCADA through the workshop
      if (flow) {
        for (let e = 0; e < 8; e++) place(t0 + e * BEAT / 2, pulse(midi(c.root + 24)), e % 2 ? 0.035 : 0.05, e % 2 ? 0.3 : -0.3, 0.2);
        place(t0, bass(midi(c.root), BAR), 0.22, 0, 0.05);
      }
      if (last) break;
    }
    // the end: a held Fmaj9 and a last high line
    place(53.0, pad([41, 53, 57, 60, 64, 67].map(midi), 5.5), 0.16, 0, 0.7);
    place(53.0, bass(midi(29), 5), 0.24, 0, 0.1);
    [[53.0, 72], [53.6, 76], [54.2, 79], [55.6, 81], [56.8, 79], [57.4, 77]].forEach(([t, m]) => place(t, piano(midi(m), 1.6, 0.6), 0.2, 0.2, 0.6));

    // effects
    T.SFX.forEach(([t, k], i) => {
      if (k === 'swish') place(t, swish(), 0.06, 0, 0.3);
      else if (k === 'tick') place(t, tick(2600 + (i % 5) * 120), 0.05, 0.3, 0.1);
      else if (k === 'card') place(t, tick(1800 + (i % 7) * 90), 0.06, (i % 3 - 1) * 0.4, 0.2);
      else if (k === 'ping') place(t, piano(midi(88), 1.2, 0.5), 0.12, 0.4, 0.7);
      else if (k === 'chime') [84, 88, 91].forEach((m, j) => place(t + j * 0.09, piano(midi(m), 2, 0.45), 0.1, 0.3, 0.8));
    });

    // reverb
    function verb(inp, spread) {
      const out = new Float32Array(N), sc = sr / 44100;
      const combs = [1557, 1617, 1491, 1422, 1277, 1356].map((d) => ({ b: new Float32Array(Math.round((d + spread) * sc)), i: 0, lp: 0 }));
      const aps = [556, 441, 341].map((d) => ({ b: new Float32Array(Math.round((d + spread) * sc)), i: 0 }));
      for (let n = 0; n < N; n++) {
        const x = inp[n] * 0.2; let s = 0;
        for (const c of combs) { const y = c.b[c.i]; c.lp = y * 0.6 + c.lp * 0.4; c.b[c.i] = x + c.lp * 0.86; c.i = (c.i + 1) % c.b.length; s += y; }
        for (const a of aps) { const y = a.b[a.i]; const v = -s + y; a.b[a.i] = s + y * 0.5; a.i = (a.i + 1) % a.b.length; s = v; }
        out[n] = s;
      }
      return out;
    }
    const WL = verb(VL, 0), WR = verb(VR, 23);
    let peak = 0;
    for (let i = 0; i < N; i++) {
      const t = i / sr, e = Math.min(1, t / 0.4) * Math.min(1, (T.DUR - t) / 2.2);
      L[i] = Math.tanh((L[i] + WL[i] * 0.8) * e * 1.1); R[i] = Math.tanh((R[i] + WR[i] * 0.8) * e * 1.1);
      peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    }
    const k = 0.88 / (peak || 1);
    for (let i = 0; i < N; i++) { L[i] *= k; R[i] *= k; }
    return { L, R, sr };
  }
  g.renderAudio = renderAudio;
})(typeof window !== 'undefined' ? window : globalThis);
