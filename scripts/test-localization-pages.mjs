import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { parse } from 'parse5';
import { addPublicEntries } from './game-cli.mjs';

const resources = Object.fromEntries(
  await Promise.all(
    ['en', 'uk'].map(async (locale) => [
      locale,
      JSON.parse(
        await fs.readFile(new URL(`../game/locales/${locale}/website.json`, import.meta.url)),
      ),
    ]),
  ),
);
const toolResources = Object.fromEntries(
  await Promise.all(
    ['en', 'uk'].map(async (locale) => [
      locale,
      JSON.parse(
        await fs.readFile(new URL(`../game/locales/${locale}/tools.json`, import.meta.url)),
      ),
    ]),
  ),
);
const interfaceResources = Object.fromEntries(
  await Promise.all(
    ['en', 'uk'].map(async (locale) => [
      locale,
      JSON.parse(
        await fs.readFile(new URL(`../game/locales/${locale}/interface.json`, import.meta.url)),
      ),
    ]),
  ),
);
const assets = [
  'game/vendor/i18next-26.4.2.min.js',
  'game/i18n/catalogs.mjs',
  'game/i18n/bootstrap.mjs',
  'game/i18n/style.css',
];
const entry = (name, text = '') => ({ name, bytes: Buffer.from(text) });
function descendants(node) {
  return [node, ...(node.childNodes || []).flatMap(descendants)];
}
const attribute = (node, name) => node.attrs?.find((value) => value.name === name)?.value;

test('generated public pages use complete messages and retain original attribution links', () => {
  const entries = [
    ...assets,
    'game/vendor/LZ-STRING-LICENSE.txt',
    'game/ui/fonts/field-kit/provenance.json',
  ].map((name) => entry(name));
  addPublicEntries(entries, {
    entry: 'game/index.html',
    version: '1.2.3',
    sourceRevision: 'a'.repeat(40),
  });
  for (const file of ['index.html', 'privacy.html', 'credits.html']) {
    const source = entries.find(({ name }) => name === file).bytes.toString();
    const nodes = descendants(parse(source));
    assert.ok(nodes.some((node) => attribute(node, 'data-language-control') !== undefined));
    for (const asset of assets) assert.ok(source.includes(`"./${asset}"`), `${file}: ${asset}`);
    for (const node of nodes) {
      for (const name of ['data-i18n', 'data-i18n-rich']) {
        const key = attribute(node, name);
        if (!key) continue;
        assert.ok(key.startsWith('website:'));
        for (const locale of ['en', 'uk']) {
          const message = resources[locale][key.slice('website:'.length)];
          assert.equal(typeof message, 'string', `${locale}: ${key}`);
          if (name !== 'data-i18n-rich') continue;
          const slots = descendants(node).flatMap(
            (child) => attribute(child, 'data-i18n-slot') ?? [],
          );
          const placeholders = [...message.matchAll(/\[\[([^\]]+)\]\]/g)].map((match) => match[1]);
          assert.deepEqual(slots.sort(), placeholders.sort(), `${locale}: ${key}`);
        }
      }
    }
  }
  const credits = entries.find(({ name }) => name === 'credits.html').bytes.toString();
  for (const license of [
    'game/vendor/PHASER-LICENSE.md',
    'game/vendor/I18NEXT-LICENSE.txt',
    'game/vendor/LZ-STRING-LICENSE.txt',
    'game/ui/fonts/OFL.txt',
  ])
    assert.ok(credits.includes(`href="./${license}"`));
  for (const author of [
    'Stefan Schmidt',
    'Handjet Project Authors',
    'Exo 2 Project Authors',
    'IBM Corp.',
  ])
    assert.ok(resources.uk['page.fontNotices'].includes(author));
});

test('root launch rewriting keeps every localization asset inside the distribution', async () => {
  const landing = await fs.readFile(new URL('../site/index.html', import.meta.url));
  const entries = [
    ...assets.map((name) => entry(name)),
    { name: 'site/index.html', bytes: landing },
  ];
  addPublicEntries(entries, { entry: 'game/index.html', version: '1.2.3' });
  const source = entries.find(({ name }) => name === 'index.html').bytes.toString();
  for (const asset of assets) assert.ok(source.includes(`"./${asset}"`), asset);
  assert.doesNotMatch(source, /(?:src|href)="\.\.\/game\//);
  assert.ok(source.indexOf('<style>') < source.indexOf('<script'));
});

test('historical distributions without localization never request missing new runtime files', () => {
  const entries = [];
  addPublicEntries(entries, { entry: 'game/index.html', version: '0.1.0' });
  for (const file of ['index.html', 'privacy.html', 'credits.html']) {
    const source = entries.find(({ name }) => name === file).bytes.toString();
    assert.doesNotMatch(source, /src="[^\"]*(?:i18n|i18next)/);
    assert.doesNotMatch(source, /data-language-control/);
  }
});

test('maintained sprite review pages localize static and generated presentation text', async () => {
  const pages = [
    {
      file: '../authoring/library/fpv-enemy-presentations/index.html',
      assetPrefix: '../../../game/',
    },
    {
      file: '../game/assets/field-kit/sprites/review.html',
      assetPrefix: '../../../',
    },
  ];
  for (const { file, assetPrefix } of pages) {
    const source = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const nodes = descendants(parse(source));
    assert.ok(
      nodes.some((node) => attribute(node, 'data-language-control') !== undefined),
      file,
    );
    for (const asset of [
      'vendor/i18next-26.4.2.min.js',
      'i18n/catalogs.mjs',
      'i18n/bootstrap.mjs',
      'i18n/style.css',
    ])
      assert.ok(source.includes(`"${assetPrefix}${asset}"`), `${file}: ${asset}`);
    const keys = nodes.flatMap((node) =>
      [
        'data-i18n',
        'data-i18n-alt',
        'data-description-key',
        'data-requirement-key',
        'data-prompt-key',
      ]
        .map((name) => attribute(node, name))
        .filter(Boolean),
    );
    assert.ok(keys.length > 10, `${file}: catalog coverage`);
    for (const key of keys) {
      if (key.startsWith('common:')) continue;
      assert.match(key, /^tools:/, `${file}: ${key}`);
      for (const locale of ['en', 'uk'])
        assert.equal(
          typeof toolResources[locale][key.slice('tools:'.length)],
          'string',
          `${locale}: ${key}`,
        );
    }
  }
  const generated = await fs.readFile(
    new URL('../game/assets/field-kit/sprites/review.html', import.meta.url),
    'utf8',
  );
  assert.match(generated, /onLocaleChange\(update\)/);
  assert.match(generated, /localizedAttribute\(node,\s*['"]alt['"]/);
  assert.doesNotMatch(generated, /textContent\s*=\s*['"](?:Prompt copied|Text selected)/);
  const inlineScripts = [...generated.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  assert.ok(inlineScripts.length);
  assert.doesNotThrow(() => new Function(inlineScripts.at(-1)[1]));
});

test('offline download and launcher routes provide live language controls and bilingual fallbacks', async () => {
  for (const { file, prefix } of [
    { file: '../game/downloads.html', prefix: '' },
    { file: '../game/offline/app.html', prefix: '../' },
  ]) {
    const source = await fs.readFile(new URL(file, import.meta.url), 'utf8');
    const nodes = descendants(parse(source));
    assert.ok(
      nodes.some((node) => attribute(node, 'data-language-control') !== undefined),
      file,
    );
    for (const asset of [
      'vendor/i18next-26.4.2.min.js',
      'i18n/catalogs.mjs',
      'i18n/bootstrap.mjs',
      'i18n/style.css',
    ])
      assert.ok(source.includes(`"${prefix}${asset}"`), `${file}: ${asset}`);
    const keys = nodes.map((node) => attribute(node, 'data-i18n')).filter(Boolean);
    assert.ok(keys.length >= 8, `${file}: static catalog coverage`);
    for (const key of keys) {
      assert.match(key, /^interface:/, `${file}: ${key}`);
      for (const locale of ['en', 'uk'])
        assert.equal(
          typeof interfaceResources[locale][key.slice('interface:'.length)],
          'string',
          `${file}: ${locale}: ${key}`,
        );
    }
    const noScript = nodes.find((node) => node.tagName === 'noscript');
    assert.ok(noScript, `${file}: noscript fallback`);
    assert.match(noScript.childNodes[0].value, /JavaScript/);
    assert.match(noScript.childNodes[0].value, /потрібен JavaScript/);
  }
});
