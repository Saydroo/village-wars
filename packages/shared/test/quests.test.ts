import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameConfig } from '../src/types/gameConfig';
import { getQuestDefinitions, getQuestDef, isQuestComplete } from '../src/game/quests';

/** Minimale GameConfig mit daily_quests für Tests. */
function cfg(): GameConfig {
  return {
    daily_quests: {
      definitions: [
        { id: 'attack_3', name: 'Angreifer', description: '3 Kämpfe', type: 'attacks', target: 3, reward_gold: 500, reward_gems: 0 },
        { id: 'upgrade_1', name: 'Baumeister', description: '1 Upgrade', type: 'upgrades', target: 1, reward_gold: 300, reward_gems: 0 },
        { id: 'train_10', name: 'Ausbilder', description: '10 Truppen', type: 'troops_trained', target: 10, reward_gold: 200, reward_gems: 1 },
        { id: 'research_start', name: 'Wissenschaftler', description: '1 Forschung', type: 'researches', target: 1, reward_gold: 0, reward_gems: 2 },
      ],
    },
  } as unknown as GameConfig;
}

test('getQuestDefinitions gibt alle 4 Definitionen zurück', () => {
  assert.equal(getQuestDefinitions(cfg()).length, 4);
});

test('getQuestDef findet bekannte ID', () => {
  const def = getQuestDef(cfg(), 'attack_3');
  assert.ok(def);
  assert.equal(def.type, 'attacks');
  assert.equal(def.target, 3);
});

test('getQuestDef gibt undefined für unbekannte ID', () => {
  assert.equal(getQuestDef(cfg(), 'unbekannt'), undefined);
});

test('isQuestComplete: progress === target → true', () => {
  const def = getQuestDef(cfg(), 'upgrade_1')!;
  assert.ok(isQuestComplete(def, 1));
});

test('isQuestComplete: progress > target → true', () => {
  const def = getQuestDef(cfg(), 'upgrade_1')!;
  assert.ok(isQuestComplete(def, 5));
});

test('isQuestComplete: progress < target → false', () => {
  const def = getQuestDef(cfg(), 'attack_3')!;
  assert.ok(!isQuestComplete(def, 2));
});

test('isQuestComplete: progress = 0 → false', () => {
  const def = getQuestDef(cfg(), 'train_10')!;
  assert.ok(!isQuestComplete(def, 0));
});

test('Alle Quest-Types sind eindeutig', () => {
  const types = getQuestDefinitions(cfg()).map((d) => d.type);
  const unique = new Set(types);
  assert.equal(unique.size, types.length, 'Jeder Quest-Type darf nur einmal vorkommen');
});

test('Alle Quests haben positives target', () => {
  for (const def of getQuestDefinitions(cfg())) {
    assert.ok(def.target > 0, `${def.id}: target muss > 0 sein`);
  }
});
