import test from 'node:test';
import assert from 'node:assert/strict';
import { snapshotSessionActorPin } from '../session-actor-pin.mjs';
import { createPresentationPins } from '../presentation-pins.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';

function fixture(mode = 'standard') {
  const f = mediaFixture(true),
    entry = f.catalog.entries.find((item) => item.difficulty === mode),
    library = validateMediaLibrary(libraryRecord(f.identity), f),
    pictures = createPresentationPins({
      library,
      identityCatalog: f.identityCatalog,
      ...f.request(mode),
      themeIds: ['fpv', 'ukraine', 'retro', 'network'],
    }),
    level = entry.campaign.levels[0];
  return {
    pin: {
      format: 'revealline-actor-appearance-pin.v1',
      style: 'fpv',
      rendererPolicy: 'actor-style.v1',
      content: {
        editionId: 'field-kit',
        contentThemeId: 'fpv',
        mode: 'solo',
        owner: { kind: 'campaign', baseCampaignKey: f.identity.baseCampaignKey },
        level: {
          id: f.identity.levelId,
          revision: f.identity.levelRevision,
          sha256: 'a'.repeat(64),
        },
      },
      presentation: {
        source: { id: 'field-kit', revision: 62 },
        theme: { id: 'fpv', revision: 62 },
        collection: null,
        sha256: 'b'.repeat(64),
      },
    },
    binding: {
      pictures,
      campaignKey: entry.executionKey,
      themeId: 'fpv',
      simulationLevel: level,
      presentationLevel: level,
    },
  };
}

for (const mode of ['standard', 'gentle'])
  test(`${mode}: actor binding retains original owner separately from effective difficulty`, () => {
    const { pin, binding } = fixture(mode);
    assert.deepEqual(snapshotSessionActorPin(pin, binding), pin);
    if (mode === 'gentle')
      assert.notEqual(binding.presentationLevel.revision, pin.content.level.revision);
    const stories = {
      ...binding.pictures,
      format: 'revealline-flight-pictures.v2',
      choices: binding.pictures.choices.map((picture) => ({ picture, story: null })),
    };
    assert.deepEqual(snapshotSessionActorPin(pin, { ...binding, pictures: stories }), pin);
  });

test('actor save binding rejects mismatched mode, original owner, theme and map revision', () => {
  for (const mutate of [
    (p) => {
      p.content.mode = 'versus';
    },
    (p) => {
      p.content.owner.baseCampaignKey = 'wrong-owner';
    },
    (p) => {
      p.content.contentThemeId = 'retro';
    },
    (p) => {
      p.content.level.id = 'other-map';
    },
    (p) => {
      p.content.level.revision = 'another';
    },
  ]) {
    const { pin, binding } = fixture('gentle');
    mutate(pin);
    assert.throws(() => snapshotSessionActorPin(pin, binding), /original picture owner/);
  }
});

test('actor save binding rejects wrong execution, simulation and authored picture context', () => {
  for (const mutate of [
    (b) => {
      b.campaignKey = 'other-execution';
    },
    (b) => {
      b.simulationLevel = { ...b.simulationLevel, id: 'another-map' };
    },
    (b) => {
      b.presentationLevel = null;
    },
    (b) => {
      b.presentationLevel = { ...b.presentationLevel, revision: 'other' };
    },
  ]) {
    const { pin, binding } = fixture();
    mutate(binding);
    assert.throws(() => snapshotSessionActorPin(pin, binding), /original picture owner/);
  }
});

test('Journey owner identity is preserved, not rewritten as its backing campaign', () => {
  const { pin, binding } = fixture();
  pin.content.owner = {
    kind: 'journey',
    projectId: 'journey',
    projectRevision: 1,
    projectSha256: 'c'.repeat(64),
    packId: 'horizon',
    campaignId: 'horizon',
    baseCampaignKey: pin.content.owner.baseCampaignKey,
    policyId: 'journey-policy',
  };
  pin.content.level.simulationIdentity = '0123456789abcdef';
  assert.deepEqual(snapshotSessionActorPin(pin, binding), pin);
});
