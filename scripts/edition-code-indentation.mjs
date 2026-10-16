import { parse } from 'acorn';

function syntaxEqual(left, right) {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (left instanceof RegExp || right instanceof RegExp)
    return (
      left instanceof RegExp &&
      right instanceof RegExp &&
      left.source === right.source &&
      left.flags === right.flags
    );
  const keys = (value) => Object.keys(value).filter((key) => key !== 'start' && key !== 'end');
  const leftKeys = keys(left),
    rightKeys = keys(right);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every((key) => Object.hasOwn(right, key) && syntaxEqual(left[key], right[key]))
  );
}

function inspect(source) {
  const tokens = [],
    comments = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    onToken: tokens,
    onComment: comments,
  });
  return { ast, tokens, comments };
}

/** Compact ASCII spaces/tabs only in gaps between lexical content. Keep a
 * separator where joining words, numeric member access or operators could make
 * a different token. Unicode whitespace and all line terminators stay exact. */
function compactGap(gap, left = '', right = '') {
  const retained = gap.replace(/[\t ]/g, '');
  if (retained || !gap) return retained;
  const word = (character) => /[\p{ID_Continue}\u200c\u200d$\\]/u.test(character);
  const operator = (character) => /[+*/%<>=!&|^?~.\-]/.test(character);
  return (word(left) && word(right)) ||
    (operator(left) && operator(right)) ||
    (/[0-9]/.test(left) && right === '.')
    ? ' '
    : '';
}

/** Compact only whitespace outside lexical content in a distribution copy.
 * Keep source, tokens, comments, literals and every line terminator intact.
 * Source-mapped files retain their original columns; vendor files stay untouched.
 * The historical export name remains compatible with existing build callers. */
export function projectEditionModuleIndentation(name, bytes) {
  if (!/\.(?:mjs|js)$/.test(name) || /(?:^|\/)vendor\//.test(name)) return bytes;
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
    original = inspect(source);
  if (original.comments.some((comment) => /sourceMappingURL\s*=/.test(comment.value))) return bytes;
  const protectedRanges = [...original.tokens, ...original.comments].sort(
    (a, b) => a.start - b.start,
  );
  let cursor = 0,
    projected = '';
  for (const item of protectedRanges) {
    projected += compactGap(
      source.slice(cursor, item.start),
      source[cursor - 1],
      source[item.start],
    );
    projected += source.slice(item.start, item.end);
    cursor = item.end;
  }
  projected += source.slice(cursor).replace(/[\t ]/g, '');
  if (projected === source) return bytes;
  const result = inspect(projected);
  const sameRanges = (before, after) =>
    before.length === after.length &&
    before.every(
      (item, index) =>
        source.slice(item.start, item.end) ===
        projected.slice(after[index].start, after[index].end),
    );
  const newlines = (text) => (text.match(/[\r\n\u2028\u2029]/g) ?? []).join('');
  if (
    !syntaxEqual(original.ast, result.ast) ||
    !sameRanges(original.tokens, result.tokens) ||
    !sameRanges(original.comments, result.comments) ||
    newlines(source) !== newlines(projected)
  )
    throw new TypeError(`Edition indentation projection changed JavaScript content: ${name}.`);
  return Buffer.from(projected);
}

export function projectEditionCodeIndentation(files) {
  return new Map(
    [...files].map(([name, bytes]) => [name, projectEditionModuleIndentation(name, bytes)]),
  );
}
