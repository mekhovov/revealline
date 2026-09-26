import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateScenario } from '../content.mjs';
import { RULESET } from '../core/registry.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';
import {
  validatePack,
  preparePack,
  emptyPackLibrary,
  installPack,
  removePack,
  exportPackLibrary,
  importPackLibrary,
  resolvePackCampaign,
  scenarioFromPack,
  validateMusicDescriptor,
  PACK_LIMITS,
} from '../packs.mjs';
const readPack = (name = 'night-shift') =>
  JSON.parse(readFileSync(new URL(`../content/packs/${name}.json`, import.meta.url), 'utf8'));
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=';
const dimensions = { naturalWidth: 1, naturalHeight: 1 };
const decode = async () => dimensions;
const ready = async (value = readPack()) =>
  (await preparePack(value, { decodeImage: decode })).pack;
test('both built-in expansion packs validate and every map resolves to a compatible runtime scenario', async () => {
  for (const name of ['night-shift', 'living-threads']) {
    const source = readPack(name),
      before = structuredClone(source),
      pack = await ready(source);
    assert.equal(validatePack(source).valid, true);
    assert.deepEqual(source, before);
    const resolved = resolvePackCampaign(pack, pack.campaigns[0].id);
    assert.equal(resolved.campaign.classRecipes.length, pack.classRecipes.length);
    for (const level of resolved.campaign.levels)
      for (const turnPolicy of ['immediate', 'grid-center'])
        assert.equal(
          validateScenario(scenarioFromPack(pack, resolved.campaign.id, level.id, { turnPolicy }))
            .valid,
          true,
        );
    assert.equal(resolved.music[0].genre, name === 'night-shift' ? 'metal' : 'ambient');
  }
});
test('prepared pack installs, exports, roundtrips and removes without mutating previous library', async () => {
  const blank = emptyPackLibrary(),
    pack = await ready(),
    installed = installPack(blank, pack);
  assert.equal(blank.packs.length, 0);
  assert.equal(installed.packs.length, 1);
  assert.deepEqual(
    await importPackLibrary(exportPackLibrary(installed), { decodeImage: decode }),
    installed,
  );
  const removed = removePack(installed, pack.id);
  assert.equal(removed.packs.length, 0);
  assert.equal(installed.packs.length, 1);
  assert.throws(() => installed.packs.push(pack), TypeError);
  assert.throws(() => (pack.name = 'changed'), TypeError);
  assert.throws(() => installPack(blank, readPack()), /prepared/);
});
test('unsupported engine versions, remote media, executable fields and unknown references reject', () => {
  const mutations = [
    (p) => (p.engine = `${RULESET}-future`),
    (p) => (p.version = 'latest'),
    (p) => (p.script = 'alert(1)'),
    (p) => (p.campaigns[0].levels[0].script = 'alert(1)'),
    (p) => (p.visualOverrides.player = { dataUrl: 'https://example.test/player.png' }),
    (p) => (p.music[0].url = 'https://example.test/song.mp3'),
    (p) => (p.campaigns[0].themeId = 'unknown'),
    (p) => (p.campaigns[0].classIds = ['unknown']),
    (p) => (p.campaigns[0].levels[0].musicId = 'unknown'),
    (p) => (p.metadata.sourceUrl = 'javascript:run()'),
    (p) => (p.classRecipes[0].primitive = 'custom-script'),
  ];
  for (const mutate of mutations) {
    const bad = readPack();
    mutate(bad);
    assert.equal(validatePack(bad).valid, false, JSON.stringify(bad).slice(0, 120));
  }
});
test('dependency pins reject missing versions, unsafe replacements, removals and cycles atomically', async () => {
  const source = readPack();
  source.id = 'foundation';
  source.name = 'Foundation';
  const foundation = await ready(source),
    current = installPack(emptyPackLibrary(), foundation);
  const childSource = readPack('living-threads');
  childSource.dependencies = [{ id: 'foundation', version: '1.0.0' }];
  const child = await ready(childSource);
  assert.throws(() => installPack(emptyPackLibrary(), child), /requires foundation/);
  const pair = installPack(current, child);
  assert.equal(pair.packs.length, 2);
  assert.throws(() => removePack(pair, 'foundation'), /requires foundation/);
  const update = { ...source, version: '2.0.0' };
  const newer = await ready(update);
  assert.throws(() => installPack(pair, newer), /version 1.0.0/);
  assert.equal(pair.packs[0].version, '1.0.0');
  const circular = JSON.parse(exportPackLibrary(pair));
  circular.packs[0].dependencies = [{ id: child.id, version: child.version }];
  await assert.rejects(importPackLibrary(circular, { decodeImage: decode }), /cycle/);
});
test('per-map role overrides merge over shared art and remain independently replaceable', async () => {
  const source = readPack();
  source.visualOverrides = { player: { dataUrl: png, name: 'shared.png' } };
  source.levelVisuals = [
    {
      levelId: source.campaigns[0].levels[0].id,
      visualOverrides: { background: { dataUrl: png, name: 'first.png' } },
    },
  ];
  const calls = [];
  const { pack, warnings } = await preparePack(source, {
    decodeImage: async (url, info) => {
      calls.push([url, info]);
      return dimensions;
    },
  });
  assert.equal(calls.length, 2);
  assert.match(warnings.join(), /anchors/);
  const first = scenarioFromPack(pack, pack.campaigns[0].id, pack.campaigns[0].levels[0].id);
  const second = scenarioFromPack(pack, pack.campaigns[0].id, pack.campaigns[0].levels[1].id);
  assert.equal(first.visualOverrides.background.name, 'first.png');
  assert.equal(first.visualOverrides.player.name, 'shared.png');
  assert.equal(second.visualOverrides.background, undefined);
});
test('all headers, aggregate budgets and all pack dependencies pass before any image decoder runs', async () => {
  const source = readPack();
  source.visualOverrides = {
    player: { dataUrl: png },
    background: { dataUrl: 'data:image/png;base64,AAAA' },
  };
  let calls = 0;
  const decoder = async () => {
    calls++;
    return dimensions;
  };
  await assert.rejects(preparePack(source, { decodeImage: decoder }));
  assert.equal(calls, 0);
  const good = readPack();
  good.visualOverrides.player = { dataUrl: png };
  const bad = readPack('living-threads');
  bad.dependencies = [{ id: 'missing', version: '1.0.0' }];
  await assert.rejects(
    importPackLibrary(
      { format: 'xonix-pack-library.v1', packs: [good, bad] },
      { decodeImage: decoder },
    ),
    /requires/,
  );
  assert.equal(calls, 0);
});
test('decoder failure, mismatched dimensions and caller edits during decode cannot partially install a pack', async () => {
  const source = readPack();
  source.visualOverrides = { player: { dataUrl: png }, enemy: { dataUrl: png } };
  const current = emptyPackLibrary();
  let active = current,
    calls = 0;
  await assert.rejects(
    (async () => {
      const { pack } = await preparePack(source, {
        decodeImage: async () => {
          if (++calls === 2) throw new Error('Corrupt image');
          return dimensions;
        },
      });
      active = installPack(active, pack);
    })(),
    /Corrupt/,
  );
  assert.equal(active, current);
  await assert.rejects(
    preparePack(source, { decodeImage: async () => ({ naturalWidth: 2, naturalHeight: 1 }) }),
    /dimensions/,
  );
  let release;
  const pending = preparePack(
    { ...source, visualOverrides: { player: { dataUrl: png } } },
    { decodeImage: () => new Promise((resolve) => (release = resolve)) },
  );
  source.name = 'Modified later';
  release(dimensions);
  const { pack } = await pending;
  assert.notEqual(pack.name, 'Modified later');
});
test('malicious object shapes never execute getters and files are bounded before parsing/decoding', async () => {
  let reads = 0;
  const source = readPack();
  Object.defineProperty(source.themes[0], 'name', {
    enumerable: true,
    get() {
      reads++;
      return 'name';
    },
  });
  assert.equal(validatePack(source).valid, false);
  assert.equal(reads, 0);
  for (const key of ['__proto__', 'prototype', 'constructor'])
    assert.equal(validatePack(`{"${key}":{}}`).valid, false);
  const sparse = readPack();
  sparse.campaigns = Array(1);
  assert.equal(validatePack(sparse).valid, false);
  const cyclic = readPack();
  cyclic.extra = cyclic;
  assert.equal(validatePack(cyclic).valid, false);
  assert.equal(validatePack(' '.repeat(PACK_LIMITS.maxBytes + 1)).valid, false);
  const deep = readPack();
  deep.metadata = { bad: {} };
  let cursor = deep.metadata.bad;
  for (let i = 0; i < 30; i++) cursor = cursor.child = {};
  assert.equal(validatePack(deep).valid, false);
});
test('music descriptors accept the five procedural styles, reject payloads, invalid scales and extreme values', () => {
  const base = readPack().music[0];
  for (const genre of ['synthwave', 'chiptune', 'rock', 'metal', 'ambient'])
    assert.equal(validateMusicDescriptor({ ...base, genre }).valid, true);
  for (const patch of [
    { tempo: 999 },
    { root: 36.5 },
    { genre: 'anything' },
    { scale: 'new' },
    { source: 'remote' },
    { name: '' },
  ])
    assert.equal(validateMusicDescriptor({ ...base, ...patch }).valid, false);
});

test('pack header, dependency, metadata and music validation follows the active locale', (context) => {
  const locale = getLocale();
  context.after(() => setLocale(locale, { persist: false }));
  const music = readPack().music[0];
  const wrongEngine = readPack();
  wrongEngine.engine = `${RULESET}-future`;
  const unsafeSource = readPack();
  unsafeSource.metadata.sourceUrl = 'javascript:run()';
  const duplicateTheme = readPack();
  duplicateTheme.themes.push(structuredClone(duplicateTheme.themes[0]));
  const unknownCampaignTheme = readPack();
  unknownCampaignTheme.campaigns[0].themeId = 'missing-theme';
  const duplicateLevel = readPack();
  duplicateLevel.campaigns[0].levels.push(structuredClone(duplicateLevel.campaigns[0].levels[0]));
  const unknownArtworkLevel = readPack();
  unknownArtworkLevel.levelVisuals.push({ levelId: 'missing-level', visualOverrides: {} });

  setLocale('uk', { persist: false });
  assert.match(
    validateMusicDescriptor({ ...music, genre: 'missing' }).errors.join(' '),
    /Жанр музики/,
  );
  assert.match(validatePack(wrongEngine).errors.join(' '), /потрібен інший рушій/);
  assert.match(validatePack(unsafeSource).errors.join(' '), /URL-адресою HTTP\(S\)/);
  assert.match(
    validatePack(duplicateTheme).errors.join(' '),
    /Ідентифікатори тем мають бути унікальними/,
  );
  assert.match(validatePack(unknownCampaignTheme).errors.join(' '), /невідому тему/);
  assert.match(validatePack(duplicateLevel).errors.join(' '), /Ідентифікатори рівнів.*унікальними/);
  assert.match(
    validatePack(unknownArtworkLevel).errors.join(' '),
    /невідомий або повторюваний рівень/,
  );

  setLocale('en', { persist: false });
  assert.match(
    validateMusicDescriptor({ ...music, genre: 'missing' }).errors.join(' '),
    /Music genre/,
  );
  assert.match(validatePack(wrongEngine).errors.join(' '), /requires a different engine/);
  assert.match(validatePack(unsafeSource).errors.join(' '), /HTTP\(S\) URL/);
  assert.match(validatePack(duplicateTheme).errors.join(' '), /Theme IDs must be unique/);
  assert.match(validatePack(unknownCampaignTheme).errors.join(' '), /unknown theme/);
  assert.match(validatePack(duplicateLevel).errors.join(' '), /Level IDs must be unique/);
  assert.match(validatePack(unknownArtworkLevel).errors.join(' '), /unknown or repeated level/);
});
