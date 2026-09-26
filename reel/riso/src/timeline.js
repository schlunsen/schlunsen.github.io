// timeline.js: the shot list, standalone loops, and the print-native transitions (ink slide, dot dissolve, paper feed).
//
// shots([[t0, fn], [t1, fn], ...]) registers shots in time order. Each fn(t, lt, dur) is called with t = video time,
// lt = time since the shot started, dur = the shot's length. It paints the WHOLE frame, background included, and must be
// a pure function of t: frames render in parallel and out of order, so nothing may carry over from one frame to the next.

const SHOTS = [];
function shots(list) { SHOTS.push(...list); SHOTS.sort((a, b) => a[0] - b[0]); }

// Standalone loops (model sheets, GIFs, tests), outside the main timeline: window.LOOP = LOOPS[name] swaps the whole
// frame for that function, called with loop time. Give each a length: LOOPS.x = t => { ... }; LOOPS.x.len = 4;
const LOOPS = {};

function drawWorld(t) {
  if (window.LOOP) window.LOOP(t);
  else if (!SHOTS.length) placeholder(t);
  else {
    let i = 0; while (i + 1 < SHOTS.length && t >= SHOTS[i + 1][0]) i++;
    const t0 = SHOTS[i][0], end = i + 1 < SHOTS.length ? SHOTS[i + 1][0] : DUR;
    SHOTS[i][1](t, t - t0, end - t0);
    CAM = null;
  }
  flushLetters();
}

function placeholder(t) {
  paint(ellPts(820, 500, 300, 300, 64), { fill: 'pink' });
  paint(ellPts(1100, 560, 300, 300, 64), { fill: 'blue', over: true });
  clawd(960, 900, 20, feel('happy', t));
}

// ---------- transitions ----------
// Each one covers the frame completely at p = .5: cut to the next shot there, under full cover. Call it LAST in both
// shots, in screen space (after camEnd()):
//   end of shot A:   if (lt > dur - .35) inkSlide((lt - (dur - .35)) / .7);
//   start of shot B: if (lt < .35) inkSlide(.5 + lt / .7);

// Ink slide: one ink sweeps across the sheet, then the next overprints it (pink, then blue → a purple cover), each with
// a halftone leading edge; then they slide off the other side in the same order. cols: inks or recipes, 1–3 of them.
function inkSlide(p, cols = ['pink', 'blue'], o = {}) {
  if (p <= 0 || p >= 1) return;
  const n = cols.length, E = o.edge ?? 220, lag = o.lag ?? .22, ang = o.angle ?? -.08;
  push(); resetMatrix(); translate(W / 2, H / 2); rotate(ang); translate(-W / 2, -H / 2);
  const X0 = -E - 260, X1 = W + E + 260;
  cols.forEach((col, i) => {
    const d = i * lag / Math.max(1, n - 1) * (n > 1 ? 1 : 0);
    const k = p < .5 ? easeOut(clamp((p * 2 - d) / (1 - lag))) : ease(clamp(((p - .5) * 2 - d) / (1 - lag)));
    const over = i > 0;
    if (p < .5) {   // sweeping in: solid body behind a halftone leading edge
      const lead = lerp(X0, X1, k); if (lead <= X0 + 1) return;
      paint(rectPts(X0 - 400, -300, lead - E - X0 + 400, H + 600), { fill: col, over });
      paint(rectPts(lead - E, -300, E, H + 600), { fill: col, over, ramp: { from: [lead - E, 0], to: [lead, 0], a: 1, b: 0, fade: !over } });
    } else {        // sliding off: a halftone trailing edge ahead of the solid body
      const trail = lerp(X0, X1, k); if (trail >= X1 - 1) return;
      paint(rectPts(trail + E, -300, X1 + 400 - trail - E, H + 600), { fill: col, over });
      paint(rectPts(trail, -300, E, H + 600), { fill: col, over, ramp: { from: [trail + E, 0], to: [trail, 0], a: 1, b: 0, fade: !over } });
    }
  });
  pop();
}

// Dot dissolve: a coarse halftone of one colour grows over the print from (cx, cy) until the dots merge into a solid
// sheet (p = .5), then shrinks away from the same point into the next shot. It knocks out everything under it.
//   o: { cx, cy, cell (dot pitch px, default 44), angle (degrees), spread (0 = uniform, 1 = strongly from the centre) }
function dotDissolve(p, col = 'pink', o = {}) {
  if (p <= 0 || p >= 1) return;
  const k = p < .5 ? easeIn(p * 2) * .3 + p * 2 * .7 : 1 - easeOut((p - .5) * 2) * .3 - (p - .5) * 2 * .7;
  COVER = { k, col, cx: o.cx ?? W / 2, cy: o.cy ?? H / 2, cell: o.cell ?? 44, ang: o.angle ?? 45, spread: o.spread ?? 1.6 };
}

// Paper feed: a fresh sheet feeds up through the frame, blank but for its printer's marks (registration targets
// printed in every ink, so you see the misregistration; tone bars; crop marks), covering the print at p = .5 and
// carrying on out of the top to reveal the next shot.
function paperFeed(p, o = {}) {
  if (p <= 0 || p >= 1) return;
  const inks = RISO.inks, tilt = o.tilt ?? .012;
  // the sheet's top edge travels from below the frame to above it; it is 2× the frame tall, so at p = .5 it covers all
  const top = lerp(H + 40, -H * 2.2, ease(p)), bottom = top + H * 2.2 + 80;
  push(); resetMatrix(); translate(W / 2, H / 2); rotate(tilt); translate(-W / 2, -H / 2);
  paint(rectPts(-200, top, W + 400, bottom - top), { fill: PAL.paper });
  // a faint feed-roller smudge along the leading edge
  paint(rectPts(-200, top, W + 400, 60), { fill: inks[inks.length - 1], ramp: { from: [0, top], to: [0, top + 60], a: .28, b: 0 }, over: true });
  // printer's marks, near the sheet's top and bottom
  for (const my of [top + 150, bottom - 170]) {
    for (const mx of [160, W - 160]) {   // registration target: one per ink, overprinted, so misregistration shows
      inks.forEach(k => { arcLine(mx, my, 34, 5, k, { over: true }); inkLine([[mx - 60, my], [mx + 60, my]], 1, k, 'ink', 0, { over: true, force: true }); inkLine([[mx, my - 60], [mx, my + 60]], 1, k, 'ink', 0, { over: true, force: true }); });
    }
    inks.forEach((k, i) => [1, .7, .45, .2].forEach((tn, j) => {   // tone bars
      const x = W / 2 - inks.length * 2 * 58 + (i * 4 + j) * 58; paint(rectPts(x, my - 22, 50, 44), { fill: k, tone: tn, over: true });
    }));
  }
  pop();
}

// The old name, so scenes written for the brush kit still run: an ink slide in two colours.
function brushWipe(p, cols = ['pink', 'blue']) { inkSlide(p, cols); }
