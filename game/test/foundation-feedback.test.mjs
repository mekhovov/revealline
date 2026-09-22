import test from 'node:test';
import assert from 'node:assert/strict';
import { foundationReturnCaption, foundationCaptionForCell } from '../ui/foundation-feedback.mjs';
import { coopFoundationReturnCaption } from '../couch/coop-feedback.mjs';
import { createOpeningCandidates } from '../content-design/horizon-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const expected =
  'Foundation reached. Close future cuts here; permanent reclaimed ground adds no coverage.';
const project = compileContentProject(createOpeningCandidates());
for (const difficulty of ['gentle', 'standard', 'expert'])
  for (const turnPolicy of ['immediate', 'grid-center'])
    test(`accepted island return teaches without changing ${difficulty}/${turnPolicy} gameplay`, () => {
      const run = createRun(resolveMission(project, 'nearby-shore', { difficulty }).level, {
        seed: 1,
        turnPolicy,
      });
      assert.equal(foundationReturnCaption(run), '');
      for (let i = 0; i < 250 && !run.events.some((e) => e.type === 'cut.closed'); i++)
        stepRun(run, { direction: 'down' }, FIXED_DT);
      assert.equal(run.tick, 174);
      const before = authoritativeCheckpoint(run);
      assert.equal(foundationReturnCaption(run), expected);
      assert.deepEqual(authoritativeCheckpoint(run), before);
      assert.equal(
        foundationReturnCaption(run, [{ type: 'cells.claimed' }]),
        '',
        'no boss-release inference',
      );
      assert.equal(
        foundationReturnCaption(run, [{ type: 'cut.closed' }]),
        '',
        'no moving closure inference',
      );
      stepRun(run, { direction: null }, FIXED_DT);
      assert.equal(foundationReturnCaption(run), '', 'old return events do not repeat');
    });

test('foundation labels do not expand rectangles or label the ordinary perimeter', () => {
  const rects = [{ x: 30, y: 15, w: 5, h: 5 }];
  assert.equal(foundationCaptionForCell(rects, 15 * 72 + 30, 72), expected);
  for (const index of [-1, 0.5, 0, 15 * 72 + 29, 15 * 72 + 35, 20 * 72 + 30])
    assert.equal(foundationCaptionForCell(rects, index, 72), '');
  assert.equal(foundationCaptionForCell(undefined, 1110, 72), '');
});

function teamReturnPack() {
  const source = createStarterProject('team-return-feedback');
  source.maps[0].spawns.push({ id: 'partner', x: 0.5, y: 17.5 });
  source.missions[0].modes = ['team'];
  source.missions[0].team = { format: 'TeamMissionV1', spawnIds: ['home', 'partner'] };
  source.missions[0].design.difficulty.coordination = 1;
  return createTeamTestPack(source, 'nearby-shore', 'standard');
}

test('Team captions only physical Journey foundation returns, without state mutation', () => {
  const run = createCoop(teamReturnPack().levels[0]);
  startCoop(run);
  const command = (direction) => ({ direction, boost: false, support: false });
  stepCoop(run, [command(null), command(null)], FIXED_DT);
  for (let i = 0; i < 300 && !run.events.some((e) => e.type === 'cut.closed'); i++)
    stepCoop(run, [command('down'), command(null)], FIXED_DT);
  assert(run.events.some((e) => e.type === 'cut.closed' && e.reason === 'return'));
  const before = structuredClone(run);
  assert.equal(coopFoundationReturnCaption(run), expected);
  assert.deepEqual(run, before);
  for (const reason of ['joint', 'assist', 'assisted', 'enclosed'])
    assert.equal(coopFoundationReturnCaption(run, [{ type: 'cut.closed', player: 0, reason }]), '');
  assert.equal(
    coopFoundationReturnCaption({
      ...run,
      level: { ...run.level, version: 'revealline-coop-level.v1' },
    }),
    '',
  );
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`Solo host retains the return explanation through capture.stopped: ${turnPolicy}`, async (t) => {
    const { themes } = JSON.parse(
      await readFile(new URL('../content-design/themes.json', import.meta.url)),
    );
    const preview = prepareContentPreview(createOpeningCandidates(), 'nearby-shore', {
      theme: themes[0],
    });
    preview.scenario.settings.turnPolicy = turnPolicy;
    const p = await soloPage(t, {
      search: '?practice=1',
      storage: memoryStorage(),
      previewStorage: memoryStorage({
        'revealline.playground.current': JSON.stringify(preview.scenario),
      }),
    });
    p.$('start-button').click();
    await settle(() => p.doc.body.dataset.flightState === 'running');
    p.frame(0);
    const run = p.rendered.run;
    assert.equal(run.turnPolicy, turnPolicy);
    p.key('ArrowDown');
    p.key('ArrowDown', false);
    for (let i = 0; i < 300 && run.claimedCount === 0; i++) p.frame();
    assert.equal(run.player.speed, 0);
    assert.equal(run.classic.livesLost, 0);
    assert.match(
      p.$('run-message').textContent,
      /Line secured.*0.6%.*Foundation reached.*Tap a direction/,
    );
    assert.equal(p.doc.body.dataset.flightState, 'running', 'no teaching dialog');
    p.key('ArrowRight');
    p.key('ArrowRight', false);
    for (let i = 0; i < 60 && !run.player.cutting; i++) p.frame();
    assert(run.player.cutting);
    assert.doesNotMatch(p.$('run-message').textContent, /Foundation reached/);
    assert.deepEqual(p.errors, []);
  });

  test(`Versus returns are seat-local and retire on fresh movement: ${turnPolicy}`, async (t) => {
    const p = await couchPage(t, {
      href: 'http://localhost/game/couch/?journey=opening',
      initialLevel: null,
      turnPolicy,
      storage: memoryStorage(),
      assetDatabase: managedIndexedDB().indexedDB,
      fetchResponse: async (path) =>
        String(path).includes('/content-design/assets/')
          ? new Response(await readFile(path))
          : undefined,
    });
    p.$('race-start').click();
    await settle(() => {
      p.frame(0);
      return !p.$('race-pause').disabled;
    });
    p.$('race-journey-find').click();
    [...p.$('journey-cards').children]
      .find((card) => card.dataset.missionId.endsWith('/nearby-shore'))
      .click();
    await settle(() => {
      p.frame(0);
      return p.renders[0].levelId === 'nearby-shore' && !p.$('race-pause').disabled;
    });
    p.key('KeyS');
    assert.equal(p.renders[0].turnPolicy, turnPolicy);
    for (let i = 0; i < 300 && !p.renders[0].claimedCount; i++) p.frame();
    p.key('KeyS', false);
    assert.equal(p.$('racer-capture-0').textContent, expected);
    assert.equal(p.$('racer-capture-0').hidden, false);
    assert.equal(p.$('racer-capture-1').hidden, true);
    assert.equal(p.renders[1].claimedCount, 0);
    assert.equal(p.renders[0].player.speed, 0);
    p.$('race-pause').click();
    p.frame(0);
    assert.equal(p.$('racer-capture-0').textContent, expected);
    p.$('race-start').click();
    await settle(() => {
      p.frame(0);
      return !p.$('race-pause').disabled;
    });
    p.key('KeyD');
    for (let i = 0; i < 6; i++) p.frame();
    p.key('KeyD', false);
    assert.equal(p.$('racer-capture-0').hidden, true);
    assert(p.renders[0].player.speed > 0);
  });
}

test('real Team import explains a return without a menu or a compulsory partner action', async (t) => {
  const p = await teamPage(t, { nativeFocus: true, nativeVisibility: true });
  await p.selectFile(JSON.stringify(teamReturnPack()));
  assert.equal(p.$('coop-pack-status').dataset.state, 'ready');
  p.$('coop-start').click();
  p.tick(3);
  p.tap('ArrowDown');
  p.tap('KeyS');
  for (let i = 0; i < 300 && !p.$('coop-message').textContent.includes('Foundation reached'); i++)
    p.tick();
  assert.equal(p.$('coop-message').textContent, expected);
  p.tick(12);
  assert.equal(
    p.$('coop-message').textContent,
    expected,
    "a moving partner cannot retire the landed pilot's cue",
  );
  assert.equal(p.$('coop-menu').hidden, true);
  assert.equal(p.$('coop-state-0').textContent, 'On reclaimed ground');
  assert.equal(p.$('coop-state-1').textContent, 'On reclaimed ground');
  p.tap('KeyD');
  p.tick(50);
  assert.equal(p.$('coop-state-0').textContent, 'Line exposed');
  assert.equal(
    p.$('coop-message').textContent,
    'Choose your next route. Close cuts on reclaimed ground.',
  );
});
