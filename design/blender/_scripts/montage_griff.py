# -*- coding: utf-8 -*-
"""Bogenhand-Griff: Front | 3/4 | Von oben. Versioniert (GRIFF_check_vNN)."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

FT = sys.argv[1] if len(sys.argv) > 1 else r'C:/vw_render_tmp'
DST = r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
BASE = "GRIFF_check"


def flat(p):
    im = Image.open(p).convert("RGBA")
    b = Image.new("RGB", im.size, (255, 255, 255)); b.paste(im, (0, 0), im); return b


def font(s):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", s)
    except Exception:
        return ImageFont.load_default()


cols = [("Front", "front"), ("3/4", "34"), ("Von oben", "oben")]
ims = [flat(os.path.join(FT, f"griff_{k}.png")) for _, k in cols]
cw = max(i.width for i in ims); ch = max(i.height for i in ims)
pad, lab = 24, 46
W = 3 * cw + 4 * pad
canvas = Image.new("RGB", (W, ch + lab + pad), (255, 255, 255))
d = ImageDraw.Draw(canvas); f = font(30)
for i, ((title, _), im) in enumerate(zip(cols, ims)):
    x = pad + i * (cw + pad)
    canvas.paste(im, (x + (cw - im.width) // 2, lab))
    d.text((x + cw // 2, 8), title, anchor="ma", font=f, fill=(20, 20, 20))
vmax = 0
for fn in os.listdir(DST):
    m = re.match(rf"{BASE}_v(\d+)\.png$", fn)
    if m:
        vmax = max(vmax, int(m.group(1)))
out = os.path.join(DST, f"{BASE}_v{vmax + 1:02d}.png")
canvas.save(out)
print("VERSION:", os.path.basename(out), canvas.size)
