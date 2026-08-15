#!/usr/bin/env python3
"""
sprite_qa.py - QA-Pflichttests fuer Village-Wars Einheiten-Sprites.

Erzeugt pro Sprite ein Pruefblatt mit:
  1. Scale-Test:      Sprite bei 120px und 80px auf Grasgruen (In-Game-Simulation)
  2. Silhouetten-Test: Sprite als schwarze Silhouette
  3. Alpha-Check:      Warnung bei abgeschnittenen Raendern oder Transparenz-Artefakten

Nutzung:
  python sprite_qa.py sprite1.png sprite2.png ...
  python sprite_qa.py ordner/            (prueft alle PNGs im Ordner)

Ausgabe: qa_out/<name>_qa.png + Konsolen-Report
"""

import sys
from pathlib import Path
from PIL import Image, ImageDraw

GRASS = (106, 153, 78)          # In-Game-Untergrund
SIZES = [120, 80]               # typische Einheitengroessen auf dem Bildschirm
EDGE_TOLERANCE = 2              # px: Sprite darf nicht bis an den Rand reichen
OUT_DIR = Path("qa_out")


def collect_files(args):
    files = []
    for a in args:
        p = Path(a)
        if p.is_dir():
            files += sorted(p.glob("*.png"))
        elif p.suffix.lower() == ".png":
            files.append(p)
    return files


def alpha_check(img: Image.Image) -> list[str]:
    """Prueft auf abgeschnittene Raender (bekanntes Problem: gecroppte Sprites)."""
    warnings = []
    alpha = img.getchannel("A")
    w, h = img.size
    bbox = alpha.getbbox()
    if bbox is None:
        return ["FEHLER: Sprite ist komplett transparent"]
    left, top, right, bottom = bbox
    if left <= EDGE_TOLERANCE:
        warnings.append("WARNUNG: Inhalt beruehrt linken Rand (evtl. abgeschnitten)")
    if top <= EDGE_TOLERANCE:
        warnings.append("WARNUNG: Inhalt beruehrt oberen Rand (evtl. abgeschnitten)")
    if right >= w - EDGE_TOLERANCE:
        warnings.append("WARNUNG: Inhalt beruehrt rechten Rand (evtl. abgeschnitten)")
    if bottom >= h - EDGE_TOLERANCE:
        warnings.append("WARNUNG: Inhalt beruehrt unteren Rand (evtl. abgeschnitten)")

    # Anteil halbtransparenter Pixel (Artefakt-Indikator, Problem aus v0.2-Pack)
    hist = alpha.histogram()
    semi = sum(hist[16:240])
    total = w * h
    if total and semi / total > 0.10:
        warnings.append(
            f"WARNUNG: {semi / total:.0%} halbtransparente Pixel "
            "(moegliches Transparenz-Artefakt)"
        )
    return warnings


def silhouette(img: Image.Image) -> Image.Image:
    sil = Image.new("RGBA", img.size, (0, 0, 0, 0))
    black = Image.new("RGBA", img.size, (20, 20, 20, 255))
    sil.paste(black, mask=img.getchannel("A"))
    return sil


def qa_sheet(path: Path) -> list[str]:
    img = Image.open(path).convert("RGBA")
    bbox = img.getbbox()
    cropped = img.crop(bbox) if bbox else img

    # Layout: links Scale-Tests auf Gras, rechts Silhouette auf Weiss
    canvas = Image.new("RGB", (760, 340), (240, 240, 240))
    d = ImageDraw.Draw(canvas)

    grass_panel = Image.new("RGBA", (420, 300), GRASS + (255,))
    x = 30
    for s in SIZES:
        ratio = s / cropped.height
        small = cropped.resize((max(1, int(cropped.width * ratio)), s), Image.LANCZOS)
        grass_panel.alpha_composite(small, (x, 240 - s))
        x += small.width + 50
    canvas.paste(grass_panel.convert("RGB"), (20, 20))
    d.text((25, 322), f"Scale-Test {SIZES} px  |  {path.name}", fill=(30, 30, 30))

    sil = silhouette(cropped)
    ratio = 260 / sil.height
    sil_small = sil.resize((max(1, int(sil.width * ratio)), 260), Image.LANCZOS)
    white_panel = Image.new("RGBA", (280, 300), (255, 255, 255, 255))
    white_panel.alpha_composite(sil_small, ((280 - sil_small.width) // 2, 20))
    canvas.paste(white_panel.convert("RGB"), (460, 20))
    d.text((465, 322), "Silhouetten-Test", fill=(30, 30, 30))

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"{path.stem}_qa.png"
    canvas.save(out)

    warnings = alpha_check(img)
    return warnings


def main():
    files = collect_files(sys.argv[1:])
    if not files:
        print(__doc__)
        sys.exit(1)

    print(f"Pruefe {len(files)} Sprite(s)...\n")
    for f in files:
        warnings = qa_sheet(f)
        status = "OK " if not warnings else "PRUEFEN"
        print(f"[{status}] {f.name}")
        for w in warnings:
            print(f"         - {w}")
    print(f"\nPruefblaetter liegen in: {OUT_DIR.resolve()}")
    print("Manuelle Abnahme-Fragen pro Blatt:")
    print("  1. Einheit + Rolle bei 80px in unter 1 Sekunde erkennbar?")
    print("  2. Fraktionsfarbe dominiert (nicht Hautfarbe)?")
    print("  3. Silhouette eindeutig von allen anderen Einheiten unterscheidbar?")
    print("  4. Duenne helle Details (Sehnen, Riemen, Faeden) bei 80px noch sichtbar?")
    print("     Sonst dicker/dunkler bauen — Lehre Archer-Sehne 2026-07-12.")


if __name__ == "__main__":
    main()
