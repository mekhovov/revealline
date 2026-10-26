import test from 'node:test';
import assert from 'node:assert/strict';
import { dataIdentity } from '../data-json.mjs';
import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import { upgradeOverflightProjectCopy } from '../overflight/project-upgrade.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
  upgradeOverflightRiyProjectCopy,
} from '../overflight/riy-project.mjs';
import {
  createOverflightRecords,
  OVERFLIGHT_RECORDS_FORMAT,
  overflightRecordContext,
} from '../overflight/records.mjs';

const oldThresholds = [12, 45, 100, 180, 300, 480, 750, 1150, 1750, 2400];
const worldThresholds = [12, 45, 100, 180, 300, 480, 700, 1000, 1400, 1900];
const battlefieldThresholds = [...worldThresholds.slice(0, 8), 1250, 1550];
const modes = [
  ['Survivor', createOverflightProject, compileOverflightProject, upgradeOverflightProjectCopy],
  ['Riy', createOverflightRiyProject, compileOverflightRiyProject, upgradeOverflightRiyProjectCopy],
];

for (const [name, create, compile, upgrade] of modes) {
  test(`${name} built-in battlefields retain the opening and shorten only the last two choices`, () => {
    for (const { id: layout, world } of OVERFLIGHT_BATTLEFIELDS) {
      const intended = create({ rulesVersion: 3, world });
      assert.deepEqual(intended.upgrades.thresholds, worldThresholds);
      for (const difficulty of ['relaxed', 'standard', 'veteran']) {
        const project = create({ rulesVersion: 4, layout, difficulty });
        const compiled = compile(project);
        assert.deepEqual(compiled.upgrades.thresholds, battlefieldThresholds, layout);
        assert.deepEqual(
          compiled.upgrades.thresholds.slice(0, 8),
          intended.upgrades.thresholds.slice(0, 8),
        );
        assert.deepEqual(compiled.upgrades.thresholds.slice(0, 6), oldThresholds.slice(0, 6));
      }
    }
  });

  test(`${name} legacy and explicit authored progression survive compile/import and upgraded copies`, () => {
    for (const rulesVersion of [1, 2, 3])
      assert.deepEqual(create({ rulesVersion }).upgrades.thresholds, oldThresholds);
    for (const thresholds of [oldThresholds, [9, 40, 90, 170, 290, 470, 720, 1100, 1700, 2300]]) {
      for (const rulesVersion of [3, 4]) {
        const project = create({ rulesVersion });
        project.upgrades.thresholds = [...thresholds];
        const before = JSON.stringify(project);
        const compiled = compile(project);
        const imported = compile(JSON.parse(before));
        assert.deepEqual(imported.upgrades.thresholds, thresholds);
        assert.equal(imported.projectIdentity, compiled.projectIdentity);
        const copy = upgrade(project, { rulesVersion: 4 });
        assert.deepEqual(compile(copy).upgrades.thresholds, thresholds);
        assert.equal(JSON.stringify(project), before, 'Authoring source must remain unchanged.');
      }
    }
  });

  test(`${name} revised thresholds partition durable V4 records without changing visual identity`, async () => {
    const project = create({ rulesVersion: 4, layout: 'freight-depot-loading-loop' });
    const previous = structuredClone(project);
    previous.upgrades.thresholds = [...oldThresholds];
    const currentCompiled = compile(project),
      previousCompiled = compile(previous);
    assert.notEqual(currentCompiled.projectIdentity, previousCompiled.projectIdentity);
    assert.equal(currentCompiled.visualIdentity, previousCompiled.visualIdentity);
    assert.equal(currentCompiled.balanceRevision, previousCompiled.balanceRevision);
    const run = (compiled) => ({
      compiled,
      seed: 101303,
      airframes: 3,
      slowResume: true,
      phase: 'won',
      time: 350,
      stats: {
        kills: 1000,
        damageTaken: 20,
        airframesLost: 0,
        damageCauses: { contact: 20 },
      },
      progression: { history: [{ id: 'primary:double:4' }] },
    });
    assert.notEqual(
      dataIdentity(overflightRecordContext(run(currentCompiled))),
      dataIdentity(overflightRecordContext(run(previousCompiled))),
    );
    let saved = { format: OVERFLIGHT_RECORDS_FORMAT, entries: {} };
    const backend = {
      read: async () => structuredClone(saved),
      update: async (fn) => {
        saved = fn(structuredClone(saved));
        return structuredClone(saved);
      },
    };
    const records = createOverflightRecords({ backend });
    assert.equal((await records.record(run(previousCompiled))).durable, true);
    assert.equal((await records.read(run(currentCompiled))).bestScore, null);
    assert.equal((await records.record(run(currentCompiled))).durable, true);
    records.dispose();
    const reopened = createOverflightRecords({ backend });
    for (const compiled of [currentCompiled, previousCompiled]) {
      const record = await reopened.read(run(compiled));
      assert.equal(record.durable, true);
      assert.equal(record.bestScore.kills, 1000);
    }
    assert.equal(Object.keys(saved.entries).length, 2);
  });
}
