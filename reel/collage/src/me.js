// me.js: Rasmus, printed and cut out. His 3.5 s smile clip (104 frames, 720×900, 30 fps) with person mattes, played
// forward then backward so it loops seamlessly, each drawing pasted as a paper cutout (white scissor-cut border, torn
// bottom, grain, drop shadow). The frame is a pure function of reel time, at 15 drawings a second (on twos, like
// everything else), played at half speed.
(() => {
  const N = 104, pad = i => String(i).padStart(3, '0');
  const load = src => new Promise(ok => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => { console.error('missing ' + src); ok(im); }; im.src = src; });
  const COLF = [], MAT = [];
  window.PRELOAD = Promise.all(Array.from({ length: N }, (_, i) => Promise.all([
    load(`../assets/me/color/f_${pad(i + 1)}.jpg`).then(im => COLF[i] = im),
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
  // pasteMe(t, cx, bottom, height, o): Rasmus, standing on `bottom`, centred on cx. o: { rot, lift, border, tornBottom }
  window.pasteMe = (t, cx, bottom, h, o = {}) => {
    const i = meIndex(t), w = h * 720 / 900;
    pasteImage(COLF[i], cx - w / 2, bottom - h, w, h, { matte: MAT[i], key: 'me' + i, border: o.border ?? 18, tornBottom: o.tornBottom ?? 835, lift: o.lift ?? 1.4, rot: o.rot || 0 });
  };
  window.meIndex = meIndex;
})();
