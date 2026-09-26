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

/** Company editions start in English. Keep dynamic generic engine messages,
 * but omit other languages and unselected legacy campaign translation data.
 * Rewrite literal data in the compiler-owned copy, never execute source code. */
export function projectEditionEnglishLocalization(sourceFiles) {
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
  const en = Object.fromEntries(
    Object.entries(resources.en).filter(
      ([namespace]) => !['content', 'website'].includes(namespace),
    ),
  );
  const replacement = JSON.stringify(LZString.compressToBase64(JSON.stringify({ en })));
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
      bootstrap.slice(0, locales.init.start) + "['en']" + bootstrap.slice(locales.init.end),
    ),
  );
  if (files.has('game/i18n/content-registry.mjs'))
    files.set(
      'game/i18n/content-registry.mjs',
      Buffer.from(
        '// English editions use the exact selected authored text.\nexport default Object.freeze({});\n',
      ),
    );
  return files;
}
