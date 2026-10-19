import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { demoPage } from './helpers/demo-host-fixture.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { soloClassicDemoLaunchURL } from '../demo-modes/solo-classic-launch.mjs';
import { RasterImage } from './helpers/raster-image.mjs';
import { settle } from './helpers/solo-dom.mjs';

const clipId = 'solo-qualified-bda094dfb23a16c2';
const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
);
const row = index.missions.find(
  (item) => item.campaignId === 'night-shift' && item.levelId === 'night-shift-01',
);

function classicPage(t, search = '?journey=legacy') {
  t.mock.method(Math, 'random', () => 0.999999);
  return demoPage(t, {
    search,
    clipId,
    pictures: { Image: RasterImage },
    fetchResponse: async (path) => {
      if (/\/content\/packs\/|mission-library-index\.json/.test(String(path)))
        return new Response(await readFile(new URL(path, new URL('../', import.meta.url))));
    },
  });
}
async function openClassic(page) {
  await page.open();
  if (page.demoFrame.run.levelId !== row.levelId) {
    page.$('demo-next').click();
    await page.ready();
  }
  assert.equal(page.demoFrame.run.levelId, row.levelId);
}

for (const search of ['?journey=legacy', ''])
  test(`uninstalled authored Solo Fresh preserves exact chooser handoff from ${search || 'Journey'}`, async (t) => {
    const page = await classicPage(t, search);
    const before = [...page.storage.map],
      checkpoint = authoritativeCheckpoint(page.rendered.run),
      initialURL = globalThis.location.href;
    await openClassic(page);
    assert.deepEqual([...page.storage.map], before, 'watching must not install the source pack');
    page.$('demo-interrupt').click();
    page.$('demo-fresh').click();
    await waitFor(() => globalThis.location.href !== initialURL && !page.$('demo-dialog').open, {
      message: 'Fresh must hand the exact uninstalled source to the ordinary mission chooser.',
    });
    assert.equal(globalThis.location.href, soloClassicDemoLaunchURL(row));
    assert.deepEqual([...page.storage.map], before);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.equal(page.$('demo-dialog').open, false);
    assert.deepEqual(page.errors, []);
  });

test('uninstalled Solo Fresh keeps an unfinished flight behind its ordinary departure guard', async (t) => {
  const page = await classicPage(t);
  page.$('overlay-brief').click();
  page.$('shell-briefing').click();
  page.$('start-button').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  page.key('ArrowDown', false);
  for (let i = 0; i < 20; i++) page.frame(16);
  page.$('shell-menu').click();
  page.frame(0);
  const checkpoint = authoritativeCheckpoint(page.rendered.run),
    before = [...page.storage.map],
    initialURL = globalThis.location.href;
  await openClassic(page);
  assert.deepEqual([...page.storage.map], before);
  page.$('demo-interrupt').click();
  page.$('demo-fresh').click();
  await waitFor(() => page.$('mode-leave-dialog').open && !page.$('demo-dialog').open, {
    message: 'The existing unfinished-flight departure review must own the handoff.',
  });
  assert.equal(globalThis.location.href, initialURL);
  page.$('mode-leave-stay').click();
  page.frame(0);
  assert.equal(page.$('mode-leave-dialog').open, false);
  assert.equal(globalThis.location.href, initialURL);
  assert.equal(page.rendered.paused, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual(page.errors, []);
});
