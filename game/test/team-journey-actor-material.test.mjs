import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { webcrypto } from 'node:crypto';
import { createTeamActorCandidates } from '../content-design/team-actor-candidates.mjs';
import { createTeamJourneyCandidates } from '../content-design/team-journey-candidates.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { createCoopActorPresentation } from '../couch/coop-actor-presentation.mjs';
import { teamJourneyActorFrame } from '../couch/team-journey-actor-material.mjs';
import { drawPresentedActor } from '../ui/actor-presentation.mjs';
import {
  candidateTeamActorMaterial,
  createCandidateTeamPictures,
} from '../couch/candidate-team-pictures.mjs';
import { loadPreviewArtwork } from '../content-design/assets.mjs';
import { acquireCandidatePicture } from '../content-design/picture.mjs';
import { journeyActorThemeMaterial } from '../presentation/journey-actor-materials.mjs';

const hostFor = (source) =>
  createCandidateTeamHost(source, { corePackIds: source.packs.map((pack) => pack.id) });
const oldSource = createTeamJourneyCandidates({ artwork: true });
const source = createTeamActorCandidates();
const oldHost = hostFor(oldSource),
  host = hostFor(source);

test('explicit Team material source preserves twelve maps, originals, editions and36 simulation identities', () => {
  assert.equal(source.missions.length, 12);
  assert.notEqual(source.id, oldSource.id);
  assert.notEqual(source.revision, oldSource.revision);
  assert.deepEqual(source.maps, oldSource.maps);
  assert.deepEqual(source.assets, oldSource.assets);
  assert.deepEqual(createTeamJourneyCandidates({ artwork: true }), oldSource);
  assert.deepEqual(createTeamActorCandidates(), source);
  assert.equal(host.rows.length, 36);
  for (let i = 0; i < host.rows.length; i++) {
    const row = host.rows[i],
      old = oldHost.rows[i];
    assert.equal(row.level.id, old.level.id);
    assert.equal(row.level.format, old.level.format);
    assert.notEqual(row.level.revision, old.level.revision);
    assert.equal(row.simulationIdentity, old.simulationIdentity);
    assert.deepEqual(row.background, old.background);
    assert.equal(row.officialProgressEligible, false);
    assert(journeyActorThemeMaterial(row.presentation.themeId));
  }
  assert.deepEqual(
    new Set(source.missions.map((m) => m.presentation.themeId)),
    new Set(['horizon-actors-v1', 'signal-gardens-actors-v1', 'rover-yard-actors-v1']),
  );
});

test('actual Team frames retain their types, roles, states and exact contact radii with material drawing', () => {
  const types = new Set();
  for (const row of host.rows) {
    const run = startCoop(createCoop(row.level));
    stepCoop(
      run,
      [0, 1].map(() => ({ direction: null, boost: false, support: false })),
      1 / 120,
    );
    const before = structuredClone(run),
      adapter = createCoopActorPresentation();
    adapter.update(run, { reduced: true });
    const materialId = journeyActorThemeMaterial(row.presentation.themeId).id;
    for (const enemy of run.enemies) {
      const original = adapter.frame('enemy', enemy.id);
      const frame = teamJourneyActorFrame(original, { materialId, hasBodyOverride: false });
      const { journeyMaterial, ...unchanged } = frame;
      assert.deepEqual(unchanged, original);
      assert.equal(journeyMaterial, materialId);
      assert.equal(frame.type, enemy.type);
      assert.equal(frame.radius, enemy.radius * 16);
      assert(Object.isFrozen(frame));
      types.add(frame.type);
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
      drawPresentedActor(context, frame, { muted: '#666666', accent: '#eeeeee' });
      assert(calls.some(([name, , , radius]) => name === 'arc' && radius === frame.radius));
      assert(calls.filter(([name]) => name === 'fillRect').length > 20);
      assert(!calls.some(([name]) => name === 'drawImage'));
    }
    assert.deepEqual(run, before);
    for (const player of run.players) {
      const frame = adapter.frame('pilot', player.id);
      assert.equal(teamJourneyActorFrame(frame, { materialId, hasBodyOverride: false }), frame);
    }
  }
  assert.deepEqual(types, new Set(['drifter', 'claimed-rover']));
});

test('Team material adapter fails closed for prepared state slots, uploads and unsupported roles', () => {
  const run = createCoop(host.rows[0].level),
    adapter = createCoopActorPresentation();
  adapter.update(run);
  const frame = adapter.frame('enemy', run.enemies[0].id),
    materialId = 'horizon-enamel-v1';
  for (const options of [
    undefined,
    { materialId },
    { materialId, hasBodyOverride: true },
    { materialId, hasBodyOverride: 0 },
    { materialId: '__proto__', hasBodyOverride: false },
  ])
    assert.equal(teamJourneyActorFrame(frame, options), frame);
  for (const modified of [
    { ...frame, sourceSlot: 'team.drifter.normal' },
    { ...frame, type: 'hunter', role: 'team-line-hunter' },
    { ...frame, type: 'team-stronghold', role: 'team-stronghold', radius: 0 },
    { ...frame, role: 'bouncer' },
  ])
    assert.equal(teamJourneyActorFrame(modified, { materialId, hasBodyOverride: false }), modified);
});

test('only exact live verified Team candidate picture ownership selects a material', async () => {
  const snapshot = { resolved: { theme: { id: 'fpv', revision: 37 } } };
  for (const candidate of [
    oldHost.rows[0],
    ...['horizon', 'signal-gardens', 'rover-yard'].map((name) =>
      host.rows.find((row) => row.presentation.themeId === `${name}-actors-v1`),
    ),
  ]) {
    const candidateHost = host.owns(candidate) ? host : oldHost;
    const asset = candidate.background;
    const bytes = await readFile(new URL('../' + asset.path, import.meta.url));
    const media = await loadPreviewArtwork(asset, {
      fetchAsset: async () => new Response(bytes),
      digest: (body) => webcrypto.subtle.digest('SHA-256', body),
    });
    let releases = 0;
    const owner = createCandidateTeamPictures({
      row: candidate,
      owns: candidateHost.owns,
      getSnapshot: () => snapshot,
      acquire: () =>
        acquireCandidatePicture(asset, {
          loadArtwork: async () => media,
          decodeImage: async () => ({
            width: asset.width,
            height: asset.height,
            removeAttribute: () => releases++,
          }),
        }),
    });
    const request = {
      pack: candidate.pack,
      levelId: candidate.level.id,
      themeId: 'fpv',
      attemptId: 'team-material-test',
    };
    const binding = await owner.select(request);
    assert.equal(owner.confirm(request), binding);
    const materialId =
      candidateHost === host ? journeyActorThemeMaterial(candidate.presentation.themeId).id : null;
    assert.equal(candidateTeamActorMaterial(binding, candidate.level, snapshot), materialId);
    assert.equal(candidateTeamActorMaterial({ ...binding }, candidate.level, snapshot), null);
    assert.equal(
      candidateTeamActorMaterial(binding, { ...candidate.level, revision: 'other' }, snapshot),
      null,
    );
    assert.equal(candidateTeamActorMaterial(binding, candidate.level, { ...snapshot }), null);
    snapshot.resolved.theme.revision++;
    assert.equal(candidateTeamActorMaterial(binding, candidate.level, snapshot), null);
    snapshot.resolved.theme.revision--;
    assert.equal(candidateTeamActorMaterial(binding, candidate.level, snapshot), materialId);
    assert.equal(releases, 0);
    owner.dispose();
    assert.equal(candidateTeamActorMaterial(binding, candidate.level, snapshot), null);
    assert.equal(releases, 1);
  }
});
