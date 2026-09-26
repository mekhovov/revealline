import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateTheme,
  validateScenario,
  inspectImageDataUrl,
  CONTENT_LIMITS,
  recommendedBody,
} from '../content.mjs';
import { unlockedBodies } from '../progress.mjs';
import { preparePack, scenarioFromPack } from '../packs.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
const themes = JSON.parse(
  readFileSync(new URL('../content/themes.json', import.meta.url), 'utf8'),
).themes;
const campaign = JSON.parse(
  readFileSync(new URL('../content/campaign.json', import.meta.url), 'utf8'),
);
const classes = JSON.parse(
  readFileSync(new URL('../content/classes.json', import.meta.url), 'utf8'),
);
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const scenario = () => ({
  format: 'xonix-playground.v1',
  level: structuredClone(campaign.levels[0]),
  theme: structuredClone(themes[0]),
  settings: { classId: 'scout', turnPolicy: 'immediate', seed: 1 },
  classRecipes: structuredClone(classes),
  visualOverrides: {},
});
const rejected = (value, pattern) => {
  const r = validateScenario(value);
  assert.equal(r.valid, false, JSON.stringify(r));
  if (pattern) assert.match(r.errors.join('\n'), pattern);
  return r;
};
// Header-only fixtures exercise pre-decode size bounds; they are not claimed to
// be decodable or installed as artwork. Browser decode remains a separate gate.
function pngHeader(width, height) {
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return `data:image/png;base64,${bytes.toString('base64')}`;
}
function jpegHeader(width, height) {
  const bytes = Buffer.from([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    11,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    1,
    1,
    0x11,
    0,
    0xff,
    0xd9,
  ]);
  return `data:image/jpeg;base64,${bytes.toString('base64')}`;
}
function webpHeader(width, height) {
  const bytes = Buffer.alloc(26);
  bytes.write('RIFF');
  bytes.writeUInt32LE(18, 4);
  bytes.write('WEBPVP8L', 8);
  bytes.writeUInt32LE(5, 16);
  bytes[20] = 0x2f;
  bytes.writeUInt32LE((width - 1) | ((height - 1) << 14), 21);
  return `data:image/webp;base64,${bytes.toString('base64')}`;
}

test('all authored campaign themes and both policies validate without mutation', () => {
  for (const theme of themes)
    assert.equal(validateTheme(theme).valid, true, JSON.stringify(validateTheme(theme)));
  for (const level of campaign.levels)
    for (const turnPolicy of ['immediate', 'grid-center']) {
      const s = scenario();
      s.level = structuredClone(level);
      s.settings.turnPolicy = turnPolicy;
      s.presentation = { style: 'hybrid', showGrid: false };
      const before = structuredClone(s);
      assert.equal(validateScenario(s).valid, true, JSON.stringify(validateScenario(s)));
      assert.deepEqual(s, before);
    }
});
test('optional class appearance bindings use free registered rigs without changing recipes or unlocks', () => {
  const presets = JSON.parse(
    readFileSync(new URL('../../authoring/motion-lab/presets.json', import.meta.url), 'utf8'),
  );
  const progress = { clears: {} },
    allowed = unlockedBodies(progress);
  for (const theme of themes) {
    const before = structuredClone(theme);
    for (const recipe of classes) {
      const body = recommendedBody(theme, recipe.id);
      assert.ok(Object.hasOwn(presets.characters, body), body);
      assert.ok(allowed.has(body), `${theme.id}/${recipe.id} must not grant an earned cosmetic`);
    }
    assert.deepEqual(theme, before);
  }
  assert.equal(recommendedBody(themes[0], 'scout'), 'scout-quad');
  assert.equal(recommendedBody(themes[0], 'carrier'), 'heavy-lift');
  assert.equal(recommendedBody(themes[0], 'bomber'), 'fpv-body');
  assert.equal(recommendedBody(themes[0], 'future-class'), 'fpv-body');
  assert.equal(recommendedBody({}, 'scout', 'neutral-marker'), 'neutral-marker');
  assert.equal(
    recommendedBody({ classBodies: { scout: 'fixedwing-body' } }, 'scout'),
    'fixedwing-body',
  );
  assert.equal(allowed.has('fixedwing-body'), false, 'a recommendation must never grant ownership');
  assert.deepEqual(progress, { clears: {} });
});
test('class appearance references accept future IDs and old themes, but reject unsafe or oversized maps', () => {
  const old = structuredClone(themes[0]);
  delete old.classBodies;
  assert.equal(validateTheme(old).valid, true);
  const future = { ...old, classBodies: { 'custom-scout': 'future-body' } };
  assert.equal(validateTheme(future).valid, true);
  for (const mapping of [
    null,
    [],
    { scout: { body: 'fpv-body' } },
    { 'bad class': 'fpv-body' },
    { scout: 'https://example.test/art.png' },
    { scout: 'constructor' },
    Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`class-${i}`, 'fpv-body'])),
    JSON.parse('{"__proto__":"fpv-body"}'),
  ]) {
    const result = validateTheme({ ...old, classBodies: mapping });
    assert.equal(result.valid, false, JSON.stringify(mapping));
    assert.match(result.errors.join(' '), /classBodies|forbidden/);
  }
  const bad = { ...old, classBodies: {} };
  let reads = 0;
  Object.defineProperty(bad.classBodies, 'scout', {
    enumerable: true,
    get() {
      reads++;
      return 'fpv-body';
    },
  });
  assert.equal(validateTheme(bad).valid, false);
  assert.equal(reads, 0);
  assert.equal(validateTheme({ ...old, player: 'constructor' }).valid, false);
  assert.equal(
    recommendedBody({ classBodies: {} }, 'constructor', 'constructor'),
    'neutral-marker',
  );
});
test('class appearance maps survive pack preparation and scenario resolution as presentation only', async () => {
  const pack = JSON.parse(
    readFileSync(new URL('../content/packs/night-shift.json', import.meta.url), 'utf8'),
  );
  const theme = pack.themes[0],
    classId = pack.classRecipes[0].id;
  theme.classBodies = { [classId]: 'scout-quad' };
  const before = structuredClone(pack),
    prepared = await preparePack(pack);
  const scenario = scenarioFromPack(
    prepared.pack,
    pack.campaigns[0].id,
    pack.campaigns[0].levels[0].id,
  );
  assert.deepEqual(scenario.theme.classBodies, { [classId]: 'scout-quad' });
  assert.equal(validateScenario(scenario).valid, true);
  assert.deepEqual(pack, before);
  assert.deepEqual(
    scenario.classRecipes,
    pack.classRecipes.filter(
      (c) => !pack.campaigns[0].classIds || pack.campaigns[0].classIds.includes(c.id),
    ),
  );
});
test('optional presentation accepts the three explicit styles and rejects partial/unknown fields', () => {
  for (const style of ['microtile', 'props', 'hybrid']) {
    const s = scenario();
    s.presentation = { style, showGrid: true };
    assert.equal(validateScenario(s).valid, true);
  }
  for (const presentation of [
    null,
    {},
    { style: 'hybrid', showGrid: 'yes' },
    { style: 'cinematic', showGrid: false },
    { style: 'props', showGrid: false, rigs: {} },
  ]) {
    const s = scenario();
    s.presentation = presentation;
    rejected(s, /presentation/);
  }
});
test('unknown configuration keys are rejected at their actual scope', () => {
  const mutations = [
    (s) => (s.script = 'run()'),
    (s) => (s.settings.speed = 20),
    (s) => (s.theme.shader = 'custom'),
    (s) => (s.theme.palette.hazard = '#000000'),
    (s) => (s.theme.labels.instructions = 'extra'),
    (s) => (s.classRecipes[0].playerSpeed = 9),
    (s) => (s.visualOverrides.player = { dataUrl: png, anchorX: 0.5 }),
  ];
  for (const mutate of mutations) {
    const s = scenario();
    mutate(s);
    rejected(s, /unsupported|not supported/);
  }
});
test('theme identifiers, labels, colors and display strings must be useful bounded text', () => {
  for (const mutate of [
    (s) => (s.theme.name = ''),
    (s) => (s.theme.labels.enemy = ' '),
    (s) => (s.theme.player = 'javascript:run()'),
    (s) => (s.theme.palette.safe = 'red'),
    (s) => (s.theme.name = 'a'.repeat(121)),
  ]) {
    const s = scenario();
    mutate(s);
    rejected(s, /theme/);
  }
});
test('dangerous keys are rejected recursively including permitted level metadata', () => {
  for (const key of ['__proto__', 'constructor', 'prototype']) {
    const s = scenario();
    s.level.metadata = JSON.parse(`{"description":"safe","${key}":{}}`);
    rejected(s, /forbidden key/);
  }
});
test('cycles, accessors and non-JSON values reject without evaluating user getters', () => {
  const s = scenario();
  s.level.extra = s;
  rejected(s, /cycle/);
  let read = 0;
  const other = scenario();
  Object.defineProperty(other.theme, 'name', {
    enumerable: true,
    get() {
      read++;
      throw new Error('must not execute');
    },
  });
  rejected(other, /ordinary JSON/);
  assert.equal(read, 0);
  for (const value of [undefined, () => {}, new Map(), NaN]) {
    const s = scenario();
    s.level.extra = value;
    rejected(s, /JSON|finite/);
  }
});
test('oversized collections and deeply nested metadata are bounded before kernel work', () => {
  const s = scenario();
  s.level.walls = Array.from({ length: 257 }, () => ({ x: 1, y: 1, w: 1, h: 1 }));
  rejected(s, /array budget/);
  const nested = scenario();
  let cursor = nested.level;
  for (let i = 0; i < 15; i++) cursor = cursor.extra = {};
  rejected(nested, /nesting budget/);
});
test('sparse, decorated and altered-prototype arrays reject before their methods can be used', () => {
  const sparse = scenario();
  sparse.classRecipes = Array(2);
  rejected(sparse, /sparse/);
  const decorated = scenario();
  decorated.classRecipes.extra = 'not JSON';
  rejected(decorated, /array properties/);
  const changed = scenario();
  Object.setPrototypeOf(changed.classRecipes, null);
  assert.doesNotThrow(() => rejected(changed, /plain JSON/));
});
test('class recipe fallback uses an explicitly supplied default registry; malformed entries do not throw', () => {
  const s = scenario();
  delete s.classRecipes;
  const custom = [{ ...classes[0], id: 'local-scout' }];
  s.settings.classId = 'local-scout';
  assert.equal(validateScenario(s, { classRecipes: custom }).valid, true);
  rejected(s, /settings\.classId is not registered/);
  for (const classRecipes of [null, false, [], [null], [{}]]) {
    const bad = scenario();
    bad.classRecipes = classRecipes;
    assert.doesNotThrow(() => rejected(bad));
  }
  const named = scenario();
  named.classRecipes[0].label = 'x'.repeat(81);
  rejected(named, /label/);
});
test('scenario settings and level display metadata are bounded', () => {
  for (const settings of [
    null,
    [],
    { classId: 'scout', turnPolicy: 'diagonal', seed: 1 },
    { classId: 'scout', turnPolicy: 'immediate', seed: -1 },
  ]) {
    const s = scenario();
    s.settings = settings;
    rejected(s);
  }
  const s = scenario();
  delete s.level.name;
  rejected(s, /level.name/);
});
test('supported provenance metadata is text only and source URL never accepts executable schemes', () => {
  const s = scenario();
  s.metadata = {
    title: 'My pack',
    description: 'Original artwork.',
    author: 'Artist',
    sourceUrl: 'https://example.test/reference',
    license: 'User supplied',
    rightsStatus: 'Unverified',
  };
  assert.equal(validateScenario(s).valid, true);
  s.metadata.sourceUrl = 'javascript:alert(1)';
  rejected(s, /HTTP/);
  s.metadata = { description: 'x'.repeat(4097) };
  rejected(s, /budget/);
});
test('content structure and metadata errors follow the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const cyclic = scenario();
  cyclic.level.extra = cyclic;

  setLocale('uk', { persist: false });
  assert.match(validateScenario(cyclic).errors.join(' '), /циклічних посилань/);
  const unsafeUrl = scenario();
  unsafeUrl.metadata = { sourceUrl: 'javascript:alert(1)' };
  assert.match(validateScenario(unsafeUrl).errors.join(' '), /URL-адресою HTTP\(S\)/);
  const unsupported = scenario();
  unsupported.extra = true;
  assert.match(validateScenario(unsupported).errors.join(' '), /scenario\.extra не підтримується/);
  const invalidTheme = structuredClone(themes[0]);
  invalidTheme.id = 'not stable';
  invalidTheme.scene = 'missing-scene';
  invalidTheme.palette.ink = 'black';
  const ukrainianThemeErrors = validateTheme(invalidTheme).errors.join(' ');
  assert.match(ukrainianThemeErrors, /стабільним незарезервованим ідентифікатором/);
  assert.match(ukrainianThemeErrors, /theme\.scene не зареєстровано/);
  assert.match(ukrainianThemeErrors, /theme\.palette\.ink має використовувати формат #rrggbb/);
  assert.match(
    validateScenario({ format: 'unsupported' }).errors.join(' '),
    /Очікується підтримуваний формат xonix-playground\.v1\.\.v9/,
  );
  const invalidScenario = scenario();
  invalidScenario.settings = { classId: 'missing', turnPolicy: 'missing', seed: -1 };
  invalidScenario.presentation = { style: 'missing', showGrid: 'yes' };
  invalidScenario.visualOverrides.unknown = {};
  const ukrainianScenarioErrors = validateScenario(invalidScenario).errors.join(' ');
  assert.match(ukrainianScenarioErrors, /settings\.classId не зареєстровано/);
  assert.match(ukrainianScenarioErrors, /settings\.seed має бути цілим 32-бітним/);
  assert.match(ukrainianScenarioErrors, /presentation\.showGrid має бути булевим/);
  assert.match(ukrainianScenarioErrors, /visualOverrides\.unknown не зареєстровано/);
  const warningScenario = scenario();
  warningScenario.visualOverrides.player = { dataUrl: png };
  assert.match(validateScenario(warningScenario).warnings.join(' '), /точки кріплення ротора/);
  assert.match(inspectImageDataUrl('not-an-image').errors.join(' '), /data-URL-адреса/);
  assert.match(inspectImageDataUrl('data:image/png;base64,AAAA').errors.join(' '), /Підпис PNG/);
  assert.match(
    inspectImageDataUrl('data:image/png;base64,A===').errors.join(' '),
    /неправильний формат/,
  );

  setLocale('en', { persist: false });
  assert.match(validateScenario(cyclic).errors.join(' '), /must not contain a cycle/);
  assert.match(validateScenario(unsafeUrl).errors.join(' '), /must be an HTTP\(S\) URL/);
  const englishThemeErrors = validateTheme(invalidTheme).errors.join(' ');
  assert.match(englishThemeErrors, /non-reserved stable identifier/);
  assert.match(englishThemeErrors, /theme\.scene is not registered/);
  assert.match(englishThemeErrors, /theme\.palette\.ink must use #rrggbb/);
  assert.match(
    validateScenario({ format: 'unsupported' }).errors.join(' '),
    /supported xonix-playground\.v1\.\.v9 format/,
  );
  const englishScenarioErrors = validateScenario(invalidScenario).errors.join(' ');
  assert.match(englishScenarioErrors, /settings\.classId is not registered/);
  assert.match(englishScenarioErrors, /settings\.seed must be an unsigned 32-bit integer/);
  assert.match(englishScenarioErrors, /presentation\.showGrid must be a boolean/);
  assert.match(englishScenarioErrors, /visualOverrides\.unknown is not registered/);
  assert.match(
    validateScenario(warningScenario).warnings.join(' '),
    /rotor and attachment anchors/,
  );
  assert.match(inspectImageDataUrl('not-an-image').errors.join(' '), /embedded PNG/);
  assert.match(inspectImageDataUrl('data:image/png;base64,AAAA').errors.join(' '), /PNG signature/);
});
test('real PNG plus JPEG/WebP header fixtures expose dimensions before browser allocation', () => {
  for (const [dataUrl, width, height] of [
    [png, 1, 1],
    [jpegHeader(768, 576), 768, 576],
    [webpHeader(320, 240), 320, 240],
  ]) {
    const r = inspectImageDataUrl(dataUrl);
    assert.equal(r.valid, true, JSON.stringify(r));
    assert.equal(r.width, width);
    assert.equal(r.height, height);
    assert.ok(r.byteLength > 0);
  }
  assert.equal(
    inspectImageDataUrl(
      'data:image/webp;base64,UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA',
    ).valid,
    true,
  );
});
test('SVG, scripts, remote media, mislabeled bytes and malformed base64 cannot become visual bindings', () => {
  for (const dataUrl of [
    'data:image/svg+xml;base64,PHN2Zz4=',
    'javascript:alert(1)',
    'https://example.test/a.png',
    'data:text/html;base64,PHNjcmlwdD4=',
    png.replace('image/png', 'image/jpeg'),
    'data:image/png;base64,A===',
    'data:image/png;base64,AAAA=',
  ]) {
    assert.equal(inspectImageDataUrl(dataUrl).valid, false, dataUrl.slice(0, 40));
  }
});
test('individual and combined decoded pixel budgets reject compressed dimensions before decode', () => {
  assert.equal(inspectImageDataUrl(pngHeader(100000, 1)).valid, false);
  assert.equal(inspectImageDataUrl(pngHeader(8192, 8192)).valid, false);
  assert.equal(inspectImageDataUrl(pngHeader(0, 1)).valid, false);
  const s = scenario();
  for (const role of ['background', 'enemy', 'player'])
    s.visualOverrides[role] = { dataUrl: pngHeader(4000, 4000) };
  rejected(s, /Combined decoded/);
});
test('encoded and original-byte budgets are enforced before media parsing', () => {
  assert.equal(
    inspectImageDataUrl('x'.repeat(CONTENT_LIMITS.maxEncodedImageChars + 1)).valid,
    false,
  );
  const dataUrl =
    'data:image/png;base64,' + 'AAAA'.repeat(Math.ceil((CONTENT_LIMITS.maxImageBytes + 3) / 3));
  assert.match(inspectImageDataUrl(dataUrl).errors.join(), /4 MiB/);
  const s = scenario();
  for (const role of ['background', 'enemy', 'player', 'wall'])
    s.visualOverrides[role] = { dataUrl };
  rejected(s, /Combined artwork/);
});
test('animated and truncated containers reject rather than silently changing static visual roles', () => {
  const bytes = Buffer.from(png.split(',')[1], 'base64');
  const chunk = Buffer.alloc(20);
  chunk.writeUInt32BE(8);
  chunk.write('acTL', 4);
  const animated = Buffer.concat([bytes.subarray(0, 33), chunk, bytes.subarray(33)]);
  assert.match(
    inspectImageDataUrl(`data:image/png;base64,${animated.toString('base64')}`).errors.join(),
    /Animated/,
  );
  assert.equal(
    inspectImageDataUrl(`data:image/png;base64,${bytes.subarray(0, 35).toString('base64')}`).valid,
    false,
  );
  const webp = Buffer.from(webpHeader(1, 1).split(',')[1], 'base64');
  webp.writeUInt32LE(1000, 16);
  assert.equal(
    inspectImageDataUrl(`data:image/webp;base64,${webp.toString('base64')}`).valid,
    false,
  );
});
test('player override warns about retained rig anchors without changing physics or bytes', () => {
  const s = scenario();
  s.visualOverrides.player = { dataUrl: png, name: 'body.png', fit: 'contain' };
  const before = structuredClone(s);
  const r = validateScenario(s);
  assert.equal(r.valid, true);
  assert.match(r.warnings.join(), /anchors/);
  assert.deepEqual(s, before);
});

test('optional procedural music remains data-only and exact through scenario validation', () => {
  const s = scenario();
  s.music = {
    id: 'custom-track',
    name: 'Custom Original',
    genre: 'metal',
    tempo: 146,
    root: 43,
    scale: 'minor',
  };
  const before = structuredClone(s);
  assert.equal(validateScenario(s).valid, true);
  assert.deepEqual(s, before);
  for (const music of [
    null,
    { ...s.music, tempo: 999 },
    { ...s.music, url: 'https://example.test/song.mp3' },
    { ...s.music, genre: 'unsupported' },
  ])
    rejected({ ...s, music }, /music/);
  let calls = 0;
  const unsafe = scenario();
  unsafe.music = { ...s.music };
  Object.defineProperty(unsafe.music, 'name', {
    enumerable: true,
    get() {
      calls++;
      return 'unsafe';
    },
  });
  rejected(unsafe, /ordinary JSON/);
  assert.equal(calls, 0);
});
