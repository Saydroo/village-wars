# -*- coding: utf-8 -*-
"""Mund-Decal-Vergleich: 3/4 (Spielperspektive) | strenge Seite. Versioniert."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

FT = sys.argv[1] if len(sys.argv) > 1 else r'C:/vw_render_tmp'
DST = r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
BASE = "MUND_profil_check"


def flat(p):
    im = Image.open(p).convert("RGBA")
    b = Image.new("RGB", im.size, (255, 255, 255)); b.paste(im, (0, 0), im); return b


def font(s):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", s)
    except Exception:
        return ImageFont.load_default()


a = flat(os.path.join(FT, "gesicht_34.png"))
b = flat(os.path.join(FT, "gesicht_seite.png"))
H = max(a.height, b.height); pad = 30
W = a.width + b.width + 3 * pad
c = Image.new("RGB", (W, H + 44), (255, 255, 255)); d = ImageDraw.Draw(c)
c.paste(a, (pad, 44)); c.paste(b, (a.width + 2 * pad, 44))
d.text((pad + a.width // 2, 8), "3/4 (Spielperspektive)", anchor="ma", font=font(26), fill=(20, 20, 20))
d.text((a.width + 2 * pad + b.width // 2, 8), "Strenge Seite", anchor="ma", font=font(26), fill=(20, 20, 20))
vmax = 0
for f in os.listdir(DST):
    m = re.match(rf"{BASE}_v(\d+)\.png$", f)
    if m:
        vmax = max(vmax, int(m.group(1)))
out = os.path.join(DST, f"{BASE}_v{vmax + 1:02d}.png")
c.save(out)
print("VERSION:", os.path.basename(out), c.size)
