// Actual player hosts and async Audio initialization. DOM visibility, native
// media elements and image decoding are finite boundaries, not browser evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { couchPage } from './helpers/couch-host.mjs';
import { page as teamPage } from './helpers/coop-host.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { RasterImage } from './helpers/raster-image.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { editionPublicSlug } from '../edition-context.mjs';

function supportFullscreen({ document: doc, window: win }) {
  doc.fullscreenEnabled = true;
  doc.documentElement.requestFullscreen = async () => {};
  doc.exitFullscreen = async () => {};
  // The finite Solo window is separate until the browser boundary joins it.
  if (win !== doc.defaultView) {
    Object.assign(win, doc.defaultView);
    doc.defaultView = win;
  }
}
function displayed(node) {
  if (!node.getClientRects().length || node.closest('[hidden],[inert],[aria-hidden="true"]'))
    return false;
  for (let parent = node.parentElement; parent; parent = parent.parentElement)
    if (parent.tagName === 'DETAILS' && !parent.open && parent.querySelector('summary') !== node)
      return false;
  return true;
}
function assertLanding(page, { root, actions, modes }) {
  const landing = page.$(root),
    controls = [...landing.querySelectorAll('button,a[href],input,select,textarea,summary')].filter(
      displayed,
    ),
    creatorLinks = controls.filter((node) => node.closest('[data-landing-song]')),
    modeControls = controls.filter((node) => node.dataset.gameMode),
    actionControls = controls.filter(
      (node) => !node.dataset.gameMode && !creatorLinks.includes(node),
    );
  assert.deepEqual(
    new Set(actionControls.map((node) => node.id)),
    new Set(actions),
    `The entire ${root} surface contains only agreed actions, including asynchronously mounted content`,
  );
  assert.deepEqual(
    modeControls.map((node) => node.dataset.gameMode),
    modes,
  );
  assert.equal(
    modeControls.filter((node) => node.getAttribute('aria-current') === 'page').length,
    1,
  );
  assert.equal(landing.querySelector('.quick-music-controls'), null);
  for (const node of controls.filter((node) => !creatorLinks.includes(node)))
    assert.ok(node.dataset.menuIcon, `${node.id} has its action icon`);
  const song = landing.querySelector('[data-landing-song]');
  assert.ok(song && !song.querySelector('button,input,select'));
  assert.ok(
    creatorLinks.length <= 1,
    'The passive footer may link its current artist, but adds no transport.',
  );
  for (const link of creatorLinks) {
    assert.equal(link.tagName, 'A');
    assert.match(link.getAttribute('href'), /^https?:\/\//);
    assert.equal(link.getAttribute('target'), '_blank');
    assert.equal(link.getAttribute('rel'), 'noopener noreferrer');
  }
}
const soloActions = [
  'shell-featured',
  'shell-play',
  'shell-options',
  'shell-fullscreen',
  'shell-sound',
];
const soloSettings = {
  'shell-gallery': 'data',
  'shell-help': 'extras',
  'shell-home-fpv': 'extras',
  'shell-home-practice': 'extras',
  'shell-workshop': 'extras',
  'shell-offline': 'content',
  'shell-music': 'audio',
};
function assertSoloDestinations(page) {
  for (const [id, category] of Object.entries(soloSettings)) {
    assert.equal(page.$(id).closest('[role="tabpanel"]')?.id, `settings-panel-${category}`);
    assert.equal(page.doc.querySelectorAll(`#${id}`).length, 1, `${id} retains its real node`);
    if (id === 'shell-offline' && page.doc.body.dataset.editionId)
      assert.equal(
        page.$(id).hidden,
        true,
        'Standalone edition runtime retains its existing install capability boundary',
      );
    else assert.equal(page.$(id).hidden, false, `${id} is available in its Settings category`);
  }
}

for (const search of ['', '?journey=legacy'])
  test(`Solo ${search || 'ordinary Journey'} keeps late Audio controls in Settings`, async (t) => {
    const page = await soloPage(t, {
      search,
      titleScreen: true,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      audio: { ...audioHarness(), URLImpl: null },
      pictures: { Image: RasterImage },
      fetchResponse: async (path) => {
        if (String(path).includes('/content-design/assets/'))
          return new Response(await readFile(path));
      },
      browserSetup: supportFullscreen,
    });
    await settle(
      () => !page.$('soundtrack-open').disabled,
      'The actual Audio host must finish mounting',
    );
    assertLanding(page, {
      root: 'shell-home',
      actions: soloActions,
      modes: ['solo', 'versus', 'team'],
    });
    assertSoloDestinations(page);
    const transport = page.$('solo-quick-music-settings');
    assert.equal(transport.closest('[role="tabpanel"]')?.id, 'settings-panel-audio');
    for (const part of ['previous', 'toggle', 'next'])
      assert.ok(page.$(`solo-quick-music-settings-${part}`));
    const checkpoint = authoritativeCheckpoint(page.rendered.run),
      saved = [...page.storage.map];
    page.$('shell-options').click();
    for (const category of ['audio', 'data', 'extras']) {
      page.$(`settings-tab-${category}`).click();
      assert.equal(page.$(`settings-panel-${category}`).hidden, false);
    }
    page.$('settings-dialog').close();
    assertLanding(page, {
      root: 'shell-home',
      actions: soloActions,
      modes: ['solo', 'versus', 'team'],
    });
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual([...page.storage.map], saved);
    assert.deepEqual(page.errors, []);
  });

test('all canonical edition adapters retain the same landing whitelist and Settings destinations', async (t) => {
  const catalog = JSON.parse(
      await readFile(new URL('../editions/catalog.json', import.meta.url), 'utf8'),
    ),
    bytes = new Map();
  const fetchResponse = async (value) => {
    const request = new URL(String(value), 'http://localhost/game/'),
      pathname =
        request.protocol === 'file:'
          ? request.pathname.slice(new URL('../../', import.meta.url).pathname.length)
          : request.pathname.slice(1);
    if (!/^game\/(?:editions\/|content\/company-)/.test(pathname)) return undefined;
    if (!bytes.has(pathname))
      bytes.set(pathname, await readFile(new URL(`../../${pathname}`, import.meta.url)));
    return new Response(bytes.get(pathname));
  };
  for (const edition of catalog.editions)
    await t.test(edition.id, async (t) => {
      const page = await soloPage(t, {
        search: `?edition=${editionPublicSlug(edition.id)}`,
        titleScreen: true,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        pictures: { Image: RasterImage },
        fetchResponse,
        browserSetup: supportFullscreen,
      });
      assert.equal(page.doc.body.dataset.editionId, edition.id);
      assertLanding(page, { root: 'shell-home', actions: soloActions, modes: edition.modes });
      assertSoloDestinations(page);
      assert.equal(page.rendered.run.tick, 0);
      assert.deepEqual(page.errors, []);
    });
});

test('Versus and Team keep their complete lobby actions within the same whitelist', async (t) => {
  await t.test('Versus', async (t) => {
    const page = await couchPage(t, { beforeImport: supportFullscreen });
    assertLanding(page, {
      root: 'race-main',
      actions: [
        'race-start',
        'race-chapters',
        'race-options',
        'race-quick-sound',
        'versus-landing-fullscreen',
      ],
      modes: ['solo', 'versus', 'team'],
    });
    assert.equal(
      page.$('race-help').closest('[role="tabpanel"]')?.id,
      'race-settings-panel-extras',
    );
    assert.equal(
      page.$('race-journey-pictures').closest('[role="tabpanel"]')?.id,
      'race-settings-panel-data',
    );
  });
  await t.test('Team', async (t) => {
    const page = await teamPage(t, {
      beforeImport: ({ doc, win }) => supportFullscreen({ document: doc, window: win }),
    });
    assertLanding(page, {
      root: 'coop-menu',
      actions: [
        'coop-start',
        'coop-discovery-open',
        'coop-settings-open',
        'coop-quick-sound',
        'team-landing-fullscreen',
      ],
      modes: ['solo', 'versus', 'team'],
    });
    assert.equal(
      page.$('coop-journey-pictures').closest('[role="tabpanel"]')?.id,
      'coop-settings-panel-data',
    );
  });
});

test('isolated course retains its own usable help and music shortcuts', async (t) => {
  const page = await soloPage(t, {
    search: '?course=first-flight&lesson=close-line',
    parentWindow: {},
    titleScreen: true,
  });
  const home = page.$('shell-home'),
    checkpoint = authoritativeCheckpoint(page.rendered.run),
    saved = [...page.storage.map];
  for (const id of ['shell-help', 'shell-music']) {
    assert.ok(home.contains(page.$(id)), `${id} remains inside the isolated lesson menu`);
    assert.equal(page.$(id).hidden, false);
  }
  for (const id of ['shell-gallery', 'shell-workshop', 'shell-play'])
    assert.equal(page.$(id).hidden, true, `${id} cannot escape the isolated course`);
  page.$('shell-menu').click();
  assert.equal(home.open, true);
  page.$('shell-help').focus();
  page.$('shell-help').click();
  assert.equal(page.$('help-dialog').open, true);
  page.$('help-dialog').querySelector('[data-close="help-dialog"]').click();
  assert.equal(page.$('help-dialog').open, false);
  assert.equal(home.open, true);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
  assert.deepEqual([...page.storage.map], saved);
  assert.deepEqual(page.errors, []);
});
