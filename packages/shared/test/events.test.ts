import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameConfig, EventDef } from '../src/types/gameConfig';
import {
  getEventDefinitions,
  getActiveEvent,
  isEventActive,
  getEventChallenge,
  isChallengeComplete,
  buildEventChallengeView,
} from '../src/game/events';

function cfg(events: EventDef[]): GameConfig {
  return { events: { definitions: events } } as unknown as GameConfig;
}

const summer: EventDef = {
  id: 'summer',
  name: 'Sommer',
  starts_at: '2026-06-01T00:00:00Z',
  ends_at: '2026-09-01T00:00:00Z',
  challenges: [
    { id: 'win5', name: '5 Siege', metric: 'battles_won', target: 5, reward: { gold: 2000, gems: 5 } },
    { id: 'd3', name: '3 Dungeons', metric: 'dungeons_cleared', target: 3, reward: { gems: 10 } },
  ],
};

test('getEventDefinitions: leer ohne Config', () => {
  assert.deepEqual(getEventDefinitions({} as unknown as GameConfig), []);
});

test('isEventActive: now im Fenster → true', () => {
  assert.ok(isEventActive(summer, new Date('2026-06-28T12:00:00Z')));
});

test('isEventActive: vor Start → false', () => {
  assert.ok(!isEventActive(summer, new Date('2026-05-31T23:59:59Z')));
});

test('isEventActive: exakt starts_at → true (inklusiv)', () => {
  assert.ok(isEventActive(summer, new Date('2026-06-01T00:00:00Z')));
});

test('isEventActive: exakt ends_at → false (exklusiv)', () => {
  assert.ok(!isEventActive(summer, new Date('2026-09-01T00:00:00Z')));
});

test('isEventActive: nach Ende → false', () => {
  assert.ok(!isEventActive(summer, new Date('2026-09-02T00:00:00Z')));
});

test('getActiveEvent: aktives Fenster → Event', () => {
  const ev = getActiveEvent(cfg([summer]), new Date('2026-07-01T00:00:00Z'));
  assert.ok(ev);
  assert.equal(ev.id, 'summer');
});

test('getActiveEvent: kein aktives Fenster → null', () => {
  assert.equal(getActiveEvent(cfg([summer]), new Date('2026-01-01T00:00:00Z')), null);
});

test('getActiveEvent: bei Überlappung gewinnt das erste', () => {
  const other: EventDef = { ...summer, id: 'other', name: 'Other' };
  const ev = getActiveEvent(cfg([summer, other]), new Date('2026-07-01T00:00:00Z'));
  assert.equal(ev!.id, 'summer');
});

test('getEventChallenge: bekannte/unbekannte ID', () => {
  assert.equal(getEventChallenge(summer, 'win5')?.target, 5);
  assert.equal(getEventChallenge(summer, 'nope'), undefined);
});

test('isChallengeComplete: value >= target', () => {
  assert.ok(isChallengeComplete(5, 5));
  assert.ok(isChallengeComplete(6, 5));
  assert.ok(!isChallengeComplete(4, 5));
});

test('buildEventChallengeView: complete + claimed + reward', () => {
  const def = getEventChallenge(summer, 'win5')!;
  const view = buildEventChallengeView(def, 7, false);
  assert.equal(view.value, 7);
  assert.equal(view.complete, true);
  assert.equal(view.claimed, false);
  assert.deepEqual(view.reward, { gold: 2000, gems: 5 });

  const claimedView = buildEventChallengeView(def, 2, true);
  assert.equal(claimedView.complete, false);
  assert.equal(claimedView.claimed, true);
});
