# Rasmus Schlünsen: career reel, plates from an illustrated treatise (60 s)

Logline: fifteen years of building, drawn as nine engraved plates. A single ember spark is the pen: it plots
every drawing, engraves Rasmus, and rides back to the top of the frame at the end so the reel loops seamlessly
(frame 0 and the last frame are the same: the ember on black inside the crop marks).

Medium: canvas 2D, copied kit in `src/` (core.js: palette, fonts, fuse/glow/spark helpers; me.js; scenes/career.js).
Every shot is a pure function of time. 30 fps, 80 bpm (a beat every 0.75 s); hard cuts land on beats.

Music: its own score, synthesised by `score.mjs` → `assets/score.wav` (run `node score.mjs` first; the wav is not
committed). D minor. A low D/A drone is the ember and runs the whole reel; a burin tick on the sixteenths; FM bells
for drawn lines; a felt thud for every rubber stamp. Per plate: open = drone, bells on the headline words, the
burin engraving him; security = a careful low pulse, thud on 2010, metal clank as the shackle opens; Unity = no
bass, bright celesta arpeggio (paper plate, airy); agency = sixteenth-note drive; OrbiSCADA = wind, then Dm–C–Bb–A
stacking up with the count into a riser, a hit on 1,500+ and an A-major stab on the Gazelle stamp; Clovr = Dm→Eb
(phrygian) with a rising ping per hop and a thud on FOUND; n0 = typing clicks, then Fadd9 opens on ⏎; workshop =
the groove (Dm Bb F C) with a tick per card and nine SHIPPED thuds; end = Bb F C Dm under a slow bell line, the
burin ticks back up and the drone carries into the loop. The mix is circular (tails wrap to 0 s, filters and reverb
warmed on the tail), so the loop point has no seam. Integrated ≈ −18 LUFS.

Palette: ink blacks (#0A0A0B / #151517 / #1E1E21), graphite, ash, bone paper (#EEE9DF), one signal orange
(#FF4D12) with an ember glow, blood red for the odd stamp. The Unity and Workshop plates invert to bone paper and ink.
Lettering: Archivo (static width/weight instances, black and condensed) for headlines, Cormorant Garamond italic for
the soft line, IBM Plex Mono for code, labels, callouts and footnotes. Rubber stamps (2010, FOUND, SHIPPED) slam in
with a small camera kick.

Rasmus: `src/me.js` ping-pongs his 104-frame smile clip at 15 drawings/s with eased turnarounds (the collage reel's
timing) and draws each frame as a banknote-style line engraving: horizontal waved lines whose width follows the
brightness of his face. The spark engraves him on (top down) in the open and un-engraves him (bottom up) at the end.
The site's orbit mark (circle, two tilted ellipses, a dot) is plotted around his head.

Shots (text in reading order):
  OPEN      0–6       Construction sheet: crop marks, a hairline grid, `> plate I · career.plot()` in mono. The spark
                      engraves Rasmus, then plots the orbit mark around him. "Fifteen years." / "Building what's next."
  SECURITY  6–12      The lock: a hatched padlock over a hex dump; the spark threads the keyhole, the shackle lifts.
                      "It started with security." Stamp 2010. "An internship at a security company."
                      Footnote: "No locks were harmed."
  UNITY     12–17.25  Blueprint, inverted to bone paper: an isometric cube drawn edge by edge, a graduation cap lands
                      on it. "Final project: Unity3D." / "Built in Unity while it was a small Danish startup."
                      Title block: DWG. FINAL-PROJECT-01 · ENGINE: UNITY · EST. CPH 2004.
  AGENCY    17.25–22.5 Schematic: client → api → db with a latency readout. "Full stack, full speed." /
                      "At a young agency, where everything was due yesterday."
  ORBISCADA 22.5–33   One turbine on a horizon line ("1 · turbine · Denmark"), then turbines fill the frame as the
                      odometer runs to 1,500+ across Denmark · UK · USA · Japan. "OrbiSCADA." /
                      "SCADA for wind turbines · freelance, five years." Stamp BØRSEN GAZELLE 2018 /
                      "Central Jutland. The wind does most of the work."
  CLOVR     33–39.75  A transaction graph; a magnifier follows an orange trace hop by hop while a ledger types out,
                      then FOUND. "Following the money." / "Clovr Labs · crypto forensic analytics" /
                      "The money always went somewhere."
  N0        39.75–45  A prompt types "The workspace of the future" (a small next-token distribution picks "future"),
                      then the n0 workspace: people, agents and apps settle into one grid.
                      "People, agents and apps. One place." / nzero.pro
  WORKSHOP  45–53.25  Contact sheet on paper: nine cards drop in (n0, Claude Agent SDK Go, Gource Viewer, Gitilla,
                      Codex SDK Go, wee.cat (learn to read), Donna, The Agentic Crew, Hefty), then SHIPPED is stamped across each.
                      "Always building. Always shipping." / "Nine of them, anyway. The rest are on GitHub."
  END       53.25–60  End card: Rasmus engraved inside the orbit mark. "Serious code. Clear thinking." /
                      "Rasmus Schlünsen" / "Barcelona · schlunsen.com" / "Plate IX of IX. Fin, for now." Then the
                      text fades, the spark un-engraves him bottom-up and parks at the loop point.

Render (streamed, no frame folders):
  node score.mjs
  node render.mjs --clip --crf=12 --preset=fast --abr=128k --out=out/master.mp4
  ffmpeg -i out/master.mp4 -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k \
    -movflags +faststart out/reel-plates.mp4
Poster: `node render.mjs --stills=58 --out=out/stills`, converted to `out/reel-plates-poster.jpg`. Delete the master after.
Music only (picture unchanged): remux with
  ffmpeg -i out/reel-plates.mp4 -i assets/score.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 160k -shortest out/new.mp4
Checks: `node render.mjs --sheet=0.5,2.5,… --cols=4 --w=480 --out=out/check/sheet.jpg`.
