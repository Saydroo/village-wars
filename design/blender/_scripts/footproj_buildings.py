# -*- coding: utf-8 -*-
"""FUSSPUNKT-PROJEKTION der 12 App-Gebaeude (kein Render, kein Export).

Fuehrt das jeweilige <gebaeude>_tiered.py mit den Kontaktbogen-Argumenten aus,
faengt aber `lib_iso.render_png` ab: statt zu rendern wird der WELTURSPRUNG
(0,0,0) = Mitte der Grundflaeche auf Bodenhoehe durch die EXAKT konfigurierte
Kamera projiziert und als Render-Pixel gedruckt. Damit laesst sich der Anker
der Export-Master exakt bestimmen (gleiche Regel wie beim Archer).

Aufruf:
  blender -b --factory-startup --python footproj_buildings.py -- <script.py> <args...>
Beispiel:
  ... --python footproj_buildings.py -- town_hall_tiered.py 3 dummy.png
"""
import os, sys, runpy
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import lib_iso as L
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
script = argv[0]
script_args = argv[1:]


def _probe(out_path, res=640):
    """Ersetzt render_png: projiziert (0,0,0) und beendet ohne zu rendern."""
    sc = bpy.context.scene
    sc.render.resolution_x = sc.render.resolution_y = res
    # WICHTIG: ohne view_layer.update() ist cam.matrix_world noch die alte
    # (uninitialisierte) Matrix -> Projektion liefert faelschlich die Bildmitte.
    bpy.context.view_layer.update()
    cam = sc.camera
    uv = world_to_camera_view(sc, cam, L.Vector((0.0, 0.0, 0.0)))
    print(f"FOOTPROJ_BUILDING {os.path.basename(script)} res {res} "
          f"px {uv.x * res:.2f} {(1 - uv.y) * res:.2f} "
          f"ortho {cam.data.ortho_scale:.4f}")
    sys.exit(0)


L.render_png = _probe
# Argumente so setzen, wie das Bau-Skript sie erwartet (nach "--").
sys.argv = ["blender", "--"] + script_args
runpy.run_path(os.path.join(HERE, script), run_name="__main__")
