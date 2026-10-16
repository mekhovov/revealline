import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ENEMY_GUIDE_TOPICS,
  enemyGuideEntry,
  enemyGuidePracticeInstructions,
  createEnemyGuideScenario,
} from '../enemy-guide.mjs';
import { isEncounterGuideTopic } from '../encounter-guide.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { createRecorder, recordInput, exportReplay, verifyReplay } from '../replay.mjs';
import { validateScenario } from '../content.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const impactScenario = JSON.parse(
  readFileSync(new URL('../content/scenarios/line-impact-demo.json', import.meta.url)),
);
const lesson = (topic, themeId, turnPolicy) =>
  createEnemyGuideScenario({ topic, themeId, turnPolicy, themes, impactScenario });

test('ordinary catalogue guidance translates Sentinel counterplay and every practice instruction', (t) => {
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('uk', { persist: false });
  const sentinel = enemyGuideEntry('relay-sentinel');
  assert.equal(
    sentinel.spot,
    'Поетапна зустріч. Замок позначає ядро, захищене пов’язаними ретрансляторами щита.',
  );
  assert.equal(
    sentinel.try,
    'Захопіть усі ретранслятори щита. Коли ЯДРО ВІДКРИТО, замкніть достатній новий відріз; якщо ядро ізольоване — поверніться на відвойовану землю без незавершеної лінії.',
  );
  for (const { id } of ENEMY_GUIDE_TOPICS.filter(
    ({ id }) => id !== 'line-impact' && !isEncounterGuideTopic(id),
  ))
    assert.equal(
      enemyGuidePracticeInstructions(id),
      `${enemyGuideEntry(id).try} Рухайтеся натисканнями напрямку; для огляду ввімкніть паузу. Замикання відрізу зупиняє апарат; натисніть напрямок знову, щоб рушити. Повтор починає той самий урок.`,
      id,
    );
  setLocale('en', { persist: false });
  assert.equal(
    enemyGuideEntry('relay-sentinel').try,
    'Capture every linked shield relay. During CORE OPEN, close a sufficient new cut—or, if the core is isolated, return to reclaimed ground with no unfinished line.',
  );
  assert.equal(
    enemyGuidePracticeInstructions('bouncer'),
    'Close a short cut while it is moving away. Move with direction taps; Pause when you want to inspect. Closing a cut stops your craft; tap a fresh direction to fly again. Retry starts the same lesson.',
  );
});

test('twelve concise topics distinguish registered roles, optional encounters and line impacts', () => {
  assert.equal(ENEMY_GUIDE_TOPICS.length, 12);
  for (const { id } of ENEMY_GUIDE_TOPICS)
    for (const theme of ['fpv', 'ukraine', 'retro', 'coupa']) {
      const entry = enemyGuideEntry(id, theme);
      for (const part of ['spot', 'risk', 'try', 'note'])
        assert.ok(entry[part].length > 20 && entry[part].length < 200);
      assert.ok(Object.isFrozen(entry));
    }
  assert.match(enemyGuideEntry('line-impact').note, /Older editions/);
  assert.match(enemyGuidePracticeInstructions('line-impact', 'observe'), /Boost off/);
  assert.match(enemyGuidePracticeInstructions('line-impact', 'escape'), /Toggle/);
  assert.throws(() => enemyGuideEntry('unknown'), /registered/);
  assert.throws(() => enemyGuidePracticeInstructions('line-impact', 'win-now'), /Unknown/);
});

test('all four-theme/two-policy lesson variants validate without changing original content', () => {
  const before = structuredClone({ themes, impactScenario });
  for (const { id } of ENEMY_GUIDE_TOPICS.filter(({ id }) => !isEncounterGuideTopic(id)))
    for (const themeId of ['fpv', 'ukraine', 'retro', 'coupa'])
      for (const turnPolicy of ['immediate', 'grid-center']) {
        const scenario = lesson(id, themeId, turnPolicy);
        assert.equal(validateScenario(scenario).valid, true);
        assert.equal(scenario.masteryDefinition, null);
        assert.equal(scenario.theme.id, themeId);
        assert.equal(scenario.settings.turnPolicy, turnPolicy);
        assert.equal(scenario.level.rules.stopOnCapture, true);
        const run = createRun(scenario.level, {
          ...scenario.settings,
          classRecipes: scenario.classRecipes,
        });
        stepRun(run, { direction: 'down' }, FIXED_DT);
        assert.equal(run.tick, 1);
        if (id === 'line-impact') assert.deepEqual(scenario.level, impactScenario.level);
        else {
          assert.ok(scenario.level.enemies.some((enemy) => enemy.type === id));
          assert.match(
            enemyGuidePracticeInstructions(id),
            /Closing a cut stops your craft; tap a fresh direction/,
          );
        }
      }
  assert.deepEqual({ themes, impactScenario }, before);
  assert.throws(() => lesson('bouncer', 'fpv', 'diagonal'), /Unknown turning/);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  for (const boost of [false, true])
    test(`${turnPolicy}: the taught ${boost ? 'Boost escape wins' : 'unboosted observation loses'} through real inputs and replay`, () => {
      const scenario = lesson('line-impact', 'fpv', turnPolicy),
        options = { ...scenario.settings, classRecipes: scenario.classRecipes },
        run = createRun(scenario.level, options),
        recorder = createRecorder(scenario.level, options),
        events = [];
      for (let i = 0; i < 500 && run.status === 'running'; i++) {
        const input = { direction: 'down', boost };
        recordInput(recorder, input);
        stepRun(run, input, FIXED_DT);
        events.push(...run.events);
      }
      assert.equal(run.status, boost ? 'won' : 'lost');
      assert.equal(events.filter(({ type }) => type === 'lineImpact.seeded').length, 1);
      assert.equal(
        events.filter(({ type }) => type === 'lineImpact.arrived').length,
        boost ? 0 : 1,
      );
      assert.equal(run.classic.lineImpact.fronts.length, 0);
      assert.equal(verifyReplay(exportReplay(recorder, run)).match, true);
    });
