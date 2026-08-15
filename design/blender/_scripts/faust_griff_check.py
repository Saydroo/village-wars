# -*- coding: utf-8 -*-
"""NAHAUFNAHME-Check des Faeustlings-Verbunds (build_grip_unit, 2026-07-14):
Faust + Stabsegment in drei Winkeln (frontal / 3/4 / seitlich) als EIN
Montage-Bild, dazu ein QA-Blatt (Grasgruen #6A994E, Spielgroessen-Patch,
Silhouette ueber Alpha). KEINE Posen-Renders — Abnahme durch Ufuk abwarten.

Aufruf: blender -b --factory-startup --python faust_griff_check.py -- [outdir]
Ausgabe: <outdir>/faust_griff_vNN.png + qa_out/faust_griff_vNN_qa.png
"""
import bpy, math, os, re, sys
from mathutils import Vector

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import cartoon_parts as cp

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
OUT = argv[0] if len(argv) >= 1 else \
    r"C:\Users\Ufuk\Claude Code\Village-Wars\design\blender\units\archer"
QA_DIR = r"C:\Users\Ufuk\Claude Code\Village-Wars\qa_out"
TMP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_faust_tmp")
os.makedirs(TMP, exist_ok=True)

HAND_S = 0.88          # Posen-Skalierung (fuer die Spielgroessen-Rechnung)
T_FIG = 2.56           # Figur-Hoehe (v10) — Spielgroesse: Figur = 80 px

# v09: DREI Varianten mit je 4 Rillen — K (Boolean-Kerben) / L2 (buendige
# Linien) / W4 (vier Wuelste).
VIEWS = (("frontal", 180), ("34", 135), ("seitlich", 90))
unit_h = 0.46
for var, groove_mode in (("K", "cuts"), ("L2", "lines4"), ("W4", "bulges4")):
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete()
    M = cp.make_materials()
    cp.build_grip_unit(M, pfx="grip_", thumb=False, grooves=groove_mode)

    key = bpy.data.lights.new("key", 'SUN'); key.energy = 3.2
    key.angle = math.radians(40)
    ko = bpy.data.objects.new("key", key)
    ko.rotation_euler = (math.radians(40), math.radians(8), math.radians(20))
    bpy.context.collection.objects.link(ko)
    fill = bpy.data.lights.new("fill", 'SUN'); fill.energy = 1.5
    fill.angle = math.radians(60)
    fo = bpy.data.objects.new("fill", fill)
    fo.rotation_euler = (math.radians(55), 0, math.radians(200))
    bpy.context.collection.objects.link(fo)
    world = bpy.data.worlds.new("W"); world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (1, 1, 1, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.55
    bpy.context.scene.world = world

    cam_data = bpy.data.cameras.new("Cam"); cam_data.type = "ORTHO"
    cam_data.ortho_scale = 0.62
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    bpy.context.scene.camera = cam

    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    try:
        cprefs = bpy.context.preferences.addons['cycles'].preferences
        for ctype in ('OPTIX', 'CUDA'):
            try:
                cprefs.compute_device_type = ctype
                break
            except Exception:
                continue
        cprefs.get_devices()
        for d_ in cprefs.devices:
            d_.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:
        print('GPU-Setup fehlgeschlagen, CPU-Fallback:', e)
    sc.cycles.samples = 96
    sc.cycles.use_denoising = True
    sc.render.film_transparent = True
    sc.render.resolution_x = sc.render.resolution_y = 640
    sc.view_settings.view_transform = 'Standard'

    d, el = 12.0, math.radians(66)
    target = Vector((0, 0, 0))
    for vname, az_deg in VIEWS:
        az = math.radians(az_deg)
        cam.location = target + Vector((d * math.sin(el) * math.sin(az),
                                        d * math.sin(el) * math.cos(az),
                                        d * math.cos(el)))
        cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
        sc.render.filepath = os.path.join(TMP, f"faust_{var}_{vname}.png")
        bpy.ops.render.render(write_still=True)
        print("RENDERED", sc.render.filepath)

# === MONTAGE + QA-BLATT (PIL) =================================================
# Der in Blender EINGEBETTETE Interpreter sieht Pillow nicht — dann macht das
# Standalone-Python (4.2\python\bin\python.exe) den Montage-Teil separat
# (Skript: faust_montage.py im Session-Scratchpad).
try:
    from PIL import Image, ImageDraw, ImageFont
except ModuleNotFoundError:
    print("PIL fehlt im eingebetteten Interpreter — Montage separat ausfuehren.")
    print("DONE (nur Renders)")
    sys.exit(0)

GRASS = (106, 153, 78)          # #6A994E


def font(s):
    try:
        return ImageFont.truetype("C:/Windows/Fonts/arialbd.ttf", s)
    except Exception:
        return ImageFont.load_default()


# Versionierung: naechste freie Nummer, nichts ueberschreiben
vmax = 0
for f in os.listdir(OUT):
    m = re.match(r"faust_griff_v(\d+)\.png$", f)
    if m:
        vmax = max(vmax, int(m.group(1)))
VER = f"v{vmax + 1:02d}"

ims = {k: Image.open(os.path.join(TMP, f"faust_{k}.png")).convert("RGBA")
       for k, _ in VIEWS}
pad, lab = 20, 40
W = sum(i.width for i in ims.values()) + pad * 4
H = 640 + lab + pad
canvas = Image.new("RGB", (W, H), (255, 255, 255))
dr = ImageDraw.Draw(canvas)
x = pad
for (k, _) in VIEWS:
    im = ims[k]
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    canvas.paste(bg.convert("RGB"), (x, lab))
    dr.text((x + im.width // 2, 8), {"34": "3/4"}.get(k, k), anchor="ma",
            font=font(26), fill=(20, 20, 20))
    x += im.width + pad
out_main = os.path.join(OUT, f"faust_griff_{VER}.png")
canvas.save(out_main)
print("VERSION:", out_main)

# QA-Blatt: Nahaufnahme auf Gras + Spielgroessen-Patch + Silhouette
im34 = ims["34"]
bbox = im34.getbbox()
crop = im34.crop(bbox)
qa = Image.new("RGB", (760, 340), (240, 240, 240))
dq = ImageDraw.Draw(qa)
grass = Image.new("RGBA", (420, 300), GRASS + (255,))
big = crop.resize((int(crop.width * 240 / crop.height), 240), Image.LANCZOS)
grass.alpha_composite(big, (30, 275 - big.height))
# SPIELGROESSE: Figur = 80 px -> Verbund = 80 * (unit_h * HAND_S / T_FIG)
game_h = max(4, round(80 * (unit_h * HAND_S) / T_FIG))
small = crop.resize((max(1, int(crop.width * game_h / crop.height)), game_h),
                    Image.LANCZOS)
patch = Image.new("RGBA", (80, 80), (0, 0, 0, 0))
patch.alpha_composite(small, ((80 - small.width) // 2, (80 - small.height) // 2))
grass.alpha_composite(patch, (330, 100))
dq.text((332, 186), f"{game_h}px", font=font(16), fill=(255, 255, 255))
qa.paste(grass.convert("RGB"), (20, 20))
dq.text((25, 322), f"Nahaufnahme + Spielgroesse (Figur=80px) | faust_griff_{VER}",
        font=font(14), fill=(30, 30, 30))
sil = Image.new("RGBA", crop.size, (0, 0, 0, 0))
black = Image.new("RGBA", crop.size, (20, 20, 20, 255))
sil.paste(black, mask=crop.getchannel("A"))
sil_small = sil.resize((int(sil.width * 260 / sil.height), 260), Image.LANCZOS)
white = Image.new("RGBA", (280, 300), (255, 255, 255, 255))
white.alpha_composite(sil_small, ((280 - sil_small.width) // 2, 20))
qa.paste(white.convert("RGB"), (460, 20))
dq.text((465, 322), "Silhouetten-Test (Alpha)", font=font(14), fill=(30, 30, 30))
os.makedirs(QA_DIR, exist_ok=True)
out_qa = os.path.join(QA_DIR, f"faust_griff_{VER}_qa.png")
qa.save(out_qa)
print("QA:", out_qa)
print("DONE")
