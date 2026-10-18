#!/usr/bin/env node
/** Repackage existing exact input proofs for on-demand attract playback. */
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';
import { simDemoInventory } from '../optional-practice/civilian-fpv/demo-inventory.mjs';
import { resolveFlightDemonstration } from '../optional-practice/civilian-fpv/demonstration-resolver.mjs';
import { dataIdentity } from '../game/data-json.mjs';
import { validateWorldCourse } from '../optional-practice/civilian-fpv/world-model.mjs';

const root = new URL('../optional-practice/civilian-fpv/', import.meta.url);
async function arrayFromModule(file, name) {
  const text = await readFile(new URL(file, root), 'utf8');
  const ast = parse(text, { ecmaVersion: 'latest', sourceType: 'module' });
  const declarations = ast.body.flatMap(
    (node) =>
      (node.type === 'ExportNamedDeclaration' ? node.declaration : node)?.declarations ?? [],
  );
  const node = declarations.find((declaration) => declaration.id.name === name)?.init;
  if (node?.type !== 'ArrayExpression') throw new Error(`Missing ${name} data array`);
  return JSON.parse(text.slice(node.start, node.end));
}
function pack(frames) {
  const bytes = [],
    width = frames[0].length,
    previous = Array(width).fill(0);
  for (const frame of frames)
    for (let channel = 0; channel < width; channel++) {
      const delta = frame[channel] - previous[channel];
      previous[channel] = frame[channel];
      let value = delta < 0 ? -delta * 2 - 1 : delta * 2;
      do {
        const rest = Math.floor(value / 128);
        bytes.push((value % 128) + (rest ? 128 : 0));
        value = rest;
      } while (value);
    }
  return { width, count: frames.length, data: Buffer.from(bytes).toString('base64') };
}
const world = await arrayFromModule('world-demonstrations.mjs', 'PACKED_WORLD_DEMONSTRATIONS');
const legacy = await arrayFromModule('demonstrations.mjs', 'FLIGHT_DEMONSTRATIONS');
const archived = [];
for (const file of [
  'adventures-v1.json',
  'foundation-self-level-v1.json',
  'school-alternates-v1/fpv-school-acro-proof-part-1-of-1.json',
  'school-alternates-v1/fpv-school-self-level-proof-part-1-of-1.json',
]) {
  const archive = JSON.parse(
    await readFile(
      new URL(`../../authoring/fpv-worlds/demonstrations/optional/${file}`, root),
      'utf8',
    ),
  );
  archived.push(
    ...archive.records.map((record) => ({
      sourceIdentity: dataIdentity(validateWorldCourse(record.course)),
      proof: record.proof,
    })),
  );
}
const inventory = simDemoInventory(),
  entries = [],
  missing = [];
const generatedRoot = new URL(
  '../../authoring/fpv-worlds/demonstrations/shared-demos-generated/',
  root,
);
for (const file of await readdir(generatedRoot)) {
  if (!file.endsWith('.json')) continue;
  const row = JSON.parse(await readFile(new URL(file, generatedRoot), 'utf8'));
  if (row.proof) archived.push(row);
}
const destination = new URL('demo-data/', root);
await mkdir(destination, { recursive: true });
for (const required of inventory) {
  const existing = required.entry.legacy
    ? legacy
        .filter((proof) => proof.course === required.levelId && proof.mode === required.variantId)
        .map(({ frames, ...proof }) => ({
          sourceIdentity: dataIdentity(required.entry.course),
          proof,
          framePack: pack(frames),
        }))
    : [
        ...world
          .filter(
            (row) =>
              row.beforeFrames.course === required.levelId &&
              row.beforeFrames.mode === required.variantId,
          )
          .map((row) => ({
            sourceIdentity: row.beforeProof.sourceIdentity,
            proof: { ...row.beforeFrames, ...row.afterFrames },
            framePack: row.framePack,
          })),
        ...archived
          .filter(
            (row) => row.proof.course === required.levelId && row.proof.mode === required.variantId,
          )
          .map((row) => {
            const { frames, ...proof } = row.proof;
            return {
              sourceIdentity: row.sourceIdentity,
              proof,
              framePack: pack(frames),
              checkpoints: row.checkpoints,
            };
          }),
      ];
  let accepted = 0;
  for (const row of existing) {
    const proof = resolveFlightDemonstration({
      entry: required.entry,
      mode: required.variantId,
      worldDemonstrations: [row],
      flightDemonstrations: [row.proof],
    });
    if (!proof) continue;
    const id = `${required.levelId}-${required.variantId}-${required.sourceIdentity}`,
      file = `${id}.json`;
    const payload = {
      format: 'SimDemoPayload.v1',
      proof,
      framePack: row.framePack,
      ...(row.checkpoints ? { checkpoints: row.checkpoints } : {}),
    };
    await writeFile(new URL(file, destination), JSON.stringify(payload) + '\n');
    entries.push({
      id,
      levelId: required.levelId,
      variantId: required.variantId,
      sourceIdentity: row.sourceIdentity,
      proof,
      frames: row.framePack.count,
      file,
    });
    accepted++;
    break;
  }
  if (!accepted) missing.push(required.id);
}
const catalog = { format: 'SimDemoCatalog.v1', entries };
await writeFile(new URL('index.json', destination), JSON.stringify(catalog) + '\n');
const report = {
  format: 'SimDemoCoverage.v1',
  required: inventory.length,
  availableExactRecordings: entries.length,
  missing,
  verified: false,
  note: 'Metadata admission only. Run qualify-sim-demos.mjs to independently replay every recording.',
};
await writeFile(new URL('coverage.json', destination), JSON.stringify(report, null, 2) + '\n');
console.log(
  JSON.stringify({
    directory: fileURLToPath(destination),
    required: inventory.length,
    availableExactRecordings: entries.length,
    missing: missing.length,
  }),
);
