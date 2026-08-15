"""
Gemeinsame Helfer für die isometrische Gebäude-Render-Pipeline (Village Wars / Menschen).
Headless via:  blender --background --python <gebaeude>.py
Erzeugt 3D-Modelle aus Primitiven, rendert sie mit EEVEE als transparentes
isometrisches PNG (Pivot bottom-center, 2:1-CoC-Look).
"""
import bpy
import math
from mathutils import Vector

# --- Menschen-Palette (passend zum App-Stil HUMAN_PALETTE) ---
COL_STONE      = (0.78, 0.74, 0.64)   # heller Sandstein
COL_STONE_DARK = (0.55, 0.50, 0.42)
COL_ROOF       = (0.18, 0.37, 0.75)   # royalblau
COL_ROOF_DARK  = (0.11, 0.24, 0.52)
COL_WOOD       = (0.45, 0.30, 0.17)
COL_GOLD       = (0.95, 0.74, 0.22)
COL_WINDOW     = (0.98, 0.85, 0.45)   # warmes Fensterlicht
COL_GRASS      = (0.36, 0.55, 0.22)
COL_DIRT       = (0.40, 0.30, 0.20)
COL_FLAG       = (0.80, 0.16, 0.16)


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def mat(name, rgb, rough=0.7, metal=0.0, emis=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*rgb, 1.0)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    if emis > 0:
        bsdf.inputs["Emission Color"].default_value = (*rgb, 1.0)
        bsdf.inputs["Emission Strength"].default_value = emis
    return m


def _apply(obj, material):
    obj.data.materials.append(material)
    return obj


def box(name, center, size, material, bevel=0.04):
    """Quader: center=(x,y,z) Mittelpunkt, size=(sx,sy,sz) volle Kantenlängen."""
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0] / 2, size[1] / 2, size[2] / 2)
    bpy.ops.object.transform_apply(scale=True)
    if bevel > 0:
        b = o.modifiers.new("bev", "BEVEL")
        b.width = bevel
        b.segments = 2
    return _apply(o, material)


def cylinder(name, center, radius, height, material, verts=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=height, location=center)
    o = bpy.context.active_object
    o.name = name
    return _apply(o, material)


def cone(name, center, r1, r2, height, material, verts=24):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=height, location=center)
    o = bpy.context.active_object
    o.name = name
    return _apply(o, material)


def roof_prism(name, center, length_x, width_y, height, material):
    """Satteldach als Prisma (First entlang X)."""
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = (length_x / 2, width_y / 2, height / 2)
    bpy.ops.object.transform_apply(scale=True)
    # obere zwei Kanten zum First zusammenführen.
    # WICHTIG: robust gegen in die Mesh gebackene location — die "oberen" Verts
    # werden relativ zum Mesh-Mittelpunkt bestimmt (nicht gegen z>0), sonst
    # kollabiert das Dach, falls der Origin nicht im Mesh-Zentrum liegt.
    import bmesh
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    zs = [v.co.z for v in bm.verts]; ys = [v.co.y for v in bm.verts]
    zmid = (min(zs) + max(zs)) / 2; ymid = (min(ys) + max(ys)) / 2
    for v in bm.verts:
        if v.co.z > zmid:
            v.co.y = ymid  # First in der Mitte
    bm.to_mesh(me); bm.free()
    return _apply(o, material)


def pyramid(name, center, base, height, material):
    """Walmdach/Pyramide (für Türme)."""
    return cone(name, (center[0], center[1], center[2]), base * 0.72, 0.001, height, material, verts=4)


def hip_roof(name, center, length_x, width_y, height, material, ridge=0.42):
    """Walmdach: alle vier Seiten geneigt, kurzer First entlang X. In Iso-Ansicht
    immer als voluminöses Dach lesbar (zwei geneigte Flächen sichtbar)."""
    import bmesh
    bpy.ops.mesh.primitive_cube_add(location=center)
    o = bpy.context.active_object
    o.name = name
    o.scale = (length_x / 2, width_y / 2, height / 2)
    bpy.ops.object.transform_apply(scale=True)
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    # robust gegen gebackene location: obere Ecken relativ zum Mesh-Mittelpunkt
    zs = [v.co.z for v in bm.verts]; ys = [v.co.y for v in bm.verts]; xs = [v.co.x for v in bm.verts]
    zmid = (min(zs) + max(zs)) / 2; ymid = (min(ys) + max(ys)) / 2; xmid = (min(xs) + max(xs)) / 2
    halfx = (max(xs) - min(xs)) / 2
    for v in bm.verts:
        if v.co.z > zmid:                    # obere 4 Ecken → First
            v.co.y = ymid
            v.co.x = xmid + (1 if v.co.x > xmid else -1) * halfx * ridge
    bm.to_mesh(me); bm.free()
    return _apply(o, material)


def crystal(name, center, radius, height, material):
    """Magie-Kristall (spitzes Prisma) — für hohe Tiers."""
    return cone(name, center, radius, 0.001, height, material, verts=6)


def battlement_ring(name, cx, cy, hx, hy, z, mat, merlon=0.30, gap=0.30, h=0.34):
    """Zinnenkranz (Merlons) umlaufend auf einer rechteckigen Mauerkrone."""
    step = merlon + gap
    objs = []
    # Seiten parallel zu X (vorne/hinten bei y = ±hy)
    n = max(1, int((2 * hx) // step))
    xs = [(-hx + step / 2 + i * step) for i in range(n)]
    for sx in xs:
        for sy in (-hy, hy):
            objs.append(box(name, (cx + sx, cy + sy, z), (merlon, merlon, h), mat, bevel=0.02))
    m = max(1, int((2 * hy) // step))
    ys = [(-hy + step / 2 + i * step) for i in range(m)]
    for sy in ys:
        for sx in (-hx, hx):
            objs.append(box(name, (cx + sx, cy + sy, z), (merlon, merlon, h), mat, bevel=0.02))
    return objs


def shingle_roof(name, center, length_x, width_y, height, material, layers=6, overhang=0.3):
    """Echtes geneigtes Schindeldach (First entlang X): von der breiten Traufe unten
    zum schmalen First oben in mehreren überlappenden Reihen — die Stufen lesen sich
    als Schindel-Reihen, die Verjüngung erzeugt die sichtbare Dachneigung."""
    cx, cy, cz = center
    objs = []
    seg_h = height / layers
    for i in range(layers):
        t = i / layers
        w = (width_y + 2 * overhang) * (1.0 - t * 0.92) + 0.12   # breit unten → schmal oben
        lx = (length_x + 2 * overhang) * (1.0 - t * 0.10)
        z = cz + height * t
        objs.append(roof_prism(f"{name}{i}", (cx, cy, z), lx, w, seg_h * 2.1, material))
    return objs


def banner(name, x, y, z, w, h, pole_mat, cloth_mat, knob_mat, pole_h=1.4):
    """Fahnenmast + wehender Wimpel (leicht gewellt)."""
    cylinder(name + "_pole", (x, y, z + pole_h / 2), 0.045, pole_h, pole_mat, verts=8)
    cylinder(name + "_knob", (x, y, z + pole_h), 0.07, 0.12, knob_mat, verts=10)
    # Wimpel (dreieckig) als dünne Box, leicht geneigt
    import bmesh
    bpy.ops.mesh.primitive_cube_add(location=(x + w / 2 + 0.02, y, z + pole_h - h / 2))
    o = bpy.context.active_object
    o.name = name + "_cloth"
    o.scale = (w / 2, 0.02, h / 2)
    bpy.ops.object.transform_apply(scale=True)
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    for v in bm.verts:
        if v.co.x > x + w / 2:  # Außenkante zur Spitze verjüngen
            v.co.z = z + pole_h - h / 2
    bm.to_mesh(me); bm.free()
    return _apply(o, cloth_mat)


# --- Kamera + Licht + Render ---
def setup_iso_camera(ortho_scale=7.0, target_z=1.2):
    """Klassischer CoC-Iso-Blick von Süd-Ost-Oben. Die Kamera sieht die +Y-Fläche
    (Gebäude-FRONT mit Tor/Fenster) und die +X-Fläche. 60° vom Zenit = 30° über Horizont."""
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.type = "ORTHO"
    cam_data.ortho_scale = ortho_scale
    cam = bpy.data.objects.new("Cam", cam_data)
    bpy.context.collection.objects.link(cam)
    el = math.radians(60); az = math.radians(45); d = 24.0
    target = Vector((0, 0, target_z))
    cam.location = target + Vector((
        d * math.sin(el) * math.sin(az),
        d * math.sin(el) * math.cos(az),   # +Y → Front zeigt zur Kamera
        d * math.cos(el),
    ))
    direction = target - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.camera = cam
    return cam


def setup_lights():
    # Sonne (gerichtet, weiche Schatten) von links-oben-vorne.
    sun_d = bpy.data.lights.new("Sun", "SUN")
    sun_d.energy = 3.2
    sun_d.angle = math.radians(6)  # weiche Schattenkante
    sun = bpy.data.objects.new("Sun", sun_d)
    sun.rotation_euler = (math.radians(50), math.radians(12), math.radians(35))
    bpy.context.collection.objects.link(sun)
    # Fülllicht (Himmel) über die Welt.
    world = bpy.data.worlds.new("W")
    world.use_nodes = True
    bg = world.node_tree.nodes.get("Background")
    bg.inputs["Color"].default_value = (0.55, 0.62, 0.75, 1.0)
    bg.inputs["Strength"].default_value = 0.55
    bpy.context.scene.world = world


def render_png(out_path, res=640):
    sc = bpy.context.scene
    sc.render.engine = "BLENDER_EEVEE_NEXT"
    ev = sc.eevee
    for attr, val in (("use_raytracing", True), ("taa_render_samples", 96), ("use_shadows", True)):
        try:
            setattr(ev, attr, val)
        except Exception:
            pass
    # Ambient Occlusion / Fast GI für plastische Tiefe (CoC-Look).
    try:
        ev.use_fast_gi = True
        ev.fast_gi_method = "AMBIENT_OCCLUSION_ONLY"
        ev.fast_gi_distance = 0.6
    except Exception:
        pass
    sc.render.resolution_x = res
    sc.render.resolution_y = res
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    sc.view_settings.view_transform = "Standard"  # flache, saturierte Farben (kein Filmic)
    sc.view_settings.look = "None"
    sc.render.filepath = out_path
    bpy.ops.render.render(write_still=True)
    print("RENDERED", out_path)
