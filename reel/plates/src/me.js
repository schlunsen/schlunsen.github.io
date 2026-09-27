// me.js: Rasmus, engraved. His 104-frame smile clip (720×900) with person mattes, ping-ponged at half speed with eased
// turnarounds (a pure function of reel time), drawn as a banknote-style line engraving: horizontal lines, gently
// waved, whose width follows the brightness of the face (bone lines on ink: light = thick). One Path2D per source
// frame, built lazily and cached, in unit space (0..1 wide, 0..1.25 tall).
(() => {
  const N = 104, pad = i => String(i).padStart(3, '0');
  const load = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { console.error('missing ' + src); ok(im); }; im.src = src; });
  const COL = [], MAT = [];
  window.PRELOAD = Promise.all(Array.from({ length: N }, (_, i) => Promise.all([
    load(`../assets/me/color/f_${pad(i + 1)}.jpg`).then(im => COL[i] = im),
    load(`../assets/me/matte/f_${pad(i + 1)}.png`).then(im => MAT[i] = im)])));

  // ping-pong at 15 drawings/s, one source frame per drawing, easing to a stop at each end
  const LAST = N - 1, TURN = 12, HALF = LAST + TURN;
  const meIndex = t => {
    const n = Math.floor(Math.max(0, t) * 15 + 1e-6), k = n % (2 * HALF), tau = k % HALF;
    const p = tau < TURN ? tau * tau / (2 * TURN) : tau < HALF - TURN ? TURN / 2 + (tau - TURN) : LAST - (HALF - tau) ** 2 / (2 * TURN);
    return Math.max(0, Math.min(LAST, Math.round(k < HALF ? p : LAST - p)));
  };

  const LINES = 96, COLS = 200, AR = 900 / 720;
  const sc = document.createElement('canvas'); sc.width = COLS; sc.height = LINES;
  const sx = sc.getContext('2d', { willReadFrequently: true });
  const cache = new Map();
  function build(i) {
    const key = i; if (cache.has(key)) return cache.get(key);
    sx.clearRect(0, 0, COLS, LINES); sx.drawImage(COL[i], 0, 0, COLS, LINES); const c = sx.getImageData(0, 0, COLS, LINES).data;
    sx.clearRect(0, 0, COLS, LINES); sx.drawImage(MAT[i], 0, 0, COLS, LINES); const m = sx.getImageData(0, 0, COLS, LINES).data;
    const body = new Path2D(), edge = [];
    const pitch = AR / LINES;
    for (let r = 0; r < LINES; r++) {
      const yc = (r + .5) * pitch, top = [], bot = [];
      let run = false;
      const flush = () => { if (top.length > 1) { body.moveTo(top[0][0], top[0][1]); for (const p of top) body.lineTo(p[0], p[1]); for (let j = bot.length - 1; j >= 0; j--) body.lineTo(bot[j][0], bot[j][1]); body.closePath(); } top.length = 0; bot.length = 0; };
      for (let q = 0; q < COLS; q++) {
        const o = (r * COLS + q) * 4, mt = m[o] / 255;
        const L = (.3 * c[o] + .59 * c[o + 1] + .11 * c[o + 2]) / 255;
        // levels: lift the mids, crush the darks, so the features read as line density
        const v = Math.pow(clamp((L - .08) / .8), .9) * clamp(mt * 1.4 - .2);
        const x = (q + .5) / COLS, wave = Math.sin(x * 22 + r * .35) * pitch * .12;
        const hw = pitch * .5 * clamp(v * .95 + (mt > .5 ? .06 : 0));
        if (hw > pitch * .03) { top.push([x, yc + wave - hw]); bot.push([x, yc + wave + hw]); run = true; }
        else if (run) { flush(); run = false; }
        if (mt > .5 && q > 0 && m[o - 4] / 255 <= .5) edge.push([x, yc]);   // left silhouette edge (for the rim light)
      }
      flush();
    }
    const res = { body, edge };
    cache.set(key, res);
    if (cache.size > 120) cache.delete(cache.keys().next().value);
    return res;
  }
  // engraveMe(t, cx, bottom, h, o): draws him standing on `bottom`, centred at cx, h px tall.
  //   o: { col (line colour), a (alpha), rim (0..1: an orange rim light on his left edge), reveal (0..1: lines are
  //        engraved top-down, the burin's head as a spark) }
  window.engraveMe = (t, cx, bottom, h, o = {}) => {
    const i = meIndex(t), E = build(i), w = h / AR;
    X.save(); X.translate(cx - w / 2, bottom - h); X.scale(w, w);
    if (o.reveal != null && o.reveal < 1) { X.beginPath(); X.rect(-1, -1, 3, 1 + AR * o.reveal); X.clip(); }
    X.globalAlpha *= o.a ?? 1; X.fillStyle = o.col || C.bone; X.fill(E.body);
    X.restore();
    if (o.rim) glow(g => { g.save(); g.translate(cx - w / 2, bottom - h); g.scale(w, w); g.globalAlpha = o.rim * .5; g.fillStyle = C.signal; g.fill(E.body); g.restore(); });
    return { x: cx - w / 2, y: bottom - h, w, h };
  };
  window.meIndex = meIndex;
})();
