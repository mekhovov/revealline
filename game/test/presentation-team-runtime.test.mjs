import test from 'node:test';
import assert from 'node:assert/strict';
import { createPresentationHost } from '../presentation/host.mjs';
import {
  TEAM_RUNTIME_IMAGE_SLOTS,
  isTeamRuntimeImageSlot,
} from '../presentation/team-runtime-slots.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { compilePresentation } from '../../scripts/compile-presentation.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createStudioTeamFixture } from '../../authoring/asset-studio/team-preview-fixture.mjs';

let pending;
function fixture() {
  return (pending ??= (async () => {
    const original = createDefaultThemeBundle(),
      prior = resolvePresentation(original),
      assets = [],
      bindings = {},
      blobs = new Map();
    for (const [i, id] of TEAM_RUNTIME_IMAGE_SLOTS.entries()) {
      const slot = original.slots.find((s) => s.id === id),
        { width, height } = slot.dimensions,
        rgba = new Uint8Array(width * height * 4);
      rgba.set([100 + i, 200, 150, 255], (width + 1) * 4);
      const bytes = encodeSpritePNG({ width, height, rgba }),
        hash = await hashPresentationBytes(bytes),
        asset = {
          ...structuredClone(prior.assets[id]),
          id: `runtime-test.${id}`,
          revision: 1,
          kind: 'image',
          recipe: null,
          geometry: structuredClone(slot.geometry),
          file: { sha256: hash, bytes: bytes.length, mime: 'image/png', width, height },
        };
      assets.push(asset);
      bindings[id] = { id: asset.id, revision: 1 };
      blobs.set(hash, new Blob([bytes], { type: 'image/png' }));
    }
    const document = reviseStudioTheme(original, { assets, bindings }),
      compiled = await compilePresentation(document, blobs);
    return { ...compiled, assets, blobs };
  })());
}
function environment(f) {
  const decoded = [],
    requests = [],
    revoked = [];
  let failure = null;
  const host = createPresentationHost({
    baseURL: 'https://game.test/compiled/',
    fetch: async (url) => {
      requests.push(url);
      const name = url.split('/compiled/')[1],
        bytes = f.files.get(name);
      if (name === failure?.name) {
        if (failure.type === 'missing') return new Response(null, { status: 404 });
        const wrong = new Uint8Array(bytes);
        wrong[wrong.length - 1] ^= 1;
        return new Response(wrong);
      }
      return bytes ? new Response(bytes) : new Response(null, { status: 404 });
    },
    decodeImage: async (blob) => {
      const b = new Uint8Array(await blob.arrayBuffer()),
        v = new DataView(b.buffer),
        image = {
          width: v.getUint32(16),
          height: v.getUint32(20),
          closed: 0,
          close() {
            this.closed++;
          },
        };
      decoded.push(image);
      return image;
    },
    createObjectURL: () => `blob:test-${decoded.length}`,
    revokeObjectURL: (url) => revoked.push(url),
  });
  return {
    host,
    decoded,
    requests,
    revoked,
    fail: (value) => {
      failure = value;
    },
  };
}
function surface() {
  const calls = [],
    ctx = new Proxy(
      {},
      {
        get:
          (_, key) =>
          (...args) => {
            calls.push({ key, args });
            if (key === 'measureText') return { width: String(args[0]).length * 0.5 };
          },
        set: () => true,
      },
    );
  return { calls, canvas: { width: 1152, height: 576, clientWidth: 1152, getContext: () => ctx } };
}

test('only explicitly registered Team roles join the release host image set', () => {
  assert.equal(TEAM_RUNTIME_IMAGE_SLOTS.length, 42);
  assert.equal(new Set(TEAM_RUNTIME_IMAGE_SLOTS).size, 42);
  for (const id of TEAM_RUNTIME_IMAGE_SLOTS) assert(isTeamRuntimeImageSlot(id));
  for (const id of [
    'team.fake',
    'team.emitter.spark.other',
    'team.picture.any',
    'scene.reveal.wide',
    null,
    '__proto__',
  ])
    assert(!isTeamRuntimeImageSlot(id));
});
test('actual compiler output fetches, verifies and prepares every Team role for the real painter', async () => {
  const f = await fixture(),
    e = environment(f),
    snapshot = await e.host.load();
  assert.equal(e.decoded.length, 42);
  assert.equal(e.requests.length, 43);
  for (const asset of f.assets) {
    const id = asset.id.slice('runtime-test.'.length),
      frame = snapshot.image(id);
    assert(frame, `${id} was not decoded`);
    assert.equal(frame.asset.file.sha256, asset.file.sha256);
    assert.equal(frame.image.width, asset.file.width);
    assert.equal(frame.geometry.frame.height, asset.file.height);
  }
  const cases = [
    ['initial', 'team.enemy.drifter'],
    ['initial', 'team.enemy.hunter.patrol'],
    ['warning', 'team.enemy.hunter.warning'],
    ['charge', 'team.enemy.hunter.charge'],
    ['hunter-recovery', 'team.enemy.hunter.recovery'],
    ['initial', 'team.anchor.available'],
    ['initial', 'team.core.shielded'],
    ['anchors', 'team.anchor.captured'],
    ['core', 'team.core.exposed'],
    ['support', 'team.support.pulse'],
    ['support', 'team.enemy.slowed'],
    ['emitter-warning', 'team.emitter.warning'],
    ['emitter-spark', 'team.emitter.spark'],
    ['rescue-p1', 'team.rescue.progress'],
    ['recovered-p2', 'team.player.recovery'],
  ];
  for (const [scenario, id] of cases) {
    const { canvas, calls } = surface(),
      painter = createCoopPainter(canvas),
      run = createStudioTeamFixture({ arena: 'relay-yard', scenario }).run,
      before = structuredClone(run);
    painter.setPresentation(snapshot);
    painter.paint(run, { reduced: true });
    assert(
      calls.some((c) => c.key === 'drawImage' && c.args[0] === snapshot.image(id).image),
      `${scenario} did not use ${id}`,
    );
    assert.deepEqual(run, before);
  }
  for (const seat of [1, 2])
    for (const state of ['normal', 'cutting', 'downed', 'crawling', 'rescuing', 'recovery'])
      for (const [treatment, width] of [
        ['compact', 390],
        ['detailed', 1152],
      ]) {
        const scenario = {
          normal: 'initial',
          cutting: 'cutting',
          downed: `downed-p${seat}`,
          crawling: `crawling-p${seat}`,
          rescuing: `rescue-p${seat === 1 ? 2 : 1}`,
          recovery: `recovered-p${seat}`,
        }[state];
        const fixture = createStudioTeamFixture({ arena: 'relay-yard', scenario }),
          { canvas, calls } = surface(),
          painter = createCoopPainter(canvas),
          id = `team.pilot.p${seat}.${state}.${treatment}`,
          before = structuredClone(fixture.run);
        canvas.clientWidth = width;
        painter.setPresentation(snapshot);
        painter.paint(fixture.run, { previousRun: fixture.previousRun, reduced: true });
        assert.equal(painter.actorFrame('pilot', seat - 1).sourceSlot, id);
        assert(
          calls.some((c) => c.key === 'drawImage' && c.args[0] === snapshot.image(id).image),
          `${id} did not reach the painter`,
        );
        assert.deepEqual(fixture.run, before);
      }
  // Secured cores are valid prepared roles; the won arena intentionally hides live bodies.
  assert(snapshot.image('team.core.secured'));
  assert.equal(snapshot.image('scene.reveal.wide'), null);
  e.host.close();
  assert(e.decoded.every((image) => image.closed === 1));
});
for (const type of ['missing', 'hash'])
  test(`a ${type} Team image cannot replace or dispose the accepted snapshot`, async () => {
    const f = await fixture(),
      e = environment(f),
      before = await e.host.load(),
      old = [...e.decoded],
      asset = f.assets.find((a) => a.id.endsWith('team.player.recovery'));
    e.fail({ type, name: `assets/${asset.file.sha256}.png` });
    await assert.rejects(e.host.load());
    assert.equal(e.host.current(), before);
    assert(old.every((image) => image.closed === 0));
    assert(e.decoded.slice(old.length).every((image) => image.closed === 1));
    e.fail(null);
    const recovered = await e.host.load();
    assert.notEqual(recovered, before);
    assert(old.every((image) => image.closed === 1));
    assert(recovered.image('team.player.recovery'));
    e.host.close();
    assert(e.decoded.every((image) => image.closed === 1));
  });
