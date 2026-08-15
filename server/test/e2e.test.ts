import { before, after } from 'node:test';
import { globalSetup, globalTeardown } from './harness';

/**
 * Einziger Einstiegspunkt der Server-E2E-Suite. Läuft in EINEM Prozess (Node startet
 * pro Testdatei sonst einen eigenen Prozess) und bündelt alle Suiten — so wird die
 * Test-DB genau einmal angelegt/gebootet. Die `*.suite.ts`-Module registrieren beim
 * Import ihre Tests; `before`/`after` umklammern sie mit Setup/Teardown.
 */

before(globalSetup);
after(globalTeardown);

import './suites/auth.suite';
import './suites/village.suite';
import './suites/units.suite';
import './suites/clan.suite';
import './suites/dungeon.suite';
import './suites/shop.suite';
import './suites/errors.suite';
import './suites/battle.suite';
import './suites/clanwar.suite';
import './suites/daily.suite';
import './suites/achievements.suite';
import './suites/research.suite';
import './suites/quests.suite';
import './suites/heroes.suite';
import './suites/seasonPass.suite';
import './suites/onboarding.suite';
import './suites/clanChat.suite';
import './suites/clanDonations.suite';
import './suites/friendly.suite';
import './suites/events.suite';
