"""
Material-/Stil-Tiers für die Menschen-Gebäude (Village Wars), inspiriert von der
Clash-of-Clans-Town-Hall-Progression. ALLE Gebäude teilen pro Tier dasselbe Thema,
sodass ein Dorf auf einem Ausbaustand visuell konsistent wirkt.

Tier 1 (Lv 1-3)   Holz/baufällig  — schiefes Strohdach, raues Holz, kein Gold
Tier 2 (Lv 4-6)   Stein+Holz      — begradigt, Ziegeldach, erste Steinrahmen
Tier 3 (Lv 7-9)   Sandstein-Burg  — Zinnen, blaue Schindeldächer, Gold, Türme
Tier 4 (Lv 10-12) Edel/Marmor     — heller Stein, viel Gold, prächtiger, mehr Türme
Tier 5 (Lv 13-15) Magie/Episch    — Marmor, violette Dächer, Gold, Magie-Kristalle
"""

# Farben als (r,g,b) 0..1, plus Stil-Flags je Tier.
THEMES = {
    1: {
        "label": "Holz",
        "wall":   (0.60, 0.44, 0.27), "wall_l": (0.70, 0.53, 0.34), "wall_d": (0.44, 0.31, 0.18),
        "roof":   (0.74, 0.46, 0.22), "roof_d": (0.55, 0.32, 0.15),   # orange Stroh/Schindel
        "wood":   (0.40, 0.27, 0.15), "wood_d": (0.27, 0.17, 0.09),
        "accent": (0.52, 0.40, 0.24),                                  # Holz statt Gold
        "window": (0.98, 0.80, 0.42), "ground": (0.40, 0.58, 0.24), "ground_d": (0.31, 0.47, 0.18),
        "roof_style": "thatch", "battlements": False, "towers": 0,
        "gold": False, "magic": False, "decay": 0.55, "scale": 0.82,
    },
    2: {
        "label": "Stein+Holz",
        "wall":   (0.66, 0.62, 0.55), "wall_l": (0.76, 0.72, 0.64), "wall_d": (0.48, 0.45, 0.39),
        "roof":   (0.66, 0.27, 0.20), "roof_d": (0.48, 0.18, 0.13),   # rotes Ziegeldach
        "wood":   (0.42, 0.28, 0.15), "wood_d": (0.29, 0.18, 0.09),
        "accent": (0.55, 0.52, 0.45),
        "window": (1.0, 0.82, 0.44), "ground": (0.40, 0.59, 0.24), "ground_d": (0.31, 0.48, 0.18),
        "roof_style": "tile", "battlements": False, "towers": 0,
        "gold": False, "magic": False, "decay": 0.12, "scale": 0.9,
    },
    3: {
        "label": "Sandstein-Burg",
        "wall":   (0.74, 0.66, 0.52), "wall_l": (0.84, 0.77, 0.62), "wall_d": (0.52, 0.44, 0.33),
        "roof":   (0.18, 0.40, 0.84), "roof_d": (0.11, 0.26, 0.60),   # royalblau
        "wood":   (0.46, 0.29, 0.15), "wood_d": (0.30, 0.18, 0.09),
        "accent": (0.97, 0.74, 0.19),                                  # Gold
        "window": (1.0, 0.84, 0.42), "ground": (0.40, 0.60, 0.25), "ground_d": (0.31, 0.49, 0.18),
        "roof_style": "hip", "battlements": True, "towers": 2,
        "gold": True, "magic": False, "decay": 0.0, "scale": 1.0,
    },
    4: {
        "label": "Edel/Marmor",
        "wall":   (0.86, 0.83, 0.78), "wall_l": (0.93, 0.91, 0.87), "wall_d": (0.66, 0.62, 0.56),
        "roof":   (0.16, 0.44, 0.80), "roof_d": (0.10, 0.28, 0.56),
        "wood":   (0.40, 0.26, 0.14), "wood_d": (0.27, 0.16, 0.08),
        "accent": (1.0, 0.78, 0.22),
        "window": (1.0, 0.86, 0.46), "ground": (0.40, 0.60, 0.25), "ground_d": (0.31, 0.49, 0.18),
        "roof_style": "hip", "battlements": True, "towers": 4,
        "gold": True, "magic": False, "decay": 0.0, "scale": 1.08,
    },
    5: {
        "label": "Magie/Episch",
        "wall":   (0.90, 0.90, 0.96), "wall_l": (0.97, 0.97, 1.0), "wall_d": (0.66, 0.66, 0.78),
        "roof":   (0.46, 0.24, 0.78), "roof_d": (0.30, 0.13, 0.55),   # violett
        "wood":   (0.38, 0.30, 0.20), "wood_d": (0.26, 0.20, 0.13),
        "accent": (1.0, 0.80, 0.24),
        "window": (0.62, 0.85, 1.0), "ground": (0.40, 0.60, 0.25), "ground_d": (0.31, 0.49, 0.18),
        "roof_style": "spire", "battlements": True, "towers": 4,
        "gold": True, "magic": True, "decay": 0.0, "scale": 1.14,
    },
}


def tier_for_level(level):
    """Mappt Gebäude-Level 1..15 auf Material-Tier 1..5 (je 3 Level)."""
    return min(5, (max(1, level) - 1) // 3 + 1)
