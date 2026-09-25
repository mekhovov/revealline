import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { contentText } from '../i18n/content.mjs';
import { createTeamOpeningCandidates } from '../content-design/team-candidates.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { editTimedBonus } from '../content-design/timed-bonuses.mjs';
import { createCoop, startCoop, stepCoop, pauseCoop } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';
import { coopFailureFeedback, coopRetryFeedback } from '../couch/coop-feedback.mjs';
import { coopGoalLabel, coopObjectiveLabel } from '../couch/coop-copy.mjs';
import {
  coopBonusView,
  coopBonusDetails,
  coopBonusLive,
  coopBonusCaption,
} from '../couch/coop-bonus-view.mjs';
import { page } from './helpers/coop-host.mjs';

function locales(context) {
  const original = getLocale();
  context.after(() => setLocale(original, { persist: false }));
  setLocale('en', { persist: false });
}

test('Team advice and failures translate complete sentences without rewriting authored recipes', (context) => {
  locales(context);
  const journey = createTeamTestPack(createTeamOpeningCandidates(), 'twin-landings').levels[0];
  for (const level of [...COOP_STARTER_PACK.levels, journey]) {
    const run = createCoop(level);
    const before = JSON.stringify(run);
    const english = coopArenaGuidance(level, { jointCuts: false });
    setLocale('uk', { persist: false });
    const ukrainian = coopArenaGuidance(level, { jointCuts: false });
    for (const key of [
      'groundName',
      'supportText',
      'threatText',
      'strongholdText',
      'startMessage',
    ]) {
      assert.notEqual(ukrainian[key], english[key], key);
      assert.doesNotMatch(ukrainian[key], /[A-Za-z]|undefined|\{\{/u, key);
    }
    assert.match(ukrainian.supportText, /на (безпечній|відвойованій) території/);
    for (const cause of [
      'lethal-terrain',
      'self-trail',
      'line-impact',
      'enemy-trail',
      'enemy-player',
    ]) {
      for (const enemy of ['hunter', 'drifter', 'claimed-rover']) {
        const observed = { ...run, enemies: [{ id: 'observed', type: enemy }] };
        const feedback = coopFailureFeedback(observed, { cause, enemy: 'observed' });
        assert.doesNotMatch(feedback.cause + feedback.advice, /[A-Za-z]|undefined|\{\{/u);
      }
    }
    assert.doesNotMatch(coopRetryFeedback(run), /[A-Za-z]|undefined|\{\{/u);
    assert.doesNotMatch(coopGoalLabel(level), /[A-Za-z]|undefined|\{\{/u);
    assert.doesNotMatch(coopObjectiveLabel(run), /[A-Za-z]|undefined|\{\{/u);
    assert.equal(JSON.stringify(run), before);
    setLocale('en', { persist: false });
    assert.deepEqual(coopArenaGuidance(level, { jointCuts: false }), english);
  }
});

test('accepted Team bonus windows refresh their language without advancing their clocks', (context) => {
  locales(context);
  const source = editTimedBonus(createTeamOpeningCandidates(), 'twin-landings', {
    action: 'add',
    id: 'locale-bonus',
    schedule: {
      id: 'locale-bonus',
      kind: 'player-speed',
      anchors: [
        { x: 20.5, y: 8.5 },
        { x: 51.5, y: 8.5 },
      ],
      initialDelayTicks: 0,
      announcementTicks: 120,
      availableTicks: 1200,
      cooldownTicks: 240,
      maxAppearances: 3,
      maxCollections: 1,
    },
  });
  const run = startCoop(createCoop(createTeamTestPack(source, 'twin-landings').levels[0]));
  const idle = [
    { direction: null, boost: false, support: false },
    { direction: null, boost: false, support: false },
  ];
  for (let tick = 0; tick < 121; tick++) stepCoop(run, idle);
  pauseCoop(run);
  const view = coopBonusView(run);
  const before = JSON.stringify(run);
  const originalView = JSON.stringify(view);
  const english = coopBonusDetails(view);
  assert.match(english, /expires in 10.0s/);
  setLocale('uk', { persist: false });
  assert.match(coopBonusDetails(view), /зникнення через 10,0 с/);
  assert.equal(coopBonusLive(view), 'Доступний 1 тимчасовий бонус');
  for (const kind of ['extra-life', 'player-speed', 'enemy-slow', 'enemy-freeze']) {
    for (const type of [
      'powerup.collected',
      'bonus.announced',
      'bonus.appeared',
      'bonus.expired',
    ]) {
      const caption = coopBonusCaption({ type, kind, players: [0], gain: 1 }, [
        'Соняшник',
        'Обрій',
      ]);
      assert.doesNotMatch(caption, /[A-Za-z]|undefined|\{\{/u);
    }
  }
  for (const count of [0, 1, 2, 5, 11, 21, 22, 1.5]) {
    assert.match(t('gameplay:team.reserves', { count }), /резерв/);
    assert.match(t('gameplay:team.bonusAvailable', { count }), /бонус/);
  }
  assert.equal(JSON.stringify(run), before);
  assert.equal(JSON.stringify(view), originalView);
  setLocale('en', { persist: false });
  assert.equal(coopBonusDetails(view), english);
});

test('Team language changes preserve paused play, help focus, and a custom arena name', async (context) => {
  locales(context);
  const f = await page(context, {
    capturePaint: true,
    presentation: {
      load: ({ snapshot }) => {
        snapshot.resolved.theme.revision = 79;
      },
    },
  });
  const pack = structuredClone(COOP_STARTER_PACK);
  pack.id = 'locale-custom-pack';
  pack.name = 'My authored pack';
  pack.levels = [{ ...pack.levels[0], id: 'locale-custom-arena', name: 'My authored arena' }];
  const source = JSON.stringify(pack);
  f.$('coop-pack-file').closest('details').open = true;
  f.$('coop-pack-file').files = [new Blob([source], { type: 'application/json' })];
  await f.$('coop-pack-file').onchange();
  const englishAdvice = f.$('coop-help-support').textContent;
  setLocale('uk', { persist: false });
  assert.match(f.$('coop-help-support').textContent, /безпечній території/);
  assert.equal(f.$('coop-stage').textContent, 'MY AUTHORED ARENA');
  setLocale('en', { persist: false });
  assert.equal(f.$('coop-help-support').textContent, englishAdvice);
  f.$('coop-start').click();
  f.tick(30);
  f.$('coop-pause').click();
  f.disclose('coop-help');
  f.$('coop-help-read').click();
  const focus = f.doc.activeElement;
  const clock = f.$('coop-clock').textContent;
  const paint = f.lastPaint;
  const selection = f.$('coop-level').value;
  const pictureStatus = f.$('coop-picture-status').textContent;
  setLocale('uk', { persist: false });
  assert.equal(f.$('coop-state-0').textContent, 'На безпечній території');
  assert.equal(f.$('coop-state-0').getAttribute('data-compact'), t('interface:safe'));
  assert.match(f.$('coop-message').textContent, /[А-Яа-яІіЇїЄєҐґ]/u);
  assert.doesNotMatch(f.$('coop-help-support').textContent, /[A-Za-z]/u);
  assert.notEqual(f.$('coop-picture-status').textContent, pictureStatus);
  assert.doesNotMatch(f.$('coop-picture-status').textContent, /[A-Za-z]/u);
  assert.equal(
    f.doc.activeElement.id,
    focus.id,
    'language switching retains the active reading control',
  );
  assert.equal(f.$('coop-clock').textContent, clock);
  assert.equal(f.$('coop-level').value, selection);
  assert.deepEqual(f.lastPaint, paint);
  f.tick(30);
  assert.equal(f.$('coop-clock').textContent, clock);
  setLocale('en', { persist: false });
  assert.equal(f.$('coop-state-0').textContent, 'On safe ground');
  assert.equal(f.$('coop-picture-status').textContent, pictureStatus);
  assert.equal(
    f.doc.activeElement.id,
    focus.id,
    'language switching retains the active reading control',
  );
});

test('starter Team names resolve by exact content identity and preserve custom edits', (context) => {
  locales(context);
  const before = JSON.stringify(COOP_STARTER_PACK);
  setLocale('uk', { persist: false });
  assert.equal(contentText(COOP_STARTER_PACK, 'name'), 'Рятувальний ретранслятор');
  assert.equal(contentText(COOP_STARTER_PACK.levels[0], 'name'), 'Перше з’єднання');
  assert.equal(contentText(COOP_STARTER_PACK.levels[1], 'name'), 'Двір ретрансляторів');
  const custom = structuredClone(COOP_STARTER_PACK.levels[0]);
  custom.id = 'custom-first-connection';
  assert.equal(contentText(custom, 'name'), 'First Connection');
  assert.equal(JSON.stringify(COOP_STARTER_PACK), before);
});
