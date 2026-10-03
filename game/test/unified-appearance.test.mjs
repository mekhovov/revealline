import test from 'node:test';
import assert from 'node:assert/strict';
import { Document, Events } from './helpers/couch-dom.mjs';
import {
  BUILTIN_THEME_FAMILIES,
  DEFAULT_THEME_PREFERENCES,
  LEGACY_THEME_PREFERENCES_KEY,
  THEME_PREFERENCES_KEY,
  createThemePreferences,
} from '../presentation/theme-system.mjs';
import { installThemeHost } from '../presentation/theme-host.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { duplicateStudioSnapshot, reviseStudioTheme } from '../presentation/studio-session.mjs';
import { createThemeCandidate } from '../presentation/theme-preview.mjs';
import { attachThemeFamilyControls } from '../ui/theme-family-controls.mjs';
import {
  INDUSTRIAL_ARCADE_COLLECTION,
  createArcadeAdapter,
  getArcadeCollection,
  industrialTexturePixels,
  selectedArcadeCollection,
} from '../presentation/industrial-arcade.mjs';
import { INDUSTRIAL_BUILTIN_SPRITES } from '../presentation/industrial-arcade-builtins.mjs';
import { FIELD_KIT_SPRITE_IDS, pixelArtForSlot } from '../presentation/pixel-art.mjs';
import { BoardPainter } from '../ui/render.mjs';

const simKey = 'revealline.fpv.appearance.v1';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial)),
    writes = [];
  return {
    values,
    writes,
    getItem: (key) => values.get(key) ?? null,
    setItem(key, value) {
      values.set(key, value);
      writes.push([key, value]);
    },
  };
}
function hostFixture(t, options = {}) {
  const document = new Document(),
    window = new Events(),
    storage = options.storage ?? memoryStorage();
  const host = installThemeHost({
    document,
    window,
    getStorage: () => storage,
    prepareStyles: () => Promise.resolve(),
    ...options,
  });
  t.after(() => host.dispose());
  return { document, window, storage, host };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
const nextTask = () => new Promise((resolve) => setImmediate(resolve));

test('prepared context leaves the accepted interface and preferences unchanged until a synchronous single-use commit', async (t) => {
  const { document, host, storage } = hostFixture(t, {
    appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
  });
  await host.ready;
  const accepted = host.snapshot(),
    preferences = host.preferences.snapshot(),
    notifications = [],
    fonts = deferred();
  let requests = 0;
  document.fonts = {
    load() {
      requests++;
      return fonts.promise;
    },
  };
  const stop = host.subscribe((snapshot) => notifications.push(snapshot));
  t.after(stop);
  const preparing = host.prepareDefault({ familyId: 'industrial-workshop', revision: 'r1' });
  await nextTask();
  assert.ok(requests > 0, 'new interface fonts are genuinely pending');
  assert.equal(host.snapshot(), accepted);
  assert.equal(document.documentElement.dataset.interfaceTheme, 'vyshyvanka');
  assert.equal(host.preferences.snapshot(), preferences);
  assert.deepEqual(storage.writes, []);
  assert.deepEqual(notifications, [accepted]);
  fonts.resolve([]);
  const token = await preparing;
  assert.equal(host.snapshot(), accepted, 'completion of preparation alone has no visible effect');
  assert.equal(token.commit(), true);
  assert.equal(host.snapshot().familyRevision, 'r1');
  assert.equal(document.documentElement.dataset.interfaceTheme, 'industrial-workshop');
  const painter = new BoardPainter({});
  t.after(() => painter.dispose());
  painter.setArcadeProvider(() => host.effectivePreferences());
  painter.setLevel({ id: 'new-attempt' });
  assert.equal(
    painter.arcadeCollection,
    INDUSTRIAL_ARCADE_COLLECTION,
    'setLevel sees the exact accepted pin in the same stack',
  );
  assert.equal(token.commit(), false, 'a consumed transaction cannot be replayed');
  assert.equal(notifications.length, 2);
  assert.equal(host.preferences.snapshot(), preferences);
  assert.deepEqual(storage.writes, [], 'context adoption never writes a personal preference');
});

for (const patch of [{ highContrast: true }, { arcadeArt: 'authored' }]) {
  test(`prepared context rejects stale ${Object.keys(patch)[0]} intent and leaves the current context in charge`, async (t) => {
    const { host } = hostFixture(t, {
      appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
    });
    await host.ready;
    const token = await host.prepareDefault({ familyId: 'dnipro-porcelain', revision: 'r1' });
    host.set(patch);
    await host.ready;
    const current = host.snapshot();
    assert.equal(token.commit(), false);
    assert.equal(token.commit(), false);
    assert.equal(host.snapshot(), current);
    assert.equal(current.familyId, 'vyshyvanka');
    assert.equal(host.preferences.snapshot()[Object.keys(patch)[0]], Object.values(patch)[0]);
  });
}

test('prepared context rejects an intervening different context or a disposed owner', async (t) => {
  const { host } = hostFixture(t, {
    appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
  });
  await host.ready;
  const old = await host.prepareDefault({ familyId: 'dnipro-porcelain', revision: 'r1' });
  await host.setDefault({ familyId: 'tryzub', revision: 'r1' });
  assert.equal(old.commit(), false);
  assert.equal(host.snapshot().familyId, 'tryzub');
  const retired = await host.prepareDefault({ familyId: 'dos', revision: 'r2' });
  host.dispose();
  assert.equal(retired.commit(), false);
});

test('failed font preparation retains the exact accepted context and lets a later preparation recover', async (t) => {
  const { document, host, storage } = hostFixture(t, {
    appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
  });
  await host.ready;
  const accepted = host.snapshot();
  document.fonts = { load: () => Promise.reject(new Error('Font decode failed')) };
  await assert.rejects(
    host.prepareDefault({ familyId: 'dos', revision: 'r2' }),
    /Font decode failed/,
  );
  assert.equal(host.snapshot(), accepted);
  assert.equal(document.documentElement.dataset.interfaceTheme, 'vyshyvanka');
  assert.equal(host.effectivePreferences().familyId, 'vyshyvanka');
  assert.deepEqual(storage.writes, []);
  document.fonts.load = () => Promise.resolve([]);
  const recovered = await host.prepareDefault({ familyId: 'dos', revision: 'r2' });
  assert.equal(recovered.commit(), true);
  assert.equal(host.snapshot().familyId, 'dos');
});

test('failed stylesheet preparation never adopts its requested context and the original context recovers', async (t) => {
  let available = false;
  const { host, storage } = hostFixture(t, {
    appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
    prepareStyles: () =>
      available ? Promise.resolve() : Promise.reject(new Error('Styles unavailable')),
  });
  await host.ready;
  assert.equal(host.snapshot(), null);
  await assert.rejects(
    host.prepareDefault({ familyId: 'dos', revision: 'r2' }),
    /Styles unavailable/,
  );
  assert.equal(host.snapshot(), null);
  assert.equal(host.effectivePreferences().familyId, 'vyshyvanka');
  available = true;
  await host.refresh();
  assert.equal(host.snapshot().familyId, 'vyshyvanka');
  assert.deepEqual(storage.writes, []);
});

test('a late earlier refresh cannot overwrite a synchronously committed prepared context', async (t) => {
  const { document, host } = hostFixture(t, {
    appearanceDefault: { familyId: 'vyshyvanka', revision: 'r1' },
  });
  await host.ready;
  const oldFonts = deferred();
  let oldRequests = 0;
  document.fonts = {
    load() {
      oldRequests++;
      return oldFonts.promise;
    },
  };
  const earlier = host.refresh();
  await nextTask();
  assert.ok(oldRequests > 0);
  document.fonts.load = () => Promise.resolve([]);
  const next = await host.prepareDefault({ familyId: 'dnipro-porcelain', revision: 'r1' });
  assert.equal(next.commit(), true);
  const accepted = host.snapshot();
  assert.equal(accepted.familyId, 'dnipro-porcelain');
  oldFonts.resolve([]);
  await earlier;
  assert.equal(await host.ready, accepted);
  assert.equal(host.snapshot(), accepted);
  assert.equal(document.documentElement.dataset.interfaceTheme, 'dnipro-porcelain');
});

// Exercise the actual host-to-painter bridge: resolving the DOM correctly is
// insufficient if the accepted revision is dropped before the new attempt.
test('an old context family pin reaches Arcade unchanged and a later context uses its own revision', async (t) => {
  const { host } = hostFixture(t, {
    appearanceDefault: { familyId: 'industrial-workshop', revision: 'r1' },
  });
  await host.ready;
  assert.equal(host.snapshot().familyRevision, 'r1');
  assert.equal(host.effectivePreferences().familyRevision, 'r1');
  const retained = selectedArcadeCollection(host.effectivePreferences());
  assert.equal(retained, INDUSTRIAL_ARCADE_COLLECTION);
  await host.setDefault({ familyId: 'industrial-workshop', revision: 'r2' });
  assert.equal(host.snapshot().familyRevision, 'r2');
  const current = selectedArcadeCollection(host.effectivePreferences());
  assert.equal(current, getArcadeCollection('industrial-workshop', 'r2'));
  assert.notEqual(current, retained);
  assert.equal(retained.revision, 'r1', 'a captured attempt keeps its original collection object');
});

test('compact theme cards immediately apply complete choices without replacing focused controls', async (t) => {
  const { document, host, storage } = hostFixture(t);
  await host.ready;
  const controls = attachThemeFamilyControls({
    document,
    root: document.body,
    host,
    prefix: 'review-',
  });
  t.after(() => controls.dispose());
  const card = document.getElementById('review-theme-card-vyshyvanka');
  assert.equal(document.getElementById('review-theme-apply'), null);
  assert.equal(document.getElementById('review-theme-familyId'), null);
  assert.equal(document.getElementById('review-theme-family-heading').tagName, 'H4');
  card.focus();
  card.click();
  assert.equal(host.preferences.snapshot().familyId, 'vyshyvanka');
  assert.equal(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)).familyId, 'vyshyvanka');
  await host.ready;
  assert.equal(host.snapshot().familyId, 'vyshyvanka');
  assert.equal(card.getAttribute('aria-pressed'), 'true');
  assert.equal(document.activeElement, card);
  const contrast = document.getElementById('review-theme-highContrast');
  contrast.checked = true;
  contrast.emit('change');
  const ornaments = document.getElementById('review-theme-ornaments');
  ornaments.value = 'off';
  ornaments.emit('change');
  const dnipro = document.getElementById('review-theme-card-dnipro-porcelain');
  dnipro.focus();
  dnipro.click();
  assert.equal(host.preferences.snapshot().familyId, 'dnipro-porcelain');
  await host.ready;
  assert.equal(host.snapshot().familyId, 'dnipro-porcelain');
  assert.equal(host.preferences.snapshot().highContrast, true);
  assert.equal(
    host.preferences.snapshot().ornaments,
    'theme',
    'A new complete choice resets optional detail.',
  );
  assert.equal(document.activeElement, dnipro);
  assert.equal(
    document.getElementById(card.id),
    card,
    'Existing gallery controls retain identity.',
  );
  assert.equal(card.getAttribute('aria-pressed'), 'false');
});

test('Follow, original Field Kit and curated revisions have complete cards and exact context/custom colors', async (t) => {
  const candidate = createThemeCandidate(
    reviseStudioTheme(
      duplicateStudioSnapshot(createDefaultThemeBundle(), {
        id: 'controls-curated',
        name: 'Community Workshop',
      }),
      { tokens: { panel: '#282428' } },
    ),
    { familyId: 'vyshyvanka' },
  );
  const { document, host, storage } = hostFixture(t, {
    appearanceThemes: [candidate],
    appearanceDefault: { familyId: candidate.family.id, revision: candidate.family.revision },
  });
  await host.ready;
  const controls = attachThemeFamilyControls({ document, root: document.body, host });
  t.after(() => controls.dispose());
  const follow = document.getElementById('theme-card-follow-game'),
    original = document.getElementById('theme-card-legacy'),
    custom = document.getElementById(`theme-card-${candidate.family.id}`);
  assert.ok(follow && original && custom);
  assert.equal(document.getElementById('theme-familyId'), null);
  assert.deepEqual(storage.writes, [], 'Rendering choices never writes a preference.');
  for (const button of [follow, original, custom]) {
    assert.ok(button.querySelector('strong').textContent);
    assert.ok(button.querySelector('small').textContent);
  }
  for (const button of [follow, custom])
    assert.equal(
      button
        .querySelector('.theme-preview-swatches')
        .children[1].style.getPropertyValue('background-color'),
      candidate.interfaceTheme.tokens.panel,
    );
  custom.focus();
  custom.click();
  await host.ready;
  assert.equal(host.snapshot().familyId, candidate.family.id);
  assert.equal(host.snapshot().familyRevision, candidate.family.revision);
  assert.equal(host.snapshot().tokens.panel, candidate.interfaceTheme.tokens.panel);
  assert.equal(document.activeElement, custom);
  original.click();
  await host.ready;
  assert.equal(host.snapshot().familyId, 'legacy');
  follow.focus();
  follow.click();
  await host.ready;
  assert.equal(host.preferences.snapshot().familyId, 'follow-game');
  assert.equal(host.snapshot().familyId, candidate.family.id);
  await host.setDefault({ familyId: 'dnipro-porcelain', revision: 'r1' });
  assert.equal(host.snapshot().familyId, 'dnipro-porcelain');
  assert.equal(document.activeElement, follow);
  assert.equal(document.getElementById(custom.id), custom);
  assert.equal(
    follow
      .querySelector('.theme-preview-swatches')
      .children[1].style.getPropertyValue('background-color'),
    host.snapshot().tokens.panel,
  );
});

test('rapid immediate choices retain the accepted theme until resources load, ignore superseded loads and preserve newest focus on failure', async (t) => {
  const { document, host } = hostFixture(t);
  await host.ready;
  const accepted = host.snapshot(),
    controls = attachThemeFamilyControls({ document, root: document.body, host });
  t.after(() => controls.dispose());
  const older = deferred();
  document.fonts = { load: () => older.promise };
  const first = document.getElementById('theme-card-vyshyvanka');
  first.focus();
  first.click();
  const previousLoad = host.ready;
  await nextTask();
  assert.equal(host.snapshot(), accepted);
  const latest = deferred();
  document.fonts.load = () => latest.promise;
  const last = document.getElementById('theme-card-dnipro-porcelain');
  last.focus();
  last.click();
  await nextTask();
  assert.equal(last.getAttribute('aria-pressed'), 'true');
  latest.resolve([]);
  await host.ready;
  const resolved = host.snapshot();
  assert.equal(resolved.familyId, 'dnipro-porcelain');
  older.resolve([]);
  await previousLoad;
  assert.equal(host.snapshot(), resolved);
  assert.equal(document.activeElement, last);
  assert.equal(last.getAttribute('aria-pressed'), 'true');
  document.fonts.load = () => Promise.reject(new Error('Font decode failed'));
  first.focus();
  first.click();
  await host.ready;
  assert.equal(host.snapshot(), resolved, 'Failure retains the last accepted presentation.');
  assert.equal(document.activeElement, first);
  assert.match(host.getWarning(), /Font decode failed/);
  document.fonts.load = () => Promise.resolve([]);
  first.click();
  await host.ready;
  assert.equal(host.snapshot().familyId, 'vyshyvanka');
  assert.equal(host.getWarning(), '');
});

test('v1 preference migration is read-only, preserves unknown intent and permits explicit recovery', async (t) => {
  const legacy = JSON.stringify({
    familyId: 'future-family',
    arcadeArt: 'authored',
    highContrast: true,
    opaqueHud: true,
  });
  const menu = JSON.stringify({ palette: 'ukrainian', ornaments: 'rich' });
  const storage = memoryStorage({
    [LEGACY_THEME_PREFERENCES_KEY]: legacy,
    'revealline.menu-style.v1': menu,
  });
  const { host } = hostFixture(t, { storage });
  await host.ready;
  assert.deepEqual(storage.writes, []);
  assert.equal(storage.getItem(THEME_PREFERENCES_KEY), null);
  assert.equal(host.preferences.snapshot().familyId, 'future-family');
  assert.equal(host.preferences.snapshot().ornaments, 'rich');
  assert.equal(host.snapshot().familyId, 'industrial-workshop');
  assert.match(host.getWarning(), /future-family/);
  await host.applyComplete('tryzub');
  assert.equal(host.snapshot().familyId, 'tryzub');
  assert.equal(host.getWarning(), '');
  assert.equal(storage.getItem(LEGACY_THEME_PREFERENCES_KEY), legacy);
  assert.equal(storage.getItem('revealline.menu-style.v1'), menu);
  assert.deepEqual(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)), {
    ...DEFAULT_THEME_PREFERENCES,
    familyId: 'tryzub',
    highContrast: true,
    opaqueHud: true,
  });
});

test('Signal Blue paints its advertised palette independently of old menu skins, while exact r1 stays legacy', async (t) => {
  for (const palette of ['auto', 'ukrainian']) {
    const menu = JSON.stringify({ palette, ornaments: 'subtle' });
    const storage = memoryStorage({
      'revealline.menu-style.v1': menu,
      [THEME_PREFERENCES_KEY]: JSON.stringify({ ...DEFAULT_THEME_PREFERENCES, familyId: 'legacy' }),
    });
    const { host, document } = hostFixture(t, { storage });
    await host.ready;
    const classic = host.availableThemeChoices().find((choice) => choice.id === 'legacy');
    assert.equal(host.snapshot().revision, 'r3');
    assert.equal(document.documentElement.dataset.themeStyled, 'true');
    for (const role of ['ink', 'panel', 'text', 'accent'])
      assert.equal(
        document.documentElement.style.getPropertyValue(`--iw-${role}`),
        classic.interfaceTheme.tokens[role],
      );
    assert.deepEqual(storage.writes, [], 'Startup does not rewrite either preference format.');
    assert.equal(storage.getItem('revealline.menu-style.v1'), menu);
    await host.applyComplete('follow-game');
    await host.setDefault({ familyId: 'legacy', revision: 'r1' });
    assert.equal(host.snapshot().revision, 'r1');
    assert.equal(document.documentElement.dataset.themeStyled, 'false');
    const writes = storage.writes.length;
    await host.setDefault({ familyId: 'legacy', revision: 'r2' });
    assert.equal(document.documentElement.dataset.themeStyled, 'true');
    assert.equal(
      storage.writes.length,
      writes,
      'Changing an exact context pin never persists personal intent.',
    );
    assert.equal(storage.getItem('revealline.menu-style.v1'), menu);
  }
});

test('complete Apply clears independent SIM appearance but preserves accessibility and legacy records', () => {
  const display = JSON.stringify({ textFace: 'plain', textSize: 'large', reducedEffects: true });
  const storage = memoryStorage({
    [THEME_PREFERENCES_KEY]: JSON.stringify({
      ...DEFAULT_THEME_PREFERENCES,
      familyId: 'dos',
      arcadeArt: 'authored',
      ornaments: 'off',
      highContrast: true,
      opaqueHud: true,
    }),
    [simKey]: JSON.stringify({
      format: 'SimAppearancePreferences.v1',
      interface: 'dos',
      world: 'vyshyvanka',
    }),
    'revealline.display.v1': display,
  });
  const preferences = createThemePreferences({ getStorage: () => storage });
  try {
    preferences.applyComplete('dnipro-porcelain');
    assert.deepEqual(JSON.parse(storage.getItem(THEME_PREFERENCES_KEY)), {
      ...DEFAULT_THEME_PREFERENCES,
      familyId: 'dnipro-porcelain',
      highContrast: true,
      opaqueHud: true,
    });
    assert.deepEqual(JSON.parse(storage.getItem(simKey)), {
      format: 'SimAppearancePreferences.v1',
      interface: 'follow-game',
      world: 'follow-game',
    });
    assert.equal(storage.getItem('revealline.display.v1'), display);
    assert.deepEqual(
      storage.writes.map(([key]) => key),
      [THEME_PREFERENCES_KEY, simKey],
    );
  } finally {
    preferences.dispose();
  }
});

test('all installed Arcade treatments preserve native sprite coverage and source ownership', () => {
  const families = BUILTIN_THEME_FAMILIES.filter((family) => family.arcade);
  assert.ok(families.length >= 8, 'Original families remain available alongside new ones.');
  for (const family of families) {
    const collection = selectedArcadeCollection({
      familyId: family.id,
      familyRevision: family.revision,
      arcadeArt: 'follow-game',
    });
    assert.equal(collection.id, family.arcade.id);
    assert.equal(collection.revision, family.arcade.revision);
    for (const slot of FIELD_KIT_SPRITE_IDS) {
      const original = pixelArtForSlot(slot),
        before = new Uint8ClampedArray(original.rgba);
      const changed = industrialTexturePixels(original, slot, collection);
      assert.equal(changed.width, original.width);
      assert.equal(changed.height, original.height);
      assert.deepEqual(original.rgba, before, `${family.id}/${slot} original pixels are immutable`);
      for (let at = 3; at < before.length; at += 4)
        assert.equal(changed.rgba[at], before[at], `${family.id}/${slot} alpha ${at}`);
    }
  }
});

function spriteFixture() {
  const slot = 'terrain.wall',
    source = pixelArtForSlot(slot),
    canvases = [];
  const originalImage = { width: source.width, height: source.height };
  const asset = {
    id: `${slot}.field-kit`,
    file: {
      width: source.width,
      height: source.height,
      sha256: INDUSTRIAL_BUILTIN_SPRITES[slot][0],
    },
  };
  const geometry = { frame: { width: source.width, height: source.height }, rotors: [] };
  const original = { image: originalImage, geometry, asset };
  const base = Object.freeze({
    source: { id: 'original-release' },
    manifestSha256: 'original-manifest',
    resolved: { assets: { [slot]: asset } },
    canvas: { motionScale: 0 },
    image: (name) => (name === slot ? original : null),
  });
  const canvasFactory = () => {
    const canvas = {
      getContext: () => ({
        drawImage() {},
        getImageData: () => ({ data: new Uint8ClampedArray(source.rgba) }),
        putImageData(value) {
          canvas.pixels = new Uint8ClampedArray(value.data);
        },
      }),
    };
    canvases.push(canvas);
    return canvas;
  };
  return { slot, base, original, canvases, canvasFactory };
}

test('theme cache isolates all installed variants and retained Industrial history without touching original media', () => {
  const f = spriteFixture(),
    adapter = createArcadeAdapter({ canvasFactory: f.canvasFactory });
  const legacy = adapter.resolve(f.base, INDUSTRIAL_ARCADE_COLLECTION),
    oldFrame = legacy.image(f.slot),
    oldPixels = new Uint8ClampedArray(oldFrame.image.pixels);
  const variants = [];
  for (const family of BUILTIN_THEME_FAMILIES.filter((family) => family.arcade)) {
    const collection = getArcadeCollection(family.arcade.id, family.arcade.revision),
      view = adapter.resolve(f.base, collection),
      frame = view.image(f.slot);
    assert.equal(adapter.resolve(f.base, collection), view);
    assert.equal(view.image(f.slot), frame);
    assert.equal(view.source, f.base.source);
    assert.equal(view.resolved, f.base.resolved);
    assert.equal(frame.geometry, f.original.geometry);
    assert.equal(frame.asset, f.original.asset);
    variants.push(frame.image);
  }
  assert.equal(new Set(variants).size, variants.length);
  assert.equal(
    f.canvases.length,
    variants.length + 1,
    'each current variant plus one retained historical revision',
  );
  assert.deepEqual(oldFrame.image.pixels, oldPixels);
  assert.equal(adapter.resolve(f.base, INDUSTRIAL_ARCADE_COLLECTION), legacy);
  assert.equal(adapter.resolve(f.base, null), f.base);
  adapter.clear();
  assert.ok(f.canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  assert.equal(f.original.image.width, 16);
  assert.equal(f.original.image.height, 16);
});

test('an already failed preload is replaced and fetched before the host accepts a theme', async (t) => {
  const document = new Document(),
    window = new Events(),
    broken = document.createElement('link');
  document.readyState = 'complete';
  broken.rel = 'stylesheet';
  broken.setAttribute('data-industrial-workshop', '');
  broken.sheet = {
    get cssRules() {
      throw new DOMException('Failed resource has no readable rules', 'SecurityError');
    },
  };
  document.head.append(broken);
  let replacements = 0;
  const append = document.head.append.bind(document.head);
  document.head.append = (...nodes) => {
    append(...nodes);
    for (const node of nodes)
      if (node !== broken && node.getAttribute?.('data-industrial-workshop') !== null) {
        replacements++;
        queueMicrotask(() => {
          node.sheet = { cssRules: [{ cssText: ':root{}' }] };
          node.emit('load');
        });
      }
  };
  const host = installThemeHost({ document, window, getStorage: () => null });
  t.after(() => host.dispose());
  await host.ready;
  assert.equal(
    replacements,
    1,
    'a truthy failed stylesheet object must not count as a loaded sheet',
  );
  assert.equal(broken.parentNode, null);
  assert.equal(host.snapshot().familyId, 'industrial-workshop');
  assert.equal(host.getWarning(), '');
});
