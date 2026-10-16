import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { missionBriefing } from '../mission-brief.mjs';
import { createCombatCandidates } from '../content-design/combat-candidates.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { prepareContentPreview } from '../content-design/preview.mjs';
import { prepareScenario } from '../imports.mjs';
import { createRun } from '../core/index.mjs';
import { authoritativeCheckpoint, createRecorder, exportReplay, verifyReplay } from '../replay.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { combatLevel, combat, patrol, ticks } from './helpers/combat-fixture.mjs';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';

const project = createCombatCandidates();
const compiled = compileContentProject(project);
const levelFor = (id) => resolveMission(compiled, id).level;

test('compiled optional missions explain their actual roles without changing authored data', () => {
  const before = JSON.stringify(project);
  for (const id of ['workshop-sweep', 'sentry-detour', 'two-bay-service']) {
    const level = levelFor(id),
      source = JSON.stringify(level),
      card = missionBriefing(level);
    assert.match(card.copy, /Bracketed/);
    assert.match(card.copy, /touch or enclose to remove/);
    assert.ok(card.copy.length <= 240, card.copy);
    assert.match(card.fullBrief, /Round keepers|round keepers/);
    if (id === 'workshop-sweep') {
      assert.match(card.copy, /scouts/);
      assert.doesNotMatch(card.copy + card.fullBrief, /[Ss]entr/);
      assert.match(card.fullBrief, /do not damage your unfinished line/);
    } else {
      assert.match(card.copy, /Sentries lock aim/);
      assert.match(card.fullBrief, /later steering does not move its aim/);
      assert.match(card.fullBrief, /close your cut before firing/);
      assert.match(card.fullBrief, /recovering sentry can still have a live shot/);
      assert.match(card.fullBrief, /do not cross a live shot to reach it/);
    }
    assert.equal(JSON.stringify(level), source);
  }
  assert.equal(JSON.stringify(project), before);
});

test('absent, disabled, empty and unsupported combat do not alter previous briefing output', () => {
  const level = structuredClone(levelFor('sentry-detour'));
  delete level.classic.combatPatrols;
  const expected = missionBriefing(level);
  const definition = levelFor('sentry-detour').classic.combatPatrols;
  for (const combatPatrols of [
    { ...definition, enabled: false },
    { ...definition, enabled: true, actors: [] },
    { ...definition, enabled: 'true' },
    { ...definition, version: 'combat-patrols.v2' },
  ])
    assert.deepEqual(
      missionBriefing({ ...level, classic: { ...level.classic, combatPatrols } }),
      expected,
    );
});

test('optional guidance preserves full authored prose and coexisting pressure counterplay', () => {
  const level = structuredClone(levelFor('sentry-detour'));
  level.metadata = { description: 'My exact imported route.\nKeep its spacing and punctuation!' };
  level.classic.enemyPressure = {
    version: 'enemy-pressure.v1',
    actors: [
      {
        id: level.enemies[0].id,
        mode: 'trail-pursuit',
        senseRadius: 16,
        scanTicks: 30,
        warningTicks: 90,
        commitTicks: 144,
        cooldownTicks: 300,
        leadTicks: 0,
      },
    ],
  };
  assert.equal(createRun(level).enemies[0].classic.pressure.phase, 'patrol');
  const before = JSON.stringify(level);
  const card = missionBriefing(level);
  assert.match(card.copy, /Sentries lock aim/);
  assert.match(card.copy, /AIM locks\. Evade HEAD; close before TRAIL catches up\./);
  assert.ok(card.copy.length <= 240, card.copy);
  assert.ok(card.fullBrief.startsWith(`${level.metadata.description}\n\n`));
  const brief = 'Caller-supplied route.\nKeep this separate from level metadata.';
  assert.ok(missionBriefing(level, { brief }).fullBrief.startsWith(`${brief}\n\n`));
  assert.equal(JSON.stringify(level), before);
  const intro = missionBriefing(level, { intro: true });
  assert.match(intro.copy, /Leave safe ground/);
  assert.match(intro.copy, /Sentries lock aim/);
});

for (const turnPolicy of ['immediate', 'grid-center']) {
  test(`${turnPolicy}: real sentry lock, changed heading and recovering live shot substantiate the lesson`, () => {
    const level = combatLevel(),
      options = { seed: 7, turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    const opening = ticks(run, 300, 'right', recorder);
    const lock = opening.find((event) => event.type === 'combat.locked');
    assert.equal(lock.tick, 240);
    assert.equal(patrol(run).phase, 'warning');
    const before = authoritativeCheckpoint(run);
    const brief = missionBriefing(run.level);
    assert.match(brief.fullBrief, /later steering does not move its aim/);
    assert.deepEqual(authoritativeCheckpoint(run), before);
    const events = ticks(run, 80, 'down', recorder);
    const shot = events.find((event) => event.type === 'combat.fired');
    assert.equal(shot.tick, lock.warningUntil);
    assert.deepEqual(shot.aim, lock.aim);
    assert.notDeepEqual(shot.aim, { x: run.player.x, y: run.player.y });
    assert.equal(patrol(run).phase, 'recovery');
    assert.equal(combat(run).projectiles.length, 1);
    assert.equal(run.lives, 3);
    assert.match(brief.fullBrief, /recovering sentry can still have a live shot/);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });

  test(`${turnPolicy}: a real earlier return cancels warning before firing`, () => {
    const level = combatLevel();
    level.goal.coverage = 0.9;
    level.foundations = [{ x: 1, y: 20, w: 70, h: 1 }];
    const options = { seed: 7, turnPolicy },
      run = createRun(level, options),
      recorder = createRecorder(level, options);
    const events = [...ticks(run, 300, 'right', recorder), ...ticks(run, 30, 'down', recorder)];
    const lock = events.find((event) => event.type === 'combat.locked');
    const closure = events.find((event) => event.type === 'cut.closed');
    const cancelled = events.find((event) => event.type === 'combat.cancelled');
    assert.ok(closure.tick < lock.warningUntil);
    assert.equal(cancelled.tick, closure.tick);
    assert.equal(cancelled.reason, 'capture');
    assert.equal(
      events.some((event) => event.type === 'combat.fired'),
      false,
    );
    assert.equal(combat(run).projectiles.length, 0);
    assert.equal(patrol(run).phase, 'cooldown');
    assert.equal(run.lives, 3);
    assert.equal(run.player.cutting, false);
    assert.equal(run.status, 'running');
    assert.match(missionBriefing(run.level).fullBrief, /close your cut before firing/);
    assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
  });
}

test('real scout contact and enclosure remove it without replacing the ordinary keeper', () => {
  for (const cause of ['ram', 'capture']) {
    const level = combatLevel('scout');
    if (cause === 'capture') level.classic.combatPatrols.actors[0].y = 25.5;
    const run = createRun(level);
    const events = ticks(run, cause === 'ram' ? 150 : 900, 'right');
    const removal = events.find((event) => event.type === 'combat.eliminated');
    assert.equal(removal.cause, cause);
    assert.equal(patrol(run).alive, false);
    assert.equal(run.enemies.length, 1);
    assert.equal(run.enemies[0].id, 'keeper');
    assert.equal(run.lives, 3);
    const before = authoritativeCheckpoint(run);
    assert.match(missionBriefing(run.level).fullBrief, /do not damage your unfinished line/);
    assert.deepEqual(authoritativeCheckpoint(run), before);
  }
});

test('the actual practice host shows localized optional guidance while retaining scenario and saves', async (t) => {
  const originalLocale = getLocale();
  t.after(() => setLocale(originalLocale));
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url)),
  );
  const theme = themes.themes.find((candidate) => candidate.id === 'horizon');
  const source = structuredClone(project);
  source.missions.find((mission) => mission.id === 'sentry-detour').presentation.themeId = theme.id;
  const preview = prepareContentPreview(source, 'sentry-detour', { theme });
  const scenario = (await prepareScenario(preview.scenario)).scenario;
  const bytes = JSON.stringify(scenario);
  for (const locale of ['en', 'uk']) {
    await t.test(locale, async (t) => {
      setLocale(locale);
      const storage = memoryStorage({ retained: 'unchanged' });
      const previewStorage = memoryStorage({ 'revealline.playground.current': bytes });
      const page = await soloPage(t, { storage, previewStorage, search: '?practice=1' });
      const checkpoint = authoritativeCheckpoint(page.rendered.run);
      const expected = missionBriefing(page.rendered.run.level);
      assert.equal(page.$('overlay-copy').textContent, expected.copy);
      page.$('overlay-brief').click();
      assert.equal(page.$('shell-missions').dataset.view, 'brief');
      assert.equal(page.$('mission-brief-copy').textContent, expected.fullBrief);
      assert.doesNotMatch(expected.copy + expected.fullBrief, /brief\.optional/);
      assert.match(expected.copy, locale === 'en' ? /Sentries lock aim/ : /[Вв]артов/);
      assert.equal(page.rendered.run.tick, 0);
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
      assert.deepEqual([...storage.map], [['retained', 'unchanged']]);
      assert.deepEqual(storage.writes, []);
      assert.equal(previewStorage.getItem('revealline.playground.current'), bytes);
      assert.deepEqual(previewStorage.writes, []);
      assert.deepEqual(page.errors, []);
    });
  }
});
