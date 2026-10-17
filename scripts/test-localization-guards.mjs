import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {
  inspectTranslationSource,
  isTranslationKeyLiteral,
  parseCatalog,
} from './localization-contracts.mjs';
import {
  isLocalizationSource,
  localizationGit,
  localizationGitBlobs,
  localizationSources,
} from './localization-sources.mjs';
import {
  catalogContractsChanged,
  checkLocalizationChanges,
  inspectCopyChanges,
} from './localization-changes.mjs';

const resources = {
  en: {
    common: {
      plain: 'Ready',
      name: 'Hello {{name}}',
      lives_one: '{{count}} life',
      lives_other: '{{count}} lives',
      profile: 'Hello {{user.name}}',
      slots: 'Read [[help]]',
    },
    interface: { ready: 'Ready' },
    gameplay: { ready: 'Ready' },
    content: { ready: 'Ready' },
    tools: { ready: 'Ready' },
    website: { ready: 'Ready' },
    errors: { ready: 'Ready' },
    demo: { ready: 'Ready' },
    controllerEditor: { help: 'Help', done: 'Done' },
  },
};
const inspect = (source) => inspectTranslationSource(source, 'game/example.mjs', resources);
const keys = (result) => [...new Set(result.references.map((entry) => entry.key))];

test('catalog parser catches decoded duplicate keys and rejects non-message shapes', () => {
  assert.throws(
    () => parseCatalog('{"ready":"Ready","ready":"Other"}', 'en/common.json'),
    /Duplicate catalog key: en\/common.json:1: ready/,
  );
  assert.throws(
    () => parseCatalog('{"ready":"Ready","rea\\u0064y":"Other"}'),
    /Duplicate catalog key/,
  );
  assert.throws(() => parseCatalog('{"empty":""}'), /flat object of nonempty/);
  assert.throws(() => parseCatalog('{"nested":{"x":"Text"}}'), /flat object/);
  assert.deepEqual(parseCatalog('{"lives_one":"{{count}} life","lives_other":"{{count}} lives"}'), {
    lives_one: '{{count}} life',
    lives_other: '{{count}} lives',
  });
});

test('canonical namespaces include new namespaces without changing scanner code', () => {
  const catalog = { en: { ...resources.en, futurePanel: { title: 'Title' } } };
  const refs = inspectTranslationSource(
    "const keys = ['demo:ready', 'controllerEditor:done', 'futurePanel:title'];",
    'game/example.js',
    catalog,
  );
  assert.deepEqual(keys(refs), ['demo:ready', 'controllerEditor:done', 'futurePanel:title']);
  for (const namespace of Object.keys(resources.en))
    assert.equal(isTranslationKeyLiteral(`${namespace}:ready`, Object.keys(resources.en)), true);
  assert.equal(isTranslationKeyLiteral('notCanonical:title', Object.keys(resources.en)), false);
  assert.equal(isTranslationKeyLiteral('demo:prefix.'), false);
  assert.deepEqual(
    keys(inspect("t('unknown:title')")),
    ['unknown:title'],
    'An unknown literal namespace still needs an uncatalogued-key error.',
  );
});

test('aliases, namespace wrappers and finite registries preserve discoverable key contracts', () => {
  const report = inspect(`
    import { t as translate, localizedMessage as later } from './i18n/index.mjs';
    const word = (key) => translate(\`controllerEditor:\${key}\`);
    const common = (key, values = {}) => translate('common:' + key, values);
    const choices = Object.freeze({ start: 'demo:ready', stop: 'common:plain' });
    word('help'); word(flag ? 'done' : 'help');
    common('name', {});
    translate(choices[state]); later('common:name', { name });
  `);
  assert.ok(keys(report).includes('controllerEditor:done'));
  assert.ok(keys(report).includes('controllerEditor:help'));
  assert.deepEqual(
    report.issues.map(({ key, missing }) => ({ key, missing })),
    [{ key: 'common:name', missing: ['name'] }],
  );
  assert.deepEqual(report.unverified, []);
});

test('shadowed functions and unknown/mutated registries are not falsely certified', () => {
  const report = inspect(`
    import { t as translate } from './i18n/index.mjs';
    function other(translate) { translate('common:name'); }
    const table = { one: 'common:plain' };
    table.one = external;
    translate(table[which]);
    translate(key, values);
    translate('common:name', { ...external });
    function local() { const t = () => {}; t('common:name'); }
  `);
  assert.equal(report.issues.length, 0);
  assert.deepEqual(
    report.unverified.map(({ kind }) => kind),
    ['dynamic-key', 'dynamic-key', 'dynamic-plural'],
  );
});

test('missing arguments, count and nested fields fail only when statically provable', () => {
  const report = inspect(`
    t('common:name');
    t('common:name', {});
    t('common:lives', {});
    t('common:profile', {user: {}});
    t('common:name', {...values, other: 1});
    t('common:name', {name, ...values});
    t('common:profile', {user});
    t('common:lives', {count: 22});
    t('common:slots');
  `);
  assert.deepEqual(
    report.issues.map(({ missing }) => missing),
    [['name'], ['name'], ['count'], ['user.name']],
  );
  assert.equal(report.unverified.length, 3);
});

test('known singular counts require the singular arguments even when a base message exists', () => {
  const catalog = {
    en: {
      common: {
        thing_one: '{{name}}',
        thing_other: '{{count}} things',
        task: 'Task',
        task_one: '{{owner}} task',
        task_other: '{{count}} tasks',
      },
    },
  };
  const report = inspectTranslationSource(
    "t('common:thing', {count: 1}); t('common:task', {count: 1});",
    'game/a.mjs',
    catalog,
  );
  assert.deepEqual(
    report.issues.map(({ missing }) => missing),
    [['name'], ['owner']],
  );
});

test('nested interpolation follows later object overwrites and uncertain spreads', () => {
  const report = inspect(`
    t('common:profile', {user: {name}, ...{user: {}}});
    t('common:profile', {...{user: {name}}, user: {}});
    t('common:profile', {...{user: {}}, user: {name}});
    t('common:profile', {user: {name}, ...{other: {}}});
    t('common:profile', {user: {name}, ...external});
    t('common:profile', {user: {name}, [unknown]: {}});
    t('common:profile', {...external, user: {name}});
    t('common:profile', {...external, user: {}});
  `);
  assert.deepEqual(
    report.issues.map(({ missing }) => missing),
    [['user.name'], ['user.name']],
  );
  // A later explicit user can coexist with unknown locale/context options.
  assert.deepEqual(
    report.unverified.map(({ kind }) => kind),
    ['dynamic-plural', 'dynamic-plural', 'dynamic-plural', 'dynamic-plural'],
  );
});

test('base, numeric plural and unresolved count contracts have distinct requirements', () => {
  const catalog = {
    en: {
      common: {
        task: 'Task',
        task_zero: 'No tasks for {{group}}',
        task_one: '{{owner}} task',
        task_other: '{{count}} tasks',
      },
    },
  };
  const inspect = (source) => inspectTranslationSource(source, 'game/a.mjs', catalog);
  for (const source of [
    "t('common:task');",
    "t('common:task', {count: 2});",
    "t('common:task', {count: 5});",
    "t('common:task', {count: '1'});",
    "t('common:task', {count: 1, owner});",
  ]) {
    const report = inspect(source);
    assert.deepEqual(report.issues, [], source);
    assert.deepEqual(report.unverified, [], source);
  }
  assert.deepEqual(
    inspect("t('common:task', {count: 1}); t('common:task', {count: 0});").issues.map(
      ({ missing }) => missing,
    ),
    [['owner'], ['group']],
  );
  const unresolved = inspect("t('common:task', {count: amount});");
  assert.deepEqual(unresolved.issues, []);
  assert.deepEqual(
    unresolved.unverified.map(({ kind }) => kind),
    ['dynamic-plural'],
  );
});

test('known counts cover different English and Ukrainian selections with English-only contracts', () => {
  const en = {
    common: { task: 'Task', task_one: '{{owner}} task', task_other: '{{count}} tasks' },
  };
  const uk = {
    common: {
      task: 'Завдання',
      task_one: 'Завдання {{owner}}',
      task_few: '{{count}} завдання',
      task_many: '{{count}} завдань',
      task_other: '{{count}} завдання',
    },
  };
  for (const catalog of [{ en }, { en, uk }]) {
    const report = inspectTranslationSource(
      "t('common:task', {count: 21}); t('common:task', {count: 22});",
      'game/a.mjs',
      catalog,
    );
    assert.deepEqual(
      report.issues.map(({ missing }) => missing),
      [['owner']],
    );
    assert.deepEqual(report.unverified, []);
  }
});

test('destructured, rest, catch and block bindings do not impersonate the imported translator', () => {
  const report = inspect(`
    import {t} from './i18n/index.mjs';
    function object({t}) { t('common:name'); }
    function array([t]) { t('common:name'); }
    function rest(...t) { t('common:name'); }
    function defaults({t} = {}) { t('common:name'); }
    function hoisted() { if (flag) { var t = custom; } t('common:name'); }
    const named = function t() { t('common:name'); };
    { const {nested: {t}} = object; t('common:name'); }
    { const [t] = array; t('common:name'); }
    try {} catch (t) { t('common:name'); }
    try {} catch ({handler: t}) { t('common:name'); }
    for (const t of handlers) { t('common:name'); }
    t('common:name');
  `);
  assert.deepEqual(
    report.issues.map(({ missing }) => missing),
    [['name']],
  );
  assert.equal(report.unverified.length, 0);
});

test('HTML template contents and all namespace markers are extracted', () => {
  const report = inspectTranslationSource(
    '<template><span data-i18n="demo:ready">Ready</span><button data-i18n-aria-label="controllerEditor:done"></button></template>',
    'game/example.html',
    resources,
  );
  assert.deepEqual(keys(report), ['demo:ready', 'controllerEditor:done']);
});

test('local dictionary HTML markers remain reviewable without becoming canonical keys', () => {
  const report = inspectTranslationSource(
    `<button data-i18n="beginLearning">Learn</button>
    <template><span data-i18n-title="settingsHelp"></span></template>
    <span data-i18n="common:plain"></span>`,
    'optional-practice/fpv-worlds/index.html',
    resources,
  );
  assert.deepEqual(keys(report), ['common:plain']);
  assert.deepEqual(
    report.unverified.map(({ kind, key, line }) => ({ kind, key, line })),
    [
      { kind: 'unqualified-marker', key: 'beginLearning', line: 1 },
      { kind: 'unqualified-marker', key: 'settingsHelp', line: 2 },
    ],
  );
});

test('local dictionary selectors and markup do not impersonate canonical translator calls', () => {
  const report = inspect(`
    const t = (key) => dictionary[key];
    t('beginLearning');
    const selector = '[data-i18n="settingsHelp"]';
    const templateSelector = \`[data-i18n="settingsPaused"]\`;
    const markup = \`<span data-i18n="audioMixHelp"></span>\`;
  `);
  assert.deepEqual(keys(report), []);
  assert.deepEqual(
    report.unverified.map(({ key }) => key),
    ['settingsHelp', 'settingsPaused', 'audioMixHelp'],
  );
  assert.equal(report.issues.length, 0);
});

test('unknown and malformed qualified markers still fail the canonical reference gate', () => {
  for (const file of ['game/a.html', 'game/a.mjs']) {
    const markup =
      '<span data-i18n="demo:missing"></span><span data-i18n-title="unknown:title"></span><span data-i18n="common:bad key"></span>';
    const after = file.endsWith('.html') ? markup : `const markup = ${JSON.stringify(markup)};`;
    const report = inspectCopyChanges('', after, file, resources, resources);
    assert.deepEqual(
      report.errors.filter(({ kind }) => kind === 'unknown-key').map(({ key }) => key),
      ['demo:missing', 'unknown:title', 'common:bad key'],
    );
    assert.equal(report.unverified.length, 0);
  }
});

test('source policy includes maintained optional/native/classic and reviewed library UI', () => {
  for (const file of [
    'game/tool.js',
    'site/landing.js',
    'optional-practice/civilian-fpv/world-app.mjs',
    'platforms/ios/diagnostics/index.html',
    'authoring/library/fpv-field-kit/prepared/titles/review-copy.mjs',
    'authoring/library/fpv-role-presentations/gallery.mjs',
  ])
    assert.equal(isLocalizationSource(file), true, file);
  for (const file of [
    'game/vendor/lib.js',
    'game/test/locale.test.mjs',
    'game/i18n/catalogs.mjs',
    'platforms/ios/www/game/app.mjs',
    'authoring/library/licensed-audio/provenance/source.html',
    'releases/v1/game/app.mjs',
    'authoring/library/fpv-role-presentations/sources.mjs',
  ])
    assert.equal(isLocalizationSource(file), false, file);
});

test('new copy ratchet retains baseline debt but detects repeated new occurrences', () => {
  const before = "old.textContent = 'Old raw caption';";
  const unchanged = inspectCopyChanges(before, `\n\n${before}`, 'game/a.mjs', resources, resources);
  assert.equal(unchanged.errors.length, 0);
  const changed = inspectCopyChanges(
    before,
    `${before}\nother.textContent = 'Old raw caption';\nnew Option('Choose now', 'choose');\nconst name = authored.name;\nthrow Error('Technical diagnostic');`,
    'game/a.mjs',
    resources,
    resources,
  );
  assert.deepEqual(
    changed.errors.map(({ text }) => text),
    ['Old raw caption', 'Choose now'],
  );
});

test('raw-copy gate includes Ukrainian display copy but not namespace-wrapper expressions', () => {
  const report = inspectCopyChanges(
    '',
    `
    const word = (key) => t(\`controllerEditor:\${key}\`);
    word('help');
    label.textContent = 'Почати політ';
  `,
    'game/a.mjs',
    resources,
    resources,
  );
  assert.deepEqual(
    report.errors.map(({ text }) => text),
    ['Почати політ'],
  );
  assert.deepEqual(report.unverified, []);
});

test('raw-copy exceptions need actual adjacent comments and retain their explanation', () => {
  const report = inspectCopyChanges(
    '',
    `
    // i18n-allow: Authored license title reproduced verbatim.
    label.textContent = 'Original license title';
    const misleading = '// i18n-allow: a string is not an exemption';
    other.textContent = 'New UI copy';
  `,
    'game/a.mjs',
    resources,
    resources,
  );
  assert.equal(report.exceptions[0].reason, 'Authored license title reproduced verbatim.');
  assert.deepEqual(
    report.errors.map(({ text }) => text),
    ['New UI copy'],
  );
  const html = inspectCopyChanges(
    '',
    '<!-- i18n-allow: Original attribution. -->\n<p>Source attribution</p>',
    'game/a.html',
    resources,
    resources,
  );
  assert.equal(html.errors.length, 0);
  assert.equal(html.exceptions.length, 1);
});

test('new unknown keys and new interpolation contracts fail; dynamic calls stay unverified', () => {
  const before = "t('common:plain');";
  const next = {
    en: { ...resources.en, common: { ...resources.en.common, plain: 'Ready {{mission}}' } },
  };
  const report = inspectCopyChanges(
    before,
    `${before}\nt('demo:missing');\nt(runtimeKey, params);`,
    'game/a.mjs',
    resources,
    next,
  );
  assert.ok(
    report.errors.some(
      (item) => item.kind === 'missing-arguments' && item.missing.includes('mission'),
    ),
  );
  assert.ok(
    report.errors.some((item) => item.kind === 'unknown-key' && item.key === 'demo:missing'),
  );
  assert.equal(report.unverified.length, 1);
  const alias = inspectCopyChanges(
    '',
    "import {t as translate} from './i18n/index.mjs'; translate('Missing catalog key');",
    'game/a.mjs',
    resources,
    resources,
  );
  assert.ok(
    alias.errors.some(({ kind, key }) => kind === 'unknown-key' && key === 'Missing catalog key'),
  );
});

test('only catalog contract changes require scanning unchanged callers', () => {
  const before = { en: { common: { plain: 'Ready', person: '{{name}}' } } };
  assert.equal(
    catalogContractsChanged(before, {
      en: { common: { plain: 'Done', person: 'Hello {{name}}', added: 'Added' } },
    }),
    false,
  );
  assert.equal(
    catalogContractsChanged(before, {
      en: { common: { plain: 'Ready {{mission}}', person: '{{name}}' } },
    }),
    true,
  );
  assert.equal(
    catalogContractsChanged(before, {
      en: { common: { ...before.en.common, added_one: 'One', added_other: 'Other' } },
    }),
    true,
  );
  assert.equal(catalogContractsChanged(before, { en: { common: { person: '{{name}}' } } }), true);
});

async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'revealline-i18n-guards-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const write = async (file, source) => {
    await fs.mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await fs.writeFile(path.join(root, file), source);
  };
  await localizationGit(root, ['init', '-q']);
  await localizationGit(root, ['config', 'user.name', 'Localization fixture']);
  await localizationGit(root, ['config', 'user.email', 'fixture@example.invalid']);
  await write('game/locales/en/common.json', JSON.stringify(resources.en.common));
  await write('game/a.mjs', "t('common:plain');");
  await localizationGit(root, ['add', '.']);
  await localizationGit(root, ['commit', '-qm', 'Fixture baseline']);
  return { root, write };
}

test('explicit-base command detects untracked sources and changed catalog contracts', async (t) => {
  const { root, write } = await fixture(t);
  await assert.rejects(checkLocalizationChanges(root), /explicit --base/);
  await write(
    'game/locales/en/common.json',
    JSON.stringify({ ...resources.en.common, plain: 'Ready {{mission}}' }),
  );
  await write('optional-practice/new/app.js', "label.textContent = 'Start flight';");
  const report = await checkLocalizationChanges(root, 'HEAD');
  assert.equal(report.status, 'failed');
  assert.ok(report.errors.some((item) => item.kind === 'missing-arguments'));
  assert.ok(report.errors.some((item) => item.file === 'optional-practice/new/app.js'));
});

test('explicit extra source files are checked when untracked without a catalog change', async (t) => {
  const { root, write } = await fixture(t);
  await write('scripts/pages-current-entry.mjs', "label.textContent = 'Start flight';");
  const report = await checkLocalizationChanges(root, 'HEAD');
  assert.equal(report.files, 1);
  assert.deepEqual(
    report.errors.map(({ file }) => file),
    ['scripts/pages-current-entry.mjs'],
  );
});

test('batched Git reads preserve Unicode bytes and filenames without materializing files', async (t) => {
  const { root, write } = await fixture(t);
  const file = 'game/space name.mjs';
  const source = "// Українська: Ґ Є І Ї\nconst value = 'рядок';\n";
  await write(file, source);
  await localizationGit(root, ['add', file]);
  const blobs = await localizationGitBlobs(root, [`:${file}`, 'HEAD:game/a.mjs']);
  assert.equal(blobs.get(`:${file}`), source);
  assert.equal(blobs.get('HEAD:game/a.mjs'), "t('common:plain');");
  await assert.rejects(
    localizationGitBlobs(root, ['HEAD:missing.mjs']),
    /Cannot read localization source/,
  );
});

test('sparse sources read exact index bytes without reviving a deleted non-sparse source', async (t) => {
  const { root, write } = await fixture(t);
  const skipped = 'authoring/library/fpv-field-kit/prepared/titles/review-copy.mjs';
  await write(skipped, "t('common:name', {name});");
  await localizationGit(root, ['add', skipped]);
  await localizationGit(root, ['update-index', '--skip-worktree', skipped]);
  await fs.rm(path.join(root, skipped));
  await fs.rm(path.join(root, 'game/a.mjs'));
  const sources = await localizationSources(root);
  assert.equal(
    await sources.find(({ file }) => file === skipped).read(),
    "t('common:name', {name});",
  );
  assert.equal(
    sources.some(({ file }) => file === 'game/a.mjs'),
    false,
  );
});
