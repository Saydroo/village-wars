import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { GameConfig, OnboardingStepDef } from '../src/types/gameConfig';
import {
  getOnboardingSteps,
  getOnboardingStep,
  isStepComplete,
  activeStepIndex,
  buildOnboardingStepView,
} from '../src/game/onboarding';

/** Minimale GameConfig mit onboarding für Tests. */
function cfg(): GameConfig {
  return {
    onboarding: {
      steps: [
        { id: 'welcome', title: 'Willkommen', metric: 'none', target: 0, reward: { wood: 1000, gems: 5 } },
        { id: 'build_first', title: 'Bauen', metric: 'buildings_count', target: 2, reward: { gold: 500 } },
        { id: 'train_army', title: 'Armee', metric: 'army_size', target: 5, reward: { gold: 500, gems: 2 } },
        { id: 'first_battle', title: 'Kampf', metric: 'battles_won', target: 1, reward: { gold: 1000, gems: 5 } },
        { id: 'join_clan', title: 'Clan', metric: 'clan_member', target: 1, reward: { gems: 10 } },
      ] as OnboardingStepDef[],
    },
  } as unknown as GameConfig;
}

test('getOnboardingSteps gibt alle 5 Schritte in Reihenfolge zurück', () => {
  const steps = getOnboardingSteps(cfg());
  assert.equal(steps.length, 5);
  assert.equal(steps[0].id, 'welcome');
  assert.equal(steps[4].id, 'join_clan');
});

test('getOnboardingSteps: ohne onboarding-Config → leeres Array', () => {
  assert.deepEqual(getOnboardingSteps({} as unknown as GameConfig), []);
});

test('getOnboardingStep findet bekannte ID', () => {
  const step = getOnboardingStep(cfg(), 'train_army');
  assert.ok(step);
  assert.equal(step.metric, 'army_size');
  assert.equal(step.target, 5);
});

test('getOnboardingStep: unbekannte ID → undefined', () => {
  assert.equal(getOnboardingStep(cfg(), 'nope'), undefined);
});

test('isStepComplete: value >= target → true, sonst false', () => {
  assert.ok(isStepComplete(5, 5));
  assert.ok(isStepComplete(6, 5));
  assert.ok(!isStepComplete(4, 5));
});

test('isStepComplete: welcome (target 0) ist immer erfüllt', () => {
  assert.ok(isStepComplete(0, 0));
});

test('activeStepIndex: 0 abgeholt → Index 0', () => {
  const steps = getOnboardingSteps(cfg());
  assert.equal(activeStepIndex(steps, 0), 0);
});

test('activeStepIndex: 2 abgeholt → Index 2', () => {
  const steps = getOnboardingSteps(cfg());
  assert.equal(activeStepIndex(steps, 2), 2);
});

test('activeStepIndex: alle abgeholt → null', () => {
  const steps = getOnboardingSteps(cfg());
  assert.equal(activeStepIndex(steps, 5), null);
});

test('activeStepIndex: über-Anzahl (Defensive) → null', () => {
  const steps = getOnboardingSteps(cfg());
  assert.equal(activeStepIndex(steps, 99), null);
});

test('buildOnboardingStepView: aktiver, erfüllter Schritt', () => {
  const steps = getOnboardingSteps(cfg());
  // claimedSteps=1 → Index 1 (build_first) ist aktiv; value 3 >= target 2 → complete
  const view = buildOnboardingStepView(steps[1], 1, 3, 1);
  assert.equal(view.id, 'build_first');
  assert.equal(view.value, 3);
  assert.equal(view.complete, true);
  assert.equal(view.claimed, false);
  assert.equal(view.active, true);
});

test('buildOnboardingStepView: bereits abgeholter Schritt (claimed, nicht aktiv)', () => {
  const steps = getOnboardingSteps(cfg());
  // claimedSteps=2 → Index 0 ist abgeholt
  const view = buildOnboardingStepView(steps[0], 0, 0, 2);
  assert.equal(view.claimed, true);
  assert.equal(view.active, false);
});

test('buildOnboardingStepView: zukünftiger, nicht erfüllter Schritt', () => {
  const steps = getOnboardingSteps(cfg());
  // claimedSteps=0 → Index 3 ist weder aktiv noch abgeholt; value 0 < target 1
  const view = buildOnboardingStepView(steps[3], 3, 0, 0);
  assert.equal(view.claimed, false);
  assert.equal(view.active, false);
  assert.equal(view.complete, false);
});

test('buildOnboardingStepView reicht die Belohnung durch', () => {
  const steps = getOnboardingSteps(cfg());
  const view = buildOnboardingStepView(steps[0], 0, 0, 0);
  assert.deepEqual(view.reward, { wood: 1000, gems: 5 });
});
