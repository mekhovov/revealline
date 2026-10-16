import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTOR_APPEARANCE_PIN_FORMAT,
  ACTOR_APPEARANCE_RENDERER_POLICY,
  snapshotActorAppearancePin,
  validateActorAppearancePinForContent,
} from '../presentation/actor-appearance-pin.mjs';

function fixture(style = 'fpv') {
  return {
    format: ACTOR_APPEARANCE_PIN_FORMAT,
    style,
    rendererPolicy: ACTOR_APPEARANCE_RENDERER_POLICY,
    content: {
      editionId: 'field-kit',
      contentThemeId: 'ukraine',
      mode: 'solo',
      owner: { kind: 'campaign', baseCampaignKey: 'campaign-v1' },
      level: { id: 'map-one', revision: 'authored-1', sha256: 'a'.repeat(64) },
    },
    presentation:
      style === 'campaign'
        ? null
        : {
            source: { id: 'field-kit', revision: 62 },
            theme: { id: 'fpv', revision: 62 },
            collection: { id: 'fpv-actors', revision: 2 },
            sha256: 'b'.repeat(64),
          },
  };
}

test('retained FPV actors own immutable exact references without changing the picture theme', () => {
  const source = fixture(),
    pin = snapshotActorAppearancePin(source);
  assert.deepEqual(pin, source);
  source.content.level.revision = 'later';
  source.presentation.source.revision = 63;
  assert.equal(pin.content.level.revision, 'authored-1');
  assert.equal(pin.presentation.source.revision, 62);
  assert.equal(pin.content.contentThemeId, 'ukraine');
  for (const value of [
    pin,
    pin.content,
    pin.content.owner,
    pin.content.level,
    pin.presentation,
    pin.presentation.source,
    pin.presentation.theme,
    pin.presentation.collection,
  ])
    assert.equal(Object.isFrozen(value), true);
  assert.deepEqual(snapshotActorAppearancePin(JSON.stringify(pin)), pin);
});

test('explicit campaign actors retain no additional presentation source', () => {
  assert.equal(snapshotActorAppearancePin(fixture('campaign')).presentation, null);
  const pin = fixture('campaign');
  pin.presentation = fixture().presentation;
  assert.throws(() => snapshotActorAppearancePin(pin), /authored presentation/);
});
test('authored v2 receipt is closed, bounded and cannot masquerade as FPV or a historical v1 pin', () => {
  const pin = {
    ...fixture('campaign'),
    format: 'revealline-actor-appearance-pin.v2',
    authoredPresentationSha256: 'c'.repeat(64),
  };
  assert.deepEqual(snapshotActorAppearancePin(pin), pin);
  for (const changed of [
    { ...pin, authoredPresentationSha256: null },
    { ...pin, authoredPresentationSha256: 'latest' },
    { ...pin, format: ACTOR_APPEARANCE_PIN_FORMAT },
    { ...pin, style: 'fpv', presentation: fixture().presentation },
  ])
    assert.throws(() => snapshotActorAppearancePin(changed));
});

test('all fields, renderer policy and exact revisions/hashes are strict', () => {
  for (const field of ['format', 'style', 'rendererPolicy', 'content', 'presentation']) {
    const pin = fixture();
    delete pin[field];
    assert.throws(() => snapshotActorAppearancePin(pin), /incomplete/);
  }
  for (const mutate of [
    (p) => {
      p.extra = true;
    },
    (p) => {
      p.style = 'neon';
    },
    (p) => {
      p.rendererPolicy = 'latest';
    },
    (p) => {
      p.presentation = null;
    },
    (p) => {
      delete p.presentation.collection;
    },
    (p) => {
      p.presentation.source.revision = '62';
    },
    (p) => {
      p.presentation.theme.revision = 0;
    },
    (p) => {
      p.presentation.collection.revision = 1000001;
    },
    (p) => {
      p.presentation.sha256 = 'A'.repeat(64);
    },
    (p) => {
      p.content.mode = 'preview';
    },
  ]) {
    const pin = fixture();
    mutate(pin);
    assert.throws(() => snapshotActorAppearancePin(pin));
  }
});

test('bounded snapshot rejects accessors without executing them', () => {
  let reads = 0;
  const pin = fixture();
  Object.defineProperty(pin.presentation, 'sha256', {
    enumerable: true,
    get() {
      reads++;
      return 'b'.repeat(64);
    },
  });
  assert.throws(() => snapshotActorAppearancePin(pin), /accessor|data/i);
  assert.equal(reads, 0);
});

test('accepted content comparison binds mode, original owner and exact hash', () => {
  const pin = fixture();
  assert.deepEqual(validateActorAppearancePinForContent(pin, pin.content), pin);
  for (const mutate of [
    (c) => {
      c.mode = 'versus';
    },
    (c) => {
      c.owner.baseCampaignKey = 'other-campaign';
    },
    (c) => {
      c.level.sha256 = 'c'.repeat(64);
    },
    (c) => {
      c.level.revision = 'authored-2';
    },
    (c) => {
      c.contentThemeId = 'retro';
    },
  ]) {
    const content = structuredClone(pin.content);
    mutate(content);
    assert.throws(
      () => validateActorAppearancePinForContent(pin, content),
      /different accepted content/,
    );
  }
});

test('structural acceptance is deliberately not source approval or lease readiness', () => {
  const pin = fixture();
  pin.presentation.source.id = 'unregistered-test-source';
  pin.presentation.sha256 = 'f'.repeat(64);
  assert.equal(snapshotActorAppearancePin(pin).presentation.source.id, 'unregistered-test-source');
  assert.deepEqual(validateActorAppearancePinForContent(pin, pin.content), pin);
});
