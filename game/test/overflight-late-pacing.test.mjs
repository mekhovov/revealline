import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createOverflightProject, compileOverflightProject } from '../overflight/project.mjs';
import {
  createOverflightRiyProject,
  compileOverflightRiyProject,
  upgradeOverflightRiyProjectCopy,
} from '../overflight/riy-project.mjs';
import { upgradeOverflightProjectCopy } from '../overflight/project-upgrade.mjs';
import { OVERFLIGHT_BATTLEFIELDS } from '../overflight/battlefields.mjs';
const prior = JSON.parse(
  gunzipSync(
    readFileSync(new URL('./fixtures/overflight-previous-v4-pacing.json.gz', import.meta.url)),
  ),
);
const thresholds = [12, 45, 100, 180, 300, 480, 700, 1000, 1250, 1550];
for (const [mode, create, compile, upgrade] of [
  ['survivor', createOverflightProject, compileOverflightProject, upgradeOverflightProjectCopy],
  ['riy', createOverflightRiyProject, compileOverflightRiyProject, upgradeOverflightRiyProjectCopy],
]) {
  test(`${mode}: new V4 sorties shorten only the last two choices and identify the balance revision`, () => {
    const old = prior.rows.find((row) => row.mode === mode);
    for (const { id: layout } of OVERFLIGHT_BATTLEFIELDS)
      for (const difficulty of ['relaxed', 'standard', 'veteran']) {
        const current = create({ rulesVersion: 4, seed: 202604, layout, difficulty });
        assert.deepEqual(compile(current).upgrades.thresholds, thresholds);
        assert.equal(current.balanceRevision, 'overflight-balance.v4.late-choice-1');
      }
    const source = create({
      rulesVersion: 4,
      seed: 202604,
      layout: 'relay-ruins-receiver-gardens',
    });
    const normalized = structuredClone(source);
    normalized.balanceRevision = old.project.balanceRevision;
    normalized.upgrades.thresholds = [...old.project.upgrades.thresholds];
    assert.deepEqual(
      normalized,
      old.project,
      'weapons, enemy budgets, resources, opening and world remain unchanged',
    );
    assert.notEqual(compile(source).projectIdentity, old.projectIdentity);
    assert.equal(compile(source).visualIdentity, old.visualIdentity);
  });
  test(`${mode}: previous authored/imported V4 projects retain exact rules and identity`, () => {
    const old = prior.rows.find((row) => row.mode === mode),
      saved = JSON.stringify(old.project),
      compiled = compile(old.project);
    assert.equal(compiled.projectIdentity, old.projectIdentity);
    assert.equal(compiled.visualIdentity, old.visualIdentity);
    assert.equal(compiled.balanceRevision, 'overflight-balance.v4');
    assert.deepEqual(compiled.upgrades.thresholds, old.project.upgrades.thresholds);
    assert.equal(compile(JSON.parse(saved)).projectIdentity, old.projectIdentity);
    assert.equal(JSON.stringify(old.project), saved);
    const copy = upgrade(old.project, { rulesVersion: 4 });
    assert.deepEqual(copy.upgrades.thresholds, old.project.upgrades.thresholds);
    const invalid = JSON.parse(saved);
    invalid.balanceRevision = 'overflight-balance.unrecognized';
    assert.throws(() => compile(invalid), /balance revision/);
  });
  test(`${mode}: old and new balance records survive a mixed-profile reopen`, async () => {
    const { createOverflightRecords, OVERFLIGHT_RECORDS_FORMAT } = await import(
      '../overflight/records.mjs'
    );
    const old = prior.rows.find((row) => row.mode === mode);
    const next = create({ rulesVersion: 4, seed: 202604, layout: 'relay-ruins-receiver-gardens' });
    const run = (source, time) => ({
      compiled: compile(source),
      seed: 202604,
      airframes: 3,
      slowResume: true,
      phase: 'won',
      time,
      stats: { kills: 1000, damageTaken: 20, airframesLost: 0, damageCauses: { contact: 20 } },
      progression: { history: [] },
    });
    let saved = { format: OVERFLIGHT_RECORDS_FORMAT, entries: {} };
    const backend = {
      read: async () => structuredClone(saved),
      update: async (fn) => {
        saved = fn(structuredClone(saved));
        return structuredClone(saved);
      },
    };
    const records = createOverflightRecords({ backend });
    assert.equal((await records.record(run(old.project, 250))).durable, true);
    assert.equal((await records.read(run(next, 300))).bestScore, null);
    assert.equal((await records.record(run(next, 300))).durable, true);
    records.dispose();
    const reopened = createOverflightRecords({ backend });
    assert.equal((await reopened.read(run(old.project, 250))).fastestClear.time, 250);
    assert.equal((await reopened.read(run(next, 300))).fastestClear.time, 300);
    assert.equal(Object.keys(saved.entries).length, 2);
    reopened.dispose();
  });
}
