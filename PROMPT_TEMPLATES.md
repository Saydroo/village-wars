# PROMPT_TEMPLATES.md – Einheiten-Prompts für Village-Wars

> Nutzung: Templates 1:1 an die Bild-Generierung übergeben.
> Platzhalter in {GESCHWEIFTEN KLAMMERN} ersetzen.
> Reihenfolge beachten: IMMER zuerst das Referenz-Sheet (Schritt A) generieren
> und absegnen lassen, DANN Posen (Schritt B) mit dem Sheet als Bildinput.

---

## 0. Basis-Stilblock (in JEDEN Prompt einfügen)

```
stylized mobile strategy game character, chibi proportions, 2.5 heads tall,
oversized head and hands, oversized weapon, short stubby legs, thick neck-less
build, flat cel shading with two shadow tones and one highlight, bold simple
color shapes, thick clean colored outlines, minimal texture detail, no patterns,
no realistic anatomy, no painterly rendering, friendly cartoon look similar to
top-down mobile strategy games, slightly elevated 3/4 camera angle (30 degrees
from above), full body, feet planted on one ground line, isolated on plain white
background, no ground shadow, character fills 85 percent of image height
```

Negativ-Prompt (falls das Tool einen unterstützt):

```
realistic proportions, seven heads tall, photorealistic, painterly, detailed
muscles, veins, tartan pattern, plaid, chainmail rings, individual fur strands,
fabric wrinkles, headband covering eyes, ground shadow, text, watermark,
cropped limbs
```

### Kurzfassung Basis-Stilblock (für 77-Token-Tools wie SD 1.5)

> Regel: Bei Tools mit 77-Token-Limit (CLIP schneidet den Rest ab) diese
> Kurzfassung verwenden und sie an den PROMPT-ANFANG stellen, danach erst das
> Einheiten-Template (ohne {BASIS-STILBLOCK}-Platzhalter). Stil-Keywords zuerst,
> damit sie garantiert wirken; Design-Details kommen primär aus der
> Bild-Geometrie (img2img/Referenz-Sheet).

```
flat cel shading game character, chibi, 2.5 heads tall, oversized head and
weapon, stubby legs, two shadow tones one highlight, thick clean colored
outlines, bold simple color shapes, friendly cartoon, full body, plain white
background
```

---

## 1. Menschen Königreich – Archer

### Schritt A: Referenz-Sheet (zuerst, nur einmal)

```
character reference sheet, four views side by side: front view, 3/4 view,
side view, back view, identical character in all views, neutral A-pose,

a stocky cheerful human archer of a woodland kingdom, {BASIS-STILBLOCK},

design: forest green hooded tunic (#4E8C3A) as the dominant color covering the
torso, green kilt, brown leather belt and simple brown boots (#7A5230), one
leather bracer on the LEFT forearm only, quiver on the back over the LEFT
shoulder, green headband worn ABOVE the eyebrows never covering the eyes,
short brown beard as one solid shape, big friendly eyes,

weapon: oversized simple wooden longbow, at least 60 percent of body height,
gold-colored arrow tips (#E8C547) as accent
```

### Schritt B: Posen (immer MIT Referenz-Sheet als Bildinput)

```
[Bildinput: menschen_archer_ref-sheet_v01.png]

same character as in the reference image, keep ALL equipment, colors and
proportions exactly identical to the reference,

pose: {POSE}, {BASIS-STILBLOCK}
```

Posen-Bibliothek für {POSE}:
- Idle: "relaxed standing pose, bow held loosely at the side, slight smile"
- Attack: "drawing the bow, arrow nocked, aiming slightly upward to the left,
  both eyes open and visible"
- Walk: "mid-stride walking pose, bow in left hand"
- Victory: "raising bow overhead with one arm, cheering"

---

## 2. Menschen Königreich – Militia

### Schritt A: Referenz-Sheet

```
character reference sheet, four views side by side: front view, 3/4 view,
side view, back view, identical character in all views, neutral A-pose,

a stocky brave human militia soldier of a woodland kingdom, {BASIS-STILBLOCK},

design: forest green padded gambeson vest (#4E8C3A) as the dominant color
covering the torso, red cloth sash around the waist as the unit's signature
accent, brown leather bracers on BOTH forearms, simple brown boots (#7A5230),
red headband worn ABOVE the eyebrows never covering the eyes, short dark beard
as one solid shape, big determined eyes,

weapons: oversized simple shortsword, blade as one clean gray shape with a
gold crossguard (#E8C547), round wooden shield with a plain green front and
ONE gold boss in the center, no spikes, no rivets pattern
```

> Hinweis: Der rote Lendenschurz + nackter Oberkörper aus v0.2 wurde bewusst
> ersetzt. Grund: Hautfarbe dominierte das Sprite, Fraktionszugehörigkeit war
> bei 80 px nicht erkennbar. Rot bleibt als Schärpe/Stirnband erhalten, damit
> die Einheit ihren Charakter behält.

### Schritt B: Posen (immer MIT Referenz-Sheet als Bildinput)

Gleiches Schema wie beim Archer. Posen-Bibliothek:
- Idle: "standing guard, sword resting on shoulder, shield at the side"
- Attack: "swinging the sword overhead, shield raised in front, wide stance"
- Walk: "mid-stride marching pose, sword lowered, shield forward"
- Victory: "sword raised to the sky, shield lifted, cheering"

---

## 3. Template für neue Einheiten (Kopiervorlage)

```
character reference sheet, four views side by side: front view, 3/4 view,
side view, back view, identical character in all views, neutral A-pose,

a {KÖRPERBAU} {FRAKTIONSVOLK} {ROLLE}, {BASIS-STILBLOCK},

design: {PRIMÄRFARBE-HEX} {HAUPTKLEIDUNGSSTÜCK} as the dominant color covering
the torso, {SEKUNDÄR-DETAILS mit Hex}, {KOPFBEDECKUNG} worn ABOVE the eyebrows
never covering the eyes, {GESICHTSMERKMAL} as one solid shape,

weapon: oversized {WAFFE}, at least 60 percent of body height,
{AKZENTFARBE-HEX} details as accent
```

Regeln beim Ausfüllen:
1. Fraktions-Farben IMMER aus der Tabelle in ART_STYLE.md nehmen
2. Genau EIN Signatur-Accessoire pro Einheit (Schärpe, Feder, Hornhelm),
   nicht drei
3. Ausrüstung eindeutig festlegen (welcher Arm, welche Seite), sonst würfelt
   die KI bei jeder Generierung neu
```
