# Village Wars — Roadmap „CoC-Level und darüber hinaus"

> **Ziel (Nutzer, 2026-06-23):** Die App so weiterentwickeln, dass sie auf dem Niveau von
> Clash of Clans (CoC) oder höher spielt — eine **bessere und beliebtere** App. Prozess liegt
> beim Assistenten; Entscheidungen datengestützt. Diese Datei priorisiert das mehrstufige
> Programm; abgehakte Punkte sind in [STATUS.md](STATUS.md) im Detail dokumentiert.

## Datengrundlage (Web-Recherche 2026-06-23)
- **Erfolg von CoC = Core-Loop + Retention + Social.** Kurze, häufige Sessions (30 s Ressourcen
  abholen … <5 min Voll-Session mit Angriff), **Auto-Farming** (immer etwas abzuholen), Clans/
  Kriege/Spenden/Chat als sozialer Klebstoff, Leaderboards als Wettbewerb. (Deconstructor of Fun,
  GameAnalytics, gamedeveloper.com)
- **Retention-Treiber:** **Daily-Rewards + Streaks** (Verlustaversion/FOMO), **Quests/Daily-Tasks**,
  **Battle/Season-Pass**, **Limited-Time-Events**, **Achievements mit Belohnungen**, **Milestone-
  Unlocks** (gameplay-relevant, nicht nur kosmetisch). (designthegame, gamigion, gameanalytics)
- **Tiefe von CoC:** **Truppen-Level** (Labor-Forschung), **Helden** (Hero Hall), Super-Truppen,
  **Ziel-Prioritäten** (Riesen→Verteidigung, Goblins→Ressourcen), viele Gebäudestufen, Practice-Mode.
- **CoC-Kritik = unsere Chance:** P2W-Druck, harte Tageslimits, „lächerlich" lange Wartezeiten,
  unfaire Matchups, Updates die Monetarisierung über Balance stellen. (Quora, Metacritic, gottabemobile)

## Leitprinzipien (woraus wir Kapital schlagen)
1. **Fair statt P2W.** Monetarisierung bleibt **rein kosmetisch** (Goldbarren/Skins) — Goldbarren
   sind zusätzlich **verdienbar** (Achievements/Events). Das ist unser stärkstes Differenzierungs-
   merkmal gegenüber CoC-Kritik.
2. **Spielerzeit respektieren.** Großzügigere Belohnungen, keine harten „zahl-oder-warte"-Gates.
3. **Eiserne Regel.** ALLE Zahlen in `server/config/game-config.json`, nie hartcodiert.
4. **Qualitätsbar.** Jede Funktion: reine Logik in `shared` + Tests (`npm test`), Server-E2E
   (`npm run test:server`), 3× `tsc`, **Emulator-Verifikation** (STATUS §8).

## Gap-Analyse (Ist → CoC-Level)
| Bereich | Ist (Village Wars) | Lücke zu CoC-Level |
|---|---|---|
| Core-Loop | Ressourcen/Bau/Training/Kampf ✓ | Auto-Farming ok; **Retention-Haken fehlen komplett** |
| Retention | **keine** | Daily-Rewards, Streaks, Quests, Events, Season-Pass, Achievements |
| Progression-Tiefe | Gebäude-Level ✓; **Einheiten nur Stufe 1** | **Truppen-Level (Labor)**, **Helden**, Super-Truppen |
| Kampf-Tiefe | generisches „nächstes Gebäude" | **Ziel-Prioritäten**, Unit-Spezialfähigkeiten (deferred) |
| Social | Clans/Kriege/Burg/Ranglisten ✓ | **Clan-Chat**, Freundschaftskämpfe, Spenden-Anfragen |
| Onboarding | Dev-Login | **Tutorial/Onboarding**, Quest-geführter Einstieg |
| Monetarisierung | kosmetisch + IAP ✓ (fair!) | verdienbare Premium-Währung ausbauen (Events) |
| Grafik | prozedural (Skia) | Bild-Vorlagen je Rasse (STATUS §9, wartet auf Bilder) |

## Pillars (priorisiert nach Wirkung/Aufwand)
- [x] **P1 — Daily-Rewards + Login-Streak** ✅ (2026-06-27, Details STATUS §3 „Roadmap P1") — Config-Ladder
      (7 Tage, RH-skaliert), `decideStreak`-Logik, Migration 011, `/api/daily/*`, Daily-Reward-Popup. **Am Emulator
      verifiziert** (Popup → Claim → Streak 0→1 → Belohnung gecappt). 94 Shared + 68 Server-E2E grün.
- [x] **P2 — Achievements** ✅ (2026-06-27, STATUS §3 „P2") — 7 Achievements/23 Stufen, Metriken **live aus dem
      Spielstand** (kein Event-Tracking), verdienbare Goldbarren/Gems, Migration 012, `/api/achievements`,
      AchievementsScreen + Menü-Badge. **Am Emulator verifiziert** (Claim → 💎7/🥇10, Badge 5→4). 99 Shared + 76 Server-E2E.
- [x] **P3 — Truppen-Level (Labor/Forschung)** ✅ (2026-06-28, STATUS §3 „P3") — `research_lab` (TH3, `buildings_common`),
      per-Einheit-Levels (1–10), `getUnitCombatStats(level)` +8% HP/+7% DPS je Level, `researchService`, Migration 013,
      `/api/research`, ResearchScreen + Menü-Eintrag. **116 Shared + 85 Server-E2E grün; Emulator ✅ (2026-06-28).**
- [x] **P4 — Quests / Daily-Tasks** ✅ (2026-06-28) — 4 tägliche Mini-Ziele (Angriffe/Upgrade/Truppen/Forschung → Gold+Gems), Fortschrittsbalken + Claim, Fire-and-forget Inkrementierung in allen relevanten Services, Migration 014, QuestScreen + Menüpunkt. 125 Shared + 95 Server-E2E grün; Emulator ✅ (2026-06-28).
- [x] **P5 — Ziel-Prioritäten der Einheiten** ✅ (2026-06-28) — `unit_target_priorities` in Config (building_categories + unit_priorities), `BattleBuilding.category` + `BattleUnit.target_priority`, `priorityTarget()` in combat.ts ersetzt `nearestBuilding`. knight/shieldbearer/stone_giant→defense, berserker/blade_dancer→resource, battering_ram→wall. 137 Shared (+12 Targeting-Tests) + 95 E2E grün; Emulator ✅ (2026-06-28, Engine lief in Live-Kämpfen); keine Migration, kein API-Breaking-Change.
- [x] **P6 — Helden** ✅ (2026-06-28) — `hero_hall` (TH5, `buildings_common`), fraktionsspezifische Helden (alle 8), Level 1–10 (+6% HP/+5% DPS je Level), Level-Up-Queue (Gold+Zeit), Regen nach Kampf (regen_minutes_per_level × level), `heroService`, Migration 015, `/api/heroes`, HeroScreen + Menüpunkt. **Held kämpft im Kampf** (`heroCombatStats` → Engine, deploybar als „🦸 Name", nicht verbrauchbar, Regen nur bei Einsatz; dabei `loadHeroForBattle`-SQL-Bug gefixt der alle Kämpfe brach). 168 Shared (+31) + 107 Server-E2E (+12) grün; Emulator ✅ (2026-06-28).
- [x] **P7 — Season-/Battle-Pass** ✅ (2026-06-28) — `season_pass`-Config (12 Stufen, Gratis+Premium-Track, kumulative XP), an `seasons`-Tabelle gekoppelt; Pass-XP aus PvP-Sieg/Dungeon-Sieg/Quest-Claim (fire-and-forget); Premium mit Gems freischaltbar (verdienbar = fair); manueller Stufen-Claim (Ressourcen gekappt, Währungen nicht); Migration 016, `seasonPassService`, `/api/season-pass` (GET/unlock/claim), SeasonPassScreen + Menüpunkt. 182 Shared (+14) + 119 Server-E2E (+12) grün; Emulator ✅ (2026-06-28). _**Limited-Time-Events ✅ (2026-06-28, FERTIG + Emulator-verifiziert):** Config-Events mit starts_at/ends_at + Aufgaben (Fortschritt live seit Event-Start: battles_won/dungeons_cleared), `shared/game/events.ts`, Migration 020 `player_event_claims`, `eventService`, `/api/events` (GET/claim), EventScreen mit Countdown + Menüpunkt „🔥 Event" (nur bei aktivem Event, mit Badge). 208 Shared (+12) + 170 Server-E2E (+10) grün; Emulator ✅ (Sommer-Ansturm, win5 5/5 abgeholt → +5💎)._
- [x] **P8 — Onboarding/Tutorial** ✅ (2026-06-28) — quest-geführter Erststart: 5 geordnete Schritte (`welcome`/`build_first`/`train_army`/`first_battle`/`join_clan`), Fortschritt **live aus dem Spielstand** (wie P2, keine Event-Instrumentierung), strikt sequentielles Abholen je einmaliger Starthilfe-Belohnung (Ressourcen gekappt), Migration 017, `onboardingService`, `/api/onboarding` (GET/claim), OnboardingScreen + Menüpunkt „🎓 Erste Schritte" mit Badge. 196 Shared (+14) + 130 Server-E2E (+11) grün; Emulator ✅ (2026-06-28).
- [x] **P9 — Clan-Chat + Sozial-Ausbau** ✅ (2026-06-28, FERTIG + Emulator-verifiziert — alle 3 Slices) — **Clan-Chat ✅:** persistente Nachrichten je Clan (Migration 018 `clan_messages`), REST `GET/POST /api/clan/chat` (Mitglieds-Gate, neueste-zuerst paginiert), **Live-Broadcast via Socket-Room** `clan:<id>` (`clanchat:message`), Mobile Chat-Tab im ClanScreen (invertierte FlatList, eigene gold/rechts, Live-Listener `bindClanChatHandler`, id-Dedup). 196 Shared + 142 Server-E2E (+12) grün; Emulator ✅ (Live-Push zwischen 2 Mitgliedern bestätigt).
      **Spenden-Anfragen ✅ (2026-06-28, FERTIG + Emulator-verifiziert):** Truppen-Anfragen (Migration 019 `clan_donation_requests`, max. 1 offen/Spieler), `clanDonationService` (wiederverwendet `donateToCastle`; received atomar, Auto-fulfilled, Selbst-Spende gesperrt), REST `GET/POST/DELETE /api/clan/donations` + `/:id/donate`, Mobile Spenden-Bereich im Burg-Tab (anfordern/schließen + fremde Anfragen mit Armee-Spende-Chips). 156 Server-E2E (+14) grün; Emulator ✅ (Spende-Transfer emuclan→chatmate, Armee−/Burg+/received+ bestätigt).
      **Freundschaftskämpfe ✅ (2026-06-28, FERTIG + Emulator-verifiziert):** Übungskampf gegen Clan-Kameraden-Layout (Socket `friendly:challenge`, `BattleSession.friendly`, `finalizeBattle` ohne Loot/Trophäen/Verbrauch/Persistenz/Regen/XP), `BattleMode` +`'friendly'`, Mobile „⚔️ Üben"-Button je Mitglied + Übungskampf-Ergebnis-Overlay. 160 Server-E2E (+4) grün; Emulator ✅ (emuclan vs chatmate: 100% Sieg, Trophäen/Armee unverändert, keine battles-Zeile). **P9 damit komplett.**
- [~] **P10 — Grafik auf CoC-Niveau** *(Asset-Track AKTIV, parallel; Nutzer rendert in Unreal)*. Ziel-Ästhetik:
      **vorgerenderte isometrische 2D-Sprites** aus 3D-Modellen, **Toon-/Cel-Shading** + PBR (der CoC-Weg). **Render-Brief
      fertig:** [docs/ASSET-PIPELINE.md](ASSET-PIPELINE.md) (Kamera-Kalibrierung auf das 2:1-Tile der App, Format/Anker/
      Maßstab, Namensschema, Manifest, **Milestone „3 Test-Sprites" zuerst**). Start-Manifest:
      `apps/mobile/src/assets/factions/humans/manifest.json`. **Arbeitsteilung:** Nutzer/Artist rendert in Unreal;
      Assistent reaktiviert den (dormanten) `useImage`-Loader + Manifest-Pipeline + verifiziert am Emulator. Risikofrei:
      fehlt ein Sprite → scharfer Vektor-Fallback bleibt (schrittweise Migration je Gebäude).

> **Reihenfolge-Logik:** Erst billige, hochwirksame **Retention** (P1/P2/P4) → frühe Spielerbindung.
> Dann **Tiefe** (P3/P5/P6) → Langzeitmotivation. Dann **Events/Pass** (P7) → Wiederkehr-Rhythmus.
> Onboarding/Social/Grafik (P8–P10) runden ab. Jede Pillar ist ein vollständiger, getesteter,
> emulator-verifizierter Vertical-Slice.
