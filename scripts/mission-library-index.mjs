#!/usr/bin/env node
/** Build-time browsing metadata, never runtime authority or a publication operation. */
import * as fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { required, canonicalJSON } from '../game/data-json.mjs';
import { PACK_LIMITS, validatePack } from '../game/packs.mjs';
import { campaignKey } from '../game/library.mjs';
import { createRun } from '../game/core/index.mjs';
import { createDuel } from '../game/multiplayer.mjs';
import { normalizedLevel } from '../game/core/level.mjs';
import { versionsForLevel } from '../game/core/versions.mjs';
import { arcadeActionCapabilities } from '../game/core/arcade-actions.mjs';
import { CAMPAIGN_DIFFICULTIES, createDifficultyContext } from '../game/campaign-difficulty.mjs';
import { prepareOptionalCatalog, assertOptionalPack } from '../game/optional-chapters.mjs';
import { prepareExternalCatalog } from '../game/external-chapter-catalog.mjs';
import { SOURCE_EXTERNAL_CHAPTERS } from '../game/external-chapter-source.mjs';
import { readExternalDistributionEntries } from './external-distribution.mjs';
import {
  readPackIndexes,
  readPackJSON,
  packNavigationSummary,
  validateNavigationCatalogs,
} from './pack-indexes.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
export const MISSION_LIBRARY_INDEX_PATH = 'game/content/mission-library-index.json';
export const MISSION_LIBRARY_INDEX_FORMAT = 'revealline-mission-library-index.v1';
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const sourceFile = (relative, bytes) => ({
  path: relative,
  bytes: bytes.length,
  sha256: digest(bytes),
});

export function assertMissionSourceBytes(bytes, expected) {
  required(
    bytes.length === expected.bytes && digest(bytes) === expected.sha256,
    `Mission index source differs from its trusted byte identity: ${expected.path}.`,
  );
}

function checkedPack(value) {
  const result = validatePack(value);
  required(result.valid, `Invalid mission index pack: ${result.errors.join('; ')}`);
  return value;
}

function rowsForCampaign(campaign, collection) {
  const key = campaignKey(campaign);
  const difficulties = CAMPAIGN_DIFFICULTIES.filter((mode) => {
    try {
      createDifficultyContext(campaign, mode);
      return true;
    } catch {
      return false;
    }
  });
  required(difficulties.includes('standard'), 'Mission index requires a valid Standard campaign.');
  return campaign.levels.map((sourceLevel, levelIndex) => {
    const level = normalizedLevel(sourceLevel);
    const options = { classRecipes: campaign.classRecipes, classId: campaign.classRecipes[0].id };
    // These are the same engines used by their hosts, not a hand-maintained mode whitelist.
    createRun(sourceLevel, options);
    createDuel(sourceLevel, options);
    const arcade = !arcadeActionCapabilities(sourceLevel).manualAbility;
    const themeId = sourceLevel.themeId || campaign.themeId || null;
    const authoredText = [
      collection.edition,
      collection.description,
      campaign.title,
      sourceLevel.metadata?.description,
    ]
      .filter(Boolean)
      .join(' ');
    const tags = [
      'Classic',
      ...(themeId === 'fpv' ? ['FPV'] : []),
      ...(themeId === 'ukraine' ? ['Ukrainian'] : []),
      ...(arcade ? ['Arcade'] : /\bTactical\b/i.test(authoredText) ? ['Tactical'] : []),
    ];
    const enemies = [...new Set(level.enemies.map((enemy) => enemy.type))].map((type) => ({
      type,
      count: level.enemies.filter((enemy) => enemy.type === type).length,
    }));
    const rules =
      `${Math.round(level.goal.coverage * 1000) / 10}% coverage · ${level.rules.lives} lives · ` +
      `${level.rules.moveSpeed} cells/s · ${level.rules.timeLimitSeconds ? `${level.rules.timeLimitSeconds}s limit` : 'No mission countdown'} · ` +
      `${arcade ? 'Direction-only Arcade' : 'Manual actions'} · ${level.enemies.length} ${level.enemies.length === 1 ? 'enemy' : 'enemies'}`;
    return {
      id: [
        'classic',
        collection.source,
        collection.packId || 'base',
        key,
        sourceLevel.id,
        sourceLevel.revision,
      ]
        .map(encodeURIComponent)
        .join('/'),
      source: collection.source,
      packId: collection.packId,
      campaignId: campaign.id,
      campaignRevision: campaign.revision,
      campaignKey: key,
      levelId: sourceLevel.id,
      levelRevision: sourceLevel.revision,
      levelIndex,
      name: sourceLevel.name || sourceLevel.id,
      campaignTitle: campaign.title || campaign.id,
      edition: collection.edition,
      themeId,
      modes: ['solo', 'versus'],
      tags,
      rules,
      ruleDetails: {
        ruleset: versionsForLevel(sourceLevel).ruleset,
        coverage: level.goal.coverage,
        lives: level.rules.lives,
        moveSpeed: level.rules.moveSpeed,
        timeLimitSeconds: level.rules.timeLimitSeconds || 0,
        enemies,
        requiredObjectives: level.objectives.filter((objective) => objective.required).length,
      },
      difficultiesByMode: { solo: difficulties, versus: ['standard'] },
      sourceFile: collection.sourceFile,
      ...(collection.packVersion ? { packVersion: collection.packVersion } : {}),
      ...(collection.download ? { download: collection.download } : {}),
    };
  });
}

function rowsForPack(pack, collection) {
  return pack.campaigns.flatMap((source) =>
    rowsForCampaign(
      {
        ...source,
        classRecipes: pack.classRecipes.filter(
          (recipe) => !source.classIds || source.classIds.includes(recipe.id),
        ),
      },
      { ...collection, packId: pack.id, packVersion: pack.version },
    ),
  );
}

/** Reads one pack at a time. External producer validation is build-only; the output
 * contains no artwork, geometry, engine objects, progress or installation authority.
 * Supplied distribution entries still have to match code-owned exact hashes.
 */
export async function buildMissionLibraryIndex({ root = ROOT, externalEntries } = {}) {
  const external = prepareExternalCatalog(
    (await readPackJSON(root, 'game/content/external-worlds.json', 65536)).value,
  );
  const entries =
    externalEntries ??
    (await readExternalDistributionEntries(root, {
      format: 'revealline-external-distribution.v1',
      catalog: 'game/content/external-worlds.json',
    }));
  const byPath = new Map(entries.map((entry) => [entry.name, entry.bytes]));
  required(
    byPath.size === entries.length && entries.length === external.chapters.length * 2,
    'Mission index requires every exact external distribution pair, without duplicates.',
  );
  // Reject altered/incomplete supplied payloads before parsing any artwork-bearing packs.
  for (const item of external.chapters) {
    for (const kind of ['pack', 'media']) {
      required(byPath.has(item[kind].path), `Missing mission index payload: ${item[kind].path}.`);
      assertMissionSourceBytes(byPath.get(item[kind].path), item[kind]);
    }
  }
  const base = await readPackJSON(root, 'game/content/campaign.json', PACK_LIMITS.maxBytes);
  const classes = await readPackJSON(root, 'game/content/classes.json', 1024 * 1024);
  const missions = rowsForCampaign(
    { ...base.value, classRecipes: classes.value },
    {
      source: 'base',
      packId: null,
      edition: 'Base game',
      sourceFile: sourceFile('game/content/campaign.json', base.bytes),
    },
  );
  const indexes = await readPackIndexes(root),
    summaries = new Map();
  for (const [kind, source] of [
    ['active', 'bundled'],
    ['archive', 'archived'],
  ]) {
    for (const entry of indexes[kind]) {
      const relative = `game/content/packs/${entry.path}`;
      const record = await readPackJSON(root, relative, PACK_LIMITS.maxBytes);
      const pack = checkedPack(record.value);
      summaries.set(entry.id, packNavigationSummary(entry, pack));
      missions.push(
        ...rowsForPack(pack, {
          source,
          edition: pack.name,
          description: pack.description,
          sourceFile: sourceFile(relative, record.bytes),
        }),
      );
    }
  }
  await validateNavigationCatalogs(root, indexes, summaries);
  const optional = prepareOptionalCatalog(
    (await readPackJSON(root, 'game/content/optional-worlds.json', 65536)).value,
  );
  for (const item of optional.packs) {
    const record = await readPackJSON(root, item.path, PACK_LIMITS.maxBytes);
    assertMissionSourceBytes(record.bytes, item);
    const pack = checkedPack(record.value);
    assertOptionalPack(pack, item);
    assertMissionSourceBytes(Buffer.from(JSON.stringify(pack)), {
      path: item.path,
      bytes: item.normalizedBytes,
      sha256: item.normalizedSha256,
    });
    missions.push(
      ...rowsForPack(pack, {
        source: 'optional',
        edition: item.name,
        description: item.description,
        sourceFile: sourceFile(item.path, record.bytes),
        download: { id: item.id, bytes: item.bytes, packPath: item.path },
      }),
    );
  }
  for (const item of external.chapters) {
    const bytes = byPath.get(item.pack.path),
      pack = checkedPack(JSON.parse(bytes.toString('utf8')));
    required(
      pack.id === item.id && pack.campaigns.length === 1,
      'External mission pack identity differs.',
    );
    const rows = rowsForPack(pack, {
      source: 'external',
      edition: item.name,
      description: item.description,
      sourceFile: sourceFile(item.pack.path, bytes),
      download: {
        id: item.id,
        bytes: item.pack.bytes + item.media.bytes,
        packPath: item.pack.path,
        mediaPath: item.media.path,
      },
    });
    const descriptor = SOURCE_EXTERNAL_CHAPTERS.find((entry) => entry.id === item.id);
    required(
      rows.length === item.levels &&
        rows.every(
          (row, index) =>
            row.campaignKey === item.campaignKey &&
            row.themeId === item.themeId &&
            row.levelId === descriptor.originals[index].levelId &&
            row.levelRevision === descriptor.originals[index].levelRevision,
        ),
      'External mission index differs from its exact campaign and picture identities.',
    );
    missions.push(...rows);
  }
  required(
    new Set(missions.map((row) => row.id)).size === missions.length,
    'Mission index contains duplicate provenance identities.',
  );
  return { format: MISSION_LIBRARY_INDEX_FORMAT, missions };
}

export function assertMissionLibraryIndex(actual, expected) {
  required(
    canonicalJSON(actual) === canonicalJSON(expected),
    'Mission library index differs from validated source; regenerate it.',
  );
  return actual;
}

export async function generateMissionLibraryIndex({
  root = ROOT,
  write = false,
  externalEntries,
} = {}) {
  const index = await buildMissionLibraryIndex({ root, externalEntries });
  const { format, resolveConfig } = await import('prettier');
  const text = await format(JSON.stringify(index), {
    ...(await resolveConfig(path.join(root, MISSION_LIBRARY_INDEX_PATH))),
    parser: 'json',
  });
  if (write) {
    await readPackJSON(root, MISSION_LIBRARY_INDEX_PATH, 512 * 1024, { optional: true });
    await fs.writeFile(path.join(root, MISSION_LIBRARY_INDEX_PATH), text);
  } else {
    const current = await readPackJSON(root, MISSION_LIBRARY_INDEX_PATH, 512 * 1024);
    assertMissionLibraryIndex(current.value, index);
    required(current.bytes.equals(Buffer.from(text)), 'Mission library index formatting differs.');
  }
  return { missions: index.missions.length, bytes: Buffer.byteLength(text) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  required(
    args.length === 0 || (args.length === 1 && args[0] === '--write'),
    'Use --write or no arguments.',
  );
  console.log(
    JSON.stringify(await generateMissionLibraryIndex({ write: args.includes('--write') })),
  );
}
