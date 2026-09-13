import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  validateProductionRegister,
  summarizeProduction,
  inspectProductionSlot,
} from '../authoring/production/model.mjs';
import { verifyProductionSources } from '../authoring/production/sources.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = async (name) => JSON.parse(await readFile(new URL(name, import.meta.url), 'utf8'));
const baseline = await read('../authoring/production/register.json');
const candidate = await read('../authoring/production/register-sentinel-themes.json');
const clone = (value) => JSON.parse(JSON.stringify(value));
const newWorks = (value) => value.works.filter((w) => w.adapter === 'sentinel-world');

test('nine Sentinel themes append exact owners without changing old works, reviews or geometry totals', () => {
  const valid = validateProductionRegister(candidate, { previous: baseline });
  const summary = summarizeProduction(valid);
  assert.equal(summary.uniquePictureWorks, 36);
  assert.equal(summary.domains.picture.missing, 80);
  assert.deepEqual(summary.maps, { target: 29, proposed: 9, approved: 0, unassigned: 20 });
  assert.equal(
    summary.missingPictureSlots.some((id) => id.includes('sentinel')),
    false,
  );
  assert.equal(summary.domains.picture.stages.produced, 36);
  assert.equal(summary.domains.picture.stages.released, 0);
  assert.deepEqual(candidate.assessments, baseline.assessments);
  assert.deepEqual(candidate.deliveries, baseline.deliveries);
  for (const old of baseline.works)
    assert.deepEqual(
      candidate.works.find((w) => w.id === old.id && w.revision === old.revision),
      old,
    );
  for (const mapId of ['sentinel-listening', 'sentinel-switchyard', 'sentinel-circuit']) {
    const layout = candidate.layouts.find((l) => l.id === `${mapId}-four-themes`);
    assert.equal(layout.variantOf, mapId);
    assert.equal(layout.owners.length, 4);
    assert.deepEqual(layout.owners[0], baseline.layouts.find((l) => l.id === mapId).owners[0]);
  }
});

test('new finite adapter verifies all exact originals without executing a game or producer', async () => {
  const result = await verifyProductionSources(candidate, { root, files: true });
  assert.equal(result.metadata, 'verified');
  assert.equal(result.originalBytesVerified, true);
  assert.equal(result.originals.length, 44);
  assert.equal(newWorks(candidate).length, 9);
  const bytes = newWorks(candidate).reduce((n, w) => n + w.files[0].file.bytes, 0);
  assert.equal(bytes, 23108412);
});

test('a new theme cannot borrow another poster or original by changing only its declared source handle', async () => {
  const next = clone(candidate);
  const [first, second] = newWorks(next);
  first.sourceId = second.sourceId;
  await assert.rejects(verifyProductionSources(next, { root }), /Original mismatch/);
  const wrongFile = clone(candidate);
  const [a, b] = newWorks(wrongFile);
  a.files = clone(b.files);
  await assert.rejects(verifyProductionSources(wrongFile, { root }), /Original mismatch/);
});

test('different-theme and different-mission owners cannot fill the intended slot', () => {
  const next = clone(candidate);
  const binding = next.bindings.find((b) => b.slotId === 'picture.sentinel-listening.ukraine');
  binding.handle.owner = clone(newWorks(next).find((w) => w.themeId === 'retro').owners[0]);
  assert.throws(() => validateProductionRegister(next), /owner/);
  const otherMission = clone(candidate);
  const target = otherMission.bindings.find(
    (b) => b.slotId === 'picture.sentinel-listening.ukraine',
  );
  const wrong = otherMission.works.find((w) => w.sourceId === 'sentinel-circuit-ukraine-poster-2');
  target.workId = wrong.id;
  target.handle.owner = clone(wrong.owners[0]);
  assert.throws(() => validateProductionRegister(otherMission), /another planned layout/);
});

test('register expansion preserves immutable history and cannot count reused layouts twice', () => {
  const changed = clone(candidate);
  changed.layouts.find((l) => l.id === 'sentinel-listening').owners.pop();
  assert.throws(() => validateProductionRegister(changed, { previous: baseline }));
  const duplicate = clone(candidate);
  duplicate.maps[9].selection = 'proposed';
  duplicate.maps[9].layoutId = 'sentinel-listening';
  assert.throws(() => validateProductionRegister(duplicate), /family/);
});

test('baseline remains readable and a new picture still has every production check open', async () => {
  assert.equal(summarizeProduction(baseline).uniquePictureWorks, 27);
  assert.equal((await verifyProductionSources(baseline, { root })).metadata, 'verified');
  const slot = inspectProductionSlot(candidate, 'picture.sentinel-listening.ukraine');
  assert.equal(slot.stage, 'produced');
  assert.equal(slot.missingChecks.length, 9);
});
