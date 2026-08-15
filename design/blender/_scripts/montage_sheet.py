# -*- coding: utf-8 -*-
"""Neutrales Referenz-Sheet: 4 Ansichten + Gesicht in EIN Bild. Versioniert
(menschen_archer_ref-sheet_vNN, setzt die bestehende Serie fort — v06 existiert)."""
import os, re, sys
from PIL import Image, ImageDraw, ImageFont

FT = sys.argv[1] if len(sys.argv) > 1 else r'C:/vw_render_tmp'
DST = r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
BASE = "menschen_archer_ref-sheet"


def flat(p):
    im = Image.open(p).convert("RGBA")
    b = Image.new("RGB", im.size, (255, 255, 255)); b.paste(im, (0, 0), im); return b


def font(s):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", s)
    except Exception:
        return ImageFont.load_default()


tiles = [("Front", "front"), ("3/4", "threequarter"), ("Seite", "side"),
         ("Rueck", "back"), ("Gesicht", "FACE")]
ims = {}
H = 768
for _, k in tiles:
    im = flat(os.path.join(FT, f"sheet_{k}.png"))
    if im.height != H:
        im = im.resize((round(im.width * H / im.height), H), Image.LANCZOS)
    ims[k] = im
pad, lab = 24, 44
ws = [ims[k].width for _, k in tiles]
W = sum(ws) + pad * (len(tiles) + 1)
canvas = Image.new("RGB", (W, H + lab + pad), (255, 255, 255))
d = ImageDraw.Draw(canvas)
x = pad
for title, k in tiles:
    im = ims[k]
    canvas.paste(im, (x, lab))
    d.text((x + im.width // 2, 8), title, anchor="ma", font=font(30), fill=(20, 20, 20))
    x += im.width + pad
vmax = 0
for f in os.listdir(DST):
    m = re.match(rf"{re.escape(BASE)}_v(\d+)", f)
    if m:
        vmax = max(vmax, int(m.group(1)))
out = os.path.join(DST, f"{BASE}_v{vmax + 1:02d}.png")
canvas.save(out)
print("VERSION:", os.path.basename(out), canvas.size)
