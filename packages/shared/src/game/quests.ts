import type { GameConfig, DailyQuestDef, QuestType } from '../types/gameConfig';

/** Alle Quest-Definitionen aus der Config. */
export function getQuestDefinitions(config: GameConfig): DailyQuestDef[] {
  return config.daily_quests.definitions;
}

/** Eine Quest-Definition nach ID suchen. */
export function getQuestDef(config: GameConfig, questId: string): DailyQuestDef | undefined {
  return config.daily_quests.definitions.find((d) => d.id === questId);
}

/** Ist eine Quest abgeschlossen (progress >= target)? */
export function isQuestComplete(def: DailyQuestDef, progress: number): boolean {
  return progress >= def.target;
}

/** Welcher QuestType wird durch eine Spieleraktion erhöht? */
export function questTypeForAction(action: QuestType): QuestType {
  return action;
}
