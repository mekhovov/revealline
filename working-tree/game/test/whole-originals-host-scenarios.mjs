import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';
import { createRun, stepRun, FIXED_DT, CLASSES } from '../core/index.mjs';
import {
  authoritativeCheckpoint,
  createRecorder,
  recordInput,
  exportReplay,
  verifyReplay,
} from '../replay.mjs';
import { resolveObjectURL } from 'node:buffer';
import { PNGImage } from './helpers/png-image.mjs';
import { playKeyboardRoute } from './helpers/keyboard-route.mjs';
import { openMissionLibrary } from './helpers/library-selection.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { dataIdentity } from '../data-json.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { createWholeJourneyCandidates } from '../content-design/whole-journey-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';

// Retain the original authored route/checkpoint evidence separately from current
// v4 fresh attempts. Never rewrite these frozen historical replay fixtures.
const historicalProject = compileContentProject(
  createWholeJourneyCandidates({ roverTeaching: true }),
);
const fixtures = [
  'horizon-greybox',
  'border-clear',
  'signal-clear',
  'neon-clear',
  'rover-clear',
  'fracture-clear',
  'phase-clear',
  'livewire-clear',
  'relay-clear',
  'crosswind-clear',
  'sentinel-clear',
  'apex-clear',
];
const rows = (
  await Promise.all(
    fixtures.map(async (name) => {
      const f = JSON.parse(
        await readFile(new URL(`./fixtures/${name}-routes.json`, import.meta.url)),
      );
      return (
        f.rows ??
        f.sets.find(
          (s) => s.difficulty === 'standard' && s.turnPolicy === 'immediate' && s.bonuses !== false,
        ).rows
      ).slice(0, -1);
    }),
  )
).flat();
const teaching = JSON.parse(
  await readFile(new URL('./fixtures/rover-teaching-routes.json', import.meta.url)),
).rows.filter((r) => r.difficulty === 'standard' && r.turnPolicy === 'immediate');
for (const row of teaching) {
  const index = rows.findIndex((r) => r[0] === row.missionId);
  assert(index >= 0);
  rows[index] = [row.missionId, row.simulationIdentity, row.checkpoint, row.segments];
}
const keys = { up: 'ArrowUp', right: 'ArrowRight', down: 'ArrowDown', left: 'ArrowLeft' };

const current = JSON.parse(
  await readFile(new URL('./fixtures/whole-originals-tuned-host-routes.json', import.meta.url)),
);
assert.equal(current.format, 'WholeOriginalsCurrentHostRoutesV1');
assert.equal(current.ruleset, 'gameplay-pressure.v4');
assert.equal(current.seed, 1);
assert.equal(current.turnPolicy, 'immediate');
assert.equal(current.difficulty, 'standard');

function historicalProof(id, checkpoint, segments) {
  const historical = createRun(resolveMission(historicalProject, id).level, {
    seed: 1,
    classId: 'scout',
  });
  for (const [direction, ticks] of segments)
    for (let tick = 0; tick < ticks; tick++) stepRun(historical, { direction }, FIXED_DT);
  assert.equal(historical.status, 'won', `Historical authored ${id}`);
  assert.equal(authoritativeCheckpoint(historical).hash, checkpoint, `Historical authored ${id}`);
}

function currentRecording(route, project, id) {
  const manifest = resolveMission(project, id),
    level = applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
    row = current.rows.find((entry) => entry.id === id),
    expected = row?.editions[route.id];
  assert(expected, `A verified current route is required for ${route.id}/${id}`);
  assert.deepEqual(current.sources[route.id], {
    id: route.source.id,
    revision: route.source.revision,
  });
  assert.equal(manifest.simulationIdentity, expected.authoredIdentity);
  const options = { seed: 1, classId: 'scout', turnPolicy: 'immediate' },
    reference = createRun(level, options),
    recorder = createRecorder(level, options);
  assert.equal(
    dataIdentity({ ruleset: reference.ruleset, level, classes: CLASSES }),
    expected.gameplayIdentity,
  );
  let closed = 0;
  for (const [direction, ticks] of row.segments)
    for (let tick = 0; tick < ticks; tick++) {
      assert.equal(reference.status, 'running', 'No input beyond the recorded terminal tick.');
      recordInput(recorder, { direction });
      stepRun(reference, { direction }, FIXED_DT);
      assert.equal(reference.classic.livesLost, 0, `${id}: lossless current route`);
      if (reference.events.some((event) => event.type === 'cut.closed')) closed++;
    }
  assert.deepEqual(
    {
      status: reference.status,
      tick: reference.tick,
      lives: reference.lives,
      score: reference.score,
      coverage: reference.coverage,
      claimedCount: reference.claimedCount,
      closed,
    },
    expected.outcome,
  );
  assert.equal(verifyReplay(exportReplay(recorder, reference)).match, true, `${id}: public replay`);
  // Raw historical goldens above remain fixed. New native checkpoint witnesses
  // are recorded separately; exact current host/reference equality and these
  // fixed discrete outcomes do not depend on cross-architecture float spelling.
  return {
    manifest,
    level,
    input: {
      seed: 1,
      turnPolicy: 'immediate',
      checkpoint: authoritativeCheckpoint(reference).hash,
      segments: row.segments.map(([direction, ticks]) => ({ direction, ticks })),
    },
  };
}

// Finite decoder reads actual PNG data/blob bytes and dimensions, not a native
// browser decoding or artwork review claim.
class OriginalImage extends PNGImage {
  releases = 0;
  async decode() {
    await super.decode();
    const blob = resolveObjectURL(this.source),
      bytes = blob
        ? Buffer.from(await blob.arrayBuffer())
        : Buffer.from(this.source.split(',')[1], 'base64');
    this.sha256 = createHash('sha256').update(bytes).digest('hex');
  }
  removeAttribute(name) {
    super.removeAttribute(name);
    if (name === 'src') this.releases++;
  }
}
const running = (p, id) =>
  settle(() => {
    p.frame(0);
    return p.doc.body.dataset.flightState === 'running' && p.rendered.run.levelId === id;
  });

function retainedEditionCards(p, route) {
  return [...p.$('journey-cards').children].filter((card) => {
    const [source, revision] = JSON.parse(card.dataset.missionId);
    return source === `journey:${route.id}` && revision === route.id;
  });
}
async function warmCatalogue(p, route, opener) {
  await openMissionLibrary(p, opener);
  const cards = retainedEditionCards(p, route);
  assert.equal(cards.length, route.source.missions.length);
  p.$('journey-back').click();
  assert.equal(p.$('journey-chooser').open, false);
  assert.equal(p.doc.activeElement.id, opener);
}

async function qualifySolo(t, routeId) {
  const route = createAuthoredJourneyRoute(routeId),
    project = compileContentProject(route.source);
  assert.equal(rows.length, 71);
  const memory = managedIndexedDB(),
    storage = memoryStorage(),
    backend = createJourneyBackend(memory);
  let refuse = null;
  const p = await soloPage(t, {
    search: `?journey=${routeId}`,
    titleScreen: true,
    storage,
    journeyIndexedDB: memory.indexedDB,
    pictures: { Image: OriginalImage },
    fetchResponse: async (path) => {
      if (!String(path).includes('/content-design/assets/')) return;
      if (refuse && String(path).includes(refuse)) return new Response('Offline', { status: 503 });
      return new Response(await readFile(path));
    },
  });
  await warmCatalogue(p, route, 'shell-packs');
  p.$('shell-featured').click();
  await running(p, rows[0][0]);
  for (const [index, [id, , checkpoint, segments]] of rows.entries()) {
    historicalProof(id, checkpoint, segments);
    const { manifest, level, input } = currentRecording(route, project, id);
    assert.equal(p.rendered.run.levelId, id);
    assert.deepEqual(p.rendered.run.level, level);
    const picture = p.rendered.backdrop;
    assert.equal(p.$('theme-select').value, manifest.presentation.themeId, id);
    assert.deepEqual(picture.assetRevision, manifest.background, id);
    assert.equal(picture.image.sha256, manifest.background.sha256, id);
    assert.equal(picture.image.width, manifest.background.width, id);
    playKeyboardRoute(p, () => [p.rendered.run], [keys], input);
    assert.strictEqual(p.rendered.backdrop, picture);
    assert.equal(p.$('game-overlay').dataset.kind, 'won', id);
    assert.equal(p.$('journey-chooser').open, false, id);
    if (index === rows.length - 1) break;
    if (id === 'return-pocket') {
      const oldRun = p.rendered.run;
      refuse = '/signal-pixel-r1/';
      p.$('next-button').click();
      await settle(() => p.$('flight-preparation-status').dataset.state === 'error');
      p.frame(0);
      assert.equal(p.rendered.run, oldRun);
      assert.equal(p.rendered.backdrop, picture);
      assert.equal(picture.image.releases, 0);
      refuse = null;
    }
    p.$('next-button').click();
    await running(p, rows[index + 1][0]);
    assert.equal(p.rendered.run.player.speed, 0, 'Next input is consumed');
  }
  const completed = p.rendered.run;
  assert.match(p.$('next-button').textContent, /Browse missions/);
  p.$('next-button').click();
  await settle(() => p.$('journey-chooser').open);
  assert.equal(retainedEditionCards(p, route).length, 83);
  assert.strictEqual(p.rendered.run, completed);
  assert.equal(completed.levelId, 'home-signal');
  let profile;
  await settle(() => {
    void backend.read().then((value) => (profile = value));
    return Object.keys(profile?.clears.solo ?? {}).length === 71;
  });
  assert.equal(Object.keys(profile.clears.solo).length, 71);
  assert.equal(Object.keys(profile.clears.versus).length, 0);
  assert.equal(Object.keys(profile.clears.team).length, 0);
  for (const key of [
    'revealline.library.dev.v1',
    'revealline.suspended.dev.v1',
    'revealline.suspended.journey-opening.v1',
    'revealline.suspended.journey-authored.v1',
    'revealline.suspended.journey-whole-originals.v1',
    'revealline.suspended.journey-whole-originals.v2',
    `revealline.suspended.journey-whole-originals.${routeId.endsWith('v4') ? 'v3' : 'v4'}`,
  ])
    assert(!storage.writes.some(([written]) => written === key), key);
  assert.deepEqual(p.errors, []);
}

async function qualifyVersus(t, routeId) {
  const route = createAuthoredJourneyRoute(routeId),
    project = compileContentProject(route.source),
    memory = managedIndexedDB(),
    storage = memoryStorage(),
    backend = createJourneyBackend(memory);
  const p = await couchPage(t, {
    href: `http://localhost/game/couch/?journey=${routeId}`,
    initialLevel: null,
    assetDatabase: memory.indexedDB,
    storage,
    ImageClass: OriginalImage,
    fetchResponse: async (url) => {
      if (String(url).includes('/content-design/assets/')) return new Response(await readFile(url));
    },
  });
  await warmCatalogue(p, route, 'race-journey-find');
  p.$('race-start').click();
  await waitFor(() => {
    p.frame(0);
    return !p.$('race-pause').disabled;
  });
  for (const [index, [id, , checkpoint, segments]] of rows.entries()) {
    historicalProof(id, checkpoint, segments);
    const { manifest, level, input } = currentRecording(route, project, id);
    for (const run of p.renders) {
      assert.equal(run.levelId, id);
      assert.deepEqual(run.level, level);
    }
    assert.equal(p.$('race-theme').value, manifest.presentation.themeId, id);
    const picture = p.drawOptions[0].backdrop;
    assert.equal(picture, p.drawOptions[1].backdrop);
    assert.deepEqual(picture.assetRevision, manifest.background, id);
    assert.equal(picture.image.sha256, manifest.background.sha256);
    assert.equal(picture.image.width, manifest.background.width);
    playKeyboardRoute(
      p,
      () => p.renders,
      [{ up: 'KeyW', right: 'KeyD', down: 'KeyS', left: 'KeyA' }, keys],
      input,
    );
    assert.equal(p.$('journey-chooser').open, false);
    assert.equal(p.drawOptions[0].backdrop, picture);
    if (index === rows.length - 1) break;
    const previous = p.renders[0];
    p.$('race-journey-next').click();
    await waitFor(() => {
      p.frame(0);
      return p.renders[0] !== previous && !p.$('race-pause').disabled;
    });
    assert.equal(p.renders[0].levelId, rows[index + 1][0]);
  }
  assert.equal(p.$('race-journey-next').hidden, false);
  assert.match(p.$('race-journey-next').textContent, /Browse missions/);
  assert.match(p.$('race-message').textContent, /End of the main Journey/);
  const completed = [...p.renders];
  p.$('race-journey-next').click();
  await waitFor(() => p.$('journey-chooser').open);
  assert.equal(retainedEditionCards(p, route).length, 83);
  assert.deepEqual(p.renders, completed);
  let profile;
  await waitFor(() => {
    void backend.read().then((value) => (profile = value));
    return Object.keys(profile?.clears.versus ?? {}).length === 71;
  });
  assert.equal(Object.keys(profile.clears.versus).length, 71);
  assert.equal(Object.keys(profile.clears.solo).length, 0);
  assert.equal(Object.keys(profile.clears.team).length, 0);
}

export { qualifySolo, qualifyVersus };
