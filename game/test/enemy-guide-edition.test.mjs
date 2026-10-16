import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Events, Document } from './helpers/couch-dom.mjs';
import { SoloElement, memoryStorage } from './helpers/solo-dom.mjs';
import { attachEnemyGuide } from '../ui/enemy-guide.mjs';
import { attachControllerNavigation } from '../ui/controller-navigation.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

const themes = JSON.parse(readFileSync(new URL('../content/themes.json', import.meta.url))).themes;
const customTheme = { ...themes[0], id: 'sample-edition-theme' };
const handoff = 'revealline.playground.current';

// Exercise the actual Guide painter with a non-null Canvas boundary. This
// records commands and resource ownership; it does not assert browser pixels.
function setup(t, options = {}) {
  const doc = new Document(),
    host = new Events(),
    painted = [],
    requested = [],
    counters = { started: 0, impact: 0 },
    context = new Proxy(
      {},
      {
        get: (target, key) => target[key] ?? ((...args) => painted.push([key, ...args])),
      },
    );
  host.location = { href: 'http://localhost/game/?edition=sample-public' };
  host.crypto = globalThis.crypto;
  host.sessionStorage = memoryStorage({ [handoff]: 'retained original bytes' });
  doc.createElement = (tag) => {
    const element = new SoloElement(doc, tag);
    element.getContext = () => context;
    return element;
  };
  const opener = doc.createElement('button');
  doc.body.append(opener);
  opener.focus();
  let repaint;
  const guide = attachEnemyGuide({
    document: doc,
    window: host,
    themes: [customTheme],
    catalogPracticeAvailable: false,
    getThemeId: () => customTheme.id,
    createBodyAssets({ changed }) {
      repaint = changed;
      return {
        update(poses) {
          requested.push(...poses);
        },
        clear() {},
        current: () => null,
        status: () => '',
      };
    },
    loadImpactScenario: async () => {
      counters.impact++;
      throw new Error('Must not load');
    },
    onPractice: () => counters.started++,
    ...options,
  });
  const nav = attachControllerNavigation({
    document: doc,
    getScope: () => (guide.dialog.open ? 'guide' : 'closed'),
    getRoot: () => guide.dialog,
    getDefaultFocus: () => doc.getElementById('enemy-guide-topic'),
    onBack: () => guide.close(),
    keyboard: true,
  });
  t.after(() => {
    nav.destroy();
    guide.dispose();
  });
  return {
    guide,
    host,
    doc,
    nav,
    opener,
    painted,
    requested,
    counters,
    repaint: () => repaint(),
    $: (id) => doc.getElementById(`enemy-guide-${id}`),
  };
}

test('custom edition with no role image remains readable with no absent palette or canonical asset request', async (t) => {
  const h = setup(t);
  assert.doesNotThrow(() => h.guide.open());
  assert.equal(h.$('preview').hidden, true);
  assert.equal(h.$('theme').disabled, true);
  assert.equal(h.$('play').disabled, true);
  assert.ok(h.$('risk').textContent.length > 0);
  for (const id of ['ukraine', 'retro', 'coupa', 'fpv']) {
    h.$('theme').value = id;
    assert.doesNotThrow(() => h.$('theme').onchange());
    h.guide.update(0.1);
    h.repaint();
    assert.equal(await h.$('play').onclick(), false, 'A stale/direct handler cannot launch.');
  }
  assert.deepEqual(h.requested, []);
  assert.equal(h.counters.started, 0);
  assert.equal(h.host.sessionStorage.getItem(handoff), 'retained original bytes');
  assert.equal(h.host.sessionStorage.writes.length, 0);
  assert.equal(h.guide.frame.hidden, true);
  h.nav.engage();
  h.nav.handle({ back: true });
  assert.equal(h.guide.dialog.open, false);
  assert.equal(h.doc.activeElement, h.opener);
});

test('selected compiled FPV role stays visible without enabling unavailable catalog practice or appearances', async (t) => {
  const image = { selectedEdition: 'bouncer' };
  let presentation = {
    canvas: { palette: themes[0].palette },
    image: (id) => (id === 'enemy.bouncer' ? { image } : null),
  };
  const h = setup(t, { getPresentation: () => presentation });
  h.guide.open();
  assert.equal(h.$('preview').hidden, false);
  assert.equal(h.$('theme').value, 'fpv');
  assert.equal(h.$('theme').disabled, true);
  assert.ok(h.painted.some(([method, object]) => method === 'drawImage' && object === image));
  for (const option of h.$('theme').children) assert.equal(option.disabled, option.value !== 'fpv');
  h.$('theme').value = 'ukraine';
  h.$('theme').onchange();
  assert.equal(h.$('theme').value, 'fpv');
  assert.equal(await h.$('play').onclick(), false);
  h.$('topic').value = 'border-patrol';
  h.$('topic').onchange();
  assert.equal(h.$('preview').hidden, true, 'Missing role never borrows the previous role image.');
  h.painted.length = 0;
  h.repaint();
  assert.equal(
    h.painted.some(([method]) => method === 'drawImage'),
    false,
  );
  h.$('topic').value = 'bouncer';
  h.$('topic').onchange();
  presentation = null;
  assert.doesNotThrow(() => h.guide.refreshPresentation());
  assert.equal(h.$('preview').hidden, true);
  presentation = { canvas: { palette: themes[0].palette }, image: () => ({ image }) };
  h.guide.refreshPresentation();
  assert.equal(h.$('preview').hidden, false, 'A newly ready admitted preview is usable.');
  assert.deepEqual(h.requested, [], 'No canonical body is substituted for selected edition art.');
  assert.equal(h.host.sessionStorage.writes.length, 0);
});

test('catalog capability blocks impact preparation even with canonical themes and a direct handler call', async (t) => {
  const h = setup(t, { themes });
  for (const topic of ['bouncer', 'line-impact']) {
    h.guide.open({ topic });
    assert.equal(h.$('play').disabled, true);
    assert.equal(await h.$('play').onclick(), false);
  }
  assert.equal(h.counters.impact, 0);
  assert.equal(h.counters.started, 0);
  assert.equal(h.host.sessionStorage.writes.length, 0);
  assert.equal(h.guide.practiceActive, false);
});

test('visibility and BFCache return reconcile edition preview readiness without requesting another body', (t) => {
  let presentation = null;
  const image = { selectedEdition: 'bouncer' },
    ready = { canvas: { palette: themes[0].palette }, image: () => ({ image }) },
    h = setup(t, { getPresentation: () => presentation });
  h.guide.open();
  assert.equal(h.$('preview').hidden, true);
  h.doc.hidden = true;
  h.doc.emit('visibilitychange');
  presentation = ready;
  h.painted.length = 0;
  h.guide.refreshPresentation();
  assert.deepEqual(h.painted, [], 'Hidden readiness performs no painting.');
  h.doc.hidden = false;
  h.doc.emit('visibilitychange');
  assert.equal(h.$('preview').hidden, false);
  assert.ok(h.painted.some(([method, object]) => method === 'drawImage' && object === image));
  h.host.emit('pagehide');
  presentation = null;
  h.painted.length = 0;
  h.guide.refreshPresentation();
  h.host.emit('pageshow');
  assert.equal(h.$('preview').hidden, true, 'BFCache never exposes the retired role image.');
  assert.equal(
    h.painted.some(([method]) => method === 'drawImage'),
    false,
  );
  assert.deepEqual(h.requested, []);
  assert.equal(h.host.sessionStorage.writes.length, 0);
});

test('unavailable practice and preview explanations follow EN/UK without hiding the readable threat', (t) => {
  const previous = getLocale();
  t.after(() => setLocale(previous));
  setLocale('en');
  const h = setup(t);
  h.guide.open();
  assert.equal(
    h.$('instructions').textContent,
    'Practice for this lesson is unavailable in this edition. You can read the guide or choose a threat from the current mission.',
  );
  assert.equal(
    h.$('preview-note').textContent,
    'An illustration is not available for this edition. The threat guidance remains available below.',
  );
  setLocale('uk');
  assert.equal(
    h.$('instructions').textContent,
    'Тренування для цього уроку недоступне в цьому виданні. Можна прочитати довідник або вибрати загрозу з поточної місії.',
  );
  assert.equal(
    h.$('preview-note').textContent,
    'Ілюстрація недоступна для цього видання. Підказки щодо загрози наведено нижче.',
  );
  assert.ok(h.$('risk').textContent.length > 0);
  assert.equal(h.$('back').disabled, false);
});
