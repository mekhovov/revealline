/** Static ownership checks for sharing only the already-projected frozen bank.
 * Never imports/evaluates a game module or creates an audio context. */
import { parse } from 'acorn';
import { createHash } from 'node:crypto';

export const PORTABLE_BANK_PATH = 'game/audio/portable-destruction.mjs';
export const AUDIO_ENTRY_PATH = 'optional-practice/civilian-fpv/world-audio.mjs';
export const ACADEMY_AUDIO_PATH = 'optional-practice/civilian-fpv/sim-presentation.mjs';
const options = { ecmaVersion: 'latest', sourceType: 'module' };
const fail = (message) => {
  throw new Error(`Shared FPV audio data: ${message}`);
};
function normalized(value) {
  if (Array.isArray(value)) return value.map(normalized);
  if (!value || typeof value !== 'object')
    return typeof value === 'bigint' ? { bigint: String(value) } : value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) =>
          !['start', 'end', 'loc', 'range'].includes(key) &&
          !(key === 'raw' && value.type === 'Literal'),
      )
      .map(([key, item]) => [key, normalized(item)]),
  );
}
const same = (left, right) =>
  JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => walk(child, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
export function assertPrivateAudioBinding(source, file = 'source') {
  walk(parse(source, options), (node) => {
    if (node.type === 'Identifier' && node.name === '_a')
      fail(`reserved projection identifier in ${file}`);
  });
}
function literal(node) {
  if (node?.type === 'Literal' && ['string', 'number', 'boolean'].includes(typeof node.value))
    return node.value;
  if (node?.type !== 'ObjectExpression') fail('bank must contain plain literal records only');
  const result = Object.create(null);
  for (const field of node.properties) {
    if (
      field.type !== 'Property' ||
      field.computed ||
      field.method ||
      field.shorthand ||
      field.kind !== 'init'
    )
      fail('nonliteral bank property');
    const key = field.key.type === 'Identifier' ? field.key.name : field.key.value;
    if (
      typeof key !== 'string' ||
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      Object.hasOwn(result, key)
    )
      fail('unsafe or duplicate bank property');
    result[key] = literal(field.value);
  }
  return result;
}
const keys = (value, expected) => value && Object.keys(value).join('|') === expected.join('|');
const skeleton = parse(
  `const bank = {};
for (const clip of Object.values(bank.clips)) {
  Object.freeze(clip.source);
  Object.freeze(clip);
}
Object.freeze(bank.release);
Object.freeze(bank.clips);
export const PORTABLE_DESTRUCTION_AUDIO = Object.freeze(bank);`,
  options,
);
function canonicalBank(source) {
  if (Buffer.byteLength(source) > 2 * 1024 * 1024) fail('bank source exceeds static bound');
  const tree = parse(source, options);
  const row = tree.body[0]?.declarations?.[0];
  if (!row) fail('missing canonical bank');
  const data = literal(row.init);
  const shape = structuredClone(tree);
  shape.body[0].declarations[0].init = structuredClone(skeleton.body[0].declarations[0].init);
  if (!same(shape, skeleton)) fail('canonical deep-freeze ownership changed');
  if (
    !keys(data, ['format', 'release', 'bytes', 'clips']) ||
    data.format !== 'revealline-portable-destruction.v1' ||
    !keys(data.release, ['id', 'revision']) ||
    typeof data.release.id !== 'string' ||
    !Number.isSafeInteger(data.release.revision) ||
    !Number.isSafeInteger(data.bytes) ||
    !data.clips ||
    typeof data.clips !== 'object'
  )
    fail('unexpected bank schema');
  const clips = Object.values(data.clips);
  if (!clips.length || clips.length > 64) fail('unexpected clip count');
  let total = 0;
  for (const clip of clips) {
    if (
      !keys(clip, ['mime', 'bytes', 'sha256', 'source', 'base64']) ||
      !keys(clip.source, ['kind', 'recordingSha256']) ||
      !['core', 'core-compact'].includes(clip.source.kind) ||
      typeof clip.source.recordingSha256 !== 'string' ||
      !/^[a-f0-9]{64}$/.test(clip.source.recordingSha256) ||
      !['audio/wav', 'audio/mpeg', 'audio/mp4'].includes(clip.mime) ||
      !Number.isSafeInteger(clip.bytes) ||
      clip.bytes < 1 ||
      typeof clip.base64 !== 'string' ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(clip.base64)
    )
      fail('unexpected clip schema');
    const bytes = Buffer.from(clip.base64, 'base64');
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (
      bytes.toString('base64') !== clip.base64 ||
      bytes.length !== clip.bytes ||
      digest !== clip.sha256 ||
      (clip.source.kind === 'core' && digest !== clip.source.recordingSha256)
    )
      fail('recording bytes or provenance changed');
    total += bytes.length;
    if (total > 1024 * 1024) fail('recordings exceed static bound');
  }
  if (total !== data.bytes) fail('bank byte total differs');
  return { tree, data, total };
}
export function assertSharedPortableAudio(canonicalSource, academySource) {
  const canonical = canonicalBank(canonicalSource);
  if (Buffer.byteLength(academySource) > 2 * 1024 * 1024) fail('projection exceeds static bound');
  const tree = parse(academySource, options);
  const exports = tree.body
    .filter(
      (node) =>
        node.type === 'ExportNamedDeclaration' && node.declaration?.type === 'VariableDeclaration',
    )
    .flatMap((node) => node.declaration.declarations);
  const row = exports.find(
    (node) =>
      node.id.type === 'ArrayPattern' && node.id.elements[0]?.name === 'createSimFlightAudio',
  );
  if (
    !row ||
    !same(
      row.id,
      parse('const [createSimFlightAudio, PORTABLE_DESTRUCTION_AUDIO] = [];', options).body[0]
        .declarations[0].id,
    ) ||
    row.init?.type !== 'CallExpression' ||
    row.init.arguments.length ||
    row.init.callee.type !== 'ArrowFunctionExpression' ||
    row.init.callee.async ||
    row.init.callee.params.length
  )
    fail('data-only projection export changed');
  if (
    exports.some(
      (node) =>
        node !== row && JSON.stringify(normalized(node.id)).includes('PORTABLE_DESTRUCTION_AUDIO'),
    )
  )
    fail('duplicate bank export');
  const body = row.init.callee.body.body;
  const tail = parse(
    `function projected() { return [_a[${JSON.stringify(AUDIO_ENTRY_PATH)}].createWorldAudio, _a[${JSON.stringify(PORTABLE_BANK_PATH)}].PORTABLE_DESTRUCTION_AUDIO]; }`,
    options,
  ).body[0].body.body[0];
  if (!same(body.at(-1), tail)) fail('projection export points at different ownership');
  const declarations = body.filter((node) => node.type === 'VariableDeclaration');
  if (
    declarations.length !== 2 ||
    !same(declarations[1], parse('const _a = Object.create(null);', options).body[0])
  )
    fail('private projection container changed');
  const assignments = body.slice(2, -1);
  const seen = new Set();
  let bank;
  for (const statement of assignments) {
    const expression = statement.expression;
    const left = expression?.left;
    if (
      statement.type !== 'ExpressionStatement' ||
      expression.type !== 'AssignmentExpression' ||
      expression.operator !== '=' ||
      left.type !== 'MemberExpression' ||
      !left.computed ||
      left.object.name !== '_a' ||
      left.property.type !== 'Literal' ||
      typeof left.property.value !== 'string' ||
      seen.has(left.property.value) ||
      expression.right.type !== 'CallExpression' ||
      expression.right.arguments.length ||
      expression.right.callee.type !== 'ArrowFunctionExpression' ||
      expression.right.callee.async ||
      expression.right.callee.params.length
    )
      fail('unexpected or duplicate private module assignment');
    seen.add(left.property.value);
    if (left.property.value === PORTABLE_BANK_PATH) bank = expression.right.callee.body.body;
  }
  if (!bank || !seen.has(AUDIO_ENTRY_PATH)) fail('canonical bank or audio entry missing');
  const expected = canonical.tree.body.map((node) =>
    node.type === 'ExportNamedDeclaration' ? node.declaration : node,
  );
  const bankReturn = parse(
    'function projected() { return { PORTABLE_DESTRUCTION_AUDIO: PORTABLE_DESTRUCTION_AUDIO }; }',
    options,
  ).body[0].body.body[0];
  if (!same(bank.slice(0, -1), expected) || !same(bank.at(-1), bankReturn))
    fail('embedded recording bank differs from canonical frozen source');
  return Object.freeze({ clips: Object.keys(canonical.data.clips).length, bytes: canonical.total });
}
