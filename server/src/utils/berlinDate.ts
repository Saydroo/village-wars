/**
 * Aktueller Europe/Berlin-Kalendertag als YYYY-MM-DD (DST-korrekt via Intl).
 * Genutzt für tägliche Mechaniken (Daily-Rewards), konsistent mit dem
 * Berlin-Zeitfenster des Dungeons.
 */
export function berlinDateString(now: Date = new Date()): string {
  // en-CA formatiert als YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
