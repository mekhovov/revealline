#!/usr/bin/env node
/** Bind the reviewed reveal paintings without changing gameplay identities. */
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { format } from 'prettier';
import { validatePack } from '../game/packs.mjs';
import { required, canonicalJSON } from '../game/data-json.mjs';
import { resolveBaseArtwork } from '../game/base-artwork.mjs';

const root = new URL('../', import.meta.url);
const read = async (file) => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const write = process.argv[2] === '--write';
required(
  process.argv.length === 3 && (write || process.argv[2] === '--check'),
  'Use refresh-classic-artwork.mjs --write or --check.',
);
const directory = 'authoring/library/classic-reveal-artwork/';
const manifest = await read(`${directory}manifest.json`);
const prompts = await read(`${directory}prompts.json`);
const visuals = new Map();
for (const row of manifest.images) {
  const bytes = await fs.readFile(new URL(`${directory}${row.file}`, root));
  required(
    createHash('sha256').update(bytes).digest('hex') === row.sha256,
    `Artwork fingerprint differs: ${row.id}`,
  );
  const prompt = prompts.find((item) => item.id === row.id);
  required(prompt, `Artwork prompt is missing: ${row.id}`);
  visuals.set(row.id, {
    levelId: row.id,
    visualOverrides: {
      background: {
        dataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}`,
        name: `${row.id}.jpg`,
        fit: 'cover',
        metadata: {
          title: row.title,
          // Keep runtime captions on the existing localized level vocabulary;
          // the complete scene description remains in prompts.json.
          description: row.title,
          author: 'RevealLine · OpenAI image generation',
          license: 'Original project content',
          rightsStatus: 'Original AI-generated artwork',
        },
      },
    },
  });
}
const campaign = await read('game/content/campaign.json');
const classes = await read('game/content/classes.json');
const themes = await read('game/content/themes.json');
const portableCampaign = Object.fromEntries(
  Object.entries(campaign).filter(([key]) => key !== 'briefs'),
);
const base = {
  format: 'xonix-pack.v1',
  id: 'first-signal-artwork',
  version: '1.0.0',
  name: campaign.title,
  description: campaign.briefs[0],
  engine: 'xonix-core.v2',
  dependencies: [],
  metadata: {
    author: 'RevealLine',
    license: 'Original project content',
    rightsStatus: 'Original AI-generated artwork',
  },
  themes: themes.themes,
  classRecipes: classes,
  campaigns: [portableCampaign],
  visualOverrides: {},
  levelVisuals: campaign.levels.map((level) => visuals.get(level.id)),
  music: [],
};
resolveBaseArtwork(base, { ...campaign, classRecipes: classes });
const outputs = [['game/content/base-artwork.json', base]];
for (const id of ['night-shift', 'living-threads', 'fieldcraft', 'sentinel-relay']) {
  const file = `game/content/packs/${id}.json`;
  const pack = await read(file);
  pack.version = '1.1.0';
  pack.levelVisuals = pack.campaigns.flatMap((entry) =>
    entry.levels.map((level) => {
      required(visuals.has(level.id), `Artwork is missing: ${level.id}`);
      const existing = pack.levelVisuals.find((row) => row.levelId === level.id);
      return {
        levelId: level.id,
        visualOverrides: { ...existing?.visualOverrides, ...visuals.get(level.id).visualOverrides },
      };
    }),
  );
  outputs.push([file, pack]);
}
for (const [file, value] of outputs) {
  const checked = validatePack(value);
  required(checked.valid, `${file}: ${checked.errors.join('; ')}`);
  if (write)
    await fs.writeFile(
      new URL(file, root),
      await format(JSON.stringify(value), { parser: 'json', printWidth: 100 }),
    );
  else
    required(
      canonicalJSON(await read(file)) === canonicalJSON(value),
      `Artwork bindings are stale: ${file}`,
    );
}
console.log(
  `${visuals.size} reveal paintings ${write ? 'bound' : 'verified'} across ${outputs.length} campaign sources.`,
);
