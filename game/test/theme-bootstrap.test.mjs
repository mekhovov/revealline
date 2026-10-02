import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { parse } from 'parse5';
import { buildThemeBootstrap } from '../../scripts/refresh-theme-bootstrap.mjs';
import { buildNeonArtworkGallery } from '../../scripts/build-neon-artwork-gallery.mjs';
import { buildNeonMosaicGallery } from '../../scripts/build-neon-mosaic.mjs';
import {
  BUILTIN_THEME_FAMILIES,
  INSTALLED_THEME_FAMILIES,
  resolvePresentation,
  presentationThemeVariables,
  resolveStoredAppearance,
  resolveThemeFamilySelection,
} from '../presentation/theme-system.mjs';

const root = path.resolve(import.meta.dirname, '../..');
const source = await fs.readFile(path.join(root, 'game/presentation/theme-bootstrap.mjs'), 'utf8');
function seed(
  records = {},
  {
    studio = false,
    coarse = false,
    reduced = false,
    brokenStorage = false,
    href = 'https://example.test/game/',
    appearanceDefault,
  } = {},
) {
  const variables = new Map(),
    dataset = appearanceDefault
      ? {
          appearanceFamily: appearanceDefault.familyId,
          appearanceRevision: appearanceDefault.revision,
        }
      : {};
  const document = {
    documentElement: { dataset, style: { setProperty: (key, value) => variables.set(key, value) } },
    currentScript: { dataset: { themeDensity: studio ? 'studio' : 'player' } },
    querySelector: () => null,
  };
  let writes = 0;
  const localStorage = {
    getItem(key) {
      if (brokenStorage) throw new Error('Unavailable');
      return records[key] ?? null;
    },
    setItem() {
      writes++;
      throw new Error('Startup must never persist intent');
    },
  };
  vm.runInNewContext(source, {
    document,
    localStorage,
    location: { href },
    URL,
    matchMedia: (query) => ({ matches: query.includes('coarse') ? coarse : reduced }),
  });
  assert.equal(writes, 0);
  return { variables, dataset };
}
const raw = (value) => JSON.stringify(value);
const preference = (familyId, patch = {}) => ({
  familyId,
  arcadeArt: 'follow-game',
  ornaments: 'theme',
  highContrast: false,
  opaqueHud: false,
  ...patch,
});

test('first-paint seed is generated from the exact admitted registry and shared migration parser', async () => {
  assert.equal(source, await buildThemeBootstrap());
  assert.ok(Buffer.byteLength(source) < 100 * 1024, 'synchronous seed remains bounded');
});

test('every admitted appearance paints exact paired tokens and frames before module execution', () => {
  for (const family of BUILTIN_THEME_FAMILIES) {
    for (const highContrast of [false, true]) {
      for (const ornaments of ['theme', 'off']) {
        const { variables, dataset } = seed({
          'revealline.appearance.v2': raw(preference(family.id, { highContrast, ornaments })),
        });
        const resolved = resolvePresentation({
          familyId: family.id,
          accessibility: { highContrast },
          ornaments: ornaments === 'off' ? 'off' : 'subtle',
        });
        const expected = presentationThemeVariables(resolved);
        for (const [key, value] of Object.entries(expected)) {
          if (/-(default|hover|pressed|disabled|loading)-/.test(key)) continue;
          assert.equal(variables.get(key), value, `${family.id}: ${key}`);
        }
        assert.equal(dataset.interfaceTheme, family.id);
        assert.equal(dataset.themeTexture, resolved.textured ? 'on' : 'off');
        assert.equal(dataset.themeStyled, String(family.id !== 'legacy' || highContrast));
      }
    }
  }
});

test('retained and current context pins paint their exact installed revision before runtime', () => {
  assert.ok(INSTALLED_THEME_FAMILIES.length > BUILTIN_THEME_FAMILIES.length);
  for (const family of INSTALLED_THEME_FAMILIES) {
    const expected = presentationThemeVariables(resolvePresentation({ themeFamily: family }));
    for (const options of [
      {
        href: `https://example.test/game/?appearanceFamily=${family.id}&appearanceRevision=${family.revision}`,
      },
      { appearanceDefault: { familyId: family.id, revision: family.revision } },
    ]) {
      const { variables, dataset } = seed({}, options);
      assert.equal(dataset.interfaceTheme, family.id);
      for (const [key, value] of Object.entries(expected)) {
        if (/-(default|hover|pressed|disabled|loading)-/.test(key)) continue;
        assert.equal(variables.get(key), value, `${family.id}@${family.revision}: ${key}`);
      }
    }
  }
});

test('read-only startup matches runtime migration for new, existing, damaged and unavailable preferences', () => {
  const cases = [
    {},
    {
      legacyTheme: raw({
        familyId: 'legacy',
        arcadeArt: 'authored',
        highContrast: false,
        opaqueHud: false,
      }),
    },
    {
      legacyTheme: raw({
        familyId: 'industrial-workshop',
        arcadeArt: 'authored',
        highContrast: true,
        opaqueHud: true,
      }),
    },
    { legacyMenu: raw({ palette: 'ukrainian', ornaments: 'rich' }) },
    { legacyDisplay: raw({ textFace: 'plain', textSize: 'standard', reducedEffects: false }) },
    { appearance: '{damaged', legacyMenu: raw({ palette: 'auto', ornaments: 'off' }) },
    { appearance: raw(preference('constructor')) },
    { appearance: raw(preference('does-not-exist')) },
    { appearance: ' '.repeat(2049) },
  ];
  for (const values of cases) {
    const intent = resolveStoredAppearance(values);
    const expected = resolveThemeFamilySelection(intent).family.id;
    const { dataset } = seed({
      'revealline.appearance.v2': values.appearance,
      'revealline.theme-family.v1': values.legacyTheme,
      'revealline.menu-style.v1': values.legacyMenu,
      'revealline.display.v1': values.legacyDisplay,
    });
    assert.equal(dataset.interfaceTheme, expected);
  }
  assert.equal(seed({}, { brokenStorage: true }).dataset.interfaceTheme, 'industrial-workshop');
});

test('first-paint density, motion, legibility and cosmetic context use bounded canonical choices', () => {
  const records = {
    'revealline.appearance.v2': raw(preference('dos', { opaqueHud: true })),
    'revealline.display.v1': raw({ textFace: 'plain', textSize: 'large', reducedEffects: true }),
  };
  const result = seed(records, { studio: true });
  assert.equal(result.variables.get('--iw-target'), '44px');
  assert.equal(result.variables.get('--iw-text-size'), '20px');
  assert.equal(result.dataset.themeMotion, 'reduced');
  assert.equal(result.dataset.themeHud, 'opaque');
  assert.equal(result.variables.get('--iw-font-ui'), "'Field Kit UI', 'Exo 2', sans-serif");
  assert.equal(seed({}, { studio: true }).variables.get('--iw-target'), '32px');
  assert.equal(seed({}, { studio: true, coarse: true }).variables.get('--iw-target'), '44px');
  const context = '?appearanceFamily=tryzub&appearanceRevision=r1';
  assert.equal(
    seed({}, { href: 'https://example.test/game/' + context }).dataset.interfaceTheme,
    'tryzub',
  );
  assert.equal(
    seed(records, { href: 'https://example.test/game/' + context }).dataset.interfaceTheme,
    'dos',
  );
  assert.equal(
    seed({}, { href: 'https://example.test/game/?appearanceFamily=tryzub&appearanceRevision=r999' })
      .dataset.interfaceTheme,
    'industrial-workshop',
  );
  assert.equal(
    seed({}, { appearanceDefault: { familyId: 'orchard-workshop', revision: 'r1' } }).dataset
      .interfaceTheme,
    'orchard-workshop',
  );
  assert.equal(
    seed(
      {},
      {
        appearanceDefault: { familyId: 'orchard-workshop', revision: 'r1' },
        href: 'https://example.test/game/?appearanceFamily=tryzub',
      },
    ).dataset.interfaceTheme,
    'orchard-workshop',
  );
  assert.equal(
    seed(
      {},
      {
        appearanceDefault: { familyId: 'orchard-workshop', revision: 'r1' },
        href: 'https://example.test/game/' + context,
      },
    ).dataset.interfaceTheme,
    'tryzub',
  );
});

async function entrypoints(directory) {
  const result = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    if (['library', 'test', 'assets', 'audio', 'node_modules', 'dist'].includes(entry.name))
      continue;
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...(await entrypoints(file)));
    else if (entry.name.endsWith('.html')) result.push(file);
  }
  return result;
}
function nodes(tree, name, out = []) {
  if (tree.nodeName === name) out.push(tree);
  for (const child of tree.childNodes ?? []) nodes(child, name, out);
  return out;
}
const attr = (node, name) => node.attrs?.find((item) => item.name === name)?.value;

async function neonEntrypoints() {
  const library = path.join(root, 'authoring/library');
  const directories = (await fs.readdir(library, { withFileTypes: true })).filter(
    (entry) => entry.isDirectory() && entry.name.startsWith('neon-'),
  );
  return (
    await Promise.all(
      directories.map(async (entry) => {
        const directory = path.join(library, entry.name);
        return (await fs.readdir(directory)).includes('index.html')
          ? [path.join(directory, 'index.html')]
          : [];
      }),
    )
  ).flat();
}

test('every production game, authoring and site entry seeds appearance before other scripts and styles', async () => {
  const library = await neonEntrypoints();
  assert.equal(
    library.length,
    18,
    'Neon reference launchers and both galleries are UI entrypoints.',
  );
  const files = [
    ...(
      await Promise.all(
        ['game', 'authoring', 'site'].map((name) => entrypoints(path.join(root, name))),
      )
    ).flat(),
    ...library,
  ];
  assert.ok(files.length >= 63);
  for (const file of files) {
    const html = await fs.readFile(file, 'utf8'),
      tree = parse(html, { sourceCodeLocationInfo: true });
    const scripts = nodes(tree, 'script');
    const bootstrap = scripts.find((node) => attr(node, 'src')?.endsWith('theme-bootstrap.mjs'));
    assert.ok(bootstrap, path.relative(root, file));
    assert.equal(attr(bootstrap, 'type'), undefined, 'bootstrap is synchronous classic code');
    assert.equal(attr(bootstrap, 'defer'), undefined);
    assert.equal(attr(bootstrap, 'async'), undefined);
    const styles = nodes(tree, 'link').filter((node) => attr(node, 'rel') === 'stylesheet');
    assert.ok(
      styles.some((node) => node.attrs.some((a) => a.name === 'data-industrial-workshop')),
      file,
    );
    const inlineStyles = library.includes(file) ? nodes(tree, 'style') : [];
    for (const resource of [...scripts, ...styles, ...inlineStyles]) {
      if (resource === bootstrap) continue;
      assert.ok(
        bootstrap.sourceCodeLocation.startOffset < resource.sourceCodeLocation.startOffset,
        `${file}: seed precedes resources`,
      );
    }
    if (library.includes(file)) {
      assert.equal(attr(bootstrap, 'data-theme-density'), 'studio');
      assert.equal(attr(bootstrap, 'data-theme-follow-context'), 'true');
      assert.ok(
        scripts.some((node) => attr(node, 'src')?.endsWith('theme-entry.mjs')),
        file,
      );
      for (const node of nodes(tree, 'style')) {
        const css = node.childNodes.map((child) => child.value ?? '').join('');
        assert.match(css, /^\s*@layer legacy\s*\{/, file);
      }
      for (const resource of [...scripts, ...styles]) {
        const relative = attr(resource, 'src') ?? attr(resource, 'href');
        if (relative) await fs.access(path.resolve(path.dirname(file), relative));
      }
    }
  }
});

test('Neon gallery generators retain shared appearance and exact authored image references on regeneration', async () => {
  const library = path.join(root, 'authoring/library');
  const images = JSON.parse(await fs.readFile(path.join(library, 'neon-artwork/prompts.json')));
  const designs = JSON.parse(await fs.readFile(path.join(library, 'neon-mosaic/designs.json')));
  for (const [folder, html, expected] of [
    ['neon-artwork', buildNeonArtworkGallery(images), images.map((image) => image.file)],
    [
      'neon-mosaic',
      buildNeonMosaicGallery(designs.map((design) => ({ design }))),
      designs.map((design) => `${design.id}/preview.svg`),
    ],
  ]) {
    assert.equal(html, await fs.readFile(path.join(library, folder, 'index.html'), 'utf8'));
    const tree = parse(html);
    assert.deepEqual(
      nodes(tree, 'img').map((image) => attr(image, 'src')),
      expected,
    );
    assert.ok(nodes(tree, 'article').every((node) => attr(node, 'data-ui-surface') === 'panel'));
  }
});

test('profile-owned players seed appearance without acquiring an auxiliary host lease', async () => {
  for (const file of [
    'game/index.html',
    'game/company.html',
    'game/couch/index.html',
    'game/couch/relay-rescue.html',
    'authoring/asset-studio/index.html',
    'game/offline/app.html',
  ]) {
    const html = await fs.readFile(path.join(root, file), 'utf8');
    assert.ok(html.includes('theme-bootstrap.mjs'), file);
    assert.ok(!html.includes('presentation/theme-entry.mjs'), `${file}: keeps runtime authority`);
  }
});
