import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { JOURNEY_PREFERENCES_KEY, JOURNEY_PREFERENCES_VERSION } from '../journey/preferences.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';

const firstPicture = COOP_PICTURE_BINDINGS[0].picture;
function preferences(difficulty = 'expert', { denyWrites = false } = {}) {
  const values = new Map([
      [
        JOURNEY_PREFERENCES_KEY,
        JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty }),
      ],
    ]),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      if (denyWrites) throw new Error('Startup preference quota test');
      writes.push([key, value]);
      values.set(key, value);
    },
  };
}

function flightCheckpoint(f) {
  return {
    paint: f.lastPaint,
    hud: ['coop-stage', 'coop-coverage', 'coop-reserves', 'coop-clock', 'coop-objective'].map(
      (id) => [id, f.$(id).textContent],
    ),
    pictureHashes: [...new Set(f.drawImages.map((image) => image.sha256).filter(Boolean))],
    paused: !f.$('coop-overlay').hidden,
  };
}

function startAndMove(f) {
  assert.equal(f.$('coop-play').hidden, true, 'Readiness never starts a flight.');
  f.$('coop-start').click();
  assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
  assert.equal(f.$('coop-reserves').textContent, '1 reserve', 'The real Expert core starts.');
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  f.tick(2);
  f.tap('KeyD');
  f.tap('ArrowLeft');
  f.tick(30);
  const checkpoint = flightCheckpoint(f);
  assert.ok(checkpoint.paint);
  assert.deepEqual(checkpoint.pictureHashes, [firstPicture.sha256]);
  f.$('coop-pause').click();
  assert.equal(f.$('coop-overlay').hidden, false);
  return checkpoint;
}

test('native setup chosen before module attachment matches the ordinary Expert First Connection flight', async (t) => {
  let expected;
  await t.test(
    'ordinary post-ready selection supplies the gameplay and artwork reference',
    async (t) => {
      const f = await page(t, { nativeFocus: true, capturePaint: true, stablePaintImages: true });
      await f.choose('coop-level', 'first-connection');
      f.$('coop-difficulty').value = 'expert';
      f.$('coop-difficulty').emit('change');
      expected = startAndMove(f);
    },
  );
  await t.test(
    'pre-attachment First Connection and Expert survive boot and exact preparation',
    async (t) => {
      let ready;
      const f = await page(t, {
        nativeFocus: true,
        capturePaint: true,
        stablePaintImages: true,
        retainInitialDifficulty: true,
        beforeImport: ({ $ }) => {
          assert.equal($('coop-start').disabled, true);
          assert.equal($('coop-level').disabled, false);
          $('coop-level').value = 'first-connection';
          $('coop-level').emit('change');
          $('coop-difficulty').value = 'expert';
          $('coop-difficulty').emit('change');
          $('coop-level').focus();
        },
        onReady: ({ $ }) => {
          ready = { level: $('coop-level').value, difficulty: $('coop-difficulty').value };
        },
      });
      assert.deepEqual(ready, { level: 'first-connection', difficulty: 'expert' });
      assert.equal(f.$('coop-level').value, 'first-connection');
      assert.equal(f.$('coop-difficulty').value, 'expert');
      assert.equal(f.doc.activeElement.id, 'coop-level', 'Boot keeps the actual selector focus.');
      assert.equal(f.$('coop-menu').hidden, false);
      assert.equal(f.drawImages.length, 0);
      assert.deepEqual(
        f.artwork.calls.reads.map(({ slot }) => slot),
        [firstPicture.slot],
      );
      assert.equal(f.previewDrawImages.at(-1).sha256, firstPicture.sha256);
      assert.deepEqual(startAndMove(f), expected, 'Real painter/HUD checkpoint and picture match.');
    },
  );
});

for (const [name, value] of [
  ['untouched markup', undefined],
  ['empty native selection', ''],
  ['unknown native selection', 'not-a-starter-arena'],
]) {
  test(`${name} uses First Connection as the safe introductory default and exact artwork`, async (t) => {
    const f = await page(t, {
      nativeFocus: true,
      beforeImport: ({ $ }) => {
        if (value !== undefined) {
          $('coop-level').value = value;
          $('coop-level').emit('change');
        }
      },
    });
    assert.equal(f.$('coop-level').value, 'first-connection');
    assert.equal(f.$('coop-stage').textContent, 'FIRST CONNECTION');
    assert.equal(f.$('coop-difficulty').value, 'standard');
    assert.equal(f.$('coop-play').hidden, true);
    assert.equal(f.drawImages.length, 0);
    assert.deepEqual(
      f.artwork.calls.reads.map(({ slot }) => slot),
      [firstPicture.slot],
    );
    assert.equal(f.previewDrawImages.at(-1).sha256, firstPicture.sha256);
    assert.equal(f.$('coop-start').disabled, false);
  });
}

for (const [name, value, events] of [
  ['untouched markup', 'standard', []],
  ['unreported browser-restored value', 'gentle', []],
  ['selector opening and cancellation', 'standard', ['pointerdown', 'click', 'keydown']],
  ['empty edit', '', ['change']],
  ['unknown edit', 'impossible', ['input', 'change']],
])
  test(`early Difficulty ${name} retains saved Expert without writes or focus takeover`, async (t) => {
    const store = preferences();
    const f = await page(t, {
      nativeFocus: true,
      retainInitialDifficulty: true,
      beforeImport: ({ $, install }) => {
        install('localStorage', { value: store });
        $('coop-difficulty').value = value;
        for (const type of events)
          $('coop-difficulty').emit(type, { button: 0, isPrimary: true, key: 'Escape' });
        $('coop-difficulty').focus();
      },
      onReady: ({ $ }) => assert.equal($('coop-difficulty').value, 'expert'),
    });
    assert.equal(f.$('coop-difficulty').value, 'expert');
    assert.equal(f.doc.activeElement.id, 'coop-difficulty');
    assert.deepEqual(store.writes, []);
    f.$('coop-start').click();
    assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  });

for (const [saved, chosen, reserves] of [
  ['expert', 'standard', '3 reserves'],
  ['standard', 'expert', '1 reserve'],
])
  test(`early ${chosen} edit overrides saved ${saved} for Start and confirmed Retry`, async (t) => {
    const store = preferences(saved);
    const f = await page(t, {
      nativeFocus: true,
      capturePaint: true,
      stablePaintImages: true,
      retainInitialDifficulty: true,
      beforeImport: ({ $, install }) => {
        install('localStorage', { value: store });
        $('coop-difficulty').value = chosen;
        $('coop-difficulty').emit('input');
        $('coop-difficulty').emit('change');
        $('coop-difficulty').focus();
      },
    });
    assert.equal(f.$('coop-difficulty').value, chosen);
    assert.equal(f.doc.activeElement.id, 'coop-difficulty');
    assert.deepEqual(store.writes, [
      [
        JOURNEY_PREFERENCES_KEY,
        JSON.stringify({ format: JOURNEY_PREFERENCES_VERSION, difficulty: chosen }),
      ],
    ]);
    f.$('coop-start').click();
    assert.equal(f.$('coop-reserves').textContent, reserves);
    const initial = flightCheckpoint(f);
    f.tick(20);
    f.$('coop-pause').click();
    f.$('coop-retry').click();
    assert.equal(f.$('coop-discard-dialog').open, true);
    f.$('coop-discard-confirm').click();
    assert.equal(f.$('coop-reserves').textContent, reserves);
    assert.deepEqual(flightCheckpoint(f), initial);
    assert.equal(f.artwork.calls.reads.length, 1);
  });

test('an early Journey Expert edit survives rejected saving and selects the matching compiled edition', async (t) => {
  const store = preferences('standard', { denyWrites: true });
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html?journey=team-greybox',
    nativeFocus: true,
    retainInitialDifficulty: true,
    beforeImport: ({ $, install }) => {
      install('localStorage', { value: store });
      $('coop-difficulty').value = 'expert';
      $('coop-difficulty').emit('change');
      $('coop-difficulty').focus();
    },
  });
  assert.equal(f.$('coop-level').value, 'twin-landings');
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.doc.activeElement.id, 'coop-difficulty');
  assert.equal(f.$('coop-journey-preferences').hidden, false);
  assert.match(f.$('coop-journey-preferences-message').textContent, /session-only/);
  assert.equal(JSON.parse(store.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'standard');
  assert.deepEqual(store.writes, []);
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  f.tick(20);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-difficulty').value, 'expert');
});

test('queryless Team adopts the early Expert preset before preparing its owned original and retains it on Retry', async (t) => {
  const source = createTeamSpatialOriginalCandidates(),
    first = source.missions[0],
    asset = source.assets.find((row) => row.id === first.presentation.backgroundAssetId),
    bytes = await readFile(new URL('../' + asset.path, import.meta.url)),
    store = preferences('gentle');
  const f = await page(t, {
    href: 'http://localhost/game/couch/relay-rescue.html',
    nativeFocus: true,
    retainInitialDifficulty: true,
    beforeImport: ({ $, install }) => {
      const BaseImage = globalThis.Image;
      class OriginalImage extends BaseImage {
        async decode() {
          if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
          const original = Buffer.from(this.source.split(',')[1], 'base64');
          this.width = this.naturalWidth = original.readUInt32BE(16);
          this.height = this.naturalHeight = original.readUInt32BE(20);
          this.sha256 = createHash('sha256').update(original).digest('hex');
        }
      }
      install('Image', { value: OriginalImage });
      install('crypto', { value: webcrypto });
      install('fetch', {
        value: async (url) => {
          assert(new URL(url).pathname.endsWith('/' + asset.path));
          return new Response(bytes);
        },
      });
      install('localStorage', { value: store });
      $('coop-difficulty').value = 'expert';
      $('coop-difficulty').emit('change');
      $('coop-difficulty').focus();
    },
  });
  assert.equal(f.$('coop-level').value, first.id);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.doc.activeElement.id, 'coop-difficulty');
  assert.equal(JSON.parse(store.getItem(JOURNEY_PREFERENCES_KEY)).difficulty, 'expert');
  f.$('coop-start').click();
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  const picture = f.drawImages.find((image) => image.sha256 === asset.sha256);
  assert(picture, 'First play draws the exact approved original for the selected mission.');
  f.tick(20);
  f.$('coop-pause').click();
  f.$('coop-retry').click();
  assert.equal(f.$('coop-discard-dialog').open, true);
  f.$('coop-discard-confirm').click();
  assert.equal(f.$('coop-level').value, first.id);
  assert.equal(f.$('coop-difficulty').value, 'expert');
  assert.equal(f.$('coop-reserves').textContent, '1 reserve');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.drawImages.filter((image) => image.sha256 === asset.sha256).at(-1), picture);
});
