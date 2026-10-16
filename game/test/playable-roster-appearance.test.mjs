import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import {
  acquireActorComparison,
  acquireScoutComparison,
  ACTOR_COMPARISON_COHORTS,
  SCOUT_COMPARISON_COHORTS,
} from '../../authoring/playable-benchmark/candidate-appearance.mjs';
import { FIELD_KIT_CANDIDATE_RIGS } from '../presentation/rotor-candidate-art.mjs';

const cohort = ACTOR_COMPARISON_COHORTS['reference-v6'];
const root = fileURLToPath(new URL('../../', import.meta.url));
function fixture({ alter = (_path, bytes) => bytes, decode } = {}) {
  const requests = [],
    decoded = [];
  let approvedReleases = 0;
  const approvedFrame = Object.freeze({ image: Object.freeze({ id: 'retained-approved-image' }) });
  const approved = Object.freeze({
    image: () => approvedFrame,
    release() {
      approvedReleases++;
    },
  });
  const image = (source) => {
    const bytes = Buffer.from(source.split(',')[1], 'base64');
    const result = {
      width: bytes.readUInt32BE(16),
      height: bytes.readUInt32BE(20),
      closes: 0,
      close() {
        this.closes++;
      },
    };
    decoded.push(result);
    return result;
  };
  return {
    approved,
    approvedFrame,
    requests,
    decoded,
    image,
    get approvedReleases() {
      return approvedReleases;
    },
    options: {
      fetch: async (url, { signal, redirect }) => {
        signal.throwIfAborted();
        assert.equal(redirect, 'error');
        const path = fileURLToPath(url).slice(root.length);
        requests.push(path);
        return new Response(await alter(path, await readFile(url)));
      },
      decodeImage: decode ?? (async (source) => image(source)),
    },
  };
}

for (const classId of cohort.roles)
  for (const treatment of ['auto', 'compact', 'detailed'])
    test(`${classId}/${treatment} loads only its native pair with exact rig and approved-slot delegation`, async () => {
      const f = fixture();
      const candidate = await acquireActorComparison(f.approved, {
        ...f.options,
        classId,
        treatment,
      });
      assert.deepEqual(f.requests, [
        `${cohort.directory}/manifest.json`,
        ...cohort.sources,
        `${cohort.directory}/${classId}.compact.png`,
        `${cohort.directory}/${classId}.detailed.png`,
      ]);
      assert.equal(f.decoded.length, 2);
      assert.equal(candidate.provenance.classId, classId);
      assert.equal(candidate.provenance.treatment, treatment);
      assert.equal(candidate.provenance.construction, 'reference-v6');
      assert.equal(candidate.provenance.manifest.sha256, cohort.manifestSHA256);
      assert.equal(candidate.provenance.productionRegistered, false);
      assert.equal(candidate.provenance.status, 'source-candidate-not-runtime-default');
      assert.equal(candidate.provenance.assets.length, 2);
      assert.equal(candidate.pin, undefined);
      assert.deepEqual(Object.keys(candidate.snapshot), ['image']);
      assert(Object.isFrozen(candidate.snapshot));
      assert(Object.isFrozen(candidate.provenance));
      for (const alias of ['compact', 'detailed']) {
        const selected = treatment === 'auto' ? alias : treatment;
        const frame = candidate.snapshot.image(`player.${classId}.${alias}`);
        assert.equal(frame.asset.id, `candidate.reference-v6.${classId}.${selected}`);
        assert.equal(frame.asset.quality.stage, 'produced');
        assert.equal(frame.image.width, selected === 'compact' ? 32 : 64);
        assert.equal(frame.geometry.frame.width, frame.image.width);
        assert.equal(frame.geometry.frame.height, frame.image.height);
        assert.deepEqual(frame.asset.geometry.rotorAnchors, FIELD_KIT_CANDIDATE_RIGS[classId]);
        assert.equal(frame.geometry.rotors.length, classId === 'carrier' ? 6 : 4);
        assert.deepEqual(
          frame.geometry.rotors.map((rotor) => [rotor.direction, rotor.phaseDegrees]),
          FIELD_KIT_CANDIDATE_RIGS[classId].map((rotor) => [rotor.direction, rotor.phaseDegrees]),
        );
        assert.equal(
          candidate.provenance.assets.find((v) => v.slot.endsWith(`.${selected}`)).assetRevision,
          frame.asset,
        );
        assert.equal(f.approved.image(`player.${classId}.${alias}`), f.approvedFrame);
      }
      for (const other of cohort.roles.filter((role) => role !== classId))
        assert.equal(candidate.snapshot.image(`player.${other}.compact`), f.approvedFrame);
      assert.equal(candidate.snapshot.image('enemy.border-patrol.compact'), f.approvedFrame);
      assert.equal(candidate.snapshot.image(`player.${classId}.rotors`), f.approvedFrame);
      candidate.release();
      candidate.release();
      assert(f.decoded.every((value) => value.closes === 1));
      assert.equal(f.approvedReleases, 0);
      assert.throws(() => candidate.snapshot.image(`player.${classId}.compact`), /released/);
    });

test('generic defaults select v6 Scout; legacy API keeps v3-v5 and its original v3 default', async () => {
  const f = fixture();
  const current = await acquireActorComparison(f.approved, f.options);
  assert.equal(current.provenance.classId, 'scout');
  assert.equal(current.provenance.construction, 'reference-v6');
  current.release();
  for (const construction of [undefined, ...Object.keys(SCOUT_COMPARISON_COHORTS)]) {
    const legacy = await acquireScoutComparison(f.approved, { ...f.options, construction });
    assert.equal(legacy.provenance.construction, construction ?? 'reference-v3');
    assert.equal(legacy.provenance.classId, 'scout');
    legacy.release();
  }
  await assert.rejects(
    acquireScoutComparison(f.approved, { ...f.options, construction: 'reference-v6' }),
    /Unknown candidate construction/,
  );
  assert.equal(f.approvedReleases, 0);
});

test('unknown classes and non-Scout legacy combinations fail visibly before fetching', async () => {
  const f = fixture();
  for (const classId of ['enemy.border-patrol', 'latest', '__proto__', '', null, {}])
    await assert.rejects(
      acquireActorComparison(f.approved, { ...f.options, classId }),
      /Unknown candidate class/,
    );
  for (const construction of Object.keys(SCOUT_COMPARISON_COHORTS))
    await assert.rejects(
      acquireActorComparison(f.approved, { ...f.options, construction, classId: 'carrier' }),
      /class|Scout only/,
    );
  assert.equal(f.requests.length, 0);
});

for (const [name, target, message, closed] of [
  ['manifest', `${cohort.directory}/manifest.json`, /manifest differs/, 0],
  ['source', cohort.sources[0], /source fingerprint differs/, 0],
  ['first PNG', `${cohort.directory}/carrier.compact.png`, /PNG byte length or SHA-256 differs/, 0],
  [
    'second PNG',
    `${cohort.directory}/carrier.detailed.png`,
    /PNG byte length or SHA-256 differs/,
    1,
  ],
])
  test(`changed ${name} refuses admission and releases staged images`, async () => {
    const f = fixture({
      alter: (path, bytes) => {
        if (path !== target) return bytes;
        const changed = Buffer.from(bytes);
        changed[0] ^= 1;
        return changed;
      },
    });
    await assert.rejects(
      acquireActorComparison(f.approved, { ...f.options, classId: 'carrier' }),
      message,
    );
    assert.equal(f.requests.at(-1), target);
    assert.equal(f.decoded.length, closed);
    assert(f.decoded.every((image) => image.closes === 1));
    assert.equal(f.approvedReleases, 0);
  });

test('oversize PNG rejects before decode and wrong decoded native dimensions dispose the image', async () => {
  const f = fixture({
    alter: (path, bytes) =>
      path.endsWith('/fiber.compact.png') ? Buffer.concat([bytes, Buffer.from('x')]) : bytes,
  });
  await assert.rejects(
    acquireActorComparison(f.approved, { ...f.options, classId: 'fiber' }),
    /byte budget/,
  );
  assert.equal(f.decoded.length, 0);
  const g = fixture();
  g.options.decodeImage = async (source) => {
    const image = g.image(source);
    image.naturalWidth = 17;
    return image;
  };
  await assert.rejects(
    acquireActorComparison(g.approved, { ...g.options, classId: 'fiber' }),
    /dimensions differ/,
  );
  assert.equal(g.decoded.length, 1);
  assert.equal(g.decoded[0].closes, 1);
  assert.equal(g.approvedReleases, 0);
});

test('cancelling a later selected-class decode releases both staged and late images without touching the approved lease', async () => {
  const f = fixture(),
    controller = new AbortController();
  let complete, started;
  const decoding = new Promise((resolve) => {
    started = resolve;
  });
  f.options.decodeImage = async (source) => {
    const image = f.image(source);
    if (f.decoded.length === 2) {
      started();
      await new Promise((resolve) => {
        complete = resolve;
      });
    }
    return image;
  };
  const pending = acquireActorComparison(f.approved, {
    ...f.options,
    classId: 'trapper',
    signal: controller.signal,
  });
  await decoding;
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
  assert.equal(f.decoded[0].closes, 1);
  complete();
  await new Promise((resolve) => setImmediate(resolve));
  assert(f.decoded.every((image) => image.closes === 1));
  assert.equal(f.approvedReleases, 0);
  assert.equal(f.approved.image('player.trapper.compact'), f.approvedFrame);
});

test('cancelled replacement cannot dispose an already accepted candidate; failed loading remains bounded', async () => {
  const f = fixture(),
    accepted = await acquireActorComparison(f.approved, { ...f.options, classId: 'bomber' });
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    acquireActorComparison(f.approved, {
      ...f.options,
      classId: 'impact',
      signal: controller.signal,
    }),
    { name: 'AbortError' },
  );
  assert.equal(
    accepted.snapshot.image('player.bomber.compact').asset.id,
    'candidate.reference-v6.bomber.compact',
  );
  assert(f.decoded.every((image) => image.closes === 0));
  await assert.rejects(
    acquireActorComparison(f.approved, {
      classId: 'impact',
      timeoutMs: 5,
      fetch: () => new Promise(() => {}),
    }),
    /did not load in time/,
  );
  accepted.release();
  assert(f.decoded.every((image) => image.closes === 1));
  assert.equal(f.approvedReleases, 0);
});
