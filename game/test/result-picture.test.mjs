import test from 'node:test';
import assert from 'node:assert/strict';
import { createFlightPictures } from '../ui/flight-pictures.mjs';
import { mediaFixture, libraryRecord } from './helpers/media-fixtures.mjs';
import { validateMediaLibrary } from '../media-library.mjs';
import { drawResultPicture } from '../ui/result-picture.mjs';
const fixture = () => {
  const calls = [],
    canvas = { width: 8, height: 8, hidden: false, getContext: () => ({ canvas }) },
    image = { width: 768, height: 576 },
    run = {
      status: 'won',
      level: { id: 'example', version: 'xonix-level.v1', width: 48, height: 36 },
    },
    painter = {
      background: { id: 'latest default' },
      drawGallery: (ctx, options) => calls.push(options),
    },
    options = {
      kind: 'won',
      run,
      painter,
      theme: { id: 'fpv' },
      seed: 14,
      flightPictures: { current: () => ({ image, fit: 'contain' }) },
    };
  return { canvas, image, options, calls };
};
test('results display the exact completed attempt image and fit without resolving a new default', () => {
  const { canvas, image, options, calls } = fixture(),
    before = structuredClone(options.run);
  assert.equal(drawResultPicture(canvas, options), true);
  assert.equal(canvas.hidden, false);
  assert.equal(canvas.width, 640);
  assert.equal(canvas.height, 480);
  assert.equal(calls[0].image, image);
  assert.equal(calls[0].fit, 'contain');
  assert.equal(calls[0].seed, 14);
  assert.deepEqual(options.run, before);
  assert.equal(drawResultPicture(canvas, { ...options, kind: 'pause' }), false);
  assert.equal(canvas.hidden, true);
  assert.equal(canvas.width, 0);
  assert.equal(calls.length, 1);
});
test('missing pinned pictures, failed rendering and unfinished runs never expose a replacement', () => {
  const { canvas, options, calls } = fixture();
  assert.equal(
    drawResultPicture(canvas, { ...options, flightPictures: { current: () => null } }),
    false,
  );
  assert.equal(calls.length, 0);
  options.run.status = 'running';
  assert.equal(drawResultPicture(canvas, options), false);
  assert.equal(calls.length, 0);
  options.run.status = 'won';
  options.painter.drawGallery = () => {
    throw new Error('Canvas unavailable');
  };
  assert.equal(drawResultPicture(canvas, options), false);
  assert.equal(canvas.hidden, true);
  assert.equal(canvas.height, 0);
});
test('legacy and practice results retain their already loaded original override', () => {
  const { canvas, options, calls } = fixture(),
    original = { id: 'practice original' };
  options.flightPictures = null;
  options.painter.images = { background: original };
  options.painter.overrides = { background: { fit: 'contain' } };
  assert.equal(drawResultPicture(canvas, options), true);
  assert.equal(calls[0].image, original);
  assert.equal(calls[0].fit, 'contain');
});

for (const mode of ['old-session', 'explicit-legacy', 'unmanaged-world']) {
  test(`${mode} uses the real legacy flight owner without reading or replacing its original`, async () => {
    const f = mediaFixture(true),
      { canvas, options, calls } = fixture(),
      level = f.catalog.entries[1].campaign.levels[0],
      original = { id: 'existing legacy original' },
      owner = createFlightPictures({
        context: { runId: 'result-attempt', ...f.request('gentle') },
        level,
        themeIds: ['fpv', 'ukraine'],
        identityCatalog: f.identityCatalog,
        legacy: mode === 'old-session',
        explicitLegacy: mode === 'explicit-legacy',
        readMedia: async () => {
          assert.equal(mode, 'unmanaged-world', 'Old and explicit legacy never read media.');
          return {
            store: {},
            metadata: {
              document: {
                library: validateMediaLibrary(libraryRecord(f.identity), {
                  identityCatalog: f.identityCatalog,
                }),
              },
            },
          };
        },
      });
    const world = mode === 'unmanaged-world' ? 'ukraine' : 'fpv';
    await owner.ensure(world);
    assert.equal(owner.current(), null);
    options.run.level = level;
    options.theme.id = world;
    options.flightPictures = owner;
    options.painter.images = { background: original };
    assert.equal(drawResultPicture(canvas, options), true);
    assert.equal(calls[0].image, original);
    assert.equal(owner.current(), null);
    if (mode === 'unmanaged-world') {
      options.theme.id = 'fpv';
      assert.equal(
        drawResultPicture(canvas, options),
        false,
        'An unresolved still choice cannot borrow another world’s legacy image.',
      );
    }
    owner.dispose();
  });
}
