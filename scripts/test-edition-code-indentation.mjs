import test from 'node:test';
import assert from 'node:assert/strict';
import { parse } from 'acorn';
import {
  projectEditionCodeIndentation,
  projectEditionModuleIndentation,
} from './edition-code-indentation.mjs';

function lexical(source) {
  const tokens = [],
    comments = [];
  const ast = parse(source, {
    ecmaVersion: 'latest',
    sourceType: 'module',
    onToken: tokens,
    onComment: comments,
  });
  const syntax = JSON.stringify(ast, (key, value) =>
    key === 'start' || key === 'end' ? undefined : typeof value === 'bigint' ? `${value}n` : value,
  );
  return {
    syntax,
    tokens: tokens.map((item) => source.slice(item.start, item.end)),
    comments: comments.map((item) => source.slice(item.start, item.end)),
    newlines: source.match(/[\r\n\u2028\u2029]/g),
  };
}

test('edition indentation retains exact tokens, comments, template text and automatic semicolon boundaries', () => {
  const source = [
    '  "use strict";',
    '  /*! Copyright example. Keep this license. */',
    '  /* A multiline comment',
    '       with significant original comment indentation. */',
    '  const big = 123n;',
    '  const pattern = /  x[ \\t]+y/u;',
    '  const text = `first line',
    '      retained template spaces ${',
    '        big + 1n',
    '      }',
    '      retained final line`;',
    '  const continued = "left\\',
    '      retained continued-string spaces";',
    '  export function result() {',
    '    return',
    '      { text, pattern, continued };',
    '  }',
    '  // Keep this comment verbatim too.',
  ].join('\r\n');
  const original = Buffer.from(source),
    projected = projectEditionModuleIndentation('game/core/history.mjs', original);
  assert(projected.byteLength < original.byteLength);
  assert.deepEqual(lexical(projected.toString()), lexical(source));
  assert.equal(original.toString(), source);
  assert.strictEqual(
    projectEditionModuleIndentation('game/core/history.mjs', projected),
    projected,
  );
});

test('edition indentation leaves vendor modules, mapped columns, data and media bytes untouched', () => {
  const source = Buffer.from('  export const value = 1;\n');
  const mapped = Buffer.from('  export const value = 1;\n//# sourceMappingURL=module.mjs.map\n');
  const input = new Map([
    ['game/vendor/library.mjs', source],
    ['game/mapped.mjs', mapped],
    ['game/content/retained.json', Buffer.from('  {"history": true}\n')],
    ['game/art.png', Buffer.from([0, 255, 10, 32, 32])],
    ['game/code.mjs', source],
  ]);
  const projected = projectEditionCodeIndentation(input);
  assert.notStrictEqual(projected, input);
  for (const [name, bytes] of input)
    if (name !== 'game/code.mjs') assert.strictEqual(projected.get(name), bytes);
  assert.equal(projected.get('game/code.mjs').toString(), 'export const value = 1;\n');
  assert.equal(input.get('game/code.mjs').toString(), '  export const value = 1;\n');
});

test('edition indentation preserves a UTF-8 BOM and every ECMAScript line terminator', () => {
  const source =
    '\ufeffconst first = 1;\r  const second = 2;\n\tconst third = 3;\u2028  const fourth = 4;\u2029  export { first, second, third, fourth };';
  const bytes = projectEditionModuleIndentation('game/lines.js', Buffer.from(source));
  assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
  assert.deepEqual(lexical(bytes.toString()), lexical(source));
  assert(!bytes.toString().includes('\n\t'));
});
