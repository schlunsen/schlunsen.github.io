/* Rasmus Schlünsen — reel. Shared timeline for picture, score and renderer. */
(function (g) {
  const T = {
    W: 1920, H: 1080, FPS: 30, DUR: 60,
    // chapters [start, end, index label, kicker]
    S: {
      open: [0, 6],
      security: [6, 12],
      unity: [12, 17],
      agency: [17, 22],
      orbiscada: [22, 33],
      clovr: [33, 40],
      n0: [40, 45],
      workshop: [45, 53],
      end: [53, 60],
    },
    SFX: [],
  };
  const add = (t, k) => T.SFX.push([t, k]);
  [6, 12, 17, 22, 33, 40, 45, 53].forEach((t) => add(t - 0.12, 'swish'));
  add(25.0, 'ping');
  for (let i = 0; i < 26; i++) add(26.2 + i * 0.22, 'tick');
  add(31.9, 'ping');
  for (let i = 0; i < 6; i++) add(35.2 + i * 0.42, 'tick');
  for (let i = 0; i < 13; i++) add(46.0 + i * 0.22, 'card');
  add(55.6, 'chime');
  T.SFX.sort((a, b) => a[0] - b[0]);
  g.RST = T;
})(typeof window !== 'undefined' ? window : globalThis);
