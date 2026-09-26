# Rasmus Schlünsen: career reel, riso (60 s)

Logline: fifteen years of building, pulled off a risograph one print run per chapter, with Rasmus himself printed
in halftone at the start and the end.

Inks: every chapter is its own print run (seed) with 2–3 inks; each seam's cover colour is an ink both neighbours
load (or bare paper), so the cut under full cover is invisible.
Motif: a yellow sun disc with the site's orbit ring around Rasmus (open), which comes back with the full ring on
the end card. A paper feed at the end leaves a blank sheet with printer's marks, the same bare paper the open starts on.

Rasmus: `src/me.js` loads his 104-frame smile clip + person mattes, ping-pongs it (pure function of reel time, 15
drawings/s), and prints it with `inkImage()` (added to `src/riso.js`): luminance → the chapter's dark ink, inverted
green → pink, inverted blue → a little yellow, masked by the matte, then screened, misregistered and multiplied like
every other shape. Portrait shots use a 7 px screen so his features read at 1080p.

Shots (headline reads in order; transitions in [ ]):
  OPEN      0–6    pink/blue/yellow  [layer slide-in: yellow, pink, blue]  Rasmus in front of the sun · FIFTEEN / YEARS.
                   · BUILDING WHAT'S NEXT. on a yellow bar · the orbit ring draws on and a dot circles him
  SECURITY  6–12   blue/orange  [blue dot dissolve from his face]  IT STARTED / WITH SECURITY. · 2010 stamp · a key
                   flies in, turns, the padlock springs open (burst) · AN INTERNSHIP AT A SECURITY COMPANY.
  UNITY     12–17  teal/orange  [orange ink slide]  FINAL PROJECT: / UNITY3D. · a flat cube drops and squashes, a
                   mortarboard lands on it · BUILT IN UNITY WHILE IT WAS A YOUNG DANISH STARTUP. · CPH 2004 sticker
  AGENCY    17–22  teal/pink  [teal ink slide]  FULL STACK, / FULL SPEED. · browser, API, database stack up; packets
                   race up and down the pipes, faster and faster · AT A YOUNG AGENCY.
  ORBISCADA 22–33  blue/yellow/pink  [paper feed]  one turbine rises in a Danish field, counter 1 · 26.2: it shrinks
                   into Denmark's field; DK, UK, USA, JAPAN fill with turbines, counter → 1,500+ · Børsen Gazelle
                   2018 rosette stamps on
  CLOVR     33–40  purple/yellow  [yellow dot dissolve from the rosette]  FOLLOWING / THE MONEY. · a wallet network;
                   the trace lights up hop by hop under a magnifier; the last wallet is found (ring + burst)
  N0        40–45  purple/pink  [purple ink slide]  THE WORKSPACE / OF THE FUTURE. · people, agents and apps fly into
                   the n0 window · Rasmus cameo in the corner · nzero.pro
  WORKSHOP  45–53  pink/blue/yellow  [pink ink slide]  ALWAYS BUILDING. / ALWAYS SHIPPING. · nine project cards stamp
                   in, 0.47 s apart, then bounce on the beat
  END       53–60  pink/blue/yellow  [blue dot dissolve from his face]  SERIOUS CODE. / CLEAR THINKING. · RASMUS
                   SCHLÜNSEN · BARCELONA, next to him in the sun with the full orbit mark
                   [paper feed out, stopping with the printer's marks in view]

Render: `node render.mjs --clip --crf=12 --vf=format=yuv420p --out=out/master.mp4`, then a two-pass H.264 encode
to `out/reel-riso.mp4` (see the report / shell history) to stay under 15 MB.
