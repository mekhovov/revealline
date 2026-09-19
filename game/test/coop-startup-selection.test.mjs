import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';

const firstPicture = COOP_PICTURE_BINDINGS[0].picture;

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
