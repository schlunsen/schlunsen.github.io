#!/usr/bin/env bash
# Build the hero portrait assets from a phone clip:
#   public/media/smile.mp4        colour | person-matte, side by side, boomerang loop
#   public/media/me-cutout.webp   still with alpha (fallback before WebGL / no WebGL)
#
# Usage: scripts/matte.sh ~/Downloads/IMG_6988.MOV [still_frame_number]
# Needs: ffmpeg, uv, imagemagick. Segmentation: rembg (birefnet-portrait), ~10 s/frame on CPU.
set -euo pipefail
SRC="$1"; STILL="${2:-045}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"; mkdir -p "$WORK/in" "$WORK/out"

ffmpeg -v error -y -i "$SRC" -vf "fps=30,crop=1080:1350:0:240,scale=720:900" "$WORK/in/f_%03d.png"

cat > "$WORK/seg.py" <<'EOF'
# /// script
# dependencies = ["rembg[cpu]", "pillow"]
# ///
import glob, os
from rembg import remove, new_session
from PIL import Image
sess = new_session("birefnet-portrait")
for f in sorted(glob.glob("in/f_*.png")):
    out = "out/" + os.path.basename(f)
    if not os.path.exists(out):
        remove(Image.open(f), session=sess, only_mask=True).save(out)
EOF
(cd "$WORK" && uv run -q seg.py)

# colour | matte, then play forward + backward for a seamless loop
ffmpeg -v error -y -framerate 30 -i "$WORK/in/f_%03d.png" -framerate 30 -i "$WORK/out/f_%03d.png" \
  -filter_complex "[1]format=gray,format=yuv420p[m];[0][m]hstack,split[a][b];[b]reverse,trim=start_frame=1,setpts=PTS-STARTPTS[r];[a][r]concat=n=2:v=1,format=yuv420p[v]" \
  -map "[v]" -c:v libx264 -profile:v high -crf 23 -preset slow -movflags +faststart "$ROOT/public/media/smile.mp4"

magick "$WORK/in/f_$STILL.png" "$WORK/out/f_$STILL.png" -alpha off -compose CopyOpacity -composite \
  \( -size 720x900 xc:white \( -size 720x270 gradient:white-black \) -gravity south -composite \) \
  -compose DstIn -composite -quality 86 "$ROOT/public/media/me-cutout.webp"

rm -rf "$WORK"
echo "wrote public/media/smile.mp4 and public/media/me-cutout.webp"
