import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';
import {
  winImported,
  playImportedRoute,
  importedCoverageRoute,
} from './helpers/coop-import-win.mjs';
import { earnTeamVictory, teamHud, teamImage, teamTabTo } from './helpers/coop-win.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { COOP_PICTURE_BINDINGS } from '../couch/coop-picture-bindings.mjs';
import { TEAM_ARENA_PREFERENCE_KEY } from '../couch/team-arena-preference.mjs';

// Earn wins with ordinary keyboard inputs through the mounted host. Finite
// DOM/Canvas and decoded-image fixtures are not physical-device evidence.
const presentation = (f) => ({
  hud: teamHud(f),
  paint: f.lastPaint,
  image: teamImage(f),
});
const io = (f) => ({
  reads: f.artwork.calls.reads.length,
  decodes: f.artwork.calls.decodes.length,
  urls: [...f.artwork.calls.urls],
  releases: [...f.artwork.calls.releases],
});

async function next(f) {
  teamTabTo(f, 'coop-next');
  f.tap('Enter');
  await waitFor(
    () => f.$('coop-overlay').hidden,
    () => f.$('coop-next-status').textContent,
  );
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.ok(f.lastPaint);
}

function conflictingDraft(f, level = 'boundary-multi-core-stronghold') {
  f.$('coop-level').value = level;
  f.$('coop-difficulty').value = 'expert';
  f.$('coop-experiment').value = 'independent';
}

function assertFresh(f, accepted, resources) {
  assert.deepEqual(presentation(f).hud, accepted.hud);
  assert.equal(f.lastPaint, accepted.paint);
  assert.equal(teamImage(f), accepted.image);
  assert.deepEqual(io(f), resources, 'Retry reuses accepted resources without image IO');
  assert.equal(f.$('coop-clock').textContent, '0:00');
  assert.equal(f.$('coop-coverage').textContent, '0.0%');
  assert.equal(f.$('coop-menu').hidden, true);
  assert.equal(f.$('coop-overlay').hidden, true);
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-canvas');
  assert.deepEqual(f.visits, []);
}

function assertCoverageSuccess(f) {
  assert.ok(Number.parseFloat(f.$('coop-coverage').textContent) >= 72.4);
  assert.equal(f.$('coop-next').hidden, true);
  assert.match(f.$('coop-overlay-copy').textContent, /Final arena in this pack/);
  assert.equal(f.doc.activeElement.id, 'coop-lobby');
}

test('imported Next → paused Retry preserves the accepted successor through Stay and confirmation', async (t) => {
  const f = await winImported(t, { capturePaint: true });
  await next(f);
  const accepted = presentation(f);
  const resources = io(f);
  assert.equal(f.$('coop-stage').textContent, 'IMPORTED COVERAGE');
  assert.equal(f.$('coop-objective').textContent, 'Reveal 72.4% together');
  assert.ok(Math.abs(f.$('coop-progress').max - 72.4) < 1e-9);
  assert.equal(f.$('coop-reserves').textContent, '5 reserves');
  f.tick(2);
  f.tap('KeyD');
  f.tick(45);
  assert.notEqual(f.lastPaint, accepted.paint, 'Ordinary input advances the successor');
  f.tap('Escape');
  assert.equal(f.$('coop-overlay').hidden, false);
  assert.equal(f.$('coop-resume').hidden, false);
  const paused = presentation(f);
  conflictingDraft(f);
  teamTabTo(f, 'coop-retry');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
  assert.equal(f.doc.activeElement.id, 'coop-discard-stay');
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, false);
  assert.equal(f.doc.activeElement.id, 'coop-retry');
  f.tick(60);
  assert.deepEqual(presentation(f), paused, 'Stay keeps the original attempt paused');
  assert.deepEqual(io(f), resources);
  f.tap('Enter');
  assert.equal(f.$('coop-discard-dialog').open, true);
  // Even later draft changes cannot replace the recipe captured by Retry.
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-experiment').value = 'joint';
  teamTabTo(f, 'coop-discard-confirm');
  f.tap('Enter');
  assertFresh(f, accepted, resources);
  const route = playImportedRoute(f, importedCoverageRoute);
  assertCoverageSuccess(f);
  t.diagnostic(JSON.stringify({ coverageInputFrames: route.replayed, hud: teamHud(f) }));
});

test('imported final Results → Retry retains the coverage arena and earns the same final result again', async (t) => {
  const f = await winImported(t, { capturePaint: true });
  await next(f);
  const accepted = presentation(f);
  const resources = io(f);
  playImportedRoute(f, importedCoverageRoute);
  assertCoverageSuccess(f);
  const firstResult = presentation(f);
  conflictingDraft(f);
  teamTabTo(f, 'coop-retry');
  f.tap('Enter');
  assertFresh(f, accepted, resources);
  playImportedRoute(f, importedCoverageRoute);
  assertCoverageSuccess(f);
  // Next and Retry establish different frame-clock origins, so DOM-frame
  // gestures are not a tick-aligned replay. Compare the observed outcome/image,
  // then verify the retried result stays stopped.
  assert.deepEqual(teamHud(f), firstResult.hud);
  assert.equal(teamImage(f), firstResult.image);
  const retryResult = presentation(f);
  assert.deepEqual(io(f), resources);
  f.tick(60);
  assert.deepEqual(presentation(f), retryResult);
  // Restore the setup draft deliberately before returning to its separate UI.
  f.$('coop-level').value = 'boundary-multi-core-coverage';
  f.$('coop-difficulty').value = 'gentle';
  f.$('coop-experiment').value = 'full';
  f.tap('Enter');
  assert.equal(f.$('coop-menu').hidden, false);
  assert.equal(f.doc.activeElement.id, 'coop-start');
  assert.equal(f.$('coop-picture-status').dataset.state, 'ready');
  f.tick(30);
  assert.equal(f.$('coop-menu').hidden, false, 'Returning to setup never starts automatically');
});

test('an imported starter copy → Next → won Retry reuses the exact accepted Yard artwork without owning the builtin bookmark', async (t) => {
  const saved = JSON.stringify({
    version: 'revealline-team-arena.v1',
    packId: COOP_STARTER_PACK.id,
    packRevision: COOP_STARTER_PACK.revision,
    levelId: 'first-connection',
  });
  const writes = [];
  const f = await page(t, {
    nativeFocus: true,
    nativeVisibility: true,
    capturePaint: true,
    beforeImport({ install }) {
      install('localStorage', {
        value: {
          getItem: (key) => (key === TEAM_ARENA_PREFERENCE_KEY ? saved : null),
          setItem: (key, value) => writes.push({ key, value }),
        },
      });
    },
  });
  await f.selectFile(JSON.stringify(COOP_STARTER_PACK));
  f.$('coop-difficulty').value = 'standard';
  f.$('coop-experiment').value = 'full';
  f.$('coop-start').focus();
  f.tap('Enter');
  earnTeamVictory(t, f);
  await next(f);
  const accepted = presentation(f);
  const resources = io(f);
  const binding = COOP_PICTURE_BINDINGS.find((entry) => entry.levelId === 'relay-yard');
  assert.equal(f.$('coop-stage').textContent, 'RELAY YARD');
  assert.equal(accepted.image.sha256, binding.picture.sha256);
  const acceptedURL = accepted.image.src;
  earnTeamVictory(t, f, 'relay-yard');
  conflictingDraft(f, 'first-connection');
  teamTabTo(f, 'coop-retry');
  f.tap('Enter');
  assertFresh(f, accepted, resources);
  assert.equal(teamImage(f).src, acceptedURL);
  assert.equal(f.artwork.calls.releases.includes(acceptedURL), false);
  assert.deepEqual(
    writes.filter(({ key }) => key === TEAM_ARENA_PREFERENCE_KEY),
    [],
  );
  earnTeamVictory(t, f, 'relay-yard');
  assert.deepEqual(io(f), resources);
  assert.equal(f.$('coop-next').hidden, true);
});
