// Independent CSS length arithmetic, not a stylesheet/layout engine. Browser
// cascade, text metrics, clipping and physical devices require separate evidence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const inventory = JSON.parse(
  await fs.readFile(
    new URL('../../docs/accessibility/text-scaling-overflight-inventory.json', import.meta.url),
    'utf8',
  ),
);
function length(value, property, context) {
  if (property === 'font') {
    const start = value.search(
      /(?:calc|clamp|min|max|var)\(|(?:\d*\.)?\d+(?:px|rem|em|vw|vh|dvh)\b/,
    );
    assert.ok(start >= 0, value);
    value = value.slice(start);
  }
  const tokens =
    value.match(/--[\w-]+|(?:\d*\.)?\d+(?:px|rem|em|vw|vh|dvh)?|[a-z][\w-]*|[(),+*/-]/gi) ?? [];
  let cursor = 0;
  const accept = (token) => tokens[cursor] === token && (++cursor, true);
  const expect = (token) =>
    assert.ok(accept(token), `Expected ${token} in ${value}, got ${tokens[cursor]}`);
  function atom() {
    const token = tokens[cursor++];
    if (token === '(') {
      const result = sum();
      expect(')');
      return result;
    }
    if (/^\d|^\./.test(token ?? '')) {
      const [, number, unit] = token.match(/^((?:\d*\.)?\d+)(px|rem|em|vw|vh|dvh)?$/);
      const scale = {
        px: 1,
        rem: context.root,
        em: context.parent,
        vw: context.width / 100,
        vh: context.height / 100,
        dvh: context.height / 100,
      };
      return Number(number) * (unit ? scale[unit] : 1);
    }
    expect('(');
    if (token === 'var') {
      const name = tokens[cursor++];
      const fallback = accept(',') ? sum() : undefined;
      expect(')');
      const result = context.variables[name] ?? fallback;
      assert.equal(typeof result, 'number', name);
      return result;
    }
    const values = [sum()];
    while (accept(',')) values.push(sum());
    expect(')');
    if (token === 'calc') {
      assert.equal(values.length, 1);
      return values[0];
    }
    if (token === 'min') return Math.min(...values);
    if (token === 'max') return Math.max(...values);
    assert.equal(token, 'clamp');
    assert.equal(values.length, 3);
    return Math.max(values[0], Math.min(values[1], values[2]));
  }
  function product() {
    let result = atom();
    while (tokens[cursor] === '*' || tokens[cursor] === '/') {
      const op = tokens[cursor++],
        next = atom();
      result = op === '*' ? result * next : result / next;
    }
    return result;
  }
  function sum() {
    let result = product();
    while (tokens[cursor] === '+' || tokens[cursor] === '-') {
      const op = tokens[cursor++],
        next = product();
      result = op === '+' ? result + next : result - next;
    }
    return result;
  }
  return property === 'font' ? atom() : sum();
}
const normalized = (value) =>
  (value.match(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|[^"']+/g) ?? [])
    .map((part) =>
      /^["']/.test(part) ? part : part.replace(/\s+/g, ' ').replace(/\s*([(),/*])\s*/g, '$1'),
    )
    .join('')
    .trim();

test('all adopted typography declarations preserve default arithmetic for Standard/Large and unsupported consumers', async () => {
  let checked = 0;
  for (const file of inventory.files) {
    const source = (
      await fs.readFile(new URL(`../../${file.path}`, import.meta.url), 'utf8')
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    const declarations = [...source.matchAll(/\b(font-size|font|line-height)\s*:\s*([^;{}]+);/g)];
    for (const declaration of file.declarations) {
      assert.ok(
        declarations.some(
          ([, property, value]) =>
            property === declaration.property &&
            normalized(value) === normalized(declaration.after),
        ),
        `${file.path}:${declaration.line} belongs to current source`,
      );
      for (const width of [320, 390, 844, 1280])
        for (const parent of [12, 16, 20, 32])
          for (const base of [16, 20]) {
            const context = {
              root: 16,
              parent,
              width,
              height: 390,
              variables: { '--iw-text-size': base, '--fk-text-secondary': 14 },
            };
            assert.equal(
              length(declaration.after, declaration.property, context),
              length(declaration.before, declaration.property, context),
              `${file.path}:${declaration.line} default ${width}/${parent}/${base}`,
            );
          }
      checked++;
    }
  }
  assert.equal(checked, inventory.totalDeclarations);
});

test('authored absolute sizes double once while em branches follow their already-enlarged parent', () => {
  for (const file of inventory.files)
    for (const declaration of file.declarations)
      for (const width of [320, 844, 1280]) {
        const before = {
          root: 16,
          parent: 16,
          width,
          height: 390,
          variables: { '--iw-text-size': 16, '--fk-text-secondary': 14 },
        };
        const after = {
          ...before,
          parent: 32,
          variables: { ...before.variables, '--overflight-text-scale': 2 },
        };
        assert.equal(
          length(declaration.after, declaration.property, after),
          length(declaration.before, declaration.property, before) * 2,
          `${file.path}:${declaration.line}`,
        );
      }
});
