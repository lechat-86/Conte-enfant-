#!/usr/bin/env python3
"""Textures utilisées par la scène 3D (photos de famille, page du journal)."""
import os, sys, random
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.argv = sys.argv[:1]
import make_video as mv
from PIL import Image, ImageDraw
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "www", "assets")
random.seed(3)
for i in range(3):
    c = Image.new("RGB", (1040, 1400), (0, 0, 0))
    mv._photo(c, 0, 0, 1040, 1400, i, S=4)
    c.save(os.path.join(OUT, "photo%d.jpg" % i), quality=93)

k = 2
page = Image.new("RGB", (700 * k, 470 * k), (196, 184, 150))
pd = ImageDraw.Draw(page)
pd.line([350 * k, 0, 350 * k, 470 * k], fill=(120, 108, 80), width=4 * k)
f = mv.font(23 * k, italic=True)
for i, ln in enumerate(["12 octobre. Elle est encore", "venue cette nuit. Elle se tient", "au pied de mon lit et elle", "chante, tout bas.", ""]):
    pd.text((26 * k, (40 + i * 38) * k), ln, font=f, fill=(46, 36, 28))
for i, ln in enumerate(["Quand la berceuse s'arrête,", "c'est qu'elle est derrière toi.", "", "NE TE RETOURNE", "JAMAIS."]):
    col = (130, 10, 10) if i >= 3 else (46, 36, 28)
    pd.text((376 * k, (40 + i * 44) * k), ln, font=mv.font((26 if i >= 3 else 23) * k, bold=i >= 3, italic=True), fill=col)
for _ in range(60):
    x, y = random.randint(0, 700 * k), random.randint(0, 470 * k)
    pd.ellipse([x, y, x + random.randint(3, 12) * k, y + random.randint(3, 12) * k], fill=(110, 20, 14))
page.save(os.path.join(OUT, "journal.jpg"), quality=93)
print("assets ok")
