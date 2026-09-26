# /// script
# dependencies = ["opencv-python-headless", "numpy", "pillow"]
# ///
"""Paint a video frame as ink + watercolour on paper, in 3 'boil' variants.

Usage: uv run paint_portrait.py <frame.png> <out_dir>
"""
import sys, os
import numpy as np
import cv2
from PIL import Image

src, out_dir = sys.argv[1], sys.argv[2]
os.makedirs(out_dir, exist_ok=True)

PAPER = np.array([0xF3, 0xEB, 0xDC], np.float32) / 255
INK = np.array([0x2B, 0x22, 0x33], np.float32) / 255
PAL = np.array([
    [0xD9, 0x77, 0x57], [0xA8, 0x4D, 0x33], [0xF2, 0xA2, 0x83], [0x2F, 0x3C, 0x7A],
    [0xE8, 0xAA, 0x38], [0x6E, 0x9F, 0x58], [0x3A, 0x9C, 0x98], [0x7B, 0x5C, 0xA8],
    [0xFF, 0xF5, 0xE2], [0x8E, 0xC3, 0xE6], [0x2B, 0x22, 0x33],
], np.float32) / 255

img = cv2.imread(src)  # BGR 1080x1920 portrait
H0, W0 = img.shape[:2]
# 4:5 crop around the face
cw = W0
ch = int(cw * 1.25)
y0 = int(H0 * 0.14)
img = img[y0:y0 + ch, 0:cw]
W, H = 800, 1000
img = cv2.resize(img, (W, H), interpolation=cv2.INTER_AREA)
rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB).astype(np.float32) / 255


def smooth_noise(seed, scale, shape=(H, W)):
    r = np.random.default_rng(seed)
    small = r.random((max(2, shape[0] // scale), max(2, shape[1] // scale))).astype(np.float32)
    return cv2.resize(small, (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC)


# ---------- watercolour wash ----------
wash = img.copy()
for _ in range(6):
    wash = cv2.bilateralFilter(wash, 9, 40, 9)
wash = cv2.cvtColor(wash, cv2.COLOR_BGR2RGB).astype(np.float32) / 255

# quantise into flat pigment areas
K = 12
Z = wash.reshape(-1, 3)
crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 30, 0.5)
_, labels, centers = cv2.kmeans(Z, K, None, crit, 3, cv2.KMEANS_PP_CENTERS)
labels = labels.reshape(H, W)

# pull each pigment toward the nearest palette colour, warm it and lighten it
new_centers = []
for c in centers:
    # warm grade instead of snapping to a palette (keeps skin as skin)
    g = c.mean()
    m = c.copy()                      # keep the photo's own saturation
    m = m * np.array([1.03, 0.99, 0.94], np.float32)
    m = m * 0.9 + 0.1                 # lighten slightly
    new_centers.append(m)
new_centers = np.array(new_centers, np.float32)
flat = new_centers[labels]
# subtle: blend the flat pigment areas back toward the smoothed photo
flat = 0.45 * flat + 0.55 * (wash * np.array([1.03, 0.99, 0.94], np.float32) * 0.9 + 0.1)

# sky -> bare paper with a faint sky wash (keeps it 'painted on paper')
hsv = cv2.cvtColor((rgb * 255).astype(np.uint8), cv2.COLOR_RGB2HSV).astype(np.float32)
sky = ((hsv[..., 0] > 90) & (hsv[..., 0] < 125) & (hsv[..., 1] > 40) & (hsv[..., 2] > 150)).astype(np.float32)
yy = np.linspace(0, 1, H)[:, None]
sky *= (yy < 0.45)
sky = cv2.GaussianBlur(sky, (0, 0), 6)
skycol = PAL[9] * 0.35 + PAPER * 0.65
flat = flat * (1 - sky[..., None]) + skycol * sky[..., None]


def paint_variant(seed):
    rng = np.random.default_rng(seed)
    # soften pigment boundaries unevenly (bleed)
    f = cv2.GaussianBlur(flat, (0, 0), 2.2)
    # edge darkening where pigment pools at the boundary of each area
    lab_edges = cv2.Canny((labels * 25).astype(np.uint8), 10, 30).astype(np.float32) / 255
    lab_edges = cv2.GaussianBlur(lab_edges, (0, 0), 1.6)
    f = f * (1 - 0.1 * lab_edges[..., None])
    # granulation + blooms
    gran = rng.normal(0, 1, (H, W)).astype(np.float32)
    gran = cv2.GaussianBlur(gran, (0, 0), 0.8)
    bloom = smooth_noise(seed + 11, 40) - 0.5
    f = f * (1 + 0.02 * gran[..., None] + 0.05 * bloom[..., None])
    f = np.clip(f, 0, 1)

    # ragged painted border: wash fades out to bare paper
    ny, nx = np.mgrid[0:H, 0:W].astype(np.float32)
    dx = np.minimum(nx, W - 1 - nx) / W
    dy = np.minimum(ny, H - 1 - ny) / H
    edge = np.minimum(dx * 1.25, dy)
    rough = smooth_noise(seed + 3, 26) * 0.07 + smooth_noise(seed + 5, 7) * 0.025
    mask = np.clip((edge - 0.03 - rough) / 0.05, 0, 1)
    mask = cv2.GaussianBlur(mask, (0, 0), 1.2)

    # ---------- ink (XDoG) ----------
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    gray = cv2.bilateralFilter(gray, 7, 0.1, 5)
    # boil: displace the line source with a smooth random field
    amp = 1.0
    fx = (smooth_noise(seed + 21, 60) - 0.5) * 2 * amp
    fy = (smooth_noise(seed + 22, 60) - 0.5) * 2 * amp
    mapx = (nx + fx).astype(np.float32)
    mapy = (ny + fy).astype(np.float32)
    g = cv2.remap(gray, mapx, mapy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)
    s1 = cv2.GaussianBlur(g, (0, 0), 1.0)
    s2 = cv2.GaussianBlur(g, (0, 0), 1.0 * 1.6)
    dog = s1 - 0.985 * s2
    eps, phi = -0.0035, 120.0
    xd = np.where(dog >= eps, 1.0, 1 + np.tanh(phi * (dog - eps)))
    ink = 1 - np.clip(xd, 0, 1)  # 1 = ink
    # drop specks, keep strokes
    ink_u8 = (ink > 0.35).astype(np.uint8)
    n, cc, stats, _ = cv2.connectedComponentsWithStats(ink_u8, 8)
    keep = np.zeros(n, bool)
    keep[1:] = stats[1:, cv2.CC_STAT_AREA] > 12
    ink = ink * keep[cc]
    # uneven pressure along strokes
    press = 0.5 + 0.3 * smooth_noise(seed + 31, 12)
    ink = np.clip(ink * press, 0, 1)
    ink = cv2.GaussianBlur(ink, (0, 0), 0.6)
    ink *= np.clip((edge - 0.02 - rough * 0.6) / 0.04, 0, 1)  # ink stops a bit past the wash

    # ---------- compose (multiply on paper) ----------
    paper = np.broadcast_to(PAPER, (H, W, 3)).copy()
    fib = smooth_noise(seed + 41, 3) - 0.5
    paper *= (1 + 0.03 * fib[..., None])
    out = paper * (1 - mask[..., None]) + (paper * f) * mask[..., None] / PAPER.mean() * 0.93
    out = np.clip(out, 0, 1)
    out = out * (1 - ink[..., None] * 0.6) + INK * ink[..., None] * 0.6

    alpha = np.clip(np.maximum(mask, ink), 0, 1)
    rgba = np.dstack([np.clip(out, 0, 1), alpha])
    return (rgba * 255).astype(np.uint8)


for i in range(3):
    im = Image.fromarray(paint_variant(100 + i * 17), 'RGBA')
    im.save(os.path.join(out_dir, f'portrait-{i}.webp'), quality=82, method=6)
    if i == 0:
        im.convert('RGB').save(os.path.join(out_dir, 'portrait-preview.jpg'), quality=85)
print('done')
