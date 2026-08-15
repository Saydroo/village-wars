import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getResearchCost,
  researchHpMultiplier,
  researchDpsMultiplier,
  getUnitLevel,
  hasResearchLab,
  getUnitCombatStats,
} from '../src/index';
import { cfg } from './helpers';

/**
 * Tests für Roadmap P3: Truppen-Level-Forschung.
 * Alle Erwartungen werden aus der Config abgeleitet (kein Hartcodieren).
 */

describe('Research — Kost- und Zeitberechnung', () => {
  it('Level 2 hat einen definierten Kosten-Eintrag', () => {
    const cost = getResearchCost(cfg, 2);
    assert.ok(cost !== null, 'Level-2-Kosten müssen vorhanden sein');
    assert.ok(cost!.gold > 0, 'Gold-Kosten > 0');
    assert.ok(cost!.minutes > 0, 'Zeit > 0');
  });

  it('Level 1 hat KEINEN Kosten-Eintrag (Startlevel)', () => {
    const cost = getResearchCost(cfg, 1);
    assert.equal(cost, null);
  });

  it('Kosten steigen monoton mit dem Level', () => {
    let prevGold = 0;
    for (const entry of cfg.unit_research.level_costs) {
      assert.ok(
        entry.gold > prevGold,
        `Level ${entry.to_level}: Goldkosten ${entry.gold} muss > ${prevGold} sein`,
      );
      prevGold = entry.gold;
    }
  });

  it('Alle Einträge decken Level 2..max_level ab', () => {
    const levels = cfg.unit_research.level_costs.map((c) => c.to_level);
    for (let l = 2; l <= cfg.unit_research.max_level; l++) {
      assert.ok(levels.includes(l), `Level ${l} fehlt in level_costs`);
    }
  });
});

describe('Research — HP/DPS-Multiplikatoren', () => {
  const hpPct = cfg.unit_research.hp_bonus_per_level_percent;
  const dpsPct = cfg.unit_research.dps_bonus_per_level_percent;

  it('Level 1 → kein Bonus (Multiplikator = 1.0)', () => {
    assert.equal(researchHpMultiplier(cfg, 1), 1);
    assert.equal(researchDpsMultiplier(cfg, 1), 1);
  });

  it('Level 2 → korrekter Bonus aus Config', () => {
    const expectedHp = 1 + hpPct / 100;
    const expectedDps = 1 + dpsPct / 100;
    assert.ok(
      Math.abs(researchHpMultiplier(cfg, 2) - expectedHp) < 1e-9,
      `HP-Multiplikator Lvl 2 erwartet ${expectedHp}`,
    );
    assert.ok(
      Math.abs(researchDpsMultiplier(cfg, 2) - expectedDps) < 1e-9,
      `DPS-Multiplikator Lvl 2 erwartet ${expectedDps}`,
    );
  });

  it('Level 5 → 4× Bonus kumuliert (linear)', () => {
    const expectedHp = 1 + (4 * hpPct) / 100;
    assert.ok(Math.abs(researchHpMultiplier(cfg, 5) - expectedHp) < 1e-9);
  });

  it('Level 0 oder negativ → kein Bonus (Schutz gegen Fehldaten)', () => {
    assert.equal(researchHpMultiplier(cfg, 0), 1);
    assert.equal(researchDpsMultiplier(cfg, -1), 1);
  });
});

describe('Research — getUnitLevel Helper', () => {
  it('fehlende Einheit → Level 1 (Standard)', () => {
    assert.equal(getUnitLevel({}, 'militia'), 1);
    assert.equal(getUnitLevel(undefined, 'archer'), 1);
  });

  it('vorhandene Einheit → gespeichertes Level', () => {
    assert.equal(getUnitLevel({ militia: 3 }, 'militia'), 3);
  });
});

describe('Research — hasResearchLab', () => {
  it('kein Gebäude → false', () => {
    assert.equal(hasResearchLab([]), false);
  });

  it('research_lab Level 0 (Baustelle) → false', () => {
    assert.equal(hasResearchLab([{ type: 'research_lab', level: 0 }]), false);
  });

  it('research_lab Level 1 → true', () => {
    assert.equal(hasResearchLab([{ type: 'research_lab', level: 1 }]), true);
  });

  it('anderes Gebäude → false', () => {
    assert.equal(hasResearchLab([{ type: 'barracks', level: 3 }]), false);
  });
});

describe('Research — getUnitCombatStats mit Level', () => {
  it('Level 1 → identisch zu getUnitCombatStats ohne Level-Param', () => {
    const base = getUnitCombatStats(cfg, 'militia', 'humans', 1);
    const noLevel = getUnitCombatStats(cfg, 'militia', 'humans');
    assert.ok(base && noLevel);
    assert.ok(Math.abs(base.hp - noLevel.hp) < 1e-6);
    assert.ok(Math.abs(base.dps - noLevel.dps) < 1e-6);
  });

  it('Level 5 → HP und DPS boosted nach Config-Prozentsätzen', () => {
    const base = getUnitCombatStats(cfg, 'militia', 'humans', 1)!;
    const boosted = getUnitCombatStats(cfg, 'militia', 'humans', 5)!;
    const hpMul = researchHpMultiplier(cfg, 5);
    const dpsMul = researchDpsMultiplier(cfg, 5);
    assert.ok(Math.abs(boosted.hp - base.hp * hpMul) < 1e-6, 'HP stimmt nicht');
    assert.ok(Math.abs(boosted.dps - base.dps * dpsMul) < 1e-6, 'DPS stimmt nicht');
  });

  it('Fraktions-Modifikatoren UND Research-Level kombinieren sich korrekt', () => {
    // Drachenmenschen: +20% Fernkampfschaden; Bogenschütze Level 3
    const base = getUnitCombatStats(cfg, 'archer', 'dragonfolk', 1)!;
    const lvl3 = getUnitCombatStats(cfg, 'archer', 'dragonfolk', 3)!;
    const dpsMul = researchDpsMultiplier(cfg, 3);
    assert.ok(Math.abs(lvl3.dps - base.dps * dpsMul) < 1e-6, 'Fraktions-Mod + Research korrekt');
  });
});
