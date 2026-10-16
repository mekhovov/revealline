// Actual Solo admission, Guide, navigation and persistence with finite browser
// boundaries. This does not claim native Canvas pixels or browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, SoloElement, memoryStorage, settle } from './helpers/solo-dom.mjs';
import { editionProviderFixture } from './helpers/edition-provider-fixture.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { enemyGuideEntry } from '../enemy-guide.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

const handoffKey = 'revealline.playground.current';

function nativeDialogs(t) {
  const showModal = SoloElement.prototype.showModal,
    close = SoloElement.prototype.close,
    origins = new WeakMap();
  t.mock.method(SoloElement.prototype, 'showModal', function () {
    if (this.open) return;
    origins.set(this, this.ownerDocument.activeElement);
    this.emit('beforetoggle', { oldState: 'closed', newState: 'open' });
    showModal.call(this);
    this.querySelector('button:not(:disabled),select:not(:disabled),input:not(:disabled)')?.focus();
  });
  t.mock.method(SoloElement.prototype, 'close', function () {
    if (!this.open) return;
    close.call(this);
    const origin = origins.get(this),
      dialog = origin?.closest('dialog');
    if (origin?.isConnected && !origin.closest('[hidden]') && (!dialog || dialog.open))
      origin.focus();
    else this.ownerDocument.activeElement = this.ownerDocument.body;
  });
}

function nativeKey(page, key) {
  const target = page.doc.activeElement,
    event = target.emit('keydown', { key, code: key, repeat: false });
  if (!event.defaultPrevented && key === 'Enter' && target.tagName === 'BUTTON') target.click();
  if (!event.defaultPrevented && key === 'Escape') {
    const dialog = target.closest('dialog[open]') ?? page.doc.querySelector('dialog[open]');
    if (dialog && !dialog.emit('cancel').defaultPrevented) dialog.close();
  }
  target.emit('keyup', { key, code: key });
}

function openGuide(page) {
  page.$('overlay-menu').click();
  page.$('shell-workshop').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('shell-workshop-dialog').open, true);
  page.$('shell-guide').focus();
  nativeKey(page, 'Enter');
  assert.equal(page.$('enemy-guide-dialog').open, true);
}

for (const compiled of [false, true])
  test(`${compiled ? 'compiled' : 'query'} edition keeps catalog lessons readable without offering unsupported practice`, async (t) => {
    const locale = getLocale();
    t.after(() => setLocale(locale, { persist: false }));
    setLocale('en', { persist: false });
    nativeDialogs(t);
    const fixture = await editionProviderFixture(),
      storage = memoryStorage(),
      preview = memoryStorage({ [handoffKey]: 'unrelated retained authoring preview' }),
      requests = [],
      paints = [];
    fixture.source.missions[0].actors[0].role = 'trail-pursuer';
    const project = compileContentProject(fixture.source);
    fixture.data.campaign.levels = project.missions.map(
      (mission) => resolveMission(project, mission.id, { difficulty: 'standard' }).level,
    );
    // Give the actual Guide a non-null Canvas context. Other optional surfaces
    // remain unpainted; panel tests own detailed actor rendering assertions.
    const context = new Proxy(
      {},
      {
        get: (target, key) => target[key] ?? ((...args) => paints.push([key, ...args])),
        set: (target, key, value) => {
          target[key] = value;
          return true;
        },
      },
    );
    t.mock.method(SoloElement.prototype, 'getContext', function () {
      return this.id === 'enemy-guide-preview' ? context : null;
    });
    const page = await soloPage(t, {
      search: compiled ? '' : '?edition=sample-public',
      storage,
      previewStorage: preview,
      fetchResponse: async (path, options) => {
        requests.push(String(path));
        // Unhandled URLs retain the existing host's ordinary fetch fallback.
        return fixture.fetcher(path, options);
      },
      browserSetup({ document }) {
        // Model the real compiled HTML marker on <html>, which the provider
        // reads before admission; the body marker must be produced by the app.
        if (compiled) document.documentElement.setAttribute('data-edition-id', 'sample-public');
      },
    });
    page.win.crypto = globalThis.crypto;
    page.$('enemy-guide-frame').contentWindow = {};
    assert.equal(page.doc.body.dataset.editionId, 'sample-public');
    assert.ok(
      fixture.requests.includes(compiled ? 'edition-catalog.json' : 'game/editions/catalog.json'),
      'The actual provider must admit the requested source or compiled edition.',
    );
    assert.deepEqual(
      page.$('theme-select').children.map(({ value }) => value),
      ['sample-theme'],
      'The real edition owns its custom theme, not the canonical Guide theme catalog.',
    );
    page.$('start-button').click();
    await settle(() => page.doc.body.dataset.flightState === 'running');
    for (let i = 0; i < 12; i++) page.frame();
    page.$('pause-button').click();
    page.frame(0);
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    openGuide(page);
    // The existing Guide opener invokes pause(true), which may refresh the
    // suspended record's savedAt. Subsequent reading/rejected launch is inert.
    const persisted = [...storage.map],
      persistentWrites = storage.writes.length,
      retained = [...preview.map],
      previewWrites = preview.writes.length,
      requestCount = requests.length,
      frameSource = page.$('enemy-guide-frame').src;
    for (const topic of ['bouncer', 'line-impact']) {
      page.change('enemy-guide-topic', topic);
      const entry = enemyGuideEntry(topic),
        notice = translate('interface:guideCatalogPracticeUnavailable');
      assert.doesNotMatch(notice, /guideCatalogPracticeUnavailable|interface:/);
      assert.ok(page.$('enemy-guide-instructions').textContent.includes(notice));
      assert.equal(page.$('enemy-guide-play').disabled, true);
      assert.equal(page.$('enemy-guide-theme').disabled, true);
      for (const field of ['spot', 'risk', 'try'])
        assert.ok(page.$(`enemy-guide-${field}`).textContent.includes(entry[field]));
      page.$('enemy-guide-read').focus();
      nativeKey(page, 'Enter');
      assert.equal(page.doc.activeElement, page.$('enemy-guide-summary'));
      for (let i = 0; i < 12; i++) page.frame();
      nativeKey(page, 'Escape');
      assert.equal(page.doc.activeElement, page.$('enemy-guide-read'));
      // Disabled native controls are not the authority: stale/programmatic
      // activation must also be rejected before any preparation or handoff.
      assert.equal(await page.$('enemy-guide-play').onclick(), false);
      assert.equal(page.$('enemy-guide-frame').hidden, true);
      assert.equal(page.$('enemy-guide-frame').src, frameSource);
      assert.equal(page.$('enemy-guide-practice').hidden, true);
      assert.equal(page.$('enemy-guide-content').hidden, false);
      assert.equal(page.doc.activeElement, page.$('enemy-guide-read'));
      assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
      assert.deepEqual([...storage.map], persisted);
      assert.deepEqual([...preview.map], retained);
      assert.equal(storage.writes.length, persistentWrites);
      assert.equal(preview.writes.length, previewWrites);
    }
    assert.ok(
      requests.slice(requestCount).every((path) => !path.includes('line-impact-demo.json')),
      'Unavailable practice must not even fetch the impact scenario.',
    );
    // The same admitted host must still offer the enabled role in its actual
    // loaded mission. Only unsupported catalog practice is unavailable.
    page.change('enemy-guide-topic', 'trail-pursuit');
    const run = page.rendered.run;
    assert.equal(run.level.classic.enemyPressure.actors[0].mode, 'trail-pursuit');
    assert.equal(page.$('enemy-guide-play').disabled, false);
    assert.equal(await page.$('enemy-guide-play').onclick(), true);
    const frame = page.$('enemy-guide-frame'),
      url = new URL(frame.src);
    assert.equal(frame.hidden, false);
    assert.equal(page.doc.activeElement, frame);
    assert.equal(url.origin, 'http://localhost');
    assert.equal(url.searchParams.get('edition'), 'sample-public');
    assert.equal(url.searchParams.get('edition-mission'), run.levelId);
    assert.equal(url.searchParams.get('practice'), '1');
    assert.equal(url.searchParams.get('practice-return'), 'enemy-guide');
    assert.match(url.searchParams.get('enemy-workshop-session'), /^[a-f0-9]{32}$/);
    assert.equal(url.searchParams.get('class'), run.classId);
    assert.equal(url.searchParams.get('turn-policy'), run.turnPolicy);
    assert.equal(url.searchParams.get('guide-seed'), String(run.seed));
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...storage.map], persisted);
    assert.deepEqual([...preview.map], retained);
    assert.equal(storage.writes.length, persistentWrites);
    assert.equal(preview.writes.length, previewWrites);
    page.$('enemy-guide-return').focus();
    nativeKey(page, 'Enter');
    assert.equal(frame.hidden, true);
    assert.equal(frame.src, 'about:blank');
    assert.equal(page.$('enemy-guide-dialog').open, true);
    assert.equal(page.$('enemy-guide-topic').value, 'trail-pursuit');
    assert.equal(page.doc.activeElement, page.$('enemy-guide-play'));
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...storage.map], persisted);
    assert.deepEqual([...preview.map], retained);
    assert.equal(storage.writes.length, persistentWrites);
    assert.equal(preview.writes.length, previewWrites);
    page.$('enemy-guide-back').focus();
    nativeKey(page, 'Enter');
    assert.equal(page.$('enemy-guide-dialog').open, false);
    assert.equal(page.$('shell-workshop-dialog').open, true);
    assert.equal(page.doc.activeElement, page.$('shell-guide'));
    page.frame(0);
    assert.equal(page.rendered.paused, true);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual([...storage.map], persisted);
    assert.deepEqual([...preview.map], retained);
    assert.equal(storage.writes.length, persistentWrites);
    assert.equal(preview.writes.length, previewWrites);
    assert.deepEqual(page.errors, []);
  });
