import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import {
  createCandidateTeamPictures,
  candidateTeamPictureFrame,
} from '../couch/candidate-team-pictures.mjs';
import { acquireCandidatePicture, claimCandidatePicture } from '../content-design/picture.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createCoopPainter } from '../couch/coop-view.mjs';
import { createCoop } from '../coop/core.mjs';

const source = createTeamJourneyCandidates({ artwork: true });
const host = createCandidateTeamHost(source, { corePackIds: source.packs.map((p) => p.id) });
const row = host.rows[0],
  asset = row.background;
const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
const media = await loadPreviewArtwork(asset, {
  fetchAsset: async () => new Response(bytes),
  digest: (body) => webcrypto.subtle.digest('SHA-256', body),
});
const snapshot = Object.freeze({
  resolved: { theme: { id: 'fpv', revision: 1 } },
  canvas: {
    palette: {
      ink: '#f6f3e8',
      paper: '#071527',
      muted: '#a8b8cc',
      accent: '#ffd64a',
      safe: '#67aaff',
      danger: '#ff7169',
      field: '#10243e',
      grid: '#182b43',
      sky: '#233950',
      land: '#526e67',
    },
    motionScale: 1,
  },
  fonts: { ui: 'sans-serif', numeric: 'monospace' },
});
const request = (extra = {}) => ({
  pack: structuredClone(row.pack),
  levelId: row.level.id,
  themeId: 'fpv',
  attemptId: 'candidate-team-1',
  ...extra,
});
async function picture() {
  return acquireCandidatePicture(asset, {
    loadArtwork: async () => media,
    decodeImage: async () => ({
      width: asset.width,
      height: asset.height,
      releases: 0,
      removeAttribute() {
        this.releases++;
      },
    }),
  });
}
const lease = (extra = {}) =>
  createCandidateTeamPictures({
    row,
    owns: host.owns,
    getSnapshot: () => snapshot,
    acquire: picture,
    ...extra,
  });

test('Team candidate verifies exact source and owns original-size draw until disposal', async () => {
  const owner = lease(),
    binding = await owner.select(request());
  assert.equal(owner.confirm(request()), binding);
  assert.equal(await owner.select(request()), binding);
  assert.equal(binding.choice.officialProgressEligible, false);
  assert.equal(candidateTeamPictureFrame(binding, row.level, snapshot).sha256, asset.sha256);
  assert.equal(candidateTeamPictureFrame({ ...binding }, row.level, snapshot), null);
  const calls = [],
    context = new Proxy(
      {},
      {
        get:
          (_, name) =>
          (...args) =>
            calls.push([name, ...args]),
      },
    );
  const painter = createCoopPainter({ width: 1152, height: 576, getContext: () => context });
  const run = createCoop(row.level),
    before = structuredClone(run);
  painter.setPresentation(snapshot);
  painter.paint(run, { picture: binding });
  const draw = calls.find((c) => c[0] === 'drawImage');
  assert.deepEqual(draw.slice(2), [0, 0, asset.width, asset.height, 0, 0, 72, 36]);
  assert.deepEqual(run, before);
  assert.throws(() => painter.paint(run, { picture: { ...binding } }), /verified owner/);
  owner.dispose();
  owner.dispose();
  assert.equal(binding.image.releases, 1);
  assert.equal(candidateTeamPictureFrame(binding, row.level, snapshot), null);
  assert.throws(() => painter.paint(run, { picture: binding }), /verified owner/);
});

test('Team candidate rejects foreign rows, changed pack, theme, attempt and snapshot', async () => {
  assert.throws(() => lease({ row: { ...row } }), /owned Team/);
  const owner = lease();
  const changed = structuredClone(row.pack);
  changed.name += ' altered';
  for (const change of [
    { pack: changed },
    { themeId: 'horizon' },
    { levelId: 'unknown' },
    { artworkSource: {} },
  ])
    await assert.rejects(owner.select(request(change)), /exact owned/);
  await owner.select(request());
  assert.throws(() => owner.confirm(request({ attemptId: 'another-attempt' })), /exact candidate/);
  owner.dispose();
  let current = snapshot;
  const other = lease({ getSnapshot: () => current });
  await other.select(request());
  current = { ...snapshot };
  assert.throws(() => other.confirm(request()), /presentation changed/);
  other.dispose();
  const mutable = structuredClone(snapshot);
  const pinned = lease({ getSnapshot: () => mutable });
  await pinned.select(request());
  mutable.resolved.theme.revision++;
  assert.throws(() => pinned.confirm(request()), /theme identity changed/);
  pinned.dispose();
});

for (const action of ['cancel', 'dispose', 'abort'])
  test(`Team ${action} rejects late pixels and releases once`, async () => {
    const original = await picture();
    let resolve;
    const controller = new AbortController();
    const owner = lease({
      acquire: () =>
        new Promise((done) => {
          resolve = done;
        }),
    });
    const pending = owner.select(request({ signal: controller.signal }));
    if (action === 'abort') controller.abort();
    else owner[action]();
    resolve(original);
    await assert.rejects(pending, { name: 'AbortError' });
    assert.equal(original.image.releases, 1);
    assert.equal(owner.current(), null);
    owner.dispose();
  });

test('Team ready callback cannot adopt after reentrant cancellation', async () => {
  const original = await picture();
  const owner = lease({ acquire: async () => original });
  await assert.rejects(
    owner.select(
      request({
        onStatus: ({ status }) => {
          if (status === 'ready') owner.cancel();
        },
      }),
    ),
    { name: 'AbortError' },
  );
  assert.equal(owner.current(), null);
  assert.equal(original.image.releases, 1);
  owner.dispose();
});

test('Team cannot claim pixels already owned by another display', async () => {
  const original = await picture();
  claimCandidatePicture(asset, original);
  const owner = lease({ acquire: async () => original });
  await assert.rejects(owner.select(request()), /another display owner/);
  owner.dispose();
  assert.equal(original.image.releases, 0);
  original.release();
});

test('failed future Team picture leaves current attempt drawable', async () => {
  const current = lease(),
    binding = await current.select(request());
  const next = lease({
    acquire: async () => {
      throw new Error('offline');
    },
  });
  await assert.rejects(next.select(request()), /offline/);
  next.dispose();
  assert.equal(current.confirm(request()), binding);
  assert.equal(binding.image.releases, 0);
  current.dispose();
});
