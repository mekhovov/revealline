import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createCharacterPresentations } from '../character-presentations.mjs';
import { validateEnemyPresentations } from '../enemy-presentations.mjs';
import { BoardPainter } from '../ui/render.mjs';

const json = (path) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const presets = json('../../authoring/motion-lab/presets.json');
const enemies = json('../content/enemy-presentations.json');
const manifest = json('../../authoring/library/runtime-sprite-candidates-v1/export/manifest.json');
const config = json('../build-config.json');
const set = presets.characterPresentations.sets.find((entry) => entry.id === 'ukraine-roles-v1');
const theme = json('../content/themes.json').themes.find((entry) => entry.id === 'ukraine');
const directory = 'authoring/library/runtime-sprite-candidates-v1/export/';

test('all fourteen runtime files bind the reviewed full-frame derivative and original identity', () => {
  assert.equal(manifest.entries.length, 14);
  let bytes = 0,
    originalBytes = 0;
  const seen = new Set();
  for (const entry of manifest.entries) {
    const id = entry.original.id;
    const enemy = enemies.entries.find((row) => row.presentationId === id);
    const body = enemy ?? presets.characters[id];
    assert.ok(body, id);
    const src = directory + entry.file;
    assert.equal(enemy ? body.src : `authoring/${body.src.slice(3)}`, src);
    const source = body.derivation.source;
    assert.deepEqual(source, {
      src: enemy ? entry.original.path : `../${entry.original.path.slice('authoring/'.length)}`,
      bytes: entry.original.bytes,
      sha256: entry.original.sha256,
      width: entry.original.width,
      height: entry.original.height,
    });
    assert.deepEqual(body.derivation.output, {
      bytes: entry.output.bytes,
      sha256: entry.output.sha256,
      width: entry.output.width,
      height: entry.output.height,
    });
    assert.equal(body.derivation.recipe, manifest.recipe);
    assert.deepEqual(entry.frame, { crop: false, pivot: [0.5, 0.5], heading: 'north' });
    if (!enemy) assert.equal(body.originalSha256, source.sha256);
    const raw = readFileSync(new URL(`../../${src}`, import.meta.url));
    assert.equal(raw.length, entry.output.bytes);
    assert.equal(createHash('sha256').update(raw).digest('hex'), entry.output.sha256);
    assert.deepEqual([...raw.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.equal(raw.readUInt32BE(16), 128);
    assert.equal(raw.readUInt32BE(20), 128);
    assert.equal(raw[24], 8);
    assert.equal(raw[25], 6, 'RGBA pixels, with the accepted full-frame alpha');
    assert.equal(config.include.filter((path) => path === src).length, 1);
    assert.ok(!config.include.includes(entry.original.path));
    assert.ok(!seen.has(src));
    seen.add(src);
    bytes += raw.length;
    originalBytes += source.bytes;
  }
  assert.equal(bytes, 920318);
  assert.equal(originalBytes, 12396181);
  assert.equal(config.include.filter((path) => path.startsWith(directory)).length, 15);
  assert.ok(config.include.includes(directory + 'manifest.json'));
});

test('legacy records without derivation preserve the same appearance and animation contracts', () => {
  const legacy = structuredClone(presets);
  for (const id of Object.values(set.classBodies)) {
    const body = legacy.characters[id];
    body.src = body.derivation.source.src;
    delete body.derivation;
  }
  const old = createCharacterPresentations(legacy),
    current = createCharacterPresentations(presets);
  for (const [role, id] of Object.entries(set.classBodies)) {
    assert.equal(old.recommendedBody(theme, role), id);
    assert.equal(current.recommendedBody(theme, role), id);
  }
  const legacyEnemies = structuredClone(enemies);
  for (const row of legacyEnemies.entries) {
    Object.assign(row, row.derivation.source);
    delete row.derivation;
  }
  const result = validateEnemyPresentations(legacyEnemies);
  for (const [index, row] of result.entries.entries()) {
    assert.equal(row.presentationId, enemies.entries[index].presentationId);
    assert.equal(row.skinId, enemies.entries[index].skinId);
    assert.deepEqual(row.motion, enemies.entries[index].motion);
    assert.deepEqual(row.pivot, enemies.entries[index].pivot);
    assert.equal(row.width, 1254);
  }
});

test('existing player loader requests the runtime derivative and retains explicit overrides', async (t) => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const loaded = [];
  class Image {
    set src(url) {
      loaded.push(url);
      this.naturalWidth = this.naturalHeight = 128;
      queueMicrotask(() => this.onload?.());
    }
  }
  Object.defineProperty(globalThis, 'Image', { value: Image, configurable: true });
  t.after(() =>
    previous ? Object.defineProperty(globalThis, 'Image', previous) : delete globalThis.Image,
  );
  class Painter extends BoardPainter {
    makeArt() {
      return null;
    }
  }
  const painter = new Painter(presets);
  for (const id of Object.values(set.classBodies)) {
    await painter.setLook(theme, id);
    assert.equal(
      loaded.at(-1),
      new URL(`../../authoring/motion-lab/${presets.characters[id].src}`, import.meta.url).href,
    );
    assert.ok(!loaded.at(-1).includes('/originals/'));
    assert.equal(painter.body, presets.characters[id]);
    assert.equal(painter.recipe, presets.animationRecipes[painter.body.animationRecipe]);
    assert.equal(painter.image.naturalWidth, 128);
  }
  await painter.setLook(theme, set.classBodies.scout, {
    player: { dataUrl: 'data:image/png;base64,explicit' },
  });
  assert.equal(loaded.at(-1), 'data:image/png;base64,explicit');
});

test('player derivatives reject wrong source, output, role, geometry and recipe bindings', () => {
  const changes = [
    (body) => {
      body.derivation.source.src = presets.characters[set.classBodies.bomber].derivation.source.src;
    },
    (body) => {
      body.derivation.source.sha256 = '0'.repeat(64);
    },
    (body) => {
      body.derivation.source.width = 128;
    },
    (body) => {
      body.derivation.output.sha256 = '0'.repeat(64);
    },
    (body) => {
      body.derivation.output.width = 64;
    },
    (body) => {
      body.derivation.output.bytes = 131073;
    },
    (body) => {
      body.derivation.recipe = 'cropped';
    },
    (body) => {
      body.derivation.crop = true;
    },
    (body) => {
      const other = presets.characters[set.classBodies.bomber];
      body.src = other.src;
      body.derivation = structuredClone(other.derivation);
      body.originalSha256 = other.originalSha256;
    },
  ];
  for (const change of changes) {
    const input = structuredClone(presets);
    change(input.characters[set.classBodies.scout]);
    assert.throws(() => createCharacterPresentations(input));
  }
});

test('enemy derivatives reject source/output substitutions without losing class and skin guards', () => {
  const changes = [
    (row) => {
      row.derivation.source.src = enemies.entries[1].derivation.source.src;
    },
    (row) => {
      row.derivation.source.sha256 = ['bad'];
    },
    (row) => {
      row.derivation.source.width = 128;
    },
    (row) => {
      row.derivation.output.sha256 = '0'.repeat(64);
    },
    (row) => {
      row.sha256 = row.derivation.source.sha256;
    },
    (row) => {
      row.bytes++;
    },
    (row) => {
      row.derivation.output.height = 64;
    },
    (row) => {
      row.derivation.recipe = 'cropped';
    },
    (row) => {
      row.src = enemies.entries[1].src;
      row.derivation = structuredClone(enemies.entries[1].derivation);
    },
  ];
  for (const change of changes) {
    const input = structuredClone(enemies);
    change(input.entries[0]);
    assert.throws(() => validateEnemyPresentations(input));
  }
});
