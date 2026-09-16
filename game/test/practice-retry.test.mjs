import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, memoryStorage } from './helpers/solo-dom.mjs';
import { prepareScenario } from '../imports.mjs';
import { authoritativeCheckpoint, verifyReplay } from '../replay.mjs';

const raw = JSON.parse(
  await readFile(new URL('../content/scenarios/line-impact-demo.json', import.meta.url), 'utf8'),
);

test('a new attempt keeps replay export locked until the previous download request settles', async (t) => {
  const page = await soloPage(t);
  const schedule = globalThis.setTimeout;
  t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
    const timer = schedule(callback, delay, ...args);
    if (delay === 60000) timer.unref();
    return timer;
  });
  page.$('start-button').click();
  page.key('ArrowDown');
  page.frame(100);
  page.key('ArrowDown', false);
  page.$('pause-button').click();
  const previousRun = page.rendered.run;
  // The real web export is pending at its promise boundary. A native adapter
  // can stay at this same boundary while its Save sheet remains open.
  const downloading = page.$('export-replay').onclick();
  assert.equal(page.$('replay-dialog').open, true);
  assert.equal(page.$('export-replay').disabled, true);
  page.$('replay-dialog').close();
  page.$('overlay-restart').click();
  assert.equal(page.$('restart-dialog').open, true);
  page.$('restart-confirm').click();
  assert.equal(page.$('restart-dialog').open, false);
  page.frame(0);
  assert.notEqual(page.rendered.run, previousRun);
  assert.equal(page.$('export-replay').disabled, true);
  assert.equal(page.$('replay-operation-status').hidden, true);
  await downloading;
  assert.equal(page.$('export-replay').disabled, false);
  assert.equal(page.$('replay-dialog').open, false);
  assert.equal(page.$('replay-operation-status').hidden, true);
  assert.deepEqual(page.errors, []);
});

for (const turnPolicy of ['immediate', 'grid-center'])
  test(`${turnPolicy}: native practice Retry retains the imported one-life impact scenario, rules and replay identity`, async (t) => {
    const scenario = (await prepareScenario({ ...raw, settings: { ...raw.settings, turnPolicy } }))
      .scenario;
    const storage = memoryStorage({ 'practice-retry-control': 'unchanged' }),
      previewStorage = memoryStorage({ 'revealline.playground.current': JSON.stringify(scenario) }),
      rawPreview = previewStorage.getItem('revealline.playground.current'),
      page = await soloPage(t, { storage, previewStorage, search: '?practice=1&revision=2' }),
      before = [...storage.map],
      writes = storage.writes.length,
      ready = page.rendered.run,
      readyLevel = structuredClone(ready.level);
    assert.equal(ready.levelId, 'line-impact-demo');
    assert.equal(ready.lives, 1);
    assert.equal(ready.level.goal.coverage, 0.45);
    assert.equal(page.$('target').textContent, 'TARGET 45%');
    assert.equal(page.$('difficulty-select').disabled, true);
    page.$('start-button').click();
    page.key('ArrowDown');
    for (let i = 0; i < 400 && page.rendered.run.status === 'running'; i++) page.frame();
    page.key('ArrowDown', false);
    const lost = page.rendered.run;
    assert.equal(lost.status, 'lost');
    assert.equal(lost.failureCause, 'enemy-trail');
    assert.equal(lost.lives, 0);
    const terminal = authoritativeCheckpoint(lost);
    // Let the real bounded defeat presentation finish. No simulation state is patched.
    for (let i = 0; i < 10 && page.$('game-overlay').hidden; i++) page.frame(100);
    assert.equal(page.$('game-overlay').dataset.kind, 'lost');
    assert.equal(page.$('game-overlay').hidden, false);
    assert.equal(page.$('retry-button').hidden, false);
    const retry = page.$('retry-button');
    retry.emit('pointerdown', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
    retry.focus();
    retry.emit('pointerup', { button: 0, isPrimary: true, pointerType: 'mouse', pointerId: 1 });
    retry.click();
    page.frame(0);
    const fresh = page.rendered.run;
    assert.notEqual(fresh, lost);
    assert.equal(fresh.status, 'running');
    assert.equal(fresh.tick, 0);
    assert.equal(fresh.lives, 1);
    assert.deepEqual(fresh.level, readyLevel);
    assert.equal(fresh.turnPolicy, turnPolicy);
    assert.equal(fresh.rules.stopOnCapture, true);
    assert.deepEqual(fresh.classic.lineImpact.fronts, []);
    assert.equal(page.$('target').textContent, 'TARGET 45%');
    assert.match(page.$('mode-caption').textContent, /PRACTICE/);
    assert.deepEqual(authoritativeCheckpoint(lost), terminal);
    // Browser download cleanup keeps its real delay, but must not hold this
    // Node test process open. Simulation, input and lifecycle clocks are unchanged.
    const schedule = globalThis.setTimeout;
    t.mock.method(globalThis, 'setTimeout', (callback, delay, ...args) => {
      const timer = schedule(callback, delay, ...args);
      if (delay === 60000) timer.unref();
      return timer;
    });
    page.$('export-replay').click();
    const replay = JSON.parse(page.$('replay-json').value);
    assert.equal(replay.level.id, scenario.level.id);
    assert.equal(replay.options.turnPolicy, turnPolicy);
    assert.equal(replay.summary.lives, 1);
    assert.equal(verifyReplay(replay).match, true);
    assert.deepEqual([...storage.map], before);
    assert.equal(storage.writes.length, writes);
    assert.equal(previewStorage.getItem('revealline.playground.current'), rawPreview);
    assert.deepEqual(page.errors, []);
  });
