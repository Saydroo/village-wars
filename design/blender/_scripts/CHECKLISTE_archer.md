# Checkliste — Archer (Menschen Königreich)

Offene, **nicht blockierende** Feinschliff-Punkte am freigegebenen Kopf
(Kopf abgenommen am 2026-07-07). Bewusst zurückgestellt, beim nächsten
Kopf-/Sheet-Durchgang mitnehmen — kein Blocker für das v06-Sheet.

- [ ] **Feder-Ansatz etwas höher setzen.** Der Basispunkt der Goldfeder sitzt
      aktuell leicht zu tief an der Kapuze; Ansatz um ein Stück nach oben
      wandern lassen (in `unit_sheet_archer.py`: `fbase`-Phi bzw. z-Anteil des
      Ellipsoid-Ansatzpunkts anheben, Feder-Asserts bleiben gültig).
- [ ] **Kinnbart: leichte Fleckigkeit an der Unterkante glätten.** Der
      Kinnbart wirkt an der unteren Kante etwas fleckig (ungleichmäßiges
      Shading / Bart-Maskenrand). Materialübergang oder Maskenkante am unteren
      Bartrand vergleichmäßigen.

---
Erledigte/abgenommene Punkte am Kopf: Decal-Mund (glatte Fläche, dünne dunkle
Lächel-Linie), gerade Goldfeder mit Assert, geschlossene Kapuze ohne sichtbare
Kopfhaut, Schnauzer entfernt, Kinnbart zu den Mundwinkeln offen.
