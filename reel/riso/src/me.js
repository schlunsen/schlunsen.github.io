// me.js: Rasmus, printed. His 3.5 s smile clip (104 frames, 720×900, 30 fps) with person mattes, played forward then
// backward so it loops seamlessly, separated into the chapter's inks and printed through the riso pipeline.
// The frame is a pure function of reel time, at 15 drawings a second (on twos, like everything else), played at half speed.
(() => {
  const N = 104, pad = i => String(i).padStart(3, '0');
  const load = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { console.error('missing ' + src); ok(im); }; im.src = src; });
  const COL = [], MAT = [];
  window.PRELOAD = Promise.all(Array.from({ length: N }, (_, i) => Promise.all([
    load(`../assets/me/color/f_${pad(i + 1)}.jpg`).then(im => COL[i] = im),
    load(`../assets/me/matte/f_${pad(i + 1)}.png`).then(im => MAT[i] = im)])));
  // Ping-pong at HALF speed: one source frame per drawing (15 drawings/s over 30 fps footage = 0.5x), so ~7.7 s forward
  // and ~7.7 s back. Each turnaround eases: over the last/first TURN drawings the playhead decelerates to a stop and
  // accelerates away again (constant deceleration), so the direction change never snaps.
  const LAST = N - 1, TURN = 12, HALF = LAST + TURN;   // drawings per half-cycle (the eased ends cost TURN extra)
  const meIndex = t => {
    const n = Math.round(onTwos(Math.max(0, t)) * DRAWINGS), k = n % (2 * HALF), tau = k % HALF;
    const p = tau < TURN ? tau * tau / (2 * TURN) : tau < HALF - TURN ? TURN / 2 + (tau - TURN) : LAST - (HALF - tau) ** 2 / (2 * TURN);
    const f = Math.round(k < HALF ? p : LAST - p);
    return Math.max(0, Math.min(LAST, f));
  };

  // Separation recipes: which ink prints what. v = darkness 0..1 of a channel; lvl maps it through levels and a gamma.
  const lvl = (v, lo, hi, g = 1) => { const x = (v - lo) / (hi - lo); return x <= 0 ? 0 : x >= 1 ? 1 : Math.pow(x, g); };
  const SEPS = {
    // blue carries the drawing (shadows, features), pink the warmth of the skin; a touch of yellow if it's loaded
    duo: (r, g, b, D, I) => {
      const L = (.3 * r + .59 * g + .11 * b) / 255, dark = lvl(1 - L, .34, .84, 1.25);
      for (const k of ['blue', 'federal', 'purple', 'teal']) if (I[k] >= 0) D[I[k]] = dark;
      if (I.pink >= 0) D[I.pink] = .06 + .74 * lvl(1 - g / 255, .22, .78, 1.05);
      if (I.yellow >= 0) D[I.yellow] = .5 * lvl(1 - b / 255, .25, .85);
    },
  };
  window.ME_SEPS = SEPS; window.lvl = lvl;
  let inkIdx = null, inkKey = '';
  // printMe(t, cx, bottom, height, o): Rasmus, standing on `bottom`, centred on cx. o: { sep, over, alpha }
  window.printMe = (t, cx, bottom, h, o = {}) => {
    const i = meIndex(t), w = h * 720 / 900, name = o.sep || 'duo', fn = SEPS[name];
    if (inkKey !== RISO.inks.join()) { inkKey = RISO.inks.join(); inkIdx = {}; for (const k of Object.keys(INKS)) inkIdx[k] = RISO.inks.indexOf(k); }
    const I = inkIdx;
    inkImage(COL[i], cx - w / 2, bottom - h, w, h, (r, g, b, D) => fn(r, g, b, D, I), { matte: MAT[i], key: name + i, over: o.over, alpha: o.alpha });
  };
  window.meIndex = meIndex;
})();
