import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { verifyFirstLight } from '../../scripts/verify-first-light.mjs';
import { buildFirstLightPack } from '../../scripts/build-first-light-pack.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { soloPage, settle } from './helpers/solo-dom.mjs';

const source = JSON.parse(
  await readFile(
    new URL('../../authoring/library/fpv-arcade/pack-source.json', import.meta.url),
    'utf8',
  ),
);
test('First Light: six pinned legal routes win under the exact shipped wide rules, without lost lives', async () => {
  const result = await verifyFirstLight();
  assert.equal(result.routes.length, 6);
  assert.ok(result.routes.every((route) => route.coverage >= 0.6 && route.lives === 3));
});
test('First Light: original 2:1 artwork embeds byte-for-byte, independently for each map', async () => {
  const { report } = await buildFirstLightPack();
  assert.equal(report.backgrounds.length, 3);
  assert.equal(new Set(report.backgrounds.map((image) => image.sha256)).size, 3);
  assert.ok(report.backgrounds.every((image) => image.width === image.height * 2));
});
for (const level of source.campaigns[0].levels)
  test(`${level.id}: one unchanged direction cannot win; real contacts take lives`, () => {
    const run = createRun(level, { classId: 'scout', classRecipes: source.classRecipes, seed: 1 });
    let failures = 0;
    for (let tick = 0; tick < 18000 && !['lost', 'won'].includes(run.status); tick++) {
      // This is a deliberately careless core command stream. The host requires a
      // fresh direction after recovery; continuous fixture commands are explicit.
      stepRun(run, { direction: level.spawn.x === 0.5 ? 'right' : 'down' }, FIXED_DT);
      failures += run.events.filter((event) => event.type === 'player.failed').length;
    }
    assert.equal(run.status, 'lost');
    assert.ok(failures >= 2, 'Enemies, not only the deadline, must create pressure.');
  });
test('actual solo host changes native board and CSS geometry from wide to legacy after a legal win', async (t) => {
  const old = JSON.parse(
    await readFile(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  ).campaigns[0].levels[0];
  const fixture = structuredClone(source);
  fixture.campaigns[0].levels[0].enemies = [];
  fixture.campaigns[0].levels[0].goal = { coverage: 0.01 };
  const page = await soloPage(t, {
    fetchJSON: (url) => (url === 'content/packs/fpv-arcade.json' ? fixture : undefined),
  });
  page.change('pack-select', 'fpv-arcade');
  await settle(() => page.$('level-select').value === 'orchard-window');
  page.frame(0);
  const canvas = page.$('game-canvas').children.find((child) => child.tagName === 'CANVAS');
  assert.equal(canvas.width, 1152);
  assert.equal(canvas.height, 576);
  assert.equal(page.doc.documentElement.style['--board-aspect'], '2');
  page.$('start-button').click();
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let tick = 0; tick < 500 && page.rendered.run.status !== 'won'; tick++) page.frame();
  assert.equal(page.rendered.run.status, 'won');
  page.change('pack-select', 'night-shift');
  await settle(() => page.$('level-select').value === old.id);
  page.frame(0);
  assert.equal(page.rendered.run.level.id, old.id);
  assert.equal(canvas.width, 768);
  assert.equal(canvas.height, 576);
  assert.equal(page.doc.documentElement.style['--board-aspect'], String(4 / 3));
  assert.deepEqual(page.errors, []);
});
