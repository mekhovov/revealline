/** Share the game shell without expanding the admitted SIM package file count. */
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse } from 'acorn';
import { format, resolveConfig } from 'prettier';
import { projectEditionModuleIndentation } from './edition-code-indentation.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const check = process.argv.includes('--check');
if (process.argv.slice(2).some((arg) => arg !== '--check')) throw new Error('Use [--check].');
const read = (file) => readFile(path.join(root, file), 'utf8');
// Project canonical preference/view modules into an existing optional package slot.
// Module closures preserve private state; shared i18n, themes and actor
// preferences stay external so appearance controls and renderers share one owner.
async function projectGlobalServices() {
  const entries = {
    'game/enemy-stats.mjs': { createEnemyStatsHost: 'createSimEnemyStatsHost' },
    'game/ui/enemy-stats.mjs': { mountEnemyStats: 'mountSimEnemyStats' },
    'game/ui/continuous-celebration.mjs': {
      mountContinuousCelebration: 'mountSimContinuousCelebration',
    },
    'game/ui/continuous-play.mjs': {
      createContinuousPlayController: 'createSimContinuousPlayController',
      continuousPlayPreferences: 'simContinuousPlayPreferences',
      mountContinuousPlayControls: 'mountSimContinuousPlayControls',
      continuousPlayBindings: 'simContinuousPlayBindings',
    },
    'game/display-preferences.mjs': { createDisplayPreferences: 'createSimDisplayPreferences' },
    'game/ui/menu-animation-preferences.mjs': {
      getMenuAnimation: 'getSimMenuAnimation',
      setMenuAnimation: 'setSimMenuAnimation',
      subscribeMenuAnimation: 'subscribeSimMenuAnimation',
    },
    'game/ui/theme-family-controls.mjs': {
      attachThemeFamilyControls: 'attachSimThemeFamilyControls',
    },
    'game/ui/global-settings-view.mjs': { mountGlobalSettings: 'mountSimGlobalSettings' },
    'game/ui/radio-audio.mjs': {
      readRadioAudio: 'readSimRadioAudio',
      RADIO_AUDIO_KEY: 'SIM_RADIO_AUDIO_KEY',
    },
    'game/ui/menu-audio.mjs': {
      attachMenuAudioSettings: 'attachSimMenuAudioSettings',
      readMenuAudio: 'readSimMenuAudio',
    },
  };
  const included = new Set([
    ...Object.keys(entries),
    'game/text-face.mjs',
    'game/text-size.mjs',
    'game/ui/theme-material-preview.mjs',
    'game/ui/movement-audio.mjs',
    'game/ui/radio-audio.mjs',
    'game/ui/celebration.mjs',
    'game/data-json.mjs',
    'game/profile-storage.mjs',
    'game/profile-database.mjs',
    'game/hunt/actor-art.mjs',
    'game/hunt/actor-catalog.mjs',
    'game/presentation/actor-animation.mjs',
    'game/hunt/industrial-soldier-kit.mjs',
    'game/ui/art-review-navigation.mjs',
    'game/ui/enemy-appearance-controls.mjs',
  ]);
  const external = new Map([
    ['game/i18n/index.mjs', 'simGlobalI18n'],
    ['game/presentation/theme-system.mjs', 'simGlobalThemes'],
    ['game/hunt/preferences.mjs', 'simGlobalActorPreferences'],
  ]);
  const modules = new Map(),
    visiting = new Set();
  const resolve = (file, specifier) =>
    path.posix.normalize(path.posix.join(path.posix.dirname(file), specifier));
  async function visit(file) {
    if (external.has(file)) return external.get(file);
    if (!included.has(file)) throw new Error(`Unadmitted shared settings dependency: ${file}`);
    if (modules.has(file)) return `modules[${JSON.stringify(file)}]`;
    if (visiting.has(file)) throw new Error(`Cyclic shared settings dependency: ${file}`);
    visiting.add(file);
    let text = await read(file);
    const nodes = parse(text, { sourceType: 'module', ecmaVersion: 'latest' }).body;
    const replacements = [],
      names = [];
    for (const node of nodes) {
      if (node.type === 'ImportDeclaration') {
        const owner = await visit(resolve(file, node.source.value));
        replacements.push([
          node.start,
          node.end,
          node.specifiers
            .map((specifier) => {
              if (specifier.type === 'ImportNamespaceSpecifier')
                return `const ${specifier.local.name} = ${owner};`;
              if (specifier.type !== 'ImportSpecifier')
                throw new Error('Shared settings requires named imports.');
              return `const ${specifier.local.name} = ${owner}[${JSON.stringify(specifier.imported.name)}];`;
            })
            .join('\n'),
        ]);
      } else if (node.type === 'ExportNamedDeclaration') {
        if (!node.declaration || node.source)
          throw new Error('Shared settings requires direct named exports.');
        const declaration = node.declaration;
        names.push(
          ...(declaration.type === 'VariableDeclaration'
            ? declaration.declarations.map((item) => item.id.name)
            : [declaration.id.name]),
        );
        replacements.push([node.start, declaration.start, '']);
      }
    }
    for (const [start, end, replacement] of replacements.reverse())
      text = text.slice(0, start) + replacement + text.slice(end);
    visiting.delete(file);
    modules.set(file, { text, names });
    return `modules[${JSON.stringify(file)}]`;
  }
  for (const file of Object.keys(entries)) await visit(file);
  return [
    ...[...external].map(
      ([file, name]) => `import * as ${name} from ${JSON.stringify('../../' + file)};`,
    ),
    'const sharedGlobalSettings = (() => { const modules = Object.create(null);',
    ...[...modules].map(
      ([file, { text, names }]) =>
        `modules[${JSON.stringify(file)}] = (() => {\n${text}\nreturn {${names.join(',')}};})();`,
    ),
    `return {${Object.entries(entries)
      .flatMap(([file, names]) =>
        Object.entries(names).map(
          ([original, exported]) =>
            `${exported}: modules[${JSON.stringify(file)}][${JSON.stringify(original)}]`,
        ),
      )
      .join(',')}};})();`,
    ...Object.values(entries).flatMap((names) =>
      Object.values(names).map((name) => `export const ${name} = sharedGlobalSettings.${name};`),
    ),
  ].join('\n');
}
const source = [
  await read('game/ui/mode-choice-view.mjs'),
  await read('game/ui/settings-panels.mjs'),
  await read('game/ui/mode-settings-view.mjs'),
  await read('game/ui/mode-play-shell.mjs'),
].join('\n');
const tree = parse(source, { sourceType: 'module', ecmaVersion: 'latest' });
const exports = [];
const edits = [];
function inspect(node) {
  if (!node || typeof node !== 'object') return;
  if (
    ['ImportDeclaration', 'ImportExpression', 'MetaProperty', 'ExportDefaultDeclaration'].includes(
      node.type,
    )
  )
    throw new Error('The optional shell projection must remain dependency-free.');
  if (node.type === 'ExportNamedDeclaration') {
    if (!node.declaration || node.source)
      throw new Error('Only named shell declarations are supported.');
    const declaration = node.declaration;
    const names =
      declaration.type === 'VariableDeclaration'
        ? declaration.declarations.map((item) => item.id.name)
        : [declaration.id?.name];
    if (names.some((name) => !name)) throw new Error('Shell exports must be named.');
    exports.push(...names);
    edits.push([node.start, declaration.start]);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(inspect);
    else if (value && typeof value === 'object') inspect(value);
  }
}
inspect(tree);
if (!exports.includes('mountModePlayShell')) throw new Error('Missing canonical shell entry.');
let projected = source;
for (const [start, end] of edits.sort((a, b) => b[0] - a[0]))
  projected = projected.slice(0, start) + projected.slice(end);
const hash = createHash('sha256').update(source).digest('hex');
const jsBegin = '// BEGIN GENERATED SHARED MODE SHELL';
const jsEnd = '// END GENERATED SHARED MODE SHELL';
const formatted = await format(
  `${jsBegin}\n${await projectGlobalServices()}\n// Canonical source sha256: ${hash}\nconst sharedModeShell = (() => {\n${projected}\nreturn {${exports.join(',')}};\n})();\nexport const mountSimPlayShell = sharedModeShell.mountModePlayShell;\nexport const renderSimModeChoices = sharedModeShell.renderModeChoices;\nexport const mountSimModeSettings = sharedModeShell.mountModeSettings;\nexport const simAttachSettingsPanels = sharedModeShell.attachSettingsPanels;\nexport const simSettingsPanelBack = sharedModeShell.settingsPanelBack;\nexport const simSettingsTabOwnsKey = sharedModeShell.settingsTabOwnsKey;\n${jsEnd}\n`,
  { ...(await resolveConfig(path.join(root, 'game/ui/mode-play-shell.mjs'))), parser: 'babel' },
);
const generated = projectEditionModuleIndentation(
  'flight-fullscreen.mjs',
  Buffer.from(formatted),
).toString();
async function replace(file, begin, end, body) {
  const old = await read(file);
  const first = old.indexOf(begin),
    last = old.indexOf(end);
  const next =
    first >= 0 && last >= first
      ? old.slice(0, first) + body.trimEnd() + old.slice(last + end.length)
      : old.trimEnd() + '\n\n' + body.trimEnd() + '\n';
  if (check && next !== old) throw new Error(`Shared shell projection differs: ${file}`);
  if (!check) await writeFile(path.join(root, file), next);
}
await replace('optional-practice/civilian-fpv/flight-fullscreen.mjs', jsBegin, jsEnd, generated);
const css = [
  await read('game/ui/mode-play-shell.css'),
  await read('game/ui/pause-menu.css'),
  await read('game/ui/mode-settings-view.css'),
  await read('game/ui/global-settings-view.css'),
  (await read('game/ui/mode-choice.css')).replace(/^@import[^;]+;\s*/, ''),
].join('\n');
if (/@import|url\(/.test(css)) throw new Error('Shared shell CSS must remain resource-free.');
const cssBegin = '/* BEGIN SHARED MODE SHELL */',
  cssEnd = '/* END SHARED MODE SHELL */';
await replace(
  'optional-practice/civilian-fpv/flight-fullscreen.css',
  cssBegin,
  cssEnd,
  `${cssBegin}\n${css.trim()}\n${cssEnd}`,
);
console.log(
  JSON.stringify({
    status: check ? 'verified-byte-identical' : 'refreshed',
    sourceSha256: hash,
    bytes: Buffer.byteLength(generated),
    packageSlotsAdded: 0,
  }),
);
