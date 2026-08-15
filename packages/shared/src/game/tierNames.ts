/**
 * Tier-Namen pro Level (Abschnitt 13). Index 0 = Level 1. Rein kosmetisch,
 * für Info-Dialoge. Nicht alle Typen sind im Briefing benannt — fehlt ein
 * Eintrag, gibt tierName() null zurück und die UI nutzt den Standardnamen.
 */
export const TIER_NAMES: Record<string, string[]> = {
  town_hall: [
    'Holzhütte',
    'Kleines Rathaus',
    'Stadthaus',
    'Befestigtes Rathaus',
    'Festungsrathaus',
    'Adelspalast',
    'Kriegsburg',
    'Kaiserburg',
    'Legendäre Zitadelle',
    'Göttliche Hauptstadt',
  ],
  watchtower: [
    'Wachposten',
    'Holzturm',
    'Steinturm',
    'Wächterturm',
    'Kanonenturm',
    'Arcanaturm',
    'Kristallturm',
    'Legendärer Turm',
  ],
  wall: [
    'Holzzaun',
    'Steinmauer',
    'Verstärkte Mauer',
    'Festungsmauer',
    'Stachelmauer',
    'Runenmauer',
    'Kristallmauer',
    'Feuermauer',
    'Schattenmauer',
    'Titanmauer',
  ],
  militia: ['Dorfbewohner', 'Milizionär', 'Infanterist', 'Veteran', 'Elite-Krieger', 'Legendärer Held'],
  knight: ['Knappe', 'Ritter', 'Gepanzerter Ritter', 'Ordensritter', 'Legendärer Champion'],
};

export function tierName(type: string, level: number): string | null {
  const names = TIER_NAMES[type];
  if (!names) return null;
  return names[level - 1] ?? null;
}
