import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { CLASSIC_SNAKE_LEVELS } from '../snake/classic-catalogue.mjs';
import { prepareClassicSnakeLevel } from '../snake/classic-setup.mjs';
import { exportClassicSnakeMatch } from '../snake/classic-match.mjs';
import {
  createSnakeDemoAdapter,
  createSnakeDemoPlayer,
  createSnakeDemoPractice,
} from '../demo-modes/snake.mjs';
import { verifySnakeDemo, meaningfulSnakeDemoProgress } from '../demo-modes/snake-recording.mjs';
const load = async (entry) =>
  JSON.parse(
    await readFile(new URL(`../demo-data/snake/${entry.id}.replay.json`, import.meta.url), 'utf8'),
  );

// Current catalog is the required inventory; this fails as soon as authored
// content is added or changes without a newly qualified performance.
for (const entry of CLASSIC_SNAKE_LEVELS) {
  test(`Snake catalog coverage: ${entry.id}`, async () => {
    const level = prepareClassicSnakeLevel(entry);
    const demo = await load(entry);
    const { match } = verifySnakeDemo(demo, { level });
    assert.equal(match.status, 'finished');
    assert.equal(match.result, demo.outcome);
    assert.ok(meaningfulSnakeDemoProgress(demo.progress));
    let priorMs = 0;
    for (const point of demo.diagnostics) {
      assert.ok(point.elapsedMs - priorMs <= 5300);
      priorMs = point.elapsedMs;
    }
    assert.ok(match.elapsedMs - priorMs < 5300);
    const player = createSnakeDemoPlayer(demo, { level });
    player.play();
    let frames = 0;
    while (player.phase === 'playing' && frames++ < 50000) player.advance(0.25);
    assert.equal(player.phase, 'complete');
    assert.equal(exportClassicSnakeMatch(player.match).checkpoint, demo.recording.checkpoint);
    player.dispose();
  });
}

test('Snake source enumeration reads only authored metadata and defers recording bodies', async () => {
  let loads = 0;
  const adapter = createSnakeDemoAdapter({
    fetch: async () => {
      loads++;
      throw new Error('offline');
    },
  });
  const sources = adapter.enumerateSources();
  assert.equal(sources.length, CLASSIC_SNAKE_LEVELS.length);
  assert.equal(loads, 0);
  assert.equal(new Set(sources.map((source) => source.levelKey)).size, sources.length);
  assert.ok(
    sources.every((source) => source.modeId === 'snake' && source.variantId === 'standard'),
  );
  assert.ok(sources.every((source) => new URL(source.launchURL).searchParams.get('ready') === '1'));
  await assert.rejects(sources[0].create(), /offline/);
  assert.equal(loads, 1);
});

test('Snake practice reproduces the displayed prefix and owns all later mutations', async () => {
  const entry = CLASSIC_SNAKE_LEVELS[0],
    level = prepareClassicSnakeLevel(entry);
  const demo = await load(entry);
  const player = createSnakeDemoPlayer(demo, { level });
  player.play();
  for (let i = 0; i < 23; i++) player.advance(0.125);
  player.pause();
  const watched = exportClassicSnakeMatch(player.match);
  const fork = await player.forkForPractice();
  assert.deepEqual(exportClassicSnakeMatch(fork.match), watched);
  assert.notEqual(fork.run, player.state);
  const practice = createSnakeDemoPractice(fork);
  const beforeTurns = fork.match.turns.length;
  const direction = ['up', 'right', 'down', 'left'].find(
    (value) =>
      value !== fork.run.snakes[0].direction &&
      value !==
        { up: 'down', down: 'up', left: 'right', right: 'left' }[fork.run.snakes[0].direction],
  );
  practice.start({ direction });
  practice.advance(0.25);
  practice.advance(0.25);
  assert.equal(fork.match.turns.length, beforeTurns + 1, 'initiating input is submitted once');
  assert.deepEqual(exportClassicSnakeMatch(player.match), watched);
  const beforePause = practice.state.tick;
  practice.pause();
  practice.advance(0.25);
  assert.equal(practice.state.tick, beforePause);
  practice.start();
  assert.equal(practice.advance(5).reason, 'frame-gap');
  assert.equal(practice.phase, 'paused');
  player.dispose();
  practice.dispose();
});

test('Snake preparation cancellation, stale content and diagnostics are explicit failures', async () => {
  const entry = CLASSIC_SNAKE_LEVELS[0],
    level = prepareClassicSnakeLevel(entry);
  const demo = await load(entry);
  const controller = new AbortController();
  controller.abort();
  assert.throws(() => createSnakeDemoPlayer(demo, { level, signal: controller.signal }), {
    name: 'AbortError',
  });
  const changed = structuredClone(level);
  changed.goal++;
  assert.throws(() => verifySnakeDemo(demo, { level: changed }));
  const corrupt = structuredClone(demo);
  corrupt.diagnostics[0].checkpoint = '0000000000000000';
  assert.throws(
    () => verifySnakeDemo(corrupt, { level }),
    (error) =>
      error.name === 'ReplayVerificationError' &&
      error.diagnostics[0].tick === corrupt.diagnostics[0].tick,
  );
  const cosmetic = structuredClone(demo);
  cosmetic.progress.catches++;
  assert.throws(() => verifySnakeDemo(cosmetic, { level }), /meaningful progress/);
});

test('Snake native labels, goals, launch locale and captions follow current language', () => {
  let locale = 'en';
  const adapter = createSnakeDemoAdapter({ locale: () => locale });
  const source = adapter.enumerateSources()[0];
  assert.equal(adapter.label, 'Snake Solo');
  assert.equal(source.label, source.entry.title.en);
  locale = 'uk';
  assert.equal(adapter.label, 'Змійка');
  assert.equal(source.label, source.entry.title.uk);
  assert.equal(source.goal, source.entry.description.uk);
  assert.equal(new URL(source.launchURL).searchParams.get('lang'), 'uk');
  assert.match(adapter.semanticEvents([{ type: 'target.caught' }])[0].caption, /^Ціль/);
});
