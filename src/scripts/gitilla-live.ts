// The live Gitilla embed sitting over its own screenshot in the Selected work
// section. Two jobs: fade it in only once it actually has a city to show, so
// the panel never goes blank mid-scroll, and don't load it at all for anyone
// who has asked not to be moved.
const frame = document.querySelector<HTMLIFrameElement>('.gitilla-live');

if (frame) {
  const still = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches) {
    // Drop it entirely rather than hide it: a hidden frame is still a WebGL
    // city running on someone's battery.
    frame.remove();
  } else {
    // 'load' fires when the document is in, which is a little before the city
    // is built. A short beat after it covers the difference, and the crossfade
    // hides the rest.
    frame.addEventListener('load', () => {
      setTimeout(() => frame.classList.add('ready'), 1200);
    });
  }
}
