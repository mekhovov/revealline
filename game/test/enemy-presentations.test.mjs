import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEnemyPresentations, validateEnemyPresentations } from '../enemy-presentations.mjs';

const source = JSON.parse(
  readFileSync(new URL('../content/enemy-presentations.json', import.meta.url)),
);
const clone = () => structuredClone(source);

test('seven exact source identities bind independent bodies including both boss slots', () => {
  const provenance = JSON.parse(
    readFileSync(
      new URL('../../authoring/library/fpv-enemy-presentations/provenance.json', import.meta.url),
    ),
  );
  const model = createEnemyPresentations(source);
  assert.deepEqual(
    model.entries.map((row) => row.type),
    provenance.items.map((row) => row.type),
  );
  for (const [index, row] of model.entries.entries()) {
    const original = provenance.items[index];
    assert.equal(row.derivation.source.sha256, original.sha256);
    assert.equal(row.derivation.source.bytes, original.bytes);
    assert.equal(row.presentationId, original.presentationId);
    assert.equal(
      row.derivation.source.src,
      `authoring/library/fpv-enemy-presentations/${original.original}`,
    );
    assert.deepEqual(row.derivation.output, {
      bytes: row.bytes,
      sha256: row.sha256,
      width: row.width,
      height: row.height,
    });
  }
  assert.equal(new Set(model.entries.map((row) => row.src)).size, 7);
  assert.notEqual(model.entries[5].src, model.entries[6].src);
  assert.equal(
    model.entries.reduce((n, row) => n + row.bytes, 0),
    460159,
  );
  assert.equal(
    model.entries.reduce((n, row) => n + row.derivation.source.bytes, 0),
    6522849,
  );
});

test('uploads retain precedence, resolved skins scope defaults and unknown types stay neutral', () => {
  const model = createEnemyPresentations(source);
  for (const row of model.entries) {
    assert.equal(model.forFrame({ type: row.type, themeId: 'fpv' }), row);
    for (const themeId of ['ukraine', 'retro', 'coupa', 'unknown'])
      assert.equal(model.forFrame({ type: row.type, themeId }), null);
  }
  for (const type of ['lane-boss', 'relay-sentinel'])
    assert.equal(
      model.forFrame({ type, themeId: 'fpv' }, { boss: { dataUrl: 'requested-but-unavailable' } }),
      null,
    );
  assert.equal(model.forFrame({ type: 'contour-patrol', themeId: 'fpv' }, { contour: {} }), null);
  assert.ok(model.forFrame({ type: 'contour-patrol', themeId: 'fpv' }, { enemy: {} }));
  assert.equal(model.forFrame({ type: 'constructor', themeId: 'fpv' }), null);
  assert.equal(model.forFrame(null), null);
});

test('registry snapshot rejects accessors and detaches its finite frozen data', () => {
  let calls = 0;
  const malformed = clone();
  Object.defineProperty(malformed.entries[0], 'src', {
    enumerable: true,
    get() {
      calls++;
      return source.entries[0].src;
    },
  });
  assert.throws(() => validateEnemyPresentations(malformed), /accessors/);
  assert.equal(calls, 0);
  const input = clone();
  const result = validateEnemyPresentations(input);
  input.entries[0].motion[0].color = '#000000';
  assert.notEqual(result.entries[0].motion[0].color, input.entries[0].motion[0].color);
  assert.ok(Object.isFrozen(result.entries[0].motion[0]));
});

test('wrong identity types, foreign paths, type aliases and unbounded motion refuse', () => {
  const changes = [
    (v) => {
      v.entries[0].sha256 = [v.entries[0].sha256];
    },
    (v) => {
      v.entries[0].src = '../user-reference.png';
    },
    (v) => {
      v.entries[0].skinId = 'bouncer.ukraine.v1';
    },
    (v) => {
      v.entries[6].type = 'lane-boss';
    },
    (v) => {
      v.entries[0].motion[0].x = 1;
    },
    (v) => {
      v.entries[0].motion[0].rate = Infinity;
    },
    (v) => {
      v.entries[0].motion[0].clock = 'simulation';
    },
    (v) => {
      v.entries[0].width = 4096;
    },
    (v) => {
      v.entries[0].pivot = [0.2, 0.5];
    },
    (v) => {
      v.entries[0].bytes = 3 * 1024 * 1024;
    },
    (v) => {
      v.entries[1].motion = [structuredClone(v.entries[0].motion[0])];
    },
    (v) => {
      v.entries[0].presentationId = v.entries[1].presentationId;
    },
  ];
  for (const change of changes) {
    const value = clone();
    change(value);
    assert.throws(() => validateEnemyPresentations(value));
  }
});
