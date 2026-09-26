import { parse } from 'acorn';
import LZString from 'lz-string';
import { boundedJSON, required } from '../game/data-json.mjs';

function nodes(source) {
  const result = [],
    visit = (node) => {
      if (!node || typeof node !== 'object') return;
      if (node.type) result.push(node);
      for (const child of Object.values(node)) {
        if (Array.isArray(child)) child.forEach(visit);
        else if (child && typeof child === 'object') visit(child);
      }
    };
  visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  return result;
}

/** Preserve the shared host's locale support and dynamic generic messages,
 * while omitting unselected legacy campaign translation data.
 * Rewrite literal data in the compiler-owned copy, never execute source code. */
export function projectEditionLocalization(sourceFiles, { locales: selectedLocales = null } = {}) {
  const files = new Map(sourceFiles),
    catalogPath = 'game/i18n/catalogs.mjs';
  if (!files.has(catalogPath)) return files;
  const source = files.get(catalogPath).toString('utf8');
  const assignment = nodes(source).find(
    (node) =>
      node.type === 'AssignmentExpression' &&
      node.left.type === 'MemberExpression' &&
      node.left.object.name === 'globalThis' &&
      node.left.property.name === 'RevealLineTranslations',
  );
  const encoded = assignment?.right?.arguments?.[0]?.arguments?.[0];
  required(
    encoded?.type === 'Literal' && typeof encoded.value === 'string',
    'Unknown generated localization encoding.',
  );
  const resources = boundedJSON(LZString.decompressFromBase64(encoded.value), {
    maxBytes: 8 * 1024 * 1024,
    maxNodes: 200000,
    maxString: 20000,
  });
  required(
    resources.en && typeof resources.en === 'object',
    'English runtime messages are missing.',
  );
  const localeIds = selectedLocales ?? Object.keys(resources);
  required(
    Array.isArray(localeIds) &&
      localeIds.includes('en') &&
      new Set(localeIds).size === localeIds.length &&
      localeIds.every((id) => resources[id]),
    'Selected runtime locales need English fallback and existing resources.',
  );
  const projected = Object.fromEntries(
    localeIds.map((id) => [
      id,
      Object.fromEntries(
        Object.entries(resources[id]).filter(
          ([namespace]) => !['content', 'website'].includes(namespace),
        ),
      ),
    ]),
  );
  const replacement = JSON.stringify(LZString.compressToBase64(JSON.stringify(projected)));
  files.set(
    catalogPath,
    Buffer.from(source.slice(0, encoded.start) + replacement + source.slice(encoded.end)),
  );
  const bootstrapPath = 'game/i18n/bootstrap.mjs',
    bootstrap = files.get(bootstrapPath)?.toString('utf8');
  required(bootstrap, 'English projection requires the matching locale bootstrap.');
  const locales = nodes(bootstrap).find(
    (node) => node.type === 'VariableDeclarator' && node.id.name === 'locales',
  );
  required(locales?.init?.type === 'ArrayExpression', 'Unknown locale bootstrap vocabulary.');
  files.set(
    bootstrapPath,
    Buffer.from(
      bootstrap.slice(0, locales.init.start) +
        JSON.stringify(localeIds) +
        bootstrap.slice(locales.init.end),
    ),
  );
  if (files.has('game/i18n/content-registry.mjs'))
    files.set(
      'game/i18n/content-registry.mjs',
      Buffer.from(
        '// Editions use their exact selected authored text; legacy catalogs are not shipped.\nexport default Object.freeze({});\n',
      ),
    );
  return files;
}

/** Retain the earlier explicit projection API for existing authoring clients. */
export function projectEditionEnglishLocalization(sourceFiles) {
  return projectEditionLocalization(sourceFiles, { locales: ['en'] });
}
