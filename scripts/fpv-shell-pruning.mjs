/** Explicit source-only pruning for the generated SIM shell; not a general optimizer. */
import path from 'node:path';
import { parse } from 'acorn';

const unused = new Map([
  ['game/ui/celebration.mjs', ['advanceCelebration', 'skipCelebration']],
  ['game/ui/movement-audio.mjs', ['readMovementAudio']],
  ['game/text-face.mjs', ['canvasTextFonts']],
  ['game/enemy-stats.mjs', ['forkEnemyStatsSession']],
  ['game/ui/menu-audio.mjs', ['saveMenuAudio']],
  [
    'game/edition-context.mjs',
    [
      'editionIdentityId',
      'editionPublicSlug',
      'editionIdFromLocation',
      'parseEditionChannel',
      'installedStateKey',
      'editionAppIdentity',
      'validateCompanyInstallationReference',
      'officialContentOwner',
    ],
  ],
]);
const fail = (detail) => {
  throw new Error(`SIM projection pruning needs review: ${detail}`);
};
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  visit(node);
  for (const child of Object.values(node)) {
    if (Array.isArray(child)) child.forEach((value) => walk(value, visit));
    else if (child && typeof child === 'object') walk(child, visit);
  }
}

/** Return only whole, unused function declarations after checking all projected users.
 * Any new use or declaration shape stops generation instead of widening this list. */
export function simShellPruningPlan(sources, entries) {
  const trees = new Map(
    [...sources].map(([file, text]) => [
      file,
      parse(text, { sourceType: 'module', ecmaVersion: 'latest' }).body,
    ]),
  );
  const result = new Map();
  for (const [file, names] of unused) {
    const nodes = trees.get(file);
    if (!nodes) fail(`missing module ${file}`);
    const removals = names.map((name) => {
      const matches = nodes.filter(
        (node) =>
          node.type === 'ExportNamedDeclaration' &&
          node.declaration?.type === 'FunctionDeclaration' &&
          node.declaration.id?.name === name,
      );
      if (matches.length !== 1) fail(`changed declaration ${file}:${name}`);
      if (Object.hasOwn(entries[file] ?? {}, name)) fail(`root export ${file}:${name}`);
      return { name, start: matches[0].start, end: matches[0].end };
    });
    const removedStarts = new Set(removals.map((node) => node.start));
    for (const node of nodes) {
      if (removedStarts.has(node.start)) continue;
      walk(node, (child) => {
        if (child.type !== 'Identifier') return;
        if (names.includes(child.name)) fail(`retained reference ${file}:${child.name}`);
        // Direct eval could access a declaration through a string. Reject any
        // retained eval identifier conservatively, even when it is shadowed.
        if (child.name === 'eval') fail(`dynamic scope access ${file}`);
      });
    }
    result.set(file, removals);
  }
  for (const [file, nodes] of trees)
    for (const node of nodes) {
      walk(node, (child) => {
        if (child.type === 'ImportExpression') fail(`dynamic module access ${file}`);
      });
      if (node.source && ['ExportNamedDeclaration', 'ExportAllDeclaration'].includes(node.type)) {
        const dependency = path.posix.normalize(
          path.posix.join(path.posix.dirname(file), node.source.value),
        );
        if (unused.has(dependency)) fail(`re-export ${file} -> ${dependency}`);
      }
      if (node.type !== 'ImportDeclaration') continue;
      const dependency = path.posix.normalize(
        path.posix.join(path.posix.dirname(file), node.source.value),
      );
      const omitted = unused.get(dependency);
      if (!omitted) continue;
      for (const specifier of node.specifiers) {
        if (specifier.type === 'ImportNamespaceSpecifier')
          fail(`namespace import ${file} -> ${dependency}`);
        if (specifier.type !== 'ImportSpecifier' || specifier.imported.type !== 'Identifier')
          fail(`unsupported import shape ${file} -> ${dependency}`);
        if (omitted.includes(specifier.imported.name))
          fail(`import ${file} -> ${dependency}:${specifier.imported.name}`);
      }
    }
  return result;
}
