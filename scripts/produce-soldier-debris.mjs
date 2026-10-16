import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { ACTOR_FAMILIES, ACTOR_CASTS } from '../game/hunt/actor-catalog.mjs';
import { drawHuntActor } from '../game/hunt/actor-art.mjs';
import { INDUSTRIAL_SOLDIER_KIT_REVISION as revision } from '../game/hunt/industrial-soldier-kit.mjs';
import { drawHuntRemains, createHuntDestruction } from '../game/hunt/destruction.mjs';
import { createDestructionBudget } from '../game/hunt/destruction-budget.mjs';
import { rasterActor } from './produce-soldier-roster.mjs';
import { encodeSpritePNG } from './produce-field-kit-sprites.mjs';

const treatments = [
  { id: 'clean', brutal: false, blood: false },
  { id: 'brutal-without-blood', brutal: true, blood: false },
  { id: 'brutal-with-blood', brutal: true, blood: true },
];
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
async function atomic(path, bytes) {
  const pending = `${path}.${process.pid}.tmp`;
  try {
    await writeFile(pending, bytes);
    await rename(pending, path);
  } finally {
    await rm(pending, { force: true });
  }
}

/** Native procedural specimens, with no alternate accessory drawing recipe.
 * Every row shows the same family in three treatments; each group is live32,
 * burst at 0.22s and settled feedback. All output backgrounds are transparent. */
export async function produceSoldierDebris(output) {
  await mkdir(output, { recursive: true });
  const assets = [],
    samples = [];
  for (const cast of ACTOR_CASTS) {
    const sheet = rasterActor({ width: 576, height: 768 }),
      ctx = sheet.context;
    for (const [row, family] of ACTOR_FAMILIES.entries())
      for (const [column, treatment] of treatments.entries()) {
        const event = {
            id: family.id,
            family: family.id,
            cast: cast.id,
            x: 0,
            y: 0,
            tick: 10,
            cause: 'contact',
          },
          x = column * 192,
          y = row * 64;
        drawHuntActor(ctx, x + 8, y + 16, 32, 0, {
          family: family.id,
          cast: cast.id,
          artRevision: revision,
          state: 'walk',
          locomotionPhase: 1 / 6,
          shadow: false,
          armed: family.id === 'guard',
        });
        const painter = createHuntDestruction({
          artRevision: revision,
          budget: createDestructionBudget({ now: () => 0 }),
          now: () => 0,
        });
        painter.advance({ valid: true, eliminations: [] }, 0, { key: 'specimen', ...treatment });
        painter.advance({ valid: true, eliminations: [event] }, 0, {
          key: 'specimen',
          ...treatment,
        });
        for (const dt of [0.1, 0.1, 0.02])
          painter.advance({ valid: true, eliminations: [event] }, dt, {
            key: 'specimen',
            ...treatment,
          });
        ctx.save();
        ctx.translate(x + 88, y + 30);
        painter.draw(ctx);
        ctx.restore();
        painter.reset();
        ctx.save();
        ctx.translate(x + 157, y + 30);
        drawHuntRemains(ctx, event, { artRevision: revision, ...treatment });
        ctx.restore();
        samples.push({
          family: family.id,
          cast: cast.id,
          treatment: treatment.id,
          rectangle: [x, y, 192, 64],
        });
      }
    const png = encodeSpritePNG(sheet),
      path = `soldier-debris-v3-${cast.id}.png`;
    await atomic(resolve(output, path), png);
    assets.push({
      path,
      bytes: png.length,
      sha256: hash(png),
      width: sheet.width,
      height: sheet.height,
    });
  }
  const sources = await Promise.all(
    [
      'game/hunt/actor-art.mjs',
      'game/hunt/actor-catalog.mjs',
      'game/hunt/industrial-soldier-kit.mjs',
      'game/hunt/destruction.mjs',
      'game/hunt/destruction-budget.mjs',
      'game/hunt/presentation-catalog.mjs',
      'scripts/produce-soldier-roster.mjs',
      'scripts/produce-soldier-debris.mjs',
      'scripts/produce-field-kit-sprites.mjs',
    ].map(async (path) => ({
      path,
      sha256: hash(await readFile(new URL('../' + path, import.meta.url))),
    })),
  );
  const receipt = {
    format: 'revealline-soldier-debris-specimens.v1',
    artRevision: revision,
    families: 12,
    casts: 3,
    treatments: treatments.map(({ id }) => id),
    samples,
    sources,
    assets,
    runtimeDecodedAtlasBytes: 0,
    scope:
      'Real overhead renderers sampled offline. Native 3D runtime, motion and human/device acceptance require separate review.',
  };
  await atomic(resolve(output, 'receipt.json'), JSON.stringify(receipt, null, 2) + '\n');
  return receipt;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const output = resolve(process.argv[2] ?? '.cache/soldier-debris-v3');
  const receipt = await produceSoldierDebris(output);
  console.log(JSON.stringify({ output, assets: receipt.assets }));
}
