#!/usr/bin/env node
/** Read-only ownership supplement; uses the same current/retained readers as Solo. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { canonicalJSON, required } from '../game/data-json.mjs';
import { loadRuntimeContentProvider } from '../game/runtime-content-provider.mjs';
import { resolveEditionAssets, validateEditionRuntimeCatalog } from '../game/editions/model.mjs';
import { resolveContentJourney } from '../game/content-design/journey.mjs';
import { campaignKey } from '../game/library.mjs';
import { sceneDescriptor } from '../game/ui/scene-art.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../game/gameplay-tuning.mjs';
import { decodeOriginalPNG } from '../authoring/library/four-worlds-chapters/verify-images.mjs';
import {
  boardSVG,
  duplicateGroups,
  geometrySignature,
  normalizedGameplay,
} from './content-inventory.mjs';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const BASE = 'https://inventory.invalid/';
const CATALOG = 'game/editions/catalog.json';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const identity = (value) => hash(canonicalJSON(value));
const unique = (values) => [...new Set(values)].sort();
const ordered = (a, b) => a.id.localeCompare(b.id, 'en');
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
export const COMPANY_INVENTORY_PATH = 'docs/content-offline/company-inventory.json';

export function companyOwnerId({ campaignId, missionId, mode }) {
  // A bundle and a chapter expose the same mission. Edition profiles and exact
  // presentation receipts remain distinct instances; never alias their saves.
  return `company/${campaignId}/${missionId}/${mode}`;
}

export async function buildCompanyInventory({ root = ROOT, readFile = fs.readFile } = {}) {
  const read = async (relative) => {
    required(
      typeof relative === 'string' &&
        !relative.includes('\\') &&
        !path.isAbsolute(relative) &&
        !relative.split('/').includes('..'),
      'Inventory path escaped the repository.',
    );
    return readFile(path.join(root, relative));
  };
  const fetcher = async (url) => {
    const target = new URL(url);
    required(
      target.origin === new URL(BASE).origin && !target.search,
      'Inventory fetch escaped local source.',
    );
    return new Response(await read(decodeURIComponent(target.pathname.slice(1))));
  };
  const catalogBytes = await read(CATALOG);
  const catalog = validateEditionRuntimeCatalog(catalogBytes.toString('utf8'));
  const originalByHash = new Map(),
    files = new Map(),
    boards = new Map(),
    contexts = [],
    instances = [];
  async function pin(relative, expected) {
    if (files.has(relative)) {
      const known = files.get(relative);
      required(
        !expected || (known.sha256 === expected.sha256 && known.bytes === expected.bytes),
        `Conflicting inventory pin: ${relative}`,
      );
      return known;
    }
    const bytes = await read(relative);
    const result = { path: relative, bytes: bytes.length, sha256: hash(bytes) };
    required(
      !expected || (result.bytes === expected.bytes && result.sha256 === expected.sha256),
      `Inventory dependency differs: ${relative}`,
    );
    files.set(relative, result);
    return result;
  }
  async function original(asset) {
    const sourcePath = `game/${asset.path}`;
    await pin(sourcePath, asset);
    if (!originalByHash.has(asset.sha256)) {
      const bytes = await read(sourcePath);
      const decoded = decodeOriginalPNG(`data:image/png;base64,${bytes.toString('base64')}`);
      required(
        decoded.naturalWidth === asset.width && decoded.naturalHeight === asset.height,
        `Original dimensions differ: ${sourcePath}`,
      );
      originalByHash.set(asset.sha256, {
        id: asset.sha256,
        paths: [],
        bytes: asset.bytes,
        width: decoded.naturalWidth,
        height: decoded.naturalHeight,
        pixelsSha256: decoded.pixelsSha256,
        description: asset.alt,
      });
    }
    const item = originalByHash.get(asset.sha256);
    item.paths = unique([...item.paths, sourcePath]);
    return item.id;
  }
  for (const asset of catalog.assets) await pin(asset.path, asset);
  for (const edition of catalog.editions) {
    for (const retained of [null, ...(edition.presentationHistory ?? [])]) {
      const href = new URL('game/index.html', BASE);
      href.searchParams.set('edition', edition.id);
      if (retained) href.searchParams.set('presentation', retained.id);
      const provider = await loadRuntimeContentProvider({
        locationRef: href,
        documentRef: { documentElement: { dataset: {} } },
        fetcher,
      });
      const { bootstrap } = provider;
      const contextId = `${edition.id}/${provider.authoredPresentationSha256}`;
      const dependencies = [await pin(CATALOG)];
      if (retained) dependencies.push(await pin(retained.path, retained));
      else {
        for (const relative of unique([
          ...Object.values(edition.boot),
          ...bootstrap.selection.campaigns.flatMap((campaign) => [
            campaign.sourcePath,
            ...(campaign.lessonPath ? [campaign.lessonPath] : []),
          ]),
        ]))
          dependencies.push(await pin(relative));
      }
      const selectedAssets = resolveEditionAssets(bootstrap.catalog, { editionId: edition.id });
      for (const asset of selectedAssets) dependencies.push(await pin(asset.path, asset));
      contexts.push({
        id: contextId,
        editionId: edition.id,
        name: edition.name,
        classification: retained ? 'compatibility-only' : 'current',
        authoredPresentationSha256: provider.authoredPresentationSha256,
        retainedDescriptor: retained,
        sourceSha256: identity(bootstrap.source),
        profileKey: provider.route.profileKey,
        sessionKey: provider.route.sessionKey,
        legacySessionKey: provider.legacySessionKey,
        themeIds: provider.themes.map((theme) => theme.id),
        dependencies,
        dependencyBytes: dependencies.reduce((sum, file) => sum + file.bytes, 0),
        sizeScope:
          'Selected original assets and JSON inputs only; shared runtime, storage overhead and update peak excluded. Retained JSON inputs are inside the pinned snapshot.',
      });
      for (const mode of edition.modes) {
        const journey = resolveContentJourney(bootstrap.source, { mode, difficulty: 'standard' });
        for (const campaign of journey.campaigns)
          for (const manifest of campaign.manifests) {
            const mission = bootstrap.source.missions.find(
              (item) => item.id === manifest.missionId,
            );
            const ownerId = companyOwnerId({
              campaignId: campaign.campaignId,
              missionId: manifest.missionId,
              mode,
            });
            const board = identity(manifest.level);
            boards.set(board, { id: board, level: manifest.level });
            const theme = provider.themes.find((item) => item.id === manifest.presentation.themeId);
            required(theme, 'Effective mission theme is missing.');
            instances.push({
              id: `${contextId}/${ownerId}`,
              ownerId,
              contextId,
              classification: retained ? 'compatibility-only' : 'current',
              mode,
              campaignId: campaign.campaignId,
              missionId: manifest.missionId,
              name: manifest.level.name,
              revision: mission.revision,
              board,
              originalIdentity: {
                campaignKey: campaignKey(campaign.runtime),
                simulationIdentity: manifest.simulationIdentity,
                policyId: manifest.policyId,
              },
              presentation: manifest.presentation,
              themeSha256: identity(theme),
              procedural: manifest.background
                ? null
                : {
                    seed: 0,
                    theme,
                    descriptor: sceneDescriptor(theme, manifest.level, 0),
                    renderer: 'game/ui/scene-art.mjs',
                  },
              artwork: manifest.background ? await original(manifest.background) : null,
              backgroundKind: manifest.background ? 'pinned-original' : 'procedural-theme',
              presentationRule:
                'Canonical candidate host uses manifest.background; no Classic visualOverrides. Null background uses the selected edition theme procedurally.',
              authoredGameplayHash: identity({
                level: normalizedGameplay(manifest.level),
                context: {},
              }),
              gameplayHash: identity({
                level: normalizedGameplay(
                  applyGameplayTuning(manifest.level, resolveGameplayTuning('standard')),
                ),
                context: {},
              }),
              geometryHash: geometrySignature(manifest.level),
            });
          }
      }
    }
  }
  const owners = unique(instances.map((row) => row.ownerId)).map((id) => ({
    id,
    currentInstances: instances
      .filter((row) => row.ownerId === id && row.classification === 'current')
      .map((row) => row.id)
      .sort(),
    historicalInstances: instances
      .filter((row) => row.ownerId === id && row.classification !== 'current')
      .map((row) => row.id)
      .sort(),
  }));
  const current = instances.filter((row) => row.classification === 'current');
  const baseBytes = await read('docs/content-offline/inventory.json');
  const base = JSON.parse(baseBytes);
  const baseGameplayMatches = (field) =>
    unique(current.map((row) => row[field])).flatMap((value) => {
      const matches = base.missions.filter(
        (row) => row.classification === 'current' && row[field] === value,
      );
      return matches.length
        ? [
            {
              hash: value,
              companyOwners: unique(
                current.filter((row) => row[field] === value).map((row) => row.ownerId),
              ),
              baseOwners: matches.map((row) => row.id).sort(),
            },
          ]
        : [];
    });
  const comparisons = {
    currentSharedOriginals: duplicateGroups(current, (row) => row.artwork, {
      distinct: (row) => row.ownerId,
    }),
    currentSharedPixels: duplicateGroups(
      current,
      (row) => originalByHash.get(row.artwork)?.pixelsSha256,
      { distinct: (row) => row.ownerId },
    ),
    currentOwnerVariants: owners.flatMap((owner) => {
      const selected = current.filter((row) => row.ownerId === owner.id);
      const variants = unique(
        selected.map((row) =>
          identity({ gameplay: row.gameplayHash, artwork: row.artwork, theme: row.themeSha256 }),
        ),
      );
      return variants.length > 1
        ? [{ ownerId: owner.id, instances: selected.map((row) => row.id).sort() }]
        : [];
    }),
    currentIdenticalGameplay: duplicateGroups(current, (row) => row.gameplayHash, {
      distinct: (row) => row.ownerId,
    }),
    currentSimilarGeometry: duplicateGroups(current, (row) => row.geometryHash, {
      distinct: (row) => row.ownerId,
    }),
    historicalReuse: [...originalByHash.keys()].sort().flatMap((id) => {
      const selected = instances.filter((row) => row.artwork === id);
      return selected.some((row) => row.classification !== 'current') && selected.length > 1
        ? [{ hash: id, instances: selected.map((row) => row.id).sort() }]
        : [];
    }),
    baseIdenticalGameplay: baseGameplayMatches('gameplayHash'),
    baseSimilarGeometry: baseGameplayMatches('geometryHash'),
    baseArtworkMatches: [...originalByHash.values()].flatMap((art) =>
      base.artwork
        .filter(
          (other) =>
            other.kind === 'original' &&
            (other.id === art.id || other.pixelsSha256 === art.pixelsSha256),
        )
        .map((other) => ({
          companyArtwork: art.id,
          baseArtwork: other.id,
          companyInstances: instances
            .filter((row) => row.artwork === art.id)
            .map((row) => row.id)
            .sort(),
          baseOwners: base.missions
            .filter((row) => row.artworks.some((item) => item.id === other.id))
            .map((row) => row.id)
            .sort(),
        })),
    ),
  };
  return {
    format: 'revealline-company-content-inventory.v1',
    inputs: {
      catalog: await pin(CATALOG),
      baseInventory: {
        path: 'docs/content-offline/inventory.json',
        bytes: baseBytes.length,
        sha256: hash(baseBytes),
      },
      decoder: await pin('authoring/library/four-worlds-chapters/verify-images.mjs'),
      proceduralRenderer: await pin('game/ui/scene-art.mjs'),
    },
    summary: {
      editions: catalog.editions.length,
      campaigns: catalog.campaigns.length,
      currentMissionOwners: owners.filter((row) => row.currentInstances.length).length,
      currentInstances: current.length,
      retainedPresentations: contexts.filter((row) => row.classification !== 'current').length,
      historicalInstances: instances.length - current.length,
      originalPictures: originalByHash.size,
      currentSharedOriginalGroups: comparisons.currentSharedOriginals.length,
      currentSharedPixelGroups: comparisons.currentSharedPixels.length,
      inconsistentCurrentOwners: comparisons.currentOwnerVariants.length,
      baseArtworkMatches: comparisons.baseArtworkMatches.length,
      proceduralInstances: instances.filter((row) => !row.artwork).length,
    },
    limitations: [
      'Canonical owner IDs deduplicate bundle views for review only. Exact edition profile, campaign, simulation and presentation identities are preserved separately; this report never migrates or aliases progress.',
      'Current manifest artwork and retained original revisions are decoded with the pinned RGB8 decoder. Decorative logos/body assets are byte-verified dependencies, not mission-picture ownership or pixel-screening candidates.',
      'Gameplay matches are structural review findings, not completed playtests. Similarity transforms/perceptual review and human composition approval remain pending for company originals.',
      'Null-background instances identify procedural themes, not a visual uniqueness claim. Seed-distribution review remains separate.',
      'Dependency lists preserve selected original data; they exclude shared engine/readers and are not complete save/replay recovery proof or full offline package sizes.',
    ],
    owners,
    contexts: contexts.sort(ordered),
    instances: instances.sort(ordered),
    artwork: [...originalByHash.values()].sort(ordered),
    boards: [...boards.values()].sort(ordered),
    catalogueAssets: catalog.assets.map((asset) => ({
      ...files.get(asset.path),
      id: asset.id,
      missionOriginal: originalByHash.has(asset.sha256),
    })),
    comparisons,
  };
}

export function companyInventoryHTML(report) {
  const links = (ids) =>
    `<ul>${ids.map((id) => `<li><a href="#${escape(id)}">${escape(id)}</a></li>`).join('')}</ul>`;
  const group = (title, groups) =>
    `<h2>${title}</h2>${groups.map((entry) => `<details><summary>${escape(entry.hash)}</summary>${links(entry.owners ?? entry.instances)}</details>`).join('')}`;
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Company mission ownership</title><style>body{max-width:1100px;margin:2rem auto;padding:1rem;font:16px/1.5 system-ui;background:#111722;color:#e5edf5}a{color:#8edfff}pre,li,summary{overflow-wrap:anywhere;white-space:pre-wrap}details{border:1px solid #435166;padding:.6rem;margin:.5rem 0}img,svg{max-width:500px;width:100%;height:auto}</style><h1>Company mission ownership and retained originals</h1><p>Review findings, not uniqueness approval. Edition bundle views share a canonical mission owner, but keep their exact save and presentation identities.</p><pre>${escape(JSON.stringify(report.summary, null, 2))}</pre>${group('Current shared originals', report.comparisons.currentSharedOriginals)}${group('Current identical decoded pixels', report.comparisons.currentSharedPixels)}<h2>Conflicting current bundle presentations</h2><pre>${escape(JSON.stringify(report.comparisons.currentOwnerVariants, null, 2))}</pre><h2>Cross-check against base artwork bytes and pixels</h2><pre>${escape(JSON.stringify(report.comparisons.baseArtworkMatches, null, 2))}</pre>${group('Current identical normalized physics', report.comparisons.currentIdenticalGameplay)}${group('Current similar geometry', report.comparisons.currentSimilarGeometry)}${group('Historical original reuse', report.comparisons.historicalReuse)}<h2>Every original and all its owners</h2>${report.artwork.map((art) => `<details id="art-${art.id}"><summary>${escape(art.description ?? art.id)}</summary><img loading="lazy" src="../../${escape(art.paths[0])}" alt="${escape(art.description ?? '')}"><pre>${escape(JSON.stringify(art, null, 2))}</pre>${links(report.instances.filter((row) => row.artwork === art.id).map((row) => row.id))}</details>`).join('')}<h2>Base-game physics/geometry matches (review candidates)</h2><pre>${escape(JSON.stringify({ identicalGameplay: report.comparisons.baseIdenticalGameplay, similarGeometry: report.comparisons.baseSimilarGeometry }, null, 2))}</pre><h2>All effective mission instances</h2>${report.instances.map((row) => `<details id="${escape(row.id)}"><summary>${escape(row.name)} · ${escape(row.classification)} · ${escape(row.contextId)}</summary>${row.artwork ? `<a href="#art-${row.artwork}">Original picture</a>` : 'Procedural theme (seed 0 descriptor in record)'} · <a href="#board-${row.board}">Board</a><pre>${escape(JSON.stringify(row, null, 2))}</pre></details>`).join('')}<h2>Boards</h2>${report.boards.map((entry) => `<details id="board-${entry.id}"><summary>${escape(entry.level.name)}</summary>${boardSVG(entry.level)}</details>`).join('')}<h2>Edition dependencies and preservation identities</h2>${report.contexts.map((entry) => `<details><summary>${escape(entry.id)} · ${entry.dependencyBytes} declared bytes</summary><pre>${escape(JSON.stringify(entry, null, 2))}</pre></details>`).join('')}<h2>Limitations</h2><ul>${report.limitations.map((item) => `<li>${escape(item)}</li>`).join('')}</ul></html>\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] ?? '--check';
  required(
    ['--check', '--write', '--summary'].includes(mode) && process.argv.length <= 3,
    'Usage: company-content-inventory.mjs [--check|--write|--summary]',
  );
  const report = await buildCompanyInventory();
  for (const [relative, body] of [
    [COMPANY_INVENTORY_PATH, `${canonicalJSON(report)}\n`],
    ['docs/content-offline/company-inventory.html', companyInventoryHTML(report)],
  ]) {
    if (mode === '--write') await fs.writeFile(path.join(ROOT, relative), body);
    else if (mode === '--check')
      required(
        (await fs.readFile(path.join(ROOT, relative), 'utf8')) === body,
        `Company inventory drift: ${relative}`,
      );
  }
  console.log(JSON.stringify(report.summary, null, 2));
}
