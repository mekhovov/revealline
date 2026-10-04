import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PNGImage } from './helpers/png-image.mjs';
import { RasterImage } from './helpers/raster-image.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun } from '../core/index.mjs';
import { companySimulationIdentity } from '../company-session.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { retainedEditionFixture } from './helpers/retained-edition-fixture.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { createRewardMissionBindings } from '../rewards/bindings.mjs';

function openEditionSettings(page, category) {
  page.$('shell-options').click();
  assert.equal(page.$('settings-dialog').open, true);
  page.$(`settings-tab-${category}`).click();
  assert.equal(page.$(`settings-panel-${category}`).hidden, false);
  if (category === 'data') {
    const details = page.$('edition-presentation-select')?.closest('details');
    if (details && !details.open) details.querySelector('summary').click();
  }
}

test('artwork update offers explicit exact-snapshot recovery and Continue retains the original save', async (t) => {
  const f = await retainedEditionFixture(),
    storage = memoryStorage(),
    key = 'revealline.suspended.journey-sample-public.v1.solo-v2';
  let original;
  await t.test('save the earlier presentation', async (t) => {
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      storage,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
    page.$('shell-featured').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.key('ArrowDown');
    for (let i = 0; i < 12; i++) page.frame();
    page.key('ArrowDown', false);
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    await settle(() => storage.getItem(key) !== null);
    original = storage.getItem(key);
    assert.equal(
      JSON.parse(original).actorAppearancePin.authoredPresentationSha256,
      f.descriptor.id,
    );
  });
  // Pagehide may refresh the save timestamp while retaining this exact attempt.
  original = storage.getItem(key);
  f.replacePicture();
  await t.test('new source never silently rewrites the previous flight', async (t) => {
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      storage,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      pictures: { Image: PNGImage },
      fetchResponse: f.fetcher,
    });
    const recover = page.$('edition-recover-presentation');
    assert.ok(recover, 'The exact registered receipt offers an explicit recovery action.');
    assert.ok(
      recover.closest('#shell-home'),
      'A known saved-flight mismatch stays immediately reachable.',
    );
    const before = page.win.location.href;
    assert.equal(storage.getItem(key), original);
    assert.equal(page.$('settings-dialog').open, false);
    await recover.onclick();
    assert.notEqual(page.win.location.href, before);
    assert.equal(new URL(page.win.location.href).searchParams.get('presentation'), f.descriptor.id);
    assert.equal(storage.getItem(key), original, 'Navigation does not rewrite the suspended run.');
    assert.deepEqual(page.errors, []);
  });
  await t.test(
    'read-only artwork departure explains shared progress in either language without hiding save risk',
    async (t) => {
      const page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage: memoryStorage(),
        journeyIndexedDB: managedIndexedDB().indexedDB,
        pictures: { Image: PNGImage },
        fetchResponse: f.fetcher,
        lockManager: {
          request(key, options, task) {
            return Promise.resolve(
              (task ?? options)(key === 'revealline.company.sample-public.writer' ? null : {}),
            );
          },
        },
      });
      const locale = getLocale();
      t.after(() => setLocale(locale, { persist: false }));
      setLocale('en', { persist: false });
      page.$('shell-featured').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.$('shell-menu').click();
      openEditionSettings(page, 'data');
      const href = page.win.location.href;
      const choice = page.$('edition-presentation-select');
      choice.value = f.descriptor.id;
      await choice.onchange();
      assert.equal(page.$('mode-leave-dialog').open, true);
      assert.match(page.$('mode-leave-title').textContent, /Retained original artwork/);
      assert.match(page.$('mode-leave-status').textContent, /session-only.*Leaving may lose/);
      assert.match(page.$('mode-leave-status').textContent, /same edition.*progress stays shared/);
      assert.doesNotMatch(page.$('mode-leave-status').textContent, /progress stay separate/);
      setLocale('uk', { persist: false });
      assert.match(page.$('mode-leave-title').textContent, /Збережене оригінальне оформлення/);
      assert.match(page.$('mode-leave-confirm').textContent, /Збережене оригінальне оформлення/);
      assert.match(page.$('mode-leave-status').textContent, /прогрес залишається спільним/);
      assert.doesNotMatch(page.$('mode-leave-status').textContent, /прогрес залишаються окремими/);
      assert.equal(page.win.location.href, href);
      assert.equal(page.storage.getItem(key), null, 'The read-only flight remains session-only.');
      page.$('mode-leave-stay').click();
      assert.equal(page.$('mode-leave-dialog').open, false);
      assert.equal(page.win.location.href, href);
      assert.deepEqual(page.errors, []);
    },
  );
  await t.test('the same host reconstructs and resumes the exact earlier source', async (t) => {
    const page = await soloPage(t, {
      search: `?edition=sample-public&presentation=${f.descriptor.id}`,
      titleScreen: true,
      storage,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
    assert.equal(page.$('edition-presentation-select').value, f.descriptor.id);
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    const resumed = JSON.parse(storage.getItem(key)),
      saved = JSON.parse(original);
    assert.equal(resumed.campaignKey, saved.campaignKey);
    assert.equal(resumed.runId, saved.runId);
    assert.deepEqual(resumed.actorAppearancePin, saved.actorAppearancePin);
    assert.deepEqual(resumed.replay, saved.replay);
    page.$('shell-menu').click();
    openEditionSettings(page, 'data');
    const choice = page.$('edition-presentation-select'),
      href = page.win.location.href;
    choice.value = '';
    await choice.onchange();
    assert.equal(choice.value, f.descriptor.id, 'The selector retains the still-active snapshot.');
    assert.equal(
      page.win.location.href,
      href,
      'An unfinished flight cannot navigate before confirmation.',
    );
    assert.equal(page.$('mode-leave-dialog').open, true);
    assert.match(page.$('mode-leave-title').textContent, /Current artwork/);
    assert.match(page.$('mode-leave-status').textContent, /same edition.*progress stays shared/);
    assert.doesNotMatch(page.$('mode-leave-status').textContent, /progress stay separate/);
    const locale = getLocale();
    t.after(() => setLocale(locale, { persist: false }));
    setLocale('uk', { persist: false });
    assert.match(page.$('mode-leave-title').textContent, /Поточне оформлення/);
    assert.match(page.$('mode-leave-status').textContent, /прогрес залишається спільним/);
    page.$('mode-leave-stay').click();
    assert.equal(page.win.location.href, href);
    assert.equal(page.$('mode-leave-dialog').open, false);
    assert.deepEqual(page.errors, []);
  });
});

async function editionSwitchHost(t, { occupied = false, start = true } = {}) {
  const f = await editionProviderFixture();
  const catalog = structuredClone(f.catalog);
  catalog.editions.push({ ...catalog.editions[0], id: 'sample-other', name: 'Other audience' });
  catalog.brands.push({ ...catalog.brands[0], id: 'another-company', name: 'Another company' });
  catalog.campaigns.push({
    ...catalog.campaigns[0],
    id: 'another-campaign',
    brandId: 'another-company',
    sourcePath: 'game/content/another-company/project.json',
  });
  catalog.editions.push({
    ...catalog.editions[0],
    id: 'sample-foreign',
    name: 'Another community',
    brandId: 'another-company',
    campaignIds: ['another-campaign'],
    entryCampaignId: 'another-campaign',
  });
  for (const path of ['game/editions/catalog.json', 'edition-catalog.json'])
    f.files.set(path, catalog);
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
    ...(occupied
      ? {
          lockManager: {
            request(key, options, task) {
              return Promise.resolve(
                (task ?? options)(key === 'revealline.company.sample-public.writer' ? null : {}),
              );
            },
          },
        }
      : {}),
  });
  page.win.location.assign = (href) => {
    page.win.location.href = href;
  };
  if (!start) return page;
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let i = 0; i < 14; i++) page.frame();
  page.key('ArrowDown', false);
  assert.equal(page.rendered.run.player.cutting, true);
  return page;
}

test('edition chrome and retained-artwork recovery switch locale without remounting controls', async (t) => {
  const previousLocale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(previousLocale, { persist: false }));
  const f = await retainedEditionFixture(),
    page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      storage: memoryStorage(),
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    }),
    picker = page.$('edition-select'),
    artwork = page.$('edition-presentation-select'),
    actorNote = page.$('menu-actor-note'),
    authoredOptions = [...picker.options].map((option) => option.textContent);
  assert.match(picker.parentNode.textContent, /Choose a world/);
  assert.match(artwork.parentNode.textContent, /Artwork version/);
  assert.equal(artwork.options[0].textContent, 'Current artwork');
  assert.match(artwork.options[1].textContent, /^Saved original · /);
  assert.match(actorNote.textContent, /shared Solo rules/);
  assert.ok(
    page.doc
      .querySelectorAll('summary')
      .some((summary) => summary.textContent === 'About this world & its artwork'),
  );

  setLocale('uk', { persist: false });
  assert.equal(page.$('edition-select'), picker);
  assert.equal(page.$('edition-presentation-select'), artwork);
  assert.match(picker.parentNode.textContent, /Оберіть світ/);
  assert.match(artwork.parentNode.textContent, /Версія зображень/);
  assert.equal(artwork.options[0].textContent, 'Поточні зображення');
  assert.match(artwork.options[1].textContent, /^Збережений оригінал · /);
  assert.match(actorNote.textContent, /спільним правилам Соло/);
  assert.ok(
    page.doc
      .querySelectorAll('summary')
      .some((summary) => summary.textContent === 'Про цей світ і його зображення'),
  );
  assert.deepEqual(
    [...picker.options].map((option) => option.textContent),
    authoredOptions,
    'Authored edition names remain unchanged.',
  );
  assert.equal(artwork.value, '', 'The selected artwork remains unchanged.');
  assert.deepEqual(page.errors, []);
});

for (const saving of ['verified', 'quota', 'occupied'])
  test(`edition switch retains the paused attempt and offers Stay before ${saving} departure`, async (t) => {
    const page = await editionSwitchHost(t, { occupied: saving === 'occupied' });
    const key = 'revealline.suspended.journey-sample-public.v1.solo-v2';
    if (saving === 'quota') {
      const write = page.storage.setItem.bind(page.storage);
      page.storage.setItem = (name, value) => {
        if (name === key) throw new Error('quota exhausted');
        write(name, value);
      };
    }
    page.$('shell-menu').click();
    openEditionSettings(page, 'content');
    const before = authoritativeCheckpoint(page.rendered.run),
      origin = page.win.location.href,
      picker = page.$('edition-select');
    const request = () => {
      picker.value = 'sample-other';
      picker.focus();
      return picker.onchange({ preventDefault() {} });
    };
    await request();
    assert.equal(page.win.location.href, origin, 'Selection alone cannot discard the current run.');
    assert.equal(picker.value, 'sample-public', 'The picker describes the still-active edition.');
    assert.equal(page.$('mode-leave-dialog').open, true);
    assert.match(page.$('mode-leave-title').textContent, /Other audience/);
    assert.match(
      page.$('mode-leave-status').textContent,
      /Its missions and progress stay separate/,
    );
    assert.match(
      page.$('mode-leave-status').textContent,
      saving === 'verified' ? /saved and verified/ : /session-only.*Leaving may lose/,
    );
    const retained = page.storage.getItem(key);
    if (saving === 'verified')
      assert.equal(JSON.parse(retained).actorAppearancePin.content.editionId, 'sample-public');
    else assert.equal(retained, null);
    page.$('mode-leave-stay').click();
    assert.equal(page.$('mode-leave-dialog').open, false);
    assert.equal(page.doc.activeElement, picker);
    assert.equal(picker.value, 'sample-public');
    for (let i = 0; i < 5; i++) page.frame();
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.equal(page.win.location.href, origin);
    assert.equal(page.storage.getItem(key), retained);
    await request();
    page.$('mode-leave-confirm').click();
    assert.equal(
      page.win.location.href,
      'http://localhost/game/index.html?edition=sample-other',
      'Only explicit Leave uses the allowlisted edition destination.',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.deepEqual(page.errors, []);
  });

test('edition switch cancellation retires pending retention and cannot navigate after a late completion', async (t) => {
  const page = await editionSwitchHost(t);
  page.$('shell-menu').click();
  openEditionSettings(page, 'content');
  const origin = page.win.location.href,
    key = 'revealline.suspended.journey-sample-public.v1.solo-v2',
    retained = page.storage.getItem(key),
    before = authoritativeCheckpoint(page.rendered.run),
    picker = page.$('edition-select');
  let release;
  const request = navigator.locks.request.bind(navigator.locks);
  navigator.locks.request = async (name, options, task) => {
    if (name.endsWith('.backup-lock'))
      await new Promise((resolve) => {
        release = resolve;
      });
    return request(name, options, task);
  };
  picker.value = 'sample-other';
  picker.focus();
  const pending = picker.onchange();
  await settle(() => !!release);
  assert.equal(page.$('mode-leave-confirm').disabled, true);
  page.$('mode-leave-confirm').click();
  assert.equal(page.win.location.href, origin);
  page.$('mode-leave-stay').click();
  assert.equal(picker.value, 'sample-public');
  release();
  await pending;
  assert.equal(page.$('mode-leave-dialog').open, false);
  assert.equal(page.win.location.href, origin);
  assert.equal(page.storage.getItem(key), retained);
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.equal(page.doc.activeElement, picker);
  assert.deepEqual(page.errors, []);
});

test('edition switch permits only its company destinations and does not prompt when no flight exists', async (t) => {
  const page = await editionSwitchHost(t, { start: false }),
    origin = page.win.location.href,
    picker = page.$('edition-select');
  openEditionSettings(page, 'content');
  assert.deepEqual(
    [...picker.options].map((option) => option.value),
    ['sample-public', 'sample-other'],
  );
  for (const id of [
    'sample-public',
    'sample-foreign',
    'omitted-audience',
    'https://foreign.test/',
  ]) {
    picker.value = id;
    await picker.onchange();
    assert.equal(picker.value, 'sample-public');
    assert.equal(page.win.location.href, origin);
    assert.equal(page.$('mode-leave-dialog').open, false);
  }
  picker.value = 'sample-other';
  await picker.onchange();
  assert.equal(page.win.location.href, 'http://localhost/game/index.html?edition=sample-other');
  assert.equal(page.$('mode-leave-dialog').open, false);
  assert.deepEqual(page.errors, []);
});

test('a forged cross-company selection cannot save, replace or leave the current attempt', async (t) => {
  const page = await editionSwitchHost(t);
  page.$('shell-menu').click();
  openEditionSettings(page, 'content');
  const before = authoritativeCheckpoint(page.rendered.run);
  const origin = page.win.location.href;
  const key = 'revealline.suspended.journey-sample-public.v1.solo-v2';
  const saved = page.storage.getItem(key);
  const picker = page.$('edition-select');
  picker.value = 'sample-foreign';
  assert.equal(await picker.onchange(), false);
  assert.equal(picker.value, 'sample-public');
  assert.equal(page.$('mode-leave-dialog').open, false);
  assert.equal(page.win.location.href, origin);
  assert.equal(page.storage.getItem(key), saved);
  assert.equal(
    page.storage.getItem('revealline.suspended.journey-sample-foreign.v1.solo-v2'),
    null,
  );
  assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
  assert.deepEqual(page.errors, []);
});

test('retained edition chrome does not borrow a newly adopted logo outside its saved asset closure', async (t) => {
  const f = await retainedEditionFixture({ originalArtwork: true });
  const currentLogo = f.replacePicture('new-company-logo');
  f.catalog.brands[0].logoAssetId = currentLogo.id;
  f.catalog.brands[0].assetIds = [currentLogo.id];
  const requests = [];
  const page = await soloPage(t, {
    search: `?edition=sample-public&presentation=${f.descriptor.id}`,
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: PNGImage },
    fetchResponse(url) {
      requests.push(String(url));
      return f.fetcher(url);
    },
  });
  assert.equal(page.doc.body.dataset.editionId, 'sample-public');
  assert.equal(page.$('edition-presentation-select').value, f.descriptor.id);
  assert.ok(!requests.some((url) => url.endsWith(currentLogo.path)));
  for (const image of page.doc.querySelectorAll('img'))
    assert.ok(!String(image.src).includes('new-company-logo'));
  assert.deepEqual(page.errors, []);
});

test('edition runs the complete Solo host with canonical rules, settings and mission library', async (t) => {
  const f = await editionProviderFixture();
  const legacyKey = 'revealline.suspended.journey-sample-public.v1';
  const legacy = JSON.stringify({ format: 'revealline-company-session.v1', retained: true });
  const storage = memoryStorage({ [legacyKey]: legacy });
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    storage,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  assert.equal(
    page.doc.body.dataset.editionId,
    'sample-public',
    page.errors.map((e) => e.stack).join('\n') + page.$('overlay-copy').textContent,
  );
  assert.equal(page.$('menu-actor-style').value, 'campaign');
  assert.equal(page.$('difficulty-select').options.length, 3);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const expected = createRun(
    applyGameplayTuning(
      resolveMission(f.project, f.project.missions[0].id, { difficulty: 'standard' }).level,
      resolveGameplayTuning('standard'),
    ),
  );
  assert.equal(companySimulationIdentity(page.rendered.run), companySimulationIdentity(expected));
  assert.equal(page.rendered.actorAppearance.style, 'campaign');
  page.$('settings-button').click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.ok(page.$('turn-select'));
  assert.ok(page.$('controller-settings-root'));
  assert.ok(page.doc.querySelector('[data-language-control]'));
  page.$('settings-dialog').close();
  page.$('save-attempt-button').click();
  const saved = JSON.parse(storage.getItem(`${legacyKey}.solo-v2`));
  assert.equal(saved.format, 'xonix-session.v6');
  assert.equal(saved.actorAppearancePin.style, 'campaign');
  assert.equal(saved.actorAppearancePin.format, 'revealline-actor-appearance-pin.v2');
  assert.match(saved.actorAppearancePin.authoredPresentationSha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.actorAppearancePin.content.editionId, 'sample-public');
  assert.equal(storage.getItem(legacyKey), legacy);
  await page.$('export-replay').onclick();
  const recording = JSON.parse(page.$('replay-json').value);
  assert.equal(recording.format, 'revealline-replay-presentation.v2');
  assert.deepEqual(recording.actorAppearancePin, saved.actorAppearancePin);
  page.$('replay-dialog').close();
  assert.ok(page.$('settings-panel-data').textContent.includes('Earlier preview save retained'));
  page.$('shell-worlds').click();
  await settle(() => page.$('journey-chooser').open);
  assert.deepEqual(
    [...page.$('journey-mode').options].map((option) => option.value),
    ['solo'],
  );
  assert.deepEqual(
    [...page.$('journey-collection').options].map((option) => option.value),
    ['', 'Journey'],
  );
  assert.equal(page.doc.querySelector('.journey-library-copy').textContent, 'Sample public');
  for (const id of ['shell-controller-lab', 'shell-replay-theater'])
    assert.equal(new URL(page.$(id).href).searchParams.get('edition'), 'sample-public');
  page.$('journey-chooser').close();
  const downloads = [...page.doc.querySelectorAll('a')].find(
    (link) => link.textContent === 'Offline play & edition data',
  );
  downloads.click();
  assert.equal(page.$('settings-dialog').open, true);
  assert.equal(page.$('settings-panel-data').hidden, false);
  assert.deepEqual(page.errors, []);
});

test('edition display controls retain the shared preferences without changing a paused flight or its exact receipt', async (t) => {
  const f = await editionProviderFixture(),
    page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.key('ArrowDown');
  for (let tick = 0; tick < 12; tick++) page.frame();
  page.key('ArrowDown', false);
  page.$('settings-button').click();
  page.$('settings-tab-display').click();
  const key = 'revealline.suspended.journey-sample-public.v1.solo-v2',
    before = authoritativeCheckpoint(page.rendered.run),
    saved = page.storage.getItem(key);
  assert.ok(saved);
  for (const value of ['large', 'standard', 'large']) {
    page.change('text-size', value);
    page.change('text-face', 'plain');
    page.frame(0);
    assert.equal(page.doc.body.dataset.textSize, value);
    assert.equal(page.doc.body.dataset.textFace, 'plain');
    assert.equal(JSON.parse(page.storage.getItem(DISPLAY_PREFERENCES_KEY)).textSize, value);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), before);
    assert.equal(page.storage.getItem(key), saved);
    assert.equal(page.rendered.paused, true);
    assert.equal(page.$('settings-dialog').open, true);
  }
  assert.deepEqual(page.errors, []);
});

test('edition keyboard steers through actual launch and settings focus without accepting a held menu key', async (t) => {
  const f = await editionProviderFixture();
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  // Unlike soloPage.key(), route every event through the real focused element.
  // A launch that leaves focus on an editor must fail this host regression.
  const key = (type, key, code = '', extra = {}) =>
    page.doc.activeElement.emit(type, { key, code, repeat: false, ...extra });
  const frames = (count = 6) => {
    for (let i = 0; i < count; i++) page.frame();
  };
  assert.equal(page.doc.activeElement, page.$('shell-featured'));
  page.doc.activeElement.click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  assert.equal(page.doc.activeElement, page.$('game-canvas'));
  const run = page.rendered.run;
  const startY = run.player.y;
  assert.equal(key('keydown', 'ArrowDown', 'ArrowDown').defaultPrevented, true);
  frames();
  assert.ok(run.player.y > startY, 'The focused game receives arrow steering.');
  key('keyup', 'ArrowDown', 'ArrowDown');

  page.$('settings-button').click();
  page.$('turn-select').focus();
  const pausedPlayer = structuredClone(run.player),
    pausedTick = run.tick;
  key('keydown', 'ArrowRight', 'ArrowRight');
  frames();
  assert.deepEqual(run.player, pausedPlayer);
  assert.equal(run.tick, pausedTick, 'Native settings navigation cannot move the paused run.');
  page.$('settings-dialog').close();
  page.$('start-button').click();
  assert.equal(page.doc.activeElement, page.$('game-canvas'));
  key('keydown', 'ArrowRight', 'ArrowRight', { repeat: true });
  frames();
  assert.equal(run.player.direction, 'down', 'Holding a menu key is not a fresh flight gesture.');
  key('keyup', 'ArrowRight', 'ArrowRight');
  const startX = run.player.x;
  key('keydown', 'ArrowRight', 'ArrowRight');
  frames();
  assert.ok(run.player.x > startX, 'Release and a fresh press work after menu focus returns.');
  key('keyup', 'ArrowRight', 'ArrowRight');
  const fallbackY = run.player.y;
  key('keydown', 's');
  frames();
  assert.ok(run.player.y > fallbackY, 'A browser event without code retains the letter fallback.');
  key('keyup', 's');
  assert.deepEqual(page.errors, []);
});

for (const departure of ['window blur', 'visibility change without blur'])
  test(`edition keyboard recovers after ${departure} and an unobserved keyup`, async (t) => {
    const f = await editionProviderFixture();
    const page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
    const key = (type, repeat = false) =>
      page.doc.activeElement.emit(type, { key: 'ArrowDown', code: 'ArrowDown', repeat });
    page.$('shell-featured').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    key('keydown');
    for (let i = 0; i < 12; i++) page.frame();
    const run = page.rendered.run;
    assert.ok(run.player.cutting);
    if (departure === 'window blur') {
      page.doc.focused = false;
      page.win.emit('blur');
    } else {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
    }
    const pausedPlayer = structuredClone(run.player),
      pausedTick = run.tick;
    page.frame();
    assert.equal(page.doc.body.dataset.flightState, 'paused');
    assert.deepEqual(run.player, pausedPlayer);
    assert.equal(run.tick, pausedTick);

    // The release happened outside this document; no keyup reaches the host.
    if (departure === 'window blur') {
      page.doc.focused = true;
      page.win.emit('focus');
    } else {
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    }
    assert.equal(
      page.doc.body.dataset.flightState,
      'paused',
      'Returning focus cannot resume play.',
    );
    page.$('start-button').click();
    assert.equal(page.doc.activeElement, page.$('game-canvas'));
    page.doc.activeElement.emit('keydown', {
      key: 'ArrowRight',
      code: 'ArrowRight',
      repeat: true,
    });
    page.frame();
    assert.equal(
      run.player.direction,
      'down',
      'A key held outside the document cannot turn the run.',
    );
    const startX = run.player.x;
    page.doc.activeElement.emit('keydown', { key: 'd', code: 'KeyD', repeat: false });
    for (let i = 0; i < 6; i++) page.frame();
    assert.ok(run.player.x > startX, 'A fresh alternate key works after the external release.');
    page.doc.activeElement.emit('keyup', { key: 'd', code: 'KeyD', repeat: false });
    const startY = run.player.y;
    key('keydown');
    for (let i = 0; i < 6; i++) page.frame();
    assert.ok(
      run.player.y > startY,
      'A fresh press works even though the old keyup was never observed.',
    );
    key('keyup');
    assert.deepEqual(page.errors, []);
  });

test('edition Continue preserves a matching receipt and rejects a same-ID changed palette without overwriting recovery', async (t) => {
  const storage = memoryStorage(),
    key = 'revealline.suspended.journey-sample-public.v1.solo-v2';
  let saved;
  await t.test('save the accepted appearance', async (t) => {
    const f = await editionProviderFixture(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
    assert.equal(page.$('continue-saved').hidden, true);
    assert.equal(page.$('continue-saved-note').textContent, '');
    page.$('shell-featured').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    saved = storage.getItem(key);
    assert.ok(saved, page.$('save-warning').textContent + page.$('run-message').textContent);
  });
  await t.test('matching edition resumes', async (t) => {
    const f = await editionProviderFixture(),
      page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
    assert.ok(
      page.$('continue-saved-note').textContent.includes(JSON.parse(saved).replay.level.name),
      'The preview resolves the exact saved candidate mission from its owned execution key.',
    );
    const beforeContinue = storage.getItem(key);
    page.$('shell-continue').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    page.frame(0);
    assert.deepEqual(
      authoritativeCheckpoint(page.rendered.run),
      JSON.parse(beforeContinue).replay.checkpoint,
    );
    page.$('pause-button').click();
    page.$('save-attempt-button').click();
    assert.deepEqual(
      JSON.parse(storage.getItem(key)).actorAppearancePin,
      JSON.parse(saved).actorAppearancePin,
    );
  });
  for (const change of ['palette', 'missing receipt'])
    await t.test(change, async (t) => {
      const f = await editionProviderFixture();
      let raw = saved;
      if (change === 'palette') f.data.themes.themes[0].palette.accent = '#ff00ff';
      else {
        const prior = JSON.parse(saved);
        prior.actorAppearancePin.format = 'revealline-actor-appearance-pin.v1';
        delete prior.actorAppearancePin.authoredPresentationSha256;
        raw = JSON.stringify(prior);
      }
      storage.setItem(key, raw);
      const page = await soloPage(t, {
        search: '?edition=sample-public',
        titleScreen: true,
        storage,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        fetchResponse: f.fetcher,
      });
      const run = page.rendered.run;
      page.$('shell-continue').click();
      await settle(
        () =>
          /earlier artwork|artwork receipt/i.test(page.$('shell-flight-status').textContent) &&
          page.$('shell-flight-cancel').hidden,
      );
      assert.equal(page.rendered.run, run);
      assert.equal(storage.getItem(key), raw);
      assert.equal(page.$('shell-home').open, true);
    });
});

test('edition pause keeps canonical Skip confirmation and Watch first cut actions reachable', async (t) => {
  const f = await editionProviderFixture();
  const second = {
    ...structuredClone(f.source.missions[0]),
    id: 'farther-shore',
    name: 'Farther shore',
  };
  f.source.missions.push(second);
  f.source.campaigns[0].missionIds.push(second.id);
  const project = compileContentProject(f.source);
  f.data.campaign.levels.push(resolveMission(project, second.id).level);
  const page = await soloPage(t, {
    search: '?edition=sample-public',
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    fetchResponse: f.fetcher,
  });
  const actions = page.$('game-overlay').querySelector('.overlay-actions');
  assert.equal(page.$('journey-skip').parentElement, actions);
  assert.equal(page.$('demo-button').parentElement, actions);
  page.$('shell-featured').click();
  await settle(() => page.doc.body.dataset.flightState === 'running');
  page.frame(0);
  const first = page.rendered.run;
  page.$('pause-button').click();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('journey-skip').hidden, false);
  page.$('journey-skip').click();
  assert.match(page.$('journey-skip').textContent, /Confirm skip/i);
  assert.equal(page.rendered.run, first, 'The first activation only asks for confirmation.');
  page.$('journey-skip').click();
  await settle(() => {
    page.frame(0);
    return page.rendered.run.levelId === second.id;
  });
  page.$('pause-button').click();
  assert.equal(page.$('game-overlay').hidden, false);
  assert.equal(page.$('demo-button').hidden, false);
  const retainedRun = page.rendered.run,
    paused = authoritativeCheckpoint(retainedRun);
  page.$('demo-button').click();
  assert.equal(page.$('demo-dialog').open, true, 'Watch first cut opens the shared Demo player.');
  await settle(() => page.$('demo-dialog').dataset.scene === 'playing');
  assert.equal(page.$('demo-level').textContent, f.source.missions[0].name);
  assert.equal(page.doc.body.dataset.flightState, 'paused');
  assert.deepEqual(
    authoritativeCheckpoint(retainedRun),
    paused,
    'Watching does not replace the paused attempt.',
  );
  page.$('demo-back').click();
  assert.equal(page.$('demo-dialog').open, false);
  page.frame(0);
  assert.equal(page.rendered.run, retainedRun);
  assert.equal(page.rendered.run.levelId, second.id);
  assert.deepEqual(authoritativeCheckpoint(retainedRun), paused);
  assert.deepEqual(page.errors, []);
});

test('edition First Flight uses shared course rules and returns to its own company', async (t) => {
  const f = await editionProviderFixture();
  const page = await soloPage(t, {
    search: '?edition=sample-public&course=first-flight&lesson=close-line',
    titleScreen: true,
    fetchResponse: f.fetcher,
  });
  assert.equal(page.rendered.run.levelId, 'first-flight-close-line');
  const destinations = [];
  page.win.location.assign = (href) => destinations.push(href);
  page.$('first-flight-exit').click();
  assert.equal(new URL(destinations[0]).searchParams.get('edition'), 'sample-public');
  assert.equal(new URL(destinations[0]).searchParams.has('course'), false);
  assert.deepEqual(page.errors, []);
});

test('edition controller practice reconstructs only its selected mission without shared Playground storage', async (t) => {
  const f = await editionProviderFixture();
  const page = await soloPage(t, {
    search: `?edition=sample-public&practice=1&edition-mission=${f.project.missions[0].id}&difficulty=expert&turn-policy=grid-center&class=scout`,
    fetchResponse: f.fetcher,
  });
  const expected = createRun(
    applyGameplayTuning(
      resolveMission(f.project, f.project.missions[0].id, { difficulty: 'expert' }).level,
      resolveGameplayTuning('expert'),
    ),
    { turnPolicy: 'grid-center' },
  );
  assert.equal(companySimulationIdentity(page.rendered.run), companySimulationIdentity(expected));
  assert.deepEqual(page.errors, []);
});

test('reward-enabled controller practice boots without a Journey authority and cannot earn discoveries', async (t) => {
  const f = await editionProviderFixture(),
    catalog = structuredClone(f.catalog);
  const descriptor = catalog.campaigns[0],
    mission = createRewardMissionBindings(f.source)[0];
  descriptor.rewardPath = 'game/content/sample/rewards.json';
  const copy = { title: 'Practice discovery', teaser: 'Win this mission in Solo to collect.' };
  f.files.set('game/editions/catalog.json', catalog);
  f.files.set('edition-catalog.json', catalog);
  f.files.set(descriptor.rewardPath, [
    {
      format: 'revealline-completion-reward.v1',
      id: 'sample-discovery',
      revision: '1',
      brandId: 'sample',
      campaignId: descriptor.id,
      scope: { kind: 'mission', id: mission.missionId },
      locales: { en: copy, uk: copy },
      requirements: {
        missions: [{ missionId: mission.missionId, bindings: mission.bindings }],
        learning: [],
        mastery: [],
      },
      payloads: [
        {
          id: 'explanation',
          type: 'knowledge',
          locales: {
            en: { title: 'Explanation', paragraphs: ['A public discovery.'] },
            uk: { title: 'Пояснення', paragraphs: ['Публічне відкриття.'] },
          },
        },
      ],
    },
  ]);
  const page = await soloPage(t, {
    search: `?edition=sample-public&practice=1&edition-mission=${mission.missionId}&difficulty=expert`,
    fetchResponse: f.fetcher,
  });
  assert.equal(page.rendered.run.levelId, mission.missionId);
  for (let i = 0; i < 20; i++) page.frame();
  const card = page.$('completion-reward-shelf').querySelector('article');
  assert.equal(card.dataset.earned, 'false');
  assert.equal(card.querySelector('button'), null);
  assert.deepEqual(page.errors, []);
});

test('official DroneAid wordmark belongs only to the aggregate landing and keeps a text fallback', async (t) => {
  const bytes = new Map();
  const fetchResponse = async (value) => {
    const request = new URL(String(value), 'http://localhost/game/');
    const pathname =
      request.protocol === 'file:'
        ? request.pathname.slice(new URL('../../', import.meta.url).pathname.length)
        : request.pathname.slice(1);
    if (!/^game\/(?:editions\/|content\/company-)/.test(pathname)) return undefined;
    if (!bytes.has(pathname))
      bytes.set(pathname, await readFile(new URL(`../../${pathname}`, import.meta.url)));
    return new Response(bytes.get(pathname));
  };
  for (const edition of ['droneaid', 'droneaid-nl-workshop-lights'])
    await t.test(edition, async (t) => {
      const locale = getLocale();
      t.after(() => setLocale(locale, { persist: false }));
      const page = await soloPage(t, {
        search: `?edition=${edition}`,
        titleScreen: true,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        pictures: { Image: PNGImage },
        fetchResponse,
      });
      const home = page.$('shell-home');
      const title = page.$('shell-title');
      const wordmark = title.querySelector('.droneaid-landing-wordmark');
      const compact = page.doc.querySelector('.edition-brand-logo');
      assert.ok(compact.src.endsWith('/editions/assets/droneaid-nl/propeller.png'));
      const icon = [...page.doc.head.querySelectorAll('link')].find((link) => link.rel === 'icon');
      assert.ok(icon.href.endsWith('/droneaid-nl/icon-512.png'));
      if (edition === 'droneaid') {
        assert.equal(page.doc.body.dataset.editionId, 'droneaid-nl-community');
        assert.equal(home.dataset.landingIdentity, 'droneaid');
        assert.ok(wordmark.src.endsWith('/ui/art/menu-scenes/droneaid-wordmark-light.svg'));
        assert.equal(wordmark.alt, '');
        assert.equal(wordmark.getAttribute('aria-hidden'), 'true');
        assert.equal(home.querySelector('.edition-home-logo'), null);
        assert.equal(title.textContent, 'DroneAid / LINE');
        assert.equal(title.dataset.wordmarkLoaded, 'false');
        const action = page.$('shell-featured');
        action.focus();
        wordmark.emit('load');
        assert.equal(title.dataset.wordmarkLoaded, 'true');
        setLocale('uk', { persist: false });
        assert.equal(title.querySelector('.droneaid-landing-wordmark'), wordmark);
        assert.equal(title.textContent, 'DroneAid / LINE');
        assert.equal(page.doc.activeElement, action);
        wordmark.emit('error');
        assert.equal(title.dataset.wordmarkLoaded, 'false');
        assert.equal(title.querySelector('.native-brand-fallback').textContent, 'DroneAid');
        wordmark.emit('load');
        assert.equal(title.dataset.wordmarkLoaded, 'true');
        page.win.emit('pagehide', { persisted: false });
        assert.equal(wordmark.listeners.get('load').size, 0);
        assert.equal(wordmark.listeners.get('error').size, 0);
        assert.equal(title.querySelector('.droneaid-landing-wordmark'), null);
        assert.equal(title.dataset.wordmarkLoaded, undefined);
        wordmark.emit('load');
        assert.equal(title.dataset.wordmarkLoaded, undefined);
      } else {
        assert.equal(wordmark, null);
        assert.equal(home.dataset.landingIdentity, undefined);
        const logo = home.querySelector('.edition-home-logo');
        assert.ok(logo.classList.contains('edition-propeller'));
        assert.ok(logo.src.endsWith('/droneaid-nl/propeller.png'));
        assert.equal(title.textContent, 'Workshop Lights / LINE');
      }
      assert.deepEqual(page.errors, []);
    });
});

// The actual entry, provider, canonical catalogue and first attempt for every
// declared audience. Only browser DOM/canvas/PNG decoding are modeled.
test('every declared edition boots and starts through the canonical Solo host', async (t) => {
  const catalog = JSON.parse(
    await readFile(new URL('../editions/catalog.json', import.meta.url), 'utf8'),
  );
  const bytes = new Map();
  const fetchResponse = async (value) => {
    const request = new URL(String(value), 'http://localhost/game/');
    const pathname =
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
        search: `?edition=${edition.id}`,
        titleScreen: true,
        journeyIndexedDB: managedIndexedDB().indexedDB,
        pictures: { Image: RasterImage },
        fetchResponse,
      });
      assert.equal(page.doc.body.dataset.editionId, edition.id);
      if (edition.brandId === 'droneaid-nl') {
        const options = [...page.$('theme-select').options];
        assert.ok(options.length > 0);
        assert.ok(options.every((option) => option.textContent.startsWith('DroneAid')));
        assert.ok(options.every((option) => !option.textContent.includes('Netherlands')));
        assert.ok(options.every((option) => option.value.startsWith('droneaid-nl-')));
      }
      page.$('shell-worlds').click();
      await settle(() => page.$('journey-chooser')?.open === true);
      const count = catalog.campaigns
        .filter((campaign) => edition.campaignIds.includes(campaign.id))
        .reduce(
          (total, campaign) =>
            total + JSON.parse(bytes.get(campaign.sourcePath).toString()).missions.length,
          0,
        );
      assert.equal(page.$('journey-cards').children.length, count);
      assert.deepEqual(
        [...page.$('journey-mode').options].map((option) => option.value),
        ['solo'],
      );
      page.$('journey-chooser').close();
      page.$('shell-featured').click();
      await settle(() => page.doc.body.dataset.flightState === 'running');
      page.frame(0);
      assert.equal(page.rendered.actorAppearance.style, 'campaign');
      assert.equal(page.rendered.run.status, 'running');
      assert.deepEqual(page.errors, []);
    });
});

test('same-origin installed creator campaign cannot inject missions into a selected edition', async (t) => {
  const { generateCreatorProject } = await import('../creator/templates.mjs');
  const { prepareCreatorBundle, approveCreatorBundle } = await import('../creator/bundle.mjs');
  const {
    createCreatorStore,
    reviewCreatorInstallation,
    installPreparedCreatorBundle,
    installedCreatorManifests,
  } = await import('../creator/installed.mjs');
  const { creatorSHA256 } = await import('../creator/bytes.mjs');
  const { pngBytes } = await import('./helpers/media-fixtures.mjs');
  const media = managedIndexedDB(),
    store = createCreatorStore({ indexedDB: media.indexedDB });
  const generated = generateCreatorProject({
    id: 'unrelated-installed',
    name: 'Unrelated creator campaign',
    seed: 8,
  });
  const project = structuredClone(generated.project),
    blob = new Blob([pngBytes()], { type: 'image/png' }),
    sha256 = await creatorSHA256(await blob.arrayBuffer());
  project.assets = [
    {
      format: 'AssetRevisionV1',
      id: 'picture',
      revision: '1',
      kind: 'reveal-background',
      path: `content-design/assets/creator/${sha256}.png`,
      sha256,
      bytes: blob.size,
      width: 1,
      height: 1,
      alt: 'Fixture',
      review: 'candidate',
    },
  ];
  project.missions[0].presentation.backgroundAssetId = 'picture';
  const themes = JSON.parse(
    await readFile(new URL('../content-design/themes.json', import.meta.url), 'utf8'),
  ).themes;
  const decodeImage = async () => ({ naturalWidth: 1, naturalHeight: 1 });
  const pack = await prepareCreatorBundle(
    {
      project,
      packId: 'collection',
      themes,
      provenance: generated.provenance,
      credits: { creator: 'Fixture', picture: 'Fixture', license: 'Fixture permission' },
    },
    [{ sha256, blob }],
    { decodeImage },
  );
  const approval = approveCreatorBundle(pack),
    review = await reviewCreatorInstallation(store, pack, approval);
  await installPreparedCreatorBundle(store, pack, approval, review, { decodeImage });
  assert.equal((await installedCreatorManifests(store)).length, 1);
  store.close();
  const f = await editionProviderFixture(),
    page = await soloPage(t, {
      search: '?edition=sample-public',
      titleScreen: true,
      soundtrackIndexedDB: media.indexedDB,
      journeyIndexedDB: managedIndexedDB().indexedDB,
      fetchResponse: f.fetcher,
    });
  page.$('shell-worlds').click();
  await settle(() => page.$('journey-chooser').open);
  assert.deepEqual(
    [...page.$('journey-collection').options].map((option) => option.value),
    ['', 'Journey'],
  );
  assert.ok(!page.$('journey-cards').textContent.includes('Unrelated creator campaign'));
  assert.deepEqual(page.errors, []);
});

test('edition home keeps play primary while Settings retains localized world choice and context', async (t) => {
  const page = await editionSwitchHost(t, { start: false });
  const locale = getLocale();
  t.after(() => setLocale(locale, { persist: false }));
  setLocale('en', { persist: false });
  const picker = page.$('edition-select');
  assert.ok(picker.closest('#settings-panel-content'));
  assert.equal(page.doc.querySelectorAll('#edition-select').length, 1);
  assert.equal(page.$('shell-home').querySelector('.edition-about'), null);
  assert.match(picker.parentElement.textContent, /Choose a world/);
  openEditionSettings(page, 'content');
  assert.equal(page.$('edition-select'), picker);
  setLocale('uk', { persist: false });
  assert.match(picker.parentElement.textContent, /Оберіть світ/);
  page.$('settings-tab-extras').click();
  assert.equal(page.$('settings-panel-extras').hidden, false);
  assert.match(page.$('settings-panel-extras').textContent, /Про цей світ і його зображення/);
  assert.deepEqual(page.errors, []);
});
