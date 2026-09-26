# Rasmus Schlünsen: career reel, cut-paper collage (60 s)

Logline: fifteen years of building, glued down one chapter at a time as a Miró-inspired paper collage, with Rasmus
himself printed and cut out with scissors at the start and the end.

Ground and palette: warm oatmeal for most chapters; a deep blue night ground for the two "detective" chapters
(security, clovr). Miró primaries (red, yellow, blue, a little green), black brush lines, white paper.
Vocabulary: stars, crescent moons, eyes, suns, ladders, spirals, comets, asterisks. Chunky pasted letters (Luckiest
Guy) for headlines, Rubik on paper strips for small type.
Motif: a yellow star, Rasmus's "what's next". It orbits him in the open (with a crescent moon and an eye, on a brushed
black orbit loop), turns up in every chapter (on the key, the cube, the rosette, the found wallet, as n0's agents, on
the cards), and orbits him again on the end card.

Rasmus: `src/me.js` loads his 104-frame smile clip + person mattes and ping-pongs it at half speed with eased
turnarounds (the riso reel's timing, a pure function of reel time, one source frame per drawing at 15 drawings/s).
Each drawing is pasted with `pasteImage()`: printed on paper, cut out around the matte with a white scissor-cut
border, the bottom torn off, paper grain over the print and a drop shadow. A paper hill in front hides the torn
bottom. He's 900 px tall on a 1080 frame so his face reads.

Motion: everything on twos (15 drawings/s at 30 fps). Pieces move by transforms only, so edges and grain never change;
held pieces are byte-identical frame to frame. Locked-off camera.

Shots (headline reads in order; transitions in [ ]):
  OPEN      0–6    oatmeal  a red sun pops up behind where he'll stand · Rasmus slides up from below, a blue hill
                   slides in front · FIFTEEN / YEARS. pops in letter by letter · BUILDING WHAT'S NEXT. on a yellow strip
                   · a black orbit loop is brushed around him; a yellow star, a crescent moon and a little eye circle him
                   [flood of paper shapes from his face]
  SECURITY  6–12   night    IT STARTED / WITH SECURITY. · 2010 label · a red paper key flies in on an arc, flips (turns)
                   in the yellow padlock, the white shackle springs open, white asterisks burst · FIRST JOB, WHILE STILL
                   STUDYING: / AN INTERNSHIP AT A SECURITY COMPANY.  [sheet slide: yellow, then red]
  UNITY     12–17  oatmeal  FINAL PROJECT: / UNITY3D. · a paper cube (three flat pieces) drops and squashes, a black
                   mortarboard lands on it, tassel swings · CPH 2004 sticker · BUILT WHILE UNITY WAS A YOUNG DANISH
                   STARTUP. · COMPUTER SCIENCE · 3 YRS · BUSINESS ACADEMY WEST, ESBJERG (small strip)  [cut reveal]
  AGENCY    17–22  oatmeal  FULL STACK, / FULL SPEED. · browser, API, database pop in as a stack; paper packets race
                   along brushed rails, faster and faster; speed lines · AT A YOUNG AGENCY.  [brush sweep]
  ORBISCADA 22–33  oatmeal  ORBISCADA · FREELANCE · 5 YEARS · SCADA FOR WIND TURBINES · one big paper turbine on a green
                   hill, counter 1 · 26.2: it shrinks into Denmark; DENMARK, UK, USA, JAPAN paper fields fill with
                   turbines, counter → 1,500+ · a red rosette star: ORBITAL · BØRSEN GAZELLE 2018 · MANUFACTURING ·
                   CENTRAL JUTLAND  [sheet slide: yellow, then a night sheet]
  CLOVR     33–40  night    FOLLOWING / THE MONEY. · a network of paper wallets on white brushed lines; a Miró eye rides
                   the trace as it is painted red hop by hop; the last wallet is found (a star bursts) · CLOVR LABS ·
                   CRYPTO FORENSIC ANALYTICS  [sheet slide leftwards: yellow, then blue]
  N0        40–45  oatmeal  THE WORKSPACE / OF THE FUTURE. · a paper window; people (blue), agents (yellow stars) and
                   apps (red, green) fly in on arcs and click into place · PEOPLE, AGENTS AND APPS IN ONE PLACE. ·
                   nzero.pro strip  [cut reveal]
  WORKSHOP  45–53  oatmeal  ALWAYS BUILDING. / ALWAYS SHIPPING. · nine paper tags pasted in, 0.47 s apart (n0, Claude
                   Agent SDK Go, Gource Viewer, Gitilla, Codex SDK Go, wee.cat, Donna, The Agentic Crew, Hefty), then
                   they bob on the beat  [flood from the centre]
  END       53–60  oatmeal  Rasmus in front of the red sun again, the full orbit (star, moon, eye) · SERIOUS CODE. /
                   CLEAR THINKING. · RASMUS SCHLÜNSEN strip · BARCELONA · off the clock: a kite on a brushed string, a
                   little paper guitar and music notes drift among the stars. Holds to the end.

Render (streamed, no frame folders): a master at 15 fps, one frame per drawing, so the encoder never "refines" a
held drawing (at 30 fps x264 re-codes the duplicate frame and the photo shimmers at 15 Hz):
  node render.mjs --clip --fps=15 --crf=12 --preset=fast --abr=128k --out=out/master15.mp4
then a two-pass H.264 encode doubled to 30 fps, with the duplicate of each drawing landing on a coarse B-frame so it
decodes (almost) identical to its drawing:
  VF="fps=30,scale=in_range=full:out_range=tv,format=yuv420p"
  XP="bframes=1:b-adapt=0:b-pyramid=none:scenecut=0:keyint=60:min-keyint=60:pbratio=2.0"
  ffmpeg -i out/master15.mp4 -vf $VF -c:v libx264 -preset slow -b:v 1780k -pass 1 -x264-params $XP -an -f null /dev/null
  ffmpeg -i out/master15.mp4 -vf $VF -c:v libx264 -preset slow -b:v 1780k -pass 2 -x264-params $XP -pix_fmt yuv420p \
    -color_range tv -r 30 -c:a aac -b:a 128k -movflags +faststart out/reel-collage.mp4
Poster: `node render.mjs --stills=59.5`, converted to `out/reel-collage-poster.jpg`. Delete the master after.
