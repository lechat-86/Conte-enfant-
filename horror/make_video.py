#!/usr/bin/env python3
"""
LA MAISON DES MURMURES - génère une vidéo d'horreur en 3 parties avec screamer.
Tout est procédural : images (PIL/numpy), son (numpy), assemblage (ffmpeg).

Usage:  python3 make_video.py            -> horror/la_maison_des_murmures.mp4
        python3 make_video.py --stills   -> images de contrôle dans horror/stills/
"""
import math, random, subprocess, wave, os, sys
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageOps, ImageChops

W, H, FPS = 960, 540, 24
PW, PH = 1120, 630                       # taille des décors pré-rendus (16:9)
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "la_maison_des_murmures.mp4")
DUR = 104.0
random.seed(13)
RNG = np.random.default_rng(13)

# ----------------------------------------------------------------- polices
FD = "/usr/share/fonts/truetype/dejavu/"
def font(size, bold=False, italic=False, sans=False):
    base = "DejaVuSans" if sans else "DejaVuSerif"
    suffix = ("-Bold" if bold else "") + ("Italic" if italic else "")
    if bold and italic: suffix = "-BoldItalic"
    elif italic: suffix = "-Italic"
    for p in (FD + base + suffix + ".ttf", FD + base + ".ttf"):
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default(size)

# ----------------------------------------------------------------- outils image
def new(bg=(0, 0, 0)):
    return Image.new("RGB", (PW, PH), bg)

def vgrad(top, bot, w=PW, h=PH):
    a = np.linspace(0, 1, h)[:, None, None]
    arr = (np.array(top, float) * (1 - a) + np.array(bot, float) * a) * np.ones((1, w, 1))
    return Image.fromarray(arr.astype(np.uint8))

def glow(img, items, blur=None):
    """items = [(x, y, r, (r,g,b))] ; ajoute des halos lumineux."""
    layer = Image.new("RGB", img.size, (0, 0, 0))
    d = ImageDraw.Draw(layer)
    rmax = 1
    for x, y, r, c in items:
        d.ellipse([x - r, y - r, x + r, y + r], fill=c)
        rmax = max(rmax, r)
    layer = layer.filter(ImageFilter.GaussianBlur(blur or rmax / 2))
    return ImageChops.add(img, layer)

def fogify(img, strength, tint, ymin=0.5, ymax=1.0, seed=0):
    r = np.random.default_rng(seed)
    n = r.random((PH // 45 + 2, PW // 45 + 2))
    n = Image.fromarray((n * 255).astype(np.uint8)).resize(img.size, Image.BICUBIC)
    m = np.asarray(n.filter(ImageFilter.GaussianBlur(25)), float) / 255.0
    ys = np.linspace(0, 1, PH)[:, None]
    wy = np.clip((ys - ymin) / max(ymax - ymin, 1e-3), 0, 1)
    alpha = (strength * m * wy)[..., None]
    arr = np.asarray(img, float) * (1 - alpha) + np.array(tint, float) * alpha
    return Image.fromarray(arr.clip(0, 255).astype(np.uint8))

def tree(d, x, y, ang, length, width, depth, col=(4, 5, 7)):
    if depth == 0 or length < 5:
        return
    x2 = x + math.cos(ang) * length
    y2 = y - math.sin(ang) * length
    d.line([x, y, x2, y2], fill=col, width=max(1, int(width)))
    for _ in range(random.choice([2, 2, 3])):
        tree(d, x2, y2, ang + random.uniform(-0.75, 0.75),
             length * random.uniform(0.64, 0.8), width * 0.7, depth - 1, col)

# ----------------------------------------------------------------- personnages
def figure(img, cx, by, h, face=False, col=(3, 3, 5), skin=(205, 205, 195)):
    """Silhouette longue et maigre (la Dame). by = pieds, h = hauteur."""
    d = ImageDraw.Draw(img)
    w = h * 0.16
    hr = h * 0.07
    hy = by - h * 0.9
    d.polygon([(cx - w * 0.6, by - h * 0.84), (cx + w * 0.6, by - h * 0.84),
               (cx + w * 1.2, by), (cx - w * 1.2, by)], fill=col)
    lw = max(2, int(h * 0.03))
    for s in (-1, 1):
        pts = [(cx + s * w * 0.6, by - h * 0.82), (cx + s * w * 1.0, by - h * 0.5),
               (cx + s * w * 0.9, by - h * 0.2)]
        d.line(pts, fill=col, width=lw)
        for k in range(5):  # doigts trop longs
            d.line([pts[-1], (pts[-1][0] + s * w * (0.05 + k * 0.05) - s * w * 0.1,
                              pts[-1][1] + h * (0.1 + 0.02 * (k % 3)))],
                   fill=col, width=max(1, int(h * 0.01)))
    for _ in range(26):  # cheveux
        x0 = cx + random.uniform(-hr, hr)
        d.line([(x0, hy - hr * 0.8),
                (x0 + random.uniform(-w * 0.9, w * 0.9), by - h * random.uniform(0.35, 0.65))],
               fill=col, width=max(1, int(h * 0.012)))
    d.ellipse([cx - hr, hy - hr * 1.3, cx + hr, hy + hr * 1.3], fill=col)
    if face:
        d.ellipse([cx - hr * 0.8, hy - hr * 0.9, cx + hr * 0.8, hy + hr * 1.2], fill=skin)
        for s in (-1, 1):
            d.ellipse([cx + s * hr * 0.4 - hr * 0.25, hy - hr * 0.35,
                       cx + s * hr * 0.4 + hr * 0.25, hy + hr * 0.15], fill=(0, 0, 0))
        d.arc([cx - hr * 0.5, hy + hr * 0.15, cx + hr * 0.5, hy + hr * 0.9], 10, 170,
              fill=(20, 0, 0), width=max(1, int(hr * 0.12)))
        # cheveux par-dessus les côtés
        for s in (-1, 1):
            d.line([(cx + s * hr * 0.85, hy - hr), (cx + s * hr * 1.0, hy + hr * 2.5)],
                   fill=col, width=max(2, int(hr * 0.35)))

def girl(img, cx, cy, r, mode=0, hair=(38, 24, 18), clothes=(55, 65, 88)):
    """Léa. cy = centre de la tête, r = rayon. mode 0 normal, 1 sourire, 2 yeux noirs + rictus,
    3 terrifiée."""
    d = ImageDraw.Draw(img)
    skin = (206, 186, 176) if mode < 2 else (186, 194, 190)
    d.polygon([(cx - r * 1.2, cy), (cx + r * 1.2, cy), (cx + r * 1.6, cy + r * 3.2),
               (cx - r * 1.6, cy + r * 3.2)], fill=hair)
    d.polygon([(cx - r * 0.55, cy + r * 1.2), (cx + r * 0.55, cy + r * 1.2),
               (cx + r * 2.1, cy + r * 4.2), (cx - r * 2.1, cy + r * 4.2)], fill=clothes)
    d.rectangle([cx - r * 0.28, cy + r * 0.8, cx + r * 0.28, cy + r * 1.4], fill=skin)
    d.ellipse([cx - r, cy - r * 1.2, cx + r, cy + r * 1.2], fill=skin)
    d.pieslice([cx - r * 1.08, cy - r * 1.4, cx + r * 1.08, cy + r * 0.25], 180, 360, fill=hair)
    ey = cy - r * 0.05
    for s in (-1, 1):
        ex = cx + s * r * 0.42
        if mode in (0, 1):
            d.ellipse([ex - r * 0.17, ey - r * 0.1, ex + r * 0.17, ey + r * 0.1], fill=(240, 240, 235))
            d.ellipse([ex - r * 0.07, ey - r * 0.08, ex + r * 0.07, ey + r * 0.08], fill=(30, 20, 15))
        elif mode == 3:
            d.ellipse([ex - r * 0.22, ey - r * 0.2, ex + r * 0.22, ey + r * 0.2], fill=(245, 245, 240))
            d.ellipse([ex - r * 0.05, ey - r * 0.05, ex + r * 0.05, ey + r * 0.05], fill=(20, 10, 10))
        else:
            d.ellipse([ex - r * 0.24, ey - r * 0.2, ex + r * 0.24, ey + r * 0.22], fill=(0, 0, 0))
    my = cy + r * 0.55
    lw = max(2, int(r * 0.04))
    if mode == 0:
        d.arc([cx - r * 0.25, my - r * 0.08, cx + r * 0.25, my + r * 0.14], 0, 180, fill=(120, 60, 60), width=lw)
    elif mode == 1:
        d.pieslice([cx - r * 0.5, my - r * 0.25, cx + r * 0.5, my + r * 0.32], 0, 180,
                   fill=(235, 230, 215), outline=(40, 10, 10), width=lw)
    elif mode == 2:
        d.pieslice([cx - r * 0.85, my - r * 0.4, cx + r * 0.85, my + r * 0.5], 0, 180, fill=(14, 0, 0))
        for k in range(-7, 8):
            xx = cx + k * r * 0.11
            d.polygon([(xx - r * 0.04, my + r * 0.05), (xx + r * 0.04, my + r * 0.05), (xx, my + r * 0.22)],
                      fill=(225, 220, 195))
    else:
        d.ellipse([cx - r * 0.2, my - r * 0.05, cx + r * 0.2, my + r * 0.35], fill=(40, 8, 8))

def hand(d, x, y, size, side, col=(205, 205, 195)):
    """Main pâle aux doigts trop longs ; side = -1/1 (direction des doigts)."""
    d.ellipse([x - size * 0.5, y - size * 0.4, x + size * 0.5, y + size * 0.5], fill=col)
    for k in range(5):
        a = math.radians(-70 + k * 35) if side > 0 else math.radians(250 - k * 35)
        d.line([(x, y), (x + math.cos(a) * size * 1.7, y + math.sin(a) * size * 1.7)],
               fill=col, width=max(2, int(size * 0.14)))

# ----------------------------------------------------------------- décors
def scene_house(stage):
    img = vgrad((6, 8, 22), (28, 34, 58))
    d = ImageDraw.Draw(img)
    for _ in range(170):
        c = random.randint(90, 210)
        d.point((random.randrange(PW), random.randrange(int(PH * 0.55))), fill=(c, c, min(255, c + 25)))
    mx, my = 900, 105
    img = glow(img, [(mx, my, 95, (60, 70, 105))])
    d = ImageDraw.Draw(img)
    d.ellipse([mx - 40, my - 40, mx + 40, my + 40], fill=(226, 229, 216))
    for cx_, cy_, rr in [(-12, -10, 8), (10, 8, 10), (-5, 16, 5)]:
        d.ellipse([mx + cx_ - rr, my + cy_ - rr, mx + cx_ + rr, my + cy_ + rr], fill=(190, 194, 184))
    d.polygon([(0, 540), (PW, 515), (PW, PH), (0, PH)], fill=(8, 9, 10))
    hc = (9, 9, 13)
    d.rectangle([400, 310, 800, 545], fill=hc)
    d.polygon([(370, 315), (600, 175), (830, 315)], fill=hc)
    d.rectangle([710, 205, 752, 310], fill=hc)
    d.rectangle([310, 250, 420, 545], fill=hc)
    d.polygon([(292, 255), (365, 140), (438, 255)], fill=hc)
    for (x, y) in [(440, 350), (520, 350), (680, 350), (755, 350), (450, 460), (740, 460), (330, 300)]:
        d.rectangle([x, y, x + 40, y + 64], fill=(17, 21, 33))
        d.line([x + 20, y, x + 20, y + 64], fill=(9, 9, 13), width=3)
        d.line([x, y + 32, x + 40, y + 32], fill=(9, 9, 13), width=3)
    d.rectangle([575, 465, 635, 545], fill=(14, 10, 8))
    d.polygon([(575, 545), (635, 545), (700, PH), (510, PH)], fill=(28, 28, 33))  # chemin
    # fenêtre éclairée
    wx, wy = 585, 360
    img = glow(img, [(wx + 25, wy + 36, 70, (120, 90, 30))], blur=40)
    d = ImageDraw.Draw(img)
    d.rectangle([wx, wy, wx + 50, wy + 72], fill=(235, 190, 85))
    if stage == 1:
        d.ellipse([wx + 15, wy + 14, wx + 35, wy + 40], fill=(4, 4, 6))
        d.polygon([(wx + 2, wy + 72), (wx + 48, wy + 72), (wx + 40, wy + 40), (wx + 10, wy + 40)], fill=(4, 4, 6))
        d.ellipse([wx + 19, wy + 24, wx + 23, wy + 27], fill=(255, 255, 255))
        d.ellipse([wx + 28, wy + 24, wx + 32, wy + 27], fill=(255, 255, 255))
    d.line([wx + 25, wy, wx + 25, wy + 72], fill=(30, 20, 10), width=3)
    d.line([wx, wy + 36, wx + 50, wy + 36], fill=(30, 20, 10), width=3)
    tree(d, 140, 560, math.pi / 2 + 0.1, 150, 16, 8)
    tree(d, 1000, 560, math.pi / 2 - 0.15, 160, 16, 8)
    for x in range(0, PW, 38):
        d.line([x, 560, x, 520], fill=(5, 5, 6), width=4)
    img = fogify(img, 0.65, (110, 120, 145), 0.55, 1.0, seed=2)
    return img

def hall_geom():
    vp = (PW / 2, PH * 0.47)
    hw, fh, ch = PW * 0.95, PH * 0.85, PH * 0.95
    def P(side, z, h):
        s = 1 / (1 + z)
        return (vp[0] + side * hw * s, vp[1] + s * (fh - h * (fh + ch)))
    return vp, P

def scene_hall(fig_z=None, face=False):
    vp, P = hall_geom()
    Z = 8.0
    img = new((8, 6, 6))
    d = ImageDraw.Draw(img)
    d.polygon([P(-1, Z, 0), P(1, Z, 0), P(1, Z, 1), P(-1, Z, 1)], fill=(22, 16, 14))
    steps = 64
    for i in range(steps):
        z0, z1 = Z * i / steps, Z * (i + 1) / steps
        b = 0.30 + 0.70 * math.exp(-((z0 - 2.8) / 2.6) ** 2)
        stripe = 0.82 if (i // 4) % 2 else 1.0
        def c(base, k=1.0):
            return tuple(int(v * b * k) for v in base)
        d.polygon([P(-1, z0, 0), P(-1, z1, 0), P(-1, z1, 1), P(-1, z0, 1)], fill=c((78, 56, 42), stripe))
        d.polygon([P(1, z0, 0), P(1, z1, 0), P(1, z1, 1), P(1, z0, 1)], fill=c((70, 50, 38), stripe))
        d.polygon([P(-1, z0, 0), P(1, z0, 0), P(1, z1, 0), P(-1, z1, 0)], fill=c((48, 32, 26)))
        d.polygon([P(-1, z0, 1), P(1, z0, 1), P(1, z1, 1), P(-1, z1, 1)], fill=c((40, 32, 28)))
        d.polygon([P(-0.32, z0, 0), P(0.32, z0, 0), P(0.32, z1, 0), P(-0.32, z1, 0)], fill=c((88, 16, 16)))
    for side in (-1, 1):
        for za, zb in [(1.2, 2.3), (3.4, 4.4), (5.6, 6.4)]:
            q = [P(side, za, 0), P(side, zb, 0), P(side, zb, 0.8), P(side, za, 0.8)]
            d.polygon(q, fill=(16, 10, 8))
            d.line(q + [q[0]], fill=(96, 72, 50), width=3)
        for za, zb in [(2.6, 3.2), (4.7, 5.3)]:
            q = [P(side, za, 0.45), P(side, zb, 0.45), P(side, zb, 0.7), P(side, za, 0.7)]
            d.polygon(q, fill=(26, 24, 22))
            d.line(q + [q[0]], fill=(110, 90, 50), width=2)
    # porte de la cave au fond, entrouverte
    q = [P(-0.3, Z, 0), P(0.3, Z, 0), P(0.3, Z, 0.85), P(-0.3, Z, 0.85)]
    d.polygon(q, fill=(10, 7, 5))
    d.line(q + [q[0]], fill=(80, 60, 40), width=2)
    gap = [P(0.24, Z, 0), P(0.3, Z, 0), P(0.3, Z, 0.85), P(0.24, Z, 0.85)]
    d.polygon(gap, fill=(0, 0, 0))
    img = glow(img, [(vp[0], P(0, Z, 0)[1] + 2, 26, (150, 15, 8)),
                     (P(0, 3, 1)[0], P(0, 3, 1)[1] + 6, 70, (130, 95, 40))], blur=20)
    d = ImageDraw.Draw(img)
    if fig_z is not None:
        base, top = P(0, fig_z, 0), P(0, fig_z, 0.9)
        figure(img, base[0], base[1], base[1] - top[1], face=face)
    return fogify(img, 0.35, (95, 80, 70), 0.3, 1.0, seed=5)

def scene_mirror(stage):
    img = vgrad((40, 14, 16), (16, 7, 9))
    d = ImageDraw.Draw(img)
    for gx in range(0, PW, 60):
        for gy in range(0, PH, 60):
            d.polygon([(gx + 30, gy + 10), (gx + 44, gy + 30), (gx + 30, gy + 50), (gx + 16, gy + 30)], fill=(50, 20, 22))
    d.rectangle([370, 30, 750, 625], fill=(78, 58, 24))
    for k in range(5):
        d.rectangle([370 + k * 5, 30 + k * 5, 750 - k * 5, 625 - k * 5],
                    outline=(110 - k * 12, 82 - k * 9, 34 - k * 3), width=2)
    for (x, y) in [(370, 30), (750, 30), (370, 625), (750, 625), (560, 30)]:
        d.ellipse([x - 20, y - 20, x + 20, y + 20], fill=(100, 76, 30))
    mir = vgrad((58, 68, 76), (20, 26, 30), 310, 540)
    img.paste(mir, (405, 65))
    d = ImageDraw.Draw(img)
    if stage == 0:
        girl(img, 560, 250, 60, 0)
    elif stage == 1:
        girl(img, 560, 250, 60, 1)
    else:
        girl(img, 560, 285, 112, 2)
        d = ImageDraw.Draw(img)
        hand(d, 450, 420, 34, 1)
        hand(d, 670, 420, 34, -1)
        for _ in range(7):
            x, y = random.randint(430, 690), random.randint(90, 500)
            d.line([(x, y), (x + random.randint(-60, 60), y + random.randint(30, 90))], fill=(12, 16, 18), width=2)
    # ré-applique le cadre par-dessus les débordements
    d = ImageDraw.Draw(img)
    d.rectangle([370, 30, 405, 625], fill=(78, 58, 24))
    d.rectangle([715, 30, 750, 625], fill=(78, 58, 24))
    img = glow(img, [(560, 330, 260, (14, 22, 28))], blur=60)
    return fogify(img, 0.25, (90, 100, 110), 0.5, 1.0, seed=7)

def scene_stairs(pairs):
    vp = (PW / 2, PH * 0.42)
    img = vgrad((14, 13, 14), (4, 4, 5))
    d = ImageDraw.Draw(img)
    for _ in range(600):
        x, y = random.randrange(PW), random.randrange(PH)
        c = random.randint(14, 34)
        d.rectangle([x, y, x + random.randint(14, 40), y + random.randint(5, 12)], fill=(c, c, c))
    N = 28
    s = lambda i: 1 / (1 + 0.30 * i)
    Y = lambda i: vp[1] + PH * 0.60 * s(i)
    HWf = lambda i: PW * 0.30 * s(i)
    for i in range(N):
        b = max(0.0, 1 - i / N) ** 1.6
        y0, y1 = Y(i), Y(i + 1)
        hw0, hw1 = HWf(i), HWf(i + 1)
        c = int(95 * b) + 3
        d.polygon([(vp[0] - hw0, y0), (vp[0] + hw0, y0), (vp[0] + hw1, y1), (vp[0] - hw1, y1)],
                  fill=(c, int(c * 0.96), int(c * 0.9)))
        d.line([(vp[0] - hw1, y1), (vp[0] + hw1, y1)], fill=(int(c * 0.35),) * 3, width=3)
        d.polygon([(vp[0] - hw0, y0), (vp[0] - hw0 - 40 * s(i), y0 - 120 * s(i)),
                   (vp[0] - hw1 - 40 * s(i + 1), y1 - 120 * s(i + 1)), (vp[0] - hw1, y1)],
                  fill=(int(c * 0.6),) * 3)
        d.polygon([(vp[0] + hw0, y0), (vp[0] + hw0 + 40 * s(i), y0 - 120 * s(i)),
                   (vp[0] + hw1 + 40 * s(i + 1), y1 - 120 * s(i + 1)), (vp[0] + hw1, y1)],
                  fill=(int(c * 0.5),) * 3)
    d.line([(vp[0] - PW * 0.34, PH * 0.28), (vp[0] - 25, vp[1] + 8)], fill=(70, 50, 32), width=7)
    d.line([(vp[0] + PW * 0.34, PH * 0.28), (vp[0] + 25, vp[1] + 8)], fill=(70, 50, 32), width=7)
    d.ellipse([vp[0] - 75, vp[1] - 35, vp[0] + 75, vp[1] + 45], fill=(0, 0, 0))
    img = img.filter(ImageFilter.GaussianBlur(1))
    layers = []
    pr = random.Random(77)
    for k in range(pairs):
        if k == 0:
            ex, ey, sc = vp[0] + 4, vp[1] - 2, 1.0
        else:
            ex = vp[0] + pr.uniform(-210, 210)
            ey = vp[1] + pr.uniform(-60, 90)
            sc = 0.8 + abs(ex - vp[0]) / 130 + pr.uniform(0, 0.5)
        layers.append((ex, ey, sc))
    lay = Image.new("RGB", img.size, (0, 0, 0))
    ld = ImageDraw.Draw(lay)
    for ex, ey, sc in layers:
        sep = 11 * sc
        for sx in (-1, 1):
            ld.ellipse([ex + sx * sep - 5 * sc, ey - 2.5 * sc, ex + sx * sep + 5 * sc, ey + 2.5 * sc], fill=(255, 245, 190))
    glowl = lay.filter(ImageFilter.GaussianBlur(7))
    img = ImageChops.add(img, ImageChops.add(glowl, glowl))
    img = ImageChops.add(img, lay)
    return img

def _people(d, x, y, sc, col=(18, 14, 12), skin=(185, 170, 150)):
    for (dx, hh, ww) in [(-34, 120, 26), (34, 130, 28), (0, 70, 20)]:
        px = x + dx * sc
        d.rounded_rectangle([px - ww * sc, y - hh * sc, px + ww * sc, y], radius=int(10 * sc), fill=col)
        d.ellipse([px - 15 * sc, y - hh * sc - 30 * sc, px + 15 * sc, y - hh * sc], fill=skin)

def _photo(img, x, y, w, h, kind):
    ph = vgrad((150, 128, 96), (84, 70, 50), w, h)
    pd = ImageDraw.Draw(ph)
    pd.rectangle([0, int(h * 0.62), w, h], fill=(64, 56, 40))
    pd.rectangle([int(w * 0.18), int(h * 0.3), int(w * 0.82), int(h * 0.64)], fill=(70, 58, 44))
    pd.polygon([(int(w * 0.12), int(h * 0.32)), (int(w * 0.5), int(h * 0.12)), (int(w * 0.88), int(h * 0.32))], fill=(52, 44, 34))
    pd.rectangle([int(w * 0.44), int(h * 0.46), int(w * 0.56), int(h * 0.64)], fill=(26, 20, 14))
    if kind == 0:
        _people(pd, w * 0.5, h * 0.92, 0.9)
        pd.rectangle([int(w * 0.88), int(h * 0.5), int(w * 0.9), int(h * 0.64)], fill=(8, 8, 8))
        pd.ellipse([int(w * 0.875), int(h * 0.47), int(w * 0.915), int(h * 0.51)], fill=(8, 8, 8))
    elif kind == 1:
        _people(pd, w * 0.52, h * 0.93, 1.0)
        pd.rectangle([int(w * 0.46), int(h * 0.40), int(w * 0.54), int(h * 0.64)], fill=(5, 5, 6))
        pd.ellipse([int(w * 0.46), int(h * 0.33), int(w * 0.54), int(h * 0.43)], fill=(215, 212, 200))
        pd.ellipse([int(w * 0.48), int(h * 0.36), int(w * 0.5), int(h * 0.38)], fill=(0, 0, 0))
        pd.ellipse([int(w * 0.51), int(h * 0.36), int(w * 0.53), int(h * 0.38)], fill=(0, 0, 0))
    else:
        ph = vgrad((70, 80, 100), (28, 30, 40), w, h)   # photo récente, plus froide
        pd = ImageDraw.Draw(ph)
        tmp = Image.new("RGB", (w, h), (0, 0, 0))
        tmp.paste(ph)
        figure(tmp, w * 0.5, h * 1.25, h * 1.15, face=True, col=(4, 4, 6))
        girl(tmp, w * 0.5, h * 0.62, 38, 3)
        ph = tmp
    ph = ImageEnhance_sepia(ph, kind)
    img.paste(ph, (x, y))

def ImageEnhance_sepia(im, kind):
    a = np.asarray(im, float)
    if kind < 2:
        g = a.mean(2, keepdims=True)
        a = g * np.array([1.08, 0.95, 0.75])
    a = a + RNG.normal(0, 7, a.shape)
    return Image.fromarray(a.clip(0, 255).astype(np.uint8))

def scene_photos():
    img = vgrad((58, 44, 34), (30, 22, 18))
    d = ImageDraw.Draw(img)
    for x in range(0, PW, 56):
        d.line([x, 0, x, PH], fill=(48, 34, 26), width=3)
    pos = [(95, 150), (430, 150), (765, 150)]
    labels = ["1987", "2005", "Aujourd'hui"]
    for i, (x, y) in enumerate(pos):
        d.rectangle([x - 18, y - 18, x + 278, y + 368], fill=(30, 22, 12))
        d.rectangle([x - 12, y - 12, x + 272, y + 362], outline=(110, 86, 40), width=3)
        _photo(img, x, y, 260, 350, i)
        d = ImageDraw.Draw(img)
        d.text((x + 130, y + 395), labels[i], font=font(24, italic=True), fill=(190, 170, 130), anchor="mm")
    # lueur de lampe de poche
    img = glow(img, [(560, 300, 380, (30, 22, 12))], blur=90)
    return img

def scene_journal():
    img = vgrad((26, 16, 10), (10, 6, 4))
    page = Image.new("RGB", (700, 470), (196, 184, 150))
    pd = ImageDraw.Draw(page)
    pd.line([350, 0, 350, 470], fill=(120, 108, 80), width=4)
    f = font(23, italic=True)
    for i, ln in enumerate(["12 octobre. Elle est encore", "venue cette nuit. Elle se tient", "au pied de mon lit et elle", "chante, tout bas.", ""]):
        pd.text((26, 40 + i * 38), ln, font=f, fill=(46, 36, 28))
    for i, ln in enumerate(["Quand la berceuse s'arrête,", "c'est qu'elle est derrière toi.", "", "NE TE RETOURNE", "JAMAIS."]):
        col = (130, 10, 10) if i >= 3 else (46, 36, 28)
        pd.text((376, 40 + i * 44), ln, font=font(26 if i >= 3 else 23, bold=i >= 3, italic=True), fill=col)
    for _ in range(40):  # taches
        x, y = random.randint(0, 700), random.randint(0, 470)
        pd.ellipse([x, y, x + random.randint(3, 12), y + random.randint(3, 12)], fill=(110, 20, 14))
    page = page.rotate(4, expand=True, fillcolor=(0, 0, 0))
    mask = page.convert("L").point(lambda v: 255 if v > 8 else 0)
    img.paste(page, (190, 60), mask)
    img = glow(img, [(130, 90, 130, (110, 70, 20))], blur=70)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([60, 70, 100, 260], radius=8, fill=(190, 180, 150))   # bougie
    img = glow(img, [(80, 60, 50, (255, 170, 50))], blur=30)
    return img

def scene_musicbox(with_lady):
    img = vgrad((10, 12, 20), (3, 3, 6))
    d = ImageDraw.Draw(img)
    for k in range(-2, 9):  # lumière de lune à travers des stores
        d.polygon([(100 + k * 130, 0), (150 + k * 130, 0), (350 + k * 130, PH), (300 + k * 130, PH)], fill=(20, 26, 40))
    d.rectangle([0, 470, PW, PH], fill=(14, 10, 8))
    d.rectangle([380, 400, 740, 520], fill=(48, 30, 18))
    d.rectangle([380, 400, 740, 412], fill=(70, 46, 28))
    d.rectangle([450, 330, 670, 402], fill=(78, 48, 28))
    d.polygon([(450, 330), (670, 330), (700, 250), (420, 250)], fill=(60, 36, 22))
    d.rectangle([465, 345, 655, 395], fill=(30, 12, 12))
    d.line([560, 345, 560, 300], fill=(160, 150, 120), width=3)
    d.ellipse([548, 270, 572, 300], fill=(215, 205, 190))
    d.polygon([(560, 300), (530, 335), (590, 335)], fill=(215, 205, 190))
    d.line([(553, 280), (560, 290)], fill=(40, 20, 20), width=2)
    if with_lady:
        figure(img, 880, PH + 150, PH * 1.5, face=False)
        d = ImageDraw.Draw(img)
        d.arc([850, 20, 912, 70], 10, 170, fill=(215, 215, 205), width=3)
    img = glow(img, [(560, 340, 90, (60, 40, 12))], blur=40)
    return fogify(img, 0.35, (70, 80, 100), 0.5, 1.0, seed=11)

def scene_phone(stage):
    img = scene_hall(None)
    if stage == 1:
        vp, P = hall_geom(); b, t = P(0, 7.0, 0), P(0, 7.0, 0.9)
        figure(img, b[0], b[1], b[1] - t[1], face=False)
    elif stage == 2:
        vp, P = hall_geom(); b, t = P(0, 4.2, 0), P(0, 4.2, 0.9)
        figure(img, b[0], b[1], b[1] - t[1], face=False)
    elif stage == 3:
        figure(img, PW / 2, PH + 140, 800, face=False)
    d = ImageDraw.Draw(img)
    if stage == 3:
        girl(img, PW / 2, 385, 100, 3)
        d = ImageDraw.Draw(img)
        hand(d, PW / 2 - 195, 500, 46, -1)
        hand(d, PW / 2 + 195, 500, 46, 1)
    else:
        girl(img, PW / 2, 400, 100, 3)
    return img

def make_face():
    w, h = PW, PH
    img = Image.new("RGB", (w, h), (6, 0, 0))
    img = glow(img, [(w // 2, h // 2, 330, (60, 0, 0))], blur=120)
    d = ImageDraw.Draw(img)
    cx, cy = w // 2, int(h * 0.47)
    fr = random.Random(5)
    for _ in range(320):  # cheveux derrière
        x0 = cx + fr.gauss(0, 120)
        y0 = cy - 270 + fr.gauss(0, 15)
        side = 1 if x0 > cx else -1
        L = fr.uniform(260, 600)
        pts = [(x0 + side * (abs(x0 - cx) * 0.6 + fr.gauss(0, 8)) * (j / 11) + math.sin(j * 0.6 + x0) * 12,
                y0 + (j / 11) * L) for j in range(12)]
        c = fr.randint(0, 26)
        d.line(pts, fill=(c, c, c), width=fr.randint(2, 5))
    d.ellipse([cx - 125, cy + 120, cx + 125, cy + 345], fill=(95, 98, 92))   # menton étiré
    fw, fh = 195, 275
    for i in range(26):
        f = 1 - i / 26
        c = int(60 + 150 * (i / 26) ** 0.8)
        d.ellipse([cx - fw * f, cy - fh * f, cx + fw * f, cy + fh * f], fill=(c, int(c * 1.02), int(c * 0.95)))
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    halo = Image.new("L", (w, h), 0)
    hd = ImageDraw.Draw(halo)
    for (ex, ey, rx, ry) in [(cx - 82, cy - 55, 54, 66), (cx + 86, cy - 48, 47, 72)]:
        md.ellipse([ex - rx, ey - ry, ex + rx, ey + ry], fill=255)
        hd.ellipse([ex - rx - 30, ey - ry - 26, ex + rx + 30, ey + ry + 30], fill=150)
    for nx in (-15, 15):
        md.ellipse([cx + nx - 8, cy + 38, cx + nx + 8, cy + 58], fill=255)
    black = Image.new("RGB", (w, h), (0, 0, 0))
    img = Image.composite(black, img, halo.filter(ImageFilter.GaussianBlur(22)))
    img = Image.composite(black, img, mask.filter(ImageFilter.GaussianBlur(3)))
    d = ImageDraw.Draw(img)
    mx, my, rx, ry = cx, cy + 155, 88, 112
    d.ellipse([mx - rx - 6, my - ry - 6, mx + rx + 6, my + ry + 6], fill=(40, 0, 0))
    d.ellipse([mx - rx, my - ry, mx + rx, my + ry], fill=(4, 0, 0))
    d.ellipse([mx - 55, my + 30, mx + 55, my + ry - 6], fill=(90, 8, 14))
    for a in range(200, 341, 9):
        r_ = math.radians(a)
        x, y = mx + rx * math.cos(r_), my + ry * math.sin(r_)
        d.polygon([(x - 7, y), (x + 7, y), (x + (mx - x) * 0.05, y + 30)], fill=(210, 198, 150))
    for a in range(30, 151, 10):
        r_ = math.radians(a)
        x, y = mx + rx * math.cos(r_), my + ry * math.sin(r_)
        d.polygon([(x - 7, y), (x + 7, y), (x + (mx - x) * 0.05, y - 26)], fill=(205, 192, 145))
    for (ex, ey) in [(cx - 82, cy - 45), (cx + 86, cy - 36)]:
        d.ellipse([ex - 5, ey - 5, ex + 5, ey + 5], fill=(255, 255, 255))
    tears = Image.new("RGB", (w, h), (0, 0, 0))
    td = ImageDraw.Draw(tears)
    for (ex, ey) in [(cx - 82, cy + 10), (cx + 86, cy + 22)]:
        for k in range(3):
            xx = ex + fr.randint(-25, 25)
            td.line([(xx, ey), (xx + fr.randint(-6, 6), ey + fr.randint(120, 260))], fill=(150, 0, 0), width=fr.randint(3, 6))
    img = ImageChops.add(img, tears.filter(ImageFilter.GaussianBlur(1.5)))
    d = ImageDraw.Draw(img)
    for _ in range(9):  # fissures
        x, y = cx + fr.randint(-150, 150), cy + fr.randint(-230, 40)
        pts = [(x, y)]
        for _ in range(7):
            x += fr.randint(-22, 22); y += fr.randint(10, 30)
            pts.append((x, y))
        d.line(pts, fill=(25, 22, 20), width=2)
    img = ImageOps.autocontrast(img, cutoff=1)
    return img.filter(ImageFilter.GaussianBlur(0.8))

def card_img(lines):
    """lines = [(texte, taille, couleur, gras, sans)]"""
    img = new((0, 0, 0))
    d = ImageDraw.Draw(img)
    total = sum(int(s * 1.5) for _, s, *_ in lines)
    y = PH // 2 - total // 2
    layer = Image.new("RGB", img.size, (0, 0, 0))
    ld = ImageDraw.Draw(layer)
    for text, size, col, bold, sans in lines:
        f = font(size, bold=bold, sans=sans)
        ld.text((PW // 2, y + size // 2), text, font=f, fill=col, anchor="mm")
        d.text((PW // 2, y + size // 2), text, font=f, fill=col, anchor="mm")
        y += int(size * 1.5)
    return ImageChops.add(img, layer.filter(ImageFilter.GaussianBlur(12)))

# ----------------------------------------------------------------- scénario
CAPTIONS = [
    (7.2, 11.0, "Léa n'avait pas revu la maison de sa grand-mère depuis dix ans."),
    (11.0, 15.0, "Ce soir-là, elle venait récupérer l'héritage… et les clés."),
    (15.0, 17.0, "Toutes les fenêtres étaient noires. Sauf une."),
    (17.3, 22.0, "Le couloir sentait la poussière et quelque chose de sucré, comme une fleur laissée à pourrir."),
    (22.3, 26.0, "Au fond, la porte de la cave était entrouverte. Elle jurait l'avoir vue fermée."),
    (26.2, 28.0, "Quelque chose chuchota son prénom."),
    (28.3, 33.0, "Dans le grand miroir du salon, Léa croisa son regard. Elle leva la main. Son reflet aussi."),
    (33.2, 37.2, "Puis elle la baissa. Le reflet, lui, resta immobile… en souriant."),
    (37.4, 40.0, "« Bienvenue à la maison, Léa. »"),
    (43.3, 48.0, "La cave. Quarante marches de pierre humide. La lampe de son téléphone tremblait."),
    (48.3, 53.0, "En bas, dans le noir, deux petites lueurs la regardaient. Puis quatre. Puis dix."),
    (53.3, 57.0, "Sur le mur, des photos de famille. Sur la première, une silhouette sombre, tout au fond du jardin."),
    (57.2, 61.0, "Sur la deuxième, prise vingt ans plus tard, elle se tenait sur le seuil de la maison."),
    (61.2, 65.0, "Sur la troisième… elle était derrière Léa. Léa, telle qu'elle était ce soir."),
    (65.3, 70.0, "Un journal, posé sur une caisse. L'écriture de sa grand-mère : « Ne te retourne jamais. »"),
    (70.2, 73.0, "Une boîte à musique se mit à jouer toute seule. Les lumières moururent."),
    (73.2, 75.0, "Quelque chose de très grand respira dans le noir."),
    (78.5, 83.0, "Léa remonta en courant. La porte était verrouillée. Elle alluma la caméra de son téléphone."),
    (83.3, 88.0, "Sur l'écran, l'escalier était vide. Mais la berceuse, elle, se rapprochait."),
    (88.3, 91.5, "Les marches grincèrent. Une, puis une autre. Juste derrière elle."),
    (91.7, 94.4, "Et la musique s'arrêta."),
]
SCREAM_T = 96.0

def build_scenes():
    S = []
    def st(t, img, focus=(PW / 2, PH / 2), z0=1.0, z1=1.12):
        return dict(t=t, img=img, focus=focus, z0=z0, z1=z1)
    def sc(name, t0, t1, stages, **kw):
        d = dict(name=name, t0=t0, t1=t1, stages=stages, vig=0.8, grain=9, tint=None, fi=0.5, fo=0.4, dark=1.0, flick=True)
        d.update(kw); S.append(d)

    red = (150, 14, 14)
    sc("title", 0, 4, [st(0, card_img([("LA MAISON", 92, red, True, False), ("DES MURMURES", 92, red, True, False),
                                        ("⚠  contient un screamer  ⚠", 24, (150, 150, 150), False, True)]), z0=1.0, z1=1.08)],
       fi=1.0, fo=0.6)
    sc("card1", 4, 7, [st(4, card_img([("PARTIE 1", 30, (140, 140, 140), False, True), ("L'HÉRITAGE", 80, red, True, False)]))], fi=0.7, fo=0.7)
    sc("house", 7, 17, [st(7, scene_house(0), (590, 400), 1.0, 1.28), st(15, scene_house(1), (590, 400), 1.28, 1.4)], vig=0.9, grain=10)
    sc("hall", 17, 28, [st(17, scene_hall(None), (560, 300), 1.0, 1.15),
                        st(22, scene_hall(7.4), (560, 300), 1.15, 1.3),
                        st(26, scene_hall(4.2), (560, 300), 1.3, 1.42)], vig=1.0)
    sc("mirror", 28, 40, [st(28, scene_mirror(0), (560, 300), 1.0, 1.2),
                          st(33, scene_mirror(1), (560, 280), 1.2, 1.38),
                          st(37.4, scene_mirror(2), (560, 300), 1.2, 1.45)], vig=1.0)
    sc("card2", 40, 43, [st(40, card_img([("PARTIE 2", 30, (140, 140, 140), False, True), ("LE SOUS-SOL", 80, red, True, False)]))], fi=0.7, fo=0.7)
    sc("stairs", 43, 53, [st(43, scene_stairs(0), (560, 270), 1.0, 1.25),
                          st(46.5, scene_stairs(1), (560, 270), 1.25, 1.4),
                          st(48.4, scene_stairs(4), (560, 270), 1.35, 1.6),
                          st(51.0, scene_stairs(16), (560, 270), 1.5, 1.8)], vig=0.9, grain=12, dark=1.9)
    ph = scene_photos()
    sc("photos", 53, 65, [st(53, ph, (225, 330), 1.9, 2.2), st(57, ph, (560, 330), 1.9, 2.2),
                          st(61, ph, (895, 330), 1.9, 2.3)], vig=1.2, grain=11)
    jr = scene_journal()
    sc("lady", 65, 75, [st(65, jr, (560, 330), 1.0, 1.25),
                        st(70, scene_musicbox(False), (560, 340), 1.0, 1.3),
                        st(73, scene_musicbox(True), (700, 300), 1.1, 1.35)], vig=1.25)
    sc("card3", 75, 78, [st(75, card_img([("PARTIE 3", 30, (140, 140, 140), False, True), ("ELLE", 100, red, True, False)]))], fi=0.7, fo=0.5)
    sc("phone", 78, 94.5, [st(78, scene_phone(0), (560, 330), 1.0, 1.1),
                           st(84, scene_phone(1), (560, 330), 1.1, 1.18),
                           st(88.5, scene_phone(2), (560, 330), 1.18, 1.25),
                           st(91.5, scene_phone(3), (560, 340), 1.1, 1.3)],
       tint="green", hud=True, vig=1.0, grain=26, fo=0.0, fi=0.3)
    sc("black", 94.5, 96, [st(94.5, new())], fi=0, fo=0, grain=3, flick=False)
    sc("scream", 96, 98.2, [st(96, make_face())], fi=0, fo=0, grain=30, flick=False)
    sc("end", 98.2, DUR, [st(98.2, new()),
                          st(99.0, card_img([("Ne te retourne jamais.", 44, (170, 170, 170), False, False)])),
                          st(102.2, card_img([("FIN", 90, red, True, False)]))], fi=0.2, fo=0.5, grain=4)
    return S

# ----------------------------------------------------------------- rendu image
_vig_cache = {}
def vignette(v):
    if v not in _vig_cache:
        ys, xs = np.mgrid[0:H, 0:W]
        r = np.sqrt(((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2)
        _vig_cache[v] = np.clip(1.12 - v * r ** 1.6, 0.03, 1)[..., None].astype(np.float32)
    return _vig_cache[v]

NOISE = RNG.normal(0, 1, (8, H, W)).astype(np.float32)

def wrap(text, f, maxw):
    words, lines, cur = text.split(), [], ""
    for w_ in words:
        t = (cur + " " + w_).strip()
        if f.getlength(t) <= maxw:
            cur = t
        else:
            lines.append(cur); cur = w_
    return lines + [cur]

CAP_H = 170
def make_caption(text):
    f = font(27, italic=True)
    lines = wrap(text, f, W - 150)
    im = Image.new("RGBA", (W, CAP_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    lh = 37
    y = CAP_H - 22 - lh * len(lines)
    d.rectangle([0, y - 14, W, CAP_H], fill=(0, 0, 0, 120))
    for i, ln in enumerate(lines):
        d.text((W / 2, y + i * lh), ln, font=f, fill=(238, 232, 222, 255), anchor="ma", stroke_width=2, stroke_fill=(0, 0, 0, 255))
    a = np.asarray(im, np.float32)
    return a[..., :3], a[..., 3:4] / 255.0

_hud_cache = {}
def hud(t, t0):
    sec = int(t - t0)
    blink = int(t * 1.6) % 2
    key = (sec, blink)
    if key not in _hud_cache:
        im = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(im)
        f = font(20, sans=True)
        if blink:
            d.ellipse([34, 30, 52, 48], fill=(235, 30, 30, 255))
        d.text((62, 38), "REC", font=f, fill=(235, 235, 235, 255), anchor="lm")
        d.text((W - 34, 38), "00:%02d:%02d" % (sec // 60, sec % 60), font=f, fill=(235, 235, 235, 255), anchor="rm")
        d.text((W - 34, 66), "▮▮▯", font=f, fill=(235, 235, 235, 200), anchor="rm")
        for (x, y, sx, sy) in [(24, 20, 1, 1), (W - 24, 20, -1, 1), (24, H - 20, 1, -1), (W - 24, H - 20, -1, -1)]:
            d.line([x, y, x + sx * 34, y], fill=(235, 235, 235, 220), width=3)
            d.line([x, y, x, y + sy * 34], fill=(235, 235, 235, 220), width=3)
        d.text((W / 2, H - 36), "NIGHT  ISO 6400", font=font(16, sans=True), fill=(235, 235, 235, 160), anchor="mm")
        a = np.asarray(im, np.float32)
        _hud_cache[key] = (a[..., :3], a[..., 3:4] / 255.0)
    return _hud_cache[key]

def crop_box(focus, zoom, t, sway=1.0):
    bw, bh = PW / zoom, PH / zoom
    fx = focus[0] + math.sin(t * 0.9) * 7 * sway
    fy = focus[1] + math.cos(t * 0.7) * 5 * sway
    x0 = min(max(fx - bw / 2, 0), PW - bw)
    y0 = min(max(fy - bh / 2, 0), PH - bh)
    return (x0, y0, x0 + bw, y0 + bh)

def render_frame(fi, scenes, caps):
    t = fi / FPS
    sc = next((s for s in scenes if s["t0"] <= t < s["t1"]), scenes[-1])
    sts = sc["stages"]
    idx = max(i for i, s in enumerate(sts) if s["t"] <= t)
    s = sts[idx]
    end = sts[idx + 1]["t"] if idx + 1 < len(sts) else sc["t1"]
    p = min(max((t - s["t"]) / max(end - s["t"], 1e-3), 0), 1)
    dt = t - s["t"]
    switching = idx > 0 and dt < 0.35
    rf = random.Random(fi * 7919)

    if sc["name"] == "scream":
        k = t - SCREAM_T
        zoom = 1.05 + 0.95 * (1 - math.exp(-k * 5.0)) + 0.15 * k
        amp = 30 * math.exp(-k * 0.8) + 6
        focus = (PW / 2 + rf.uniform(-amp, amp) * 3, PH * 0.52 + rf.uniform(-amp, amp) * 2)
        box = crop_box(focus, zoom, t, 0)
    else:
        zoom = s["z0"] + (s["z1"] - s["z0"]) * p
        box = crop_box(s["focus"], zoom, t)
    arr = np.asarray(s["img"].resize((W, H), Image.BILINEAR, box=box), np.float32)

    mult = 1.0
    if sc["flick"]:
        mult = 1.0 + 0.05 * math.sin(t * 13) + 0.03 * math.sin(t * 31.7)
        if rf.random() < 0.035:
            mult *= rf.uniform(0.25, 0.6)
    if switching:
        mult *= rf.choice([0.0, 1.8, 0.25, 1.0, 0.0, 1.4])
        for _ in range(3):
            y0 = rf.randrange(0, H - 40); hh = rf.randrange(8, 40); dx = rf.randrange(-40, 40)
            arr[y0:y0 + hh] = np.roll(arr[y0:y0 + hh], dx, axis=1)
        arr[..., 0] = np.roll(arr[..., 0], 4, axis=1)

    if sc["name"] == "scream":
        k = t - SCREAM_T
        if k < 0.5 and fi % 3 == 0:
            arr = 255 - arr
        if fi % 2 == 0:
            arr = arr * np.array([1.25, 0.75, 0.75], np.float32)
        arr[..., 0] = np.roll(arr[..., 0], int(10 * math.exp(-k)), axis=1)
        arr[..., 2] = np.roll(arr[..., 2], -int(10 * math.exp(-k)), axis=1)
        arr *= 1.15

    arr = arr * mult * sc["dark"] * vignette(sc["vig"])
    if sc["tint"] == "green":
        g = arr.mean(2, keepdims=True) * 1.5
        arr = g * np.array([0.30, 1.0, 0.38], np.float32)
        if rf.random() < 0.08:   # parasites
            y0 = rf.randrange(0, H - 20)
            arr[y0:y0 + rf.randrange(2, 12)] += 60
    arr += NOISE[fi % 8][..., None] * sc["grain"]

    # sous-titres
    for (c0, c1, text) in caps:
        if c0 <= t < c1:
            col, a = caps[(c0, c1, text)]
            fade = min(1, (t - c0) / 0.3, (c1 - t) / 0.3)
            reg = arr[H - CAP_H:]
            arr[H - CAP_H:] = reg * (1 - a * fade) + col * (a * fade)
    if sc.get("hud"):
        col, a = hud(t, sc["t0"])
        arr = arr * (1 - a) + col * a

    fade = 1.0
    if sc["fi"] > 0 and t - sc["t0"] < sc["fi"]:
        fade = (t - sc["t0"]) / sc["fi"]
    if sc["fo"] > 0 and sc["t1"] - t < sc["fo"]:
        fade = min(fade, (sc["t1"] - t) / sc["fo"])
    arr *= fade
    return arr.clip(0, 255).astype(np.uint8)

# ----------------------------------------------------------------- son
SR = 44100
N = int(DUR * SR)
TT = np.arange(N) / SR

def boxlp(x, k):
    cs = np.cumsum(np.concatenate([np.zeros(1), x]))
    y = (cs[k:] - cs[:-k]) / k
    return np.concatenate([y, np.zeros(len(x) - len(y))])

def norm(x):
    return x / (np.std(x) + 1e-9)

def env_curve(points):
    xs, ys = zip(*points)
    return np.interp(TT, xs, ys)

class Mix:
    def __init__(self):
        self.L = np.zeros(N); self.R = np.zeros(N)
    def add(self, sig, start, gain=1.0, pan=0.0):
        i = int(start * SR)
        if i >= N or i < 0:
            return
        sig = sig[:N - i]
        a = (pan + 1) * math.pi / 4
        self.L[i:i + len(sig)] += sig * gain * math.cos(a)
        self.R[i:i + len(sig)] += sig * gain * math.sin(a)

def tone(f, d, harm=(1.0,), decay=None, att=0.005):
    t = np.arange(int(d * SR)) / SR
    s = sum(h * np.sin(2 * math.pi * f * (k + 1) * t) for k, h in enumerate(harm))
    e = np.minimum(1, t / att) * (np.exp(-t * decay) if decay else 1.0)
    return s * e

def build_audio():
    amb = Mix()
    nr = np.random.default_rng(3)

    # drone grave
    gdrone = env_curve([(0, 0), (2, .5), (40, .6), (43, .5), (75, .8), (94.4, 1.0), (98.3, 0), (99, .5), (104, .3)])
    drone = (0.5 * np.sin(2 * math.pi * 55 * TT) + 0.45 * np.sin(2 * math.pi * 55.8 * TT) +
             0.28 * np.sin(2 * math.pi * 82.4 * TT + 1.3 * np.sin(TT * .3)) + 0.12 * np.sin(2 * math.pi * 116.5 * TT))
    drone *= 0.6 + 0.4 * np.sin(2 * math.pi * 0.11 * TT)
    amb.add(drone * gdrone * 0.9, 0)

    # ton aigu dissonant qui monte (partie 3)
    gh = env_curve([(0, 0), (76, 0), (80, .05), (94.4, .25), (94.5, 0), (104, 0)])
    hi = np.sin(2 * math.pi * (1175 + 40 * np.sin(TT * .4)) * TT) + 0.6 * np.sin(2 * math.pi * 1244.5 * TT)
    amb.add(hi * gh * 0.25, 0)

    # vent
    wind = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    wind_r = norm(boxlp(nr.standard_normal(N), 40) - boxlp(nr.standard_normal(N), 400))
    gw = env_curve([(0, .1), (7, .6), (17, .35), (40, .2), (75, .3), (94.4, .4)]) * (0.5 + 0.5 * np.sin(2 * math.pi * 0.07 * TT + 1) ** 2)
    amb.L += wind * gw * 0.25; amb.R += wind_r * gw * 0.25

    # coups graves (titres de parties, porte)
    for tb, g in [(0.2, .9), (4.0, .9), (40.0, .9), (75.0, 1.0), (78.0, 1.3)]:
        t = np.arange(int(2.0 * SR)) / SR
        boom = np.sin(2 * math.pi * (48 - 14 * (1 - np.exp(-t * 4))) * t) * np.exp(-t * 2.4)
        boom += norm(boxlp(nr.standard_normal(len(t)), 30)) * np.exp(-t * 6) * 0.4
        amb.add(boom, tb, g * 0.9)
    # clic de verrou
    amb.add(norm(nr.standard_normal(2000)) * np.exp(-np.arange(2000) / 150.0), 79.5, 0.5)
    amb.add(norm(nr.standard_normal(2000)) * np.exp(-np.arange(2000) / 120.0), 79.62, 0.7)

    # grincements
    for tc in [14.0, 20.5, 25.0, 31.0, 36.0, 46.0, 49.0, 52.0, 58.0, 68.0, 79.8, 86.0, 89.0, 90.4, 91.3]:
        d = 0.9 + nr.random() * 0.5
        t = np.arange(int(d * SR)) / SR
        f = (170 + 230 * nr.random()) * (1 + 0.45 * np.sin(math.pi * t / d * (0.5 + nr.random()))) + 25 * nr.standard_normal(len(t)).cumsum() * 0.002 * SR ** 0.5
        ph = np.cumsum(2 * math.pi * f / SR)
        s = sum(np.sin(k * ph) / k for k in range(1, 8))
        s *= np.sin(math.pi * t / d) ** 1.5 * (0.6 + 0.4 * np.sin(2 * math.pi * 23 * t))
        amb.add(s, tc, 0.28, nr.uniform(-.8, .8))

    # murmures
    for (a, b) in [(24, 28), (36, 40), (44, 53), (62, 66), (80, 94.4)]:
        for ch in (0, 1):
            n = int((b - a) * SR)
            nz = nr.standard_normal(n)
            band = norm(boxlp(nz, 4) - boxlp(nz, 30))
            seg = np.zeros(n)
            i = 0
            while i < n:
                L_ = int(nr.uniform(0.08, 0.32) * SR)
                seg[i:i + L_] = nr.random() ** 1.5
                i += L_ + int(nr.uniform(0.0, .12) * SR)
            seg = boxlp(seg, 700)
            seg = np.concatenate([seg, np.zeros(n - len(seg))])
            wsig = band * seg * np.sin(math.pi * np.arange(n) / n) ** 0.5
            pan = -0.9 if ch == 0 else 0.9
            amb.add(wsig, a, 0.55 if b < 90 else 0.75, pan)

    # battements de coeur
    tb, k = 43.0, 0
    while tb < 94.4:
        bpm = np.interp(tb, [43, 70, 94.4], [58, 95, 150])
        g = np.interp(tb, [43, 60, 94.4], [.0, .8, 1.3])
        t = np.arange(int(.35 * SR)) / SR
        th = np.sin(2 * math.pi * 52 * t) * np.exp(-t * 22)
        amb.add(th, tb, g * 1.1)
        amb.add(th, tb + 60 / bpm * .28, g * .7)
        tb += 60 / bpm
        k += 1

    # boîte à musique (Für Elise, qui se détraque)
    n_ = {"B4": 493.88, "C5": 523.25, "D5": 587.33, "D#5": 622.25, "E5": 659.25, "A4": 440.0,
          "G#4": 415.3, "E4": 329.63}
    mel = [("E5", 1), ("D#5", 1), ("E5", 1), ("D#5", 1), ("E5", 1), ("B4", 1), ("D5", 1), ("C5", 1), ("A4", 2),
           ("C5", 1), ("E5", 1), ("A4", 1), ("B4", 2), ("E4", 1), ("G#4", 1), ("B4", 1), ("C5", 2)]
    def play(t0, t1, beat, vol0, vol1, flat0, flat1):
        t_, i = t0, 0
        while t_ < t1:
            nm, ln = mel[i % len(mel)]
            u = (t_ - t0) / (t1 - t0)
            fl = 1 - (flat0 + (flat1 - flat0) * u) * (1 + 0.5 * math.sin(i * 1.7))
            s = tone(n_[nm] * fl, 1.6, (1.0, 0.0, 0.0, 0.35, 0.0, 0.15), decay=2.8)
            vol = vol0 + (vol1 - vol0) * u
            amb.add(s, t_, vol, -0.3)
            amb.add(s, t_ + 0.23, vol * 0.4, 0.5)
            t_ += beat * ln * (1 + 0.5 * u * (i % 3))
            i += 1
    play(70.0, 75.0, 0.32, .25, .35, 0.0, 0.01)
    play(83.0, 94.4, 0.5, .22, .6, 0.01, 0.06)
    # note orpheline finale
    amb.add(tone(659.25 * .94, 3.0, (1, 0, 0, .3), decay=1.5), 100.5, 0.25)

    # pas dans l'escalier
    for tp in [88.4, 89.7, 90.7, 91.5, 92.1, 92.6, 93.0, 93.3, 93.6]:
        t = np.arange(int(.35 * SR)) / SR
        step = norm(boxlp(nr.standard_normal(len(t)), 60)) * np.exp(-t * 18) * .8 + np.sin(2 * math.pi * 70 * t) * np.exp(-t * 20)
        amb.add(step, tp, 1.3, nr.uniform(-.3, .3))

    # montée de tension
    t = np.arange(int(3.4 * SR)) / SR
    rise = np.sin(2 * math.pi * np.cumsum(300 + 1700 * (t / 3.4) ** 2) / SR) * (t / 3.4) ** 2
    amb.add(rise, 91.0, 0.35)

    # silence total 94.5 -> 98.3, avec une inspiration juste avant le cri
    gate = np.interp(TT, [0, 94.42, 94.5, 98.3, 99.0, DUR], [1, 1, 0, 0, 1, 1])
    amb.L *= gate; amb.R *= gate
    t = np.arange(int(.8 * SR)) / SR
    nz = np.random.default_rng(9).standard_normal(len(t))
    inh = norm(boxlp(nz, 3) - boxlp(nz, 25)) * (t / .8) ** 2 * (t < .75)
    amb.add(inh, 95.2, 0.45)

    pk = max(np.abs(amb.L).max(), np.abs(amb.R).max())
    amb.L *= 0.5 / pk; amb.R *= 0.5 / pk

    # ---- le cri (screamer)
    d = 2.2
    t = np.arange(int(d * SR)) / SR
    rs = np.random.default_rng(21)
    wob = boxlp(rs.standard_normal(len(t)), 900)
    wob = wob / (np.abs(wob).max() + 1e-9)
    f0 = 620 + 950 * (1 - np.exp(-t * 7)) + 140 * np.sin(2 * math.pi * 7.3 * t) + 220 * wob
    sig = np.zeros(len(t))
    for ratio, g in [(1.0, 1.0), (1.067, .8), (0.5, .6)]:
        ph = np.cumsum(2 * math.pi * f0 * ratio / SR)
        sig += g * sum(np.sin(k * ph + k) / k for k in range(1, 11))
    sig *= 0.65 + 0.35 * np.sin(2 * math.pi * 31 * t + wob * 4)
    nz = rs.standard_normal(len(t))
    sig += 2.2 * norm(boxlp(nz, 2) - boxlp(nz, 14)) * np.exp(-t * 2.0)
    sig = np.tanh(3.2 * sig / (np.std(sig) + 1e-9))
    sig *= np.minimum(1, t / 0.004) * np.exp(-np.maximum(t - 0.9, 0) * 1.8)
    boom = np.sin(2 * math.pi * (60 - 22 * (1 - np.exp(-t * 6))) * t) * np.exp(-t * 3.2)
    sig = sig * 0.8 + boom * 0.85
    sig = np.tanh(1.8 * sig)
    sig /= np.abs(sig).max()
    scr = np.zeros(N); i0 = int(SCREAM_T * SR); scr[i0:i0 + len(sig)] = sig[:N - i0] * 0.97
    left = amb.L + scr
    right = amb.R + np.roll(scr, 18)    # léger décalage -> son plus large

    st = np.stack([left, right], 1)
    st = np.clip(st, -1, 1)
    pcm = (st * 32767).astype("<i2")
    path = os.path.join(HERE, "audio_tmp.wav")
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    return path

# ----------------------------------------------------------------- main
def main():
    stills = "--stills" in sys.argv
    scenes = build_scenes()
    caps = {(a, b, t): make_caption(t) for a, b, t in CAPTIONS}
    total = int(DUR * FPS)
    if stills:
        os.makedirs(os.path.join(HERE, "stills"), exist_ok=True)
        times = [1.5, 5.5, 10, 16, 19, 24, 27, 30, 35, 39, 41.5, 45, 47.5, 50, 52.5, 55, 59, 63, 67, 71.5, 74, 76.5,
                 80, 86, 90, 93.5, 96.1, 96.6, 97.4, 100, 103]
        for tt in times:
            Image.fromarray(render_frame(int(tt * FPS), scenes, caps)).save(os.path.join(HERE, "stills", "t%06.2f.png" % tt))
        print("stills ok"); return
    print("audio…", flush=True)
    wav = build_audio()
    print("vidéo…", flush=True)
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", "%dx%d" % (W, H),
           "-r", str(FPS), "-i", "-", "-i", wav, "-c:v", "libx264", "-preset", "medium", "-crf", "24",
           "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", OUT]
    pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
    for fi in range(total):
        pr.stdin.write(render_frame(fi, scenes, caps).tobytes())
        if fi % 240 == 0:
            print("  %d/%d" % (fi, total), flush=True)
    pr.stdin.close(); pr.wait()
    os.remove(wav)
    print("OK ->", OUT)

if __name__ == "__main__":
    main()
