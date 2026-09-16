import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, authoritativeCheckpoint, verifyReplay } from '../replay.mjs';
import { suspendSession, saveSession } from '../sessions.mjs';
import { emptyLibrary, updatePreferences, saveLibrary, loadLibrary } from '../library.mjs';
import { createDifficultyContext } from '../campaign-difficulty.mjs';
import { retryFixture } from './fixtures/retry-scenarios.mjs';
import { soloPage, memoryStorage, settle } from './helpers/solo-dom.mjs';

const read = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const profileKey = 'revealline.library.dev.v1';
const sessionKey = 'revealline.suspended.dev.v1';
// Authored data, not a core-state patch: real self-crossing causes recovery, while
// the remote stationary seed keeps ordinary live-cut checks deterministic.
const level = retryFixture('self-contact').level;
const campaign = {
  version: 'xonix-campaign.v1',
  id: 'difficulty-host',
  revision: '1',
  title: 'Host crossing',
  classRecipes: read('../content/classes.json'),
  levels: [{ ...level, rules: { lives: 3 } }],
};
const standard = createDifficultyContext(campaign, 'standard');
const gentle = createDifficultyContext(campaign, 'gentle');
const campaigns = [standard.campaign, gentle.campaign];
const stamp = '2026-09-12T12:00:00.000Z';
function fixture(context, turnPolicy, count = 12) {
  const options = { seed: 1, classId: 'scout', classRecipes: campaign.classRecipes, turnPolicy };
  const run = createRun(context.campaign.levels[0], options);
  const recorder = createRecorder(context.campaign.levels[0], options);
  for (let i = 0; i < count; i++) {
    const command = { direction: 'down' };
    stepRun(run, command, FIXED_DT);
    recordInput(recorder, command);
  }
  return suspendSession({
    run,
    recorder,
    campaignKey: context.campaignKey,
    runId: `saved-${context.mode}-${turnPolicy}`,
    themeId: 'fpv',
    bodyId: 'fpv-body',
    savedAt: stamp,
  });
}
function initialStorage(turnPolicy, saved = fixture(standard, turnPolicy)) {
  const storage = memoryStorage();
  assert.equal(
    saveLibrary(storage, profileKey, updatePreferences(emptyLibrary(), { turnPolicy })).ok,
    true,
  );
  assert.equal(saveSession(storage, sessionKey, saved).ok, true);
  return storage;
}
const saved = (page) => JSON.parse(page.storage.getItem(sessionKey));
const slotWrites = (page) => page.storage.writes.filter(([key]) => key === sessionKey);
const preference = (page) =>
  loadLibrary(page.storage, profileKey, { campaigns }).library.preferences.campaignDifficulty;
function ticks(page, count) {
  for (let i = 0; i < count; i++) page.frame();
}
function changeOnly(page, value, expectedPaused) {
  const before = page.rendered.run;
  const checkpoint = authoritativeCheckpoint(before);
  const raw = page.storage.getItem(sessionKey);
  const writes = slotWrites(page).length;
  const reads = page.padReads;
  page.change('difficulty-select', value);
  assert.equal(page.padReads, reads, 'setting-only handler must not poll hardware');
  assert.strictEqual(page.rendered.run, before);
  assert.deepEqual(
    authoritativeCheckpoint(before),
    checkpoint,
    'settings preserve exact simulation and pending turn',
  );
  assert.equal(page.storage.getItem(sessionKey), raw, 'saved slot bytes remain exact');
  assert.equal(slotWrites(page).length, writes, 'no hidden pause/autosave');
  page.frame(0); // A real render verifies the private host run, not a stale observer.
  assert.strictEqual(page.rendered.run, before);
  assert.equal(page.rendered.paused, expectedPaused);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.equal(page.storage.getItem(sessionKey), raw);
  assert.equal(slotWrites(page).length, writes);
}
function pauseAndRead(page, expectedContext) {
  page.$('pause-button').click();
  page.frame(0);
  assert.equal(page.rendered.paused, true);
  const session = saved(page);
  assert.equal(session.campaignKey, expectedContext.campaignKey);
  assert.deepEqual(session.replay.checkpoint, authoritativeCheckpoint(page.rendered.run));
  const checked = verifyReplay(session.replay);
  assert.equal(checked.match, true, JSON.stringify(checked.diagnostics));
  return session;
}
async function retryInto(page, context, previous, control = 'overlay-restart') {
  assert.equal(page.$(control).hidden, false);
  page.$(control).focus();
  page.$(control).click(); // Actual visible restart or terminal Retry handler.
  if (control === 'overlay-restart') {
    assert.equal(page.$('restart-dialog').open, true);
    assert.equal(page.doc.activeElement.id, 'restart-cancel');
    page.$('restart-confirm').click();
  }
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Retry prepares its new picture before flight.',
  );
  page.frame(0);
  assert.notStrictEqual(page.rendered.run, previous);
  assert.equal(page.rendered.paused, false);
  assert.equal(page.rendered.run.tick, 0);
  assert.deepEqual(
    page.rendered.run.level,
    createRun(context.campaign.levels[0], {
      classId: 'scout',
      classRecipes: campaign.classRecipes,
      turnPolicy: previous.turnPolicy,
      seed: 1,
    }).level,
  );
  assert.equal(page.rendered.run.lives, context.mode === 'gentle' ? 5 : 3);
}

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: active and paused live-cut preference changes preserve the actual run, recorder and raw saved slot`, async (t) => {
    const page = await soloPage(t, { campaign, storage: initialStorage(turnPolicy) });
    assert.equal(page.$('difficulty-select').value, 'standard');
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.key('ArrowDown');
    ticks(page, 30);
    const run = page.rendered.run;
    assert.equal(run.tick, 30);
    assert.equal(run.player.cutting, true);
    assert.equal(run.turnPolicy, turnPolicy);
    changeOnly(page, 'gentle', false);
    assert.equal(preference(page), 'gentle');
    const first = pauseAndRead(page, standard);
    assert.equal(first.replay.ticks, 30);
    assert.equal(first.replay.segments.length, 1);
    assert.equal(first.replay.segments[0].input.direction, 'down');
    assert.equal(first.replay.segments[0].ticks, 30);
    changeOnly(page, 'standard', true);
    changeOnly(page, 'gentle', true);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.frame(0);
    assert.strictEqual(page.rendered.run, run);
    assert.equal(page.rendered.paused, false);
    assert.equal(run.lives, 3, 'Resume preserves Standard despite next-attempt Gentle');
    page.key('ArrowDown');
    ticks(page, 12);
    const second = pauseAndRead(page, standard);
    assert.equal(second.runId, first.runId);
    assert.equal(second.replay.ticks, 42);
    assert.equal(second.format, 'xonix-session.v4');
    assert.equal(second.presentationPins.format, 'revealline-flight-pictures.v2');
    assert.ok(
      second.presentationPins.choices.every(
        (choice) => choice.picture.kind === 'legacy' && choice.story === null,
      ),
    );
    assert.equal(second.continuation.direction, 'down');
    assert.equal(second.replay.segments.length, 1);
    assert.equal(second.replay.segments[0].ticks, 42);
    assert.equal(second.replay.segments[0].input.direction, 'down');
    await retryInto(page, gentle, run);
    page.key('ArrowDown');
    ticks(page, 12);
    const fresh = pauseAndRead(page, gentle);
    assert.notEqual(fresh.runId, first.runId);
    assert.equal(fresh.replay.ticks, 12, 'Retry creates a fresh recorder');
    assert.deepEqual(page.errors, []);
  });

  test(`${turnPolicy}: recovery preference changes cannot replace the run or save, and Resume retains its recovery`, async (t) => {
    const page = await soloPage(t, { campaign, storage: initialStorage(turnPolicy) });
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.key('ArrowDown');
    ticks(page, 30);
    page.key('ArrowDown', false);
    page.key('ArrowUp');
    ticks(page, 1);
    const run = page.rendered.run;
    assert.equal(run.tick, 31);
    assert.equal(run.status, 'respawning');
    assert.equal(run.lives, 2);
    changeOnly(page, 'gentle', false);
    const session = pauseAndRead(page, standard);
    assert.equal(session.replay.ticks, 31);
    assert.equal(session.replay.segments[1].input.direction, 'up');
    assert.equal(session.replay.summary.failureCause, 'self-contact');
    changeOnly(page, 'standard', true);
    changeOnly(page, 'gentle', true);
    const checkpoint = authoritativeCheckpoint(run);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.frame(0);
    assert.strictEqual(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(run.status, 'respawning');
    ticks(page, 240);
    assert.equal(run.status, 'running');
    assert.equal(run.lives, 2);
    const continued = pauseAndRead(page, standard);
    assert.equal(continued.runId, session.runId);
    assert.equal(continued.replay.ticks, 271);
    await retryInto(page, gentle, run);
    assert.deepEqual(page.errors, []);
  });

  test(`${turnPolicy}: saved Gentle loads paused with its exact key while Standard remains the next preference`, async (t) => {
    const original = fixture(gentle, turnPolicy, 30);
    const storage = initialStorage(turnPolicy, original);
    const page = await soloPage(t, { campaign, storage });
    assert.equal(page.rendered.run.lives, 3);
    assert.equal(page.$('continue-saved').hidden, false);
    const bytes = storage.getItem(sessionKey),
      writes = slotWrites(page).length;
    page.$('continue-saved').click();
    await settle(
      () => !page.$('continue-saved').disabled && page.$('game-overlay').dataset.kind === 'pause',
      page.$('run-message').textContent,
    );
    page.frame(0);
    const run = page.rendered.run;
    assert.equal(page.rendered.paused, true);
    assert.equal(run.lives, 5);
    assert.deepEqual(authoritativeCheckpoint(run), original.replay.checkpoint);
    assert.equal(page.$('difficulty-select').value, 'standard');
    assert.equal(preference(page), 'standard');
    assert.equal(storage.getItem(sessionKey), bytes);
    assert.equal(slotWrites(page).length, writes);
    page.$('start-button').click();
    await settle(
      () => page.doc.body.dataset.flightState === 'running',
      'Explicit Start/Resume waits for the selected picture before movement.',
    );
    page.key('ArrowDown');
    ticks(page, 12);
    const continued = pauseAndRead(page, gentle);
    assert.equal(continued.runId, original.runId);
    assert.equal(continued.replay.ticks, 42);
    assert.deepEqual(continued.replay.segments[0], original.replay.segments[0]);
    await retryInto(page, standard, run);
    assert.deepEqual(page.errors, []);
  });
}

test('actual preference handler adopts the three-way merged saved value before preparing Ready', async (t) => {
  const storage = initialStorage('immediate');
  const page = await soloPage(t, { campaign, storage });
  const baseline = loadLibrary(storage, profileKey, { campaigns });
  // A second storage writer is modeled through the same public save API. Its
  // edit differs from this page's unchanged local Standard baseline.
  const remote = saveLibrary(
    storage,
    profileKey,
    updatePreferences(baseline.library, { campaignDifficulty: 'gentle' }),
    null,
    {
      baseline: baseline.library,
      generation: baseline.generation,
    },
  );
  assert.equal(remote.ok, true);
  const bytes = storage.getItem(sessionKey),
    writes = slotWrites(page).length;
  page.change('difficulty-select', 'standard');
  page.frame(0);
  assert.equal(preference(page), 'gentle');
  assert.equal(page.$('difficulty-select').value, 'gentle');
  assert.equal(page.rendered.run.lives, 5, 'Ready preparation follows adopted merged preference');
  assert.equal(page.rendered.paused, true);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(storage.getItem(sessionKey), bytes);
  assert.equal(slotWrites(page).length, writes);
  assert.deepEqual(page.errors, []);
});

test('a legally lost Standard attempt retries through the result button into fresh Gentle', async (t) => {
  const page = await soloPage(t, { campaign, storage: initialStorage('immediate') });
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  ticks(page, 30);
  page.key('ArrowDown', false);
  const first = pauseAndRead(page, standard);
  const run = page.rendered.run;
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  for (let remaining = 2; remaining >= 0; remaining--) {
    page.key('ArrowUp');
    ticks(page, 1);
    page.key('ArrowUp', false);
    assert.equal(run.lives, remaining);
    assert.equal(run.failureCause, 'self-contact');
    if (remaining) {
      assert.equal(run.status, 'respawning');
      ticks(page, 240);
      assert.equal(run.status, 'running');
      page.key('ArrowDown');
      ticks(page, 30);
      page.key('ArrowDown', false);
    }
  }
  assert.equal(run.status, 'lost');
  assert.equal(page.$('game-overlay').hidden, true);
  ticks(page, 80);
  assert.equal(page.rendered.paused, true);
  assert.equal(page.$('game-overlay').dataset.kind, 'lost');
  changeOnly(page, 'gentle', true);
  await retryInto(page, gentle, run, 'retry-button');
  page.key('ArrowDown');
  ticks(page, 12);
  const retried = pauseAndRead(page, gentle);
  assert.notEqual(retried.runId, first.runId);
  assert.equal(retried.replay.ticks, 12);
  assert.equal(retried.replay.summary.failureCause, null);
  assert.equal(retried.replay.summary.lives, 5);
  assert.deepEqual(page.errors, []);
});

test('replacing a two-chapter pack retains the active Gentle chapter and applies the next mode', async (t) => {
  const source = read('../content/packs/night-shift.json');
  const pack = {
    ...source,
    id: 'host-two-chapters',
    name: 'Host two chapters',
    description: 'A small public pack fixture with two distinct authored chapters.',
    campaigns: ['first', 'second'].map((part) => ({
      version: 'xonix-campaign.v1',
      id: `host-chapter-${part}`,
      revision: '1',
      title: `Host ${part} chapter`,
      themeId: source.themes[0].id,
      musicId: source.music[0].id,
      levels: [
        {
          ...campaign.levels[0],
          id: `host-map-${part}`,
          name: `Host ${part} map`,
        },
      ],
    })),
  };
  const second = { ...pack.campaigns[1], classRecipes: pack.classRecipes };
  const expectedStandard = createDifficultyContext(second, 'standard');
  const expectedGentle = createDifficultyContext(second, 'gentle');
  const page = await soloPage(t, { campaign, storage: initialStorage('immediate') });
  async function install(candidate) {
    page.$('library-button').click();
    assert.equal(page.$('library-dialog').open, true);
    page.doc.querySelector('[data-library-panel="packs"]').click();
    assert.equal(page.$('library-packs').hidden, false);
    page.$('pack-json').value = JSON.stringify(candidate);
    assert.equal(page.$('install-pack').disabled, false);
    page.$('install-pack').click();
    await settle(() => !page.$('install-pack').disabled);
    assert.match(page.$('pack-status').textContent, /Validated and installed/);
    page.frame(0);
  }
  await install(pack);
  const play = page
    .$('installed-packs')
    .querySelectorAll('button')
    .find((button) => button.textContent === 'Play Host second chapter');
  assert.ok(play, 'The real library exposes each authored chapter separately.');
  play.click();
  await settle(() => !page.$('library-dialog').open);
  assert.equal(page.$('library-dialog').open, false);
  page.change('difficulty-select', 'gentle');
  page.frame(0);
  assert.equal(page.rendered.run.levelId, 'host-map-second');
  assert.equal(page.rendered.run.revision, expectedGentle.campaign.levels[0].revision);
  assert.equal(page.rendered.run.lives, 5);

  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  ticks(page, 12);
  const current = page.rendered.run;
  changeOnly(page, 'standard', false);
  assert.equal(current.revision, expectedGentle.campaign.levels[0].revision);
  assert.equal(preference(page), 'standard');
  // Opening Library may legitimately pause/save; this replacement must resolve
  // the authored second chapter from the active derived Gentle context.
  await install({ ...pack, version: '1.0.1' });
  assert.notStrictEqual(page.rendered.run, current);
  assert.equal(page.rendered.run.levelId, 'host-map-second');
  assert.equal(page.$('campaign-select').value, expectedStandard.campaignKey);
  assert.equal(page.$('level-select').value, 'host-map-second');
  assert.equal(page.$('difficulty-select').value, 'standard');
  assert.equal(page.rendered.run.lives, 3);
  assert.equal(page.rendered.run.tick, 0);
  assert.equal(page.rendered.paused, true);
  assert.match(page.$('installed-packs').children[0].children[0].textContent, /1\.0\.1/);
  const { readAssetStore } = await import('../storage.mjs');
  const persisted = JSON.parse(await readAssetStore('revealline.packs.dev.v1'));
  assert.equal(persisted.packs[0].version, '1.0.1');
  assert.deepEqual(
    persisted.packs[0].campaigns.map((entry) => entry.id),
    ['host-chapter-first', 'host-chapter-second'],
  );
  page.$('library-dialog').close();
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  ticks(page, 12);
  const next = pauseAndRead(page, expectedStandard);
  assert.equal(next.replay.level.id, 'host-map-second');
  assert.equal(next.replay.ticks, 12);
  assert.deepEqual(page.errors, []);
});

test('ordinary practice selecting an authored campaign ignores saved Gentle and cannot award or save', async (t) => {
  const { entryScenario } = await import('../playground/model.mjs');
  const { prepareScenario } = await import('../imports.mjs');
  const base = {
    ...campaign,
    id: 'practice-mode-host',
    levels: [
      {
        ...campaign.levels[0],
        id: 'practice-mode-host-01',
        spawn: { x: 24.5, y: 0.5 },
        goal: { coverage: 0.45 },
      },
    ],
  };
  const entry = {
    campaign: base,
    classRecipes: base.classRecipes,
    themes: [read('../content/themes.json').themes.find((theme) => theme.id === 'fpv')],
    visualOverrides: {},
    levelVisuals: [],
  };
  const prepared = await prepareScenario(entryScenario(entry, base.levels[0].id));
  const previewStorage = memoryStorage({
    'revealline.playground.current': JSON.stringify(prepared.scenario),
  });
  const storage = initialStorage('immediate');
  const prior = loadLibrary(storage, profileKey);
  assert.equal(
    saveLibrary(
      storage,
      profileKey,
      updatePreferences(prior.library, {
        campaignDifficulty: 'gentle',
      }),
      null,
      { baseline: prior.library, generation: prior.generation },
    ).ok,
    true,
  );
  const before = [...storage.map],
    writes = storage.writes.length;
  const page = await soloPage(t, {
    campaign: base,
    storage,
    search: '?practice=1',
    previewStorage,
  });
  assert.equal(page.rendered.run.lives, 3);
  assert.equal(page.$('difficulty-select').disabled, true);
  // Select a real dated practice activity first, so returning to the authored
  // campaign is an actual combobox value change, not a repeated same-option event.
  page.$('library-button').click();
  page.doc.querySelector('[data-library-panel="challenges"]').click();
  page.$('challenge-date').value = '2026-09-12';
  page.change('challenge-kind', 'calm');
  page.$('launch-challenge').click();
  await settle(() => !page.$('library-dialog').open);
  assert.equal(page.$('library-dialog').open, false);
  const authored = createDifficultyContext(base, 'standard');
  assert.notEqual(page.$('campaign-select').value, authored.campaignKey);
  page.change('campaign-select', authored.campaignKey);
  page.frame(0);
  assert.equal(page.rendered.run.levelId, base.levels[0].id);
  assert.equal(page.rendered.run.revision, base.levels[0].revision);
  assert.equal(page.rendered.run.lives, 3);
  assert.equal(page.$('difficulty-select').disabled, true);
  assert.match(page.$('overlay-eyebrow').textContent, /PRACTICE/);
  assert.equal(preference(page), 'gentle', 'Practice must not persist a different preference.');
  page.$('start-button').click();
  await settle(
    () => page.doc.body.dataset.flightState === 'running',
    'Explicit Start/Resume waits for the selected picture before movement.',
  );
  page.key('ArrowDown');
  for (let tick = 0; page.rendered.run.status === 'running' && tick < 600; tick++) page.frame();
  assert.equal(page.rendered.run.status, 'won');
  assert.equal(page.rendered.run.lives, 3);
  assert.match(page.$('overlay-copy').textContent, /Practice complete/);
  assert.deepEqual([...storage.map], before);
  assert.equal(storage.writes.length, writes, 'A real practice win cannot write awards or a save.');
  page.$('collection-button').click();
  assert.equal(page.$('gallery-grid').children.length, 0, 'No in-memory picture award either.');
  assert.deepEqual(page.errors, []);
});
