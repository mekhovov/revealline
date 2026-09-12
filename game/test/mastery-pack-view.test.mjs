import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { STEADY_SIGNAL, masteryDefinitionIdentity } from '../mastery.mjs';
import { masteryFor, pictureMasteries } from '../ui/mastery-view.mjs';
import { resolveMasteryRecord } from '../mastery-records.mjs';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/mastery-v070.json', import.meta.url), 'utf8'),
);
const old = fixture.cases.find((entry) => entry.record).record;
const picture = { campaignKey: old.campaignKey, levelId: old.levelId };
const entry = (masteries) => ({
  campaign: fixture.campaign,
  sourcePackId: 'authored-homeward',
  sourcePackFormat: 'xonix-pack.v2',
  masteries,
});
const revised = {
  ...STEADY_SIGNAL,
  revision: '2',
  name: 'Signal Weaver',
  description: 'A revised authored requirement.',
};
const current = resolveMasteryRecord({
  ...structuredClone(old),
  definitionRevision: revised.revision,
  definitionHash: masteryDefinitionIdentity(revised),
});
const view = (
  records,
  catalog,
  definition = masteryFor(picture.campaignKey, picture.levelId, catalog),
) => pictureMasteries(records, picture, definition, fixture.campaign.classRecipes, catalog);

test('an explicit empty catalog suppresses builtin fallback in goal lookup and gallery labels', () => {
  const empty = createMasteryCatalog([entry([])]);
  assert.equal(masteryFor(picture.campaignKey, picture.levelId), STEADY_SIGNAL);
  assert.equal(masteryFor(picture.campaignKey, picture.levelId, empty), null);
  assert.equal(view([old], empty)[0].name, 'Archived seal: steady-signal');
  assert.equal(view([old], empty, STEADY_SIGNAL)[0].name, 'Archived seal: steady-signal');
});

test('the current authored registration labels its complete matching metadata and archives the old definition', () => {
  const catalog = createMasteryCatalog([entry([revised])]);
  const definition = masteryFor(picture.campaignKey, picture.levelId, catalog);
  assert.equal(definition.name, revised.name);
  assert.deepEqual(
    view([old, current], catalog).map((item) => item.name),
    ['Archived seal: steady-signal', 'Signal Weaver'],
  );
  assert.equal(view([current], catalog, STEADY_SIGNAL)[0].name, 'Archived seal: steady-signal');
});

test('removal and exact reinstallation change labels without altering historical metadata', () => {
  const records = [structuredClone(current)],
    before = structuredClone(records);
  const installed = createMasteryCatalog([entry([revised])]);
  const removed = createMasteryCatalog([]);
  assert.equal(view(records, installed)[0].name, revised.name);
  assert.equal(view(records, removed)[0].name, 'Archived seal: steady-signal');
  assert.equal(view(records, createMasteryCatalog([entry([revised])]))[0].name, revised.name);
  assert.deepEqual(records, before);
});

test('legacy explicit catalog and omitted-catalog callers preserve the same builtin label', () => {
  const legacy = createMasteryCatalog([{ campaign: fixture.campaign, sourcePackId: 'homeward' }]);
  assert.equal(masteryFor(picture.campaignKey, picture.levelId, legacy), STEADY_SIGNAL);
  assert.deepEqual(
    view([old], legacy),
    pictureMasteries([old], picture, STEADY_SIGNAL, fixture.campaign.classRecipes),
  );
});

test('a matching authored definition hash cannot bypass the complete map and equipment metadata check', () => {
  const catalog = createMasteryCatalog([entry([revised])]);
  for (const edit of [
    (record) => {
      record.definitionId = 'another-seal';
    },
    (record) => {
      record.definitionRevision = '3';
    },
    (record) => {
      record.levelIdentity = 'level-v1-0000000000000000';
    },
    (record) => {
      record.levelRevision = '99';
    },
    (record) => {
      record.setup.rosterHash = 'roster-v1-00000000';
    },
    (record) => {
      record.setup.ruleset = 'xonix-core.v3';
    },
  ]) {
    const record = structuredClone(current);
    edit(record);
    assert.match(view([record], catalog)[0].name, /^Archived seal:/);
  }
});
