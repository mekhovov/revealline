import fs from 'node:fs/promises';
import path from 'node:path';
import { dataIdentity } from '../game/data-json.mjs';
import { createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { CLASSES } from '../game/core/registry.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { FIRST_FLIGHT_LESSONS } from '../game/first-flight.mjs';
import { ENEMY_CATALOG } from '../game/enemy-catalog.mjs';

// Explicit presentation fields. Attribution, authors, legal notices, IDs, paths,
// recordings and user-authored files are deliberately not extraction inputs.
export const CONTENT_FIELDS = new Set(['name', 'title', 'subtitle', 'label', 'description', 'summary', 'brief', 'briefs', 'instructions', 'instruction', 'outcome', 'hint', 'caption', 'domain', 'risk', 'motion', 'forms', 'labels', 'objective', 'supply', 'enemy', 'boss', 'currency', 'ability']);
export async function contentSources(root) {
  const sources = [];
  async function walk(relative) {
    for (const item of await fs.readdir(path.join(root, relative), { withFileTypes: true })) {
      const name = path.posix.join(relative, item.name);
      if (item.isDirectory()) await walk(name);
      else if (name.endsWith('.json')) sources.push({ source: name, data: JSON.parse(await fs.readFile(path.join(root, name), 'utf8')) });
    }
  }
  await walk('game/content');
  sources.push({ source: 'authoring/motion-lab/presets.json', data: JSON.parse(await fs.readFile(path.join(root, 'authoring/motion-lab/presets.json'), 'utf8')) });
  sources.push({ source: 'game/first-flight.mjs#FIRST_FLIGHT_LESSONS', data: FIRST_FLIGHT_LESSONS });
  sources.push({ source: 'game/enemy-catalog.mjs#ENEMY_CATALOG', data: ENEMY_CATALOG });
  const classes = JSON.parse(await fs.readFile(path.join(root, 'game/content/classes.json'), 'utf8'));
  const originals = [...sources];
  for (const { source, data } of originals) {
    const campaigns = data.version === 'xonix-campaign.v1' ? [data] : data.campaigns || [];
    for (const campaign of campaigns) {
      if (!campaign.levels?.[0]?.version) continue;
      const classRecipes = (data.classRecipes || classes).filter(recipe => !campaign.classIds || campaign.classIds.includes(recipe.id));
      const owned = { ...campaign, classRecipes };
      for (const mode of ['standard', 'gentle']) {
        try { sources.push({ source: `${source}#${campaign.id}/${mode}`, data: createDifficultyContext(owned, mode).campaign }); } catch { /* Nonplayable catalogue summaries have no difficulty projection. */ }
      }
    }
  }
  sources.push({ source: 'game/core/registry.mjs#CLASSES', data: CLASSES });
  return sources;
}
export async function extractContent(root, register) {
  const registry = {};
  function visit(value, source, pointer = '') {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) { value.forEach((child, i) => visit(child, source, `${pointer}/${i}`)); return; }
    const fields = {};
    function leaves(child, field) {
      if (typeof child === 'string' && /[A-Za-z]/.test(child) && !/^(?:data:|https?:|[a-z0-9]+(?:[._/-][a-z0-9]+)+)$/.test(child) && child.length < 12000) {
        fields[field] = { source: child, key: register(child, { file: source, pointer: `${pointer}/${field}` }) };
      } else if (Array.isArray(child)) child.forEach((item, i) => leaves(item, `${field}.${i}`));
      else if (child && typeof child === 'object') for (const [key, item] of Object.entries(child)) leaves(item, `${field}.${key}`);
    }
    for (const [key, child] of Object.entries(value)) {
      if (CONTENT_FIELDS.has(key)) leaves(child, key);
      if (key === 'metadata' && child?.description) leaves(child.description, 'metadata.description');
    }
    if (Object.keys(fields).length) {
      const identity = dataIdentity(value);
      registry[identity] = { fields, source, pointer };
      if (/^xonix-level\.v/.test(value.version || '')) {
        try { registry[dataIdentity(normalizedLevel(value))] = registry[identity]; } catch { /* Nonlevel containers are not normalized. */ }
      }
    }
    for (const [key, child] of Object.entries(value)) if (key !== 'metadata' && !CONTENT_FIELDS.has(key)) visit(child, source, `${pointer}/${key}`);
  }
  for (const { source, data } of await contentSources(root)) visit(data, source);
  return registry;
}
