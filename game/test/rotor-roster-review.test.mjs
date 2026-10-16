import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  loadRosterReview,
  ROSTER_MANIFEST,
  ROSTER_ROLES,
} from '../../docs/verification/rotor-motion/roster-loader.mjs';
import {
  rosterFixture,
  ROSTER_SIZES,
  createRosterRenderer,
} from '../../docs/verification/rotor-motion/roster-render.mjs';

const root = new URL('../../', import.meta.url);
function fixture({ alter, decode } = {}) {
  const requests = [],
    closed = [];
  return {
    requests,
    closed,
    options: {
      fetch: async (url, options) => {
        options.signal.throwIfAborted();
        const path = fileURLToPath(url).slice(fileURLToPath(root).length);
        requests.push(path);
        const bytes = await readFile(url);
        return new Response(alter ? alter(path, bytes) : bytes);
      },
      decode:
        decode ??
        (async (bytes) => ({
          width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16),
          height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20),
          close() {
            closed.push(this);
          },
        })),
    },
  };
}

test('finite roster loader verifies all construction sources and native frames with no release authority', async () => {
  const f = fixture(),
    result = await loadRosterReview(f.options);
  assert.equal(result.frames.size, 14);
  assert.equal(result.manifest.status, 'source-candidate-not-runtime-default');
  assert.equal(result.resolved, undefined);
  assert.equal(result.provenance, undefined);
  assert.deepEqual(f.requests, [
    ROSTER_MANIFEST,
    ...Object.keys(result.manifest.sources),
    ...result.manifest.assets.map((a) => a.path),
  ]);
  for (const [slot, frame] of result.frames) {
    assert.equal(frame.image.width, slot.endsWith('.compact') ? 32 : 64);
    assert.equal(frame.asset.quality.stage, 'produced');
    assert.equal(frame.geometry.rotors.length, slot.startsWith('player.carrier.') ? 6 : 4);
  }
  result.release();
  result.release();
  assert.equal(f.closed.length, 14);
  assert.equal(result.frames.size, 0);
});

for (const [name, target, message] of [
  ['manifest', ROSTER_MANIFEST, /manifest differs/],
  ['construction', 'game/presentation/rotor-body-roster-art.mjs', /source fingerprint differs/],
  ['PNG', 'authoring/library/fpv-body-roster-candidates/carrier.compact.png', /image bytes differ/],
])
  test(`tampered ${name} fails closed and disposes all previously decoded frames`, async () => {
    const f = fixture({
      alter: (path, bytes) => {
        if (path === target) {
          bytes = Buffer.from(bytes);
          bytes[0] ^= 1;
        }
        return bytes;
      },
    });
    await assert.rejects(loadRosterReview(f.options), message);
    assert.equal(f.closed.length, name === 'PNG' ? 4 : 0);
    assert.equal(f.requests.at(-1), target);
  });

test('wrong decoded dimensions release the new image and do not publish a partial cohort', async () => {
  let closed = 0;
  const f = fixture({
    decode: async () => ({
      width: 16,
      height: 16,
      close() {
        closed++;
      },
    }),
  });
  await assert.rejects(loadRosterReview(f.options), /dimensions differ/);
  assert.equal(closed, 1);
});

test('cancellation during decode closes late completion and keeps prior images released', async () => {
  const controller = new AbortController();
  let closed = 0,
    calls = 0,
    complete;
  const f = fixture({
    decode: async () => {
      calls++;
      if (calls === 2)
        await new Promise((resolve) => {
          complete = resolve;
          controller.abort();
        });
      return {
        width: calls === 1 ? 32 : 64,
        height: calls === 1 ? 32 : 64,
        close() {
          closed++;
        },
      };
    },
  });
  await assert.rejects(loadRosterReview({ ...f.options, signal: controller.signal }), /cancelled/);
  assert.equal(closed, 1);
  complete();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(closed, 2);
});

test('finite timeout rejects an unresponsive fetch, without decoding or returning assets', async () => {
  let decoded = false;
  await assert.rejects(
    loadRosterReview({
      fetch: () => new Promise(() => {}),
      timeoutMs: 5,
      decode() {
        decoded = true;
      },
    }),
    /timed out/,
  );
  assert.equal(decoded, false);
});

test('review fixture uses seven Solo visual class identities and two unchanged Team pilot identities', () => {
  assert.deepEqual(ROSTER_SIZES, [20, 24, 32]);
  for (const role of ROSTER_ROLES)
    for (const [heading, direction] of ['up', 'right', 'down', 'left'].entries()) {
      const solo = rosterFixture('solo', heading, role),
        team = rosterFixture('team', heading, role);
      assert.equal(solo.activeClassId, role);
      assert.equal(solo.player.direction, direction);
      assert.equal(solo.player.x, 36);
      assert.equal(team.players.length, 2);
      assert.deepEqual(
        team.players.map((p) => p.id),
        [0, 1],
      );
      assert.ok(team.players.every((p) => p.direction === direction && p.status === 'active'));
      assert.equal(team.classId, undefined);
      assert.equal(team.activeClassId, undefined);
      assert.equal(solo.enemies.length + team.enemies.length, 0);
      assert.equal(solo.tick + team.tick + solo.time + team.time, 0);
    }
});

test('complete painters draw every exact class image at calibrated sizes and hold reduced Team rotor poses', async (t) => {
  const cohort = await loadRosterReview(fixture().options),
    presets = JSON.parse(await readFile(new URL('authoring/motion-lab/presets.json', root))),
    theme = JSON.parse(await readFile(new URL('game/content/packs/fpv-arcade-r4.json', root)))
      .themes[0];
  function makeCanvas() {
    const canvas = { width: 1, height: 1 },
      stack = [];
    let state = { globalAlpha: 1, lineWidth: 1 };
    const ctx = new Proxy(
      { canvas, measureText: () => ({ width: 1 }) },
      {
        get(target, key) {
          if (key in target) return target[key];
          if (key in state) return state[key];
          return () => {
            if (key === 'save') stack.push({ ...state });
            if (key === 'restore') state = stack.pop();
          };
        },
        set(_target, key, value) {
          state[key] = value;
          return true;
        },
      },
    );
    canvas.getContext = () => ctx;
    return canvas;
  }
  const previousDocument = globalThis.document;
  globalThis.document = { createElement: makeCanvas };
  t.after(() => {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  const engine = createRosterRenderer({ presets, theme, frames: cohort.frames, makeCanvas });
  try {
    for (const role of ROSTER_ROLES)
      for (const treatment of ['compact', 'detailed'])
        for (const mode of ['solo', 'team'])
          for (let sizeIndex = 0; sizeIndex < 3; sizeIndex++)
            for (let heading = 0; heading < 4; heading++) {
              const config = { role, treatment, mode, sizeIndex, heading, reduced: true },
                first = engine.render({ ...config, frameIndex: 1 }),
                second = engine.render({ ...config, frameIndex: 2 });
              assert.ok(Math.abs(second.diameter - ROSTER_SIZES[sizeIndex]) < 1e-7);
              assert.equal(second.painted, mode === 'solo' ? 1 : 6);
              assert.equal(second.canvas.width, 64);
              assert.equal(second.canvas.height, 64);
              if (mode === 'team') {
                assert.equal(second.actorFrame.rotorPhase, 0);
                assert.equal(second.actorFrame.reduced, true);
                assert.deepEqual(second.actorFrame, first.actorFrame);
              }
            }
  } finally {
    engine.dispose();
    cohort.release();
  }
  assert.throws(() => engine.render({}), /disposed/);
});
