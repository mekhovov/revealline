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

/** Remove only leading spaces/tabs outside lexical content in a distribution
 * copy. Keep source, tokens, comments, literals and every line terminator intact.
 * Source-mapped files retain their original columns; vendor files stay untouched. */
export function projectEditionModuleIndentation(name, bytes) {
  if (!/\.(?:mjs|js)$/.test(name) || /(?:^|\/)vendor\//.test(name)) return bytes;
  const source = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes),
    original = inspect(source);
  if (original.comments.some((comment) => /sourceMappingURL\s*=/.test(comment.value))) return bytes;
  const protectedRanges = [...original.tokens, ...original.comments].sort(
    (a, b) => a.start - b.start,
  );
  let range = 0,
    cursor = 0,
    projected = '';
  for (const match of source.matchAll(/^[\t ]+/gm)) {
    const start = match.index,
      end = start + match[0].length;
    while (range < protectedRanges.length && protectedRanges[range].end <= start) range++;
    if (range < protectedRanges.length && protectedRanges[range].start < end) continue;
    projected += source.slice(cursor, start);
    cursor = end;
  }
  if (cursor === 0) return bytes;
  projected += source.slice(cursor);
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
