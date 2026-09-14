#!/usr/bin/env node
/** Generate trusted preview locators; never emit image bytes or read user bundles. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { validatePack, PACK_LIMITS } from '../game/packs.mjs';
import { prepareOptionalCatalog, assertOptionalPack } from '../game/optional-chapters.mjs';
import { prepareExternalCatalog } from '../game/external-chapter-catalog.mjs';
import { SOURCE_EXTERNAL_EDITIONS } from '../game/external-chapter-source.mjs';
import { inspectImageDataUrl } from '../game/content.mjs';
import { campaignKey } from '../game/library.mjs';
import { canonicalJSON, dataIdentity, required } from '../game/data-json.mjs';
import { CURRENT_PICTURES } from '../game/presentation/current-pictures.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compare = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export async function inventoryCurrentArt({ projectRoot = root } = {}) {
  const read = async (relative, maximum = PACK_LIMITS.maxBytes) => {
    required(
      !relative.split('/').some((p) => !p || p === '.' || p === '..'),
      'Unsafe source path.',
    );
    const target = path.join(projectRoot, relative),
      stat = await fs.lstat(target);
    required(stat.isFile() && stat.size <= maximum, 'Expected bounded ordinary source.');
    const bytes = await fs.readFile(target);
    return { value: JSON.parse(bytes), path: relative, bytes: bytes.length, sha256: hash(bytes) };
  };
  // Source PNGs are a convenience for the local checkout. Published builds use
  // their unchanged embedded packs or exact paired external download instead.
  const sourcePNGs = new Map();
  async function scanPNGs(relative) {
    for (const entry of (
      await fs.readdir(path.join(projectRoot, relative), { withFileTypes: true })
    ).sort((a, b) => a.name.localeCompare(b.name))) {
      const next = `${relative}/${entry.name}`;
      if (entry.isDirectory()) await scanPNGs(next);
      else if (entry.isFile() && entry.name.endsWith('.png')) {
        const file = path.join(projectRoot, next),
          stat = await fs.stat(file);
        if (stat.size > 4 * 1024 * 1024) continue;
        const sha256 = hash(await fs.readFile(file));
        if (!sourcePNGs.has(sha256)) sourcePNGs.set(sha256, next);
      }
    }
  }
  await scanPNGs('authoring/library');
  const rows = new Map();
  function add(campaign, themes, source, pack = null) {
    const baseCampaignKey = campaignKey(campaign);
    for (const level of campaign.levels)
      for (const theme of themes) {
        const owner = {
          baseCampaignKey,
          levelId: level.id,
          levelRevision: level.revision,
          themeId: theme.id,
        };
        const id = `picture.${owner.themeId}.${dataIdentity(owner)}`;
        const visual =
          pack?.levelVisuals.find((v) => v.levelId === level.id)?.visualOverrides.background ??
          pack?.visualOverrides.background;
        let image = null;
        if (visual) {
          const info = inspectImageDataUrl(visual.dataUrl);
          required(info.valid, 'Current artwork has invalid image metadata.');
          const bytes = Buffer.from(visual.dataUrl.split(',')[1], 'base64');
          image = {
            sha256: hash(bytes),
            bytes: bytes.length,
            mime: info.mime,
            width: info.width,
            height: info.height,
          };
        }
        rows.set(id, {
          id,
          owner,
          label: `${campaign.title} · ${level.name} · ${theme.name ?? theme.id}`.slice(0, 120),
          kind: image ? 'embedded' : 'procedural',
          fit: visual?.fit ?? 'cover',
          sampling: 'nearest',
          source: { ...source, campaignId: campaign.id },
          sourceImagePath: image ? (sourcePNGs.get(image.sha256) ?? null) : null,
          image,
          theme,
          level,
          seed: 0,
          description:
            visual?.metadata?.description ?? 'Original procedural scene; fixed preview seed 0.',
          credit: visual?.metadata?.author ?? 'RevealLine procedural scene renderer',
          license: visual?.metadata?.license ?? 'Original project content',
        });
      }
  }
  const base = await read('game/content/campaign.json'),
    classes = await read('game/content/classes.json'),
    themes = await read('game/content/themes.json');
  add({ ...base.value, classRecipes: classes.value }, themes.value.themes, {
    kind: 'base',
    path: base.path,
    bytes: base.bytes,
    sha256: base.sha256,
    packId: null,
    contracts: [
      { path: classes.path, bytes: classes.bytes, sha256: classes.sha256 },
      { path: themes.path, bytes: themes.bytes, sha256: themes.sha256 },
    ],
  });
  for (const [file, kind] of [
    ['index.json', 'built-in'],
    ['archive-index.json', 'archive'],
  ]) {
    for (const entry of (await read(`game/content/packs/${file}`, 65536)).value.packs) {
      required(/^[a-zA-Z0-9._-]+\.json$/.test(entry.path), 'Unexpected indexed pack path.');
      const source = await read(`game/content/packs/${entry.path}`),
        pack = source.value;
      const checked = validatePack(pack);
      required(checked.valid, checked.errors.join('; '));
      for (const campaign of pack.campaigns)
        add(
          {
            ...campaign,
            classRecipes: pack.classRecipes.filter(
              (r) => !campaign.classIds || campaign.classIds.includes(r.id),
            ),
          },
          pack.themes,
          { kind, path: source.path, bytes: source.bytes, sha256: source.sha256, packId: pack.id },
          pack,
        );
    }
  }
  const optional = prepareOptionalCatalog(
    (await read('game/content/optional-worlds.json', 65536)).value,
  );
  for (const item of optional.packs) {
    const source = await read(item.path),
      pack = source.value;
    required(
      source.bytes === item.bytes && source.sha256 === item.sha256,
      'Optional source pin differs.',
    );
    const checked = validatePack(pack);
    required(checked.valid, checked.errors.join('; '));
    assertOptionalPack(pack, item);
    for (const campaign of pack.campaigns)
      add(
        {
          ...campaign,
          classRecipes: pack.classRecipes.filter(
            (r) => !campaign.classIds || campaign.classIds.includes(r.id),
          ),
        },
        pack.themes,
        {
          kind: 'optional',
          path: source.path,
          bytes: source.bytes,
          sha256: source.sha256,
          packId: pack.id,
        },
        pack,
      );
  }
  const external = prepareExternalCatalog(
    (await read('game/content/external-worlds.json', 65536)).value,
  );
  for (const { descriptor, name } of SOURCE_EXTERNAL_EDITIONS)
    for (const original of descriptor.originals) {
      const owner = {
        baseCampaignKey: descriptor.campaignKey,
        levelId: original.levelId,
        levelRevision: original.levelRevision,
        themeId: descriptor.themeId,
      };
      const id = `picture.${owner.themeId}.${dataIdentity(owner)}`,
        item = external.chapters.find((c) => c.id === descriptor.id);
      rows.set(id, {
        id,
        owner,
        label: `${name} · ${original.levelId}`.slice(0, 120),
        kind: 'external',
        fit: 'contain',
        sampling: 'nearest',
        source: {
          kind: 'external',
          descriptorId: descriptor.id,
          pack: item.pack,
          media: item.media,
        },
        sourceImagePath: sourcePNGs.get(original.sha256) ?? null,
        image: Object.fromEntries(
          ['sha256', 'bytes', 'mime', 'width', 'height'].map((k) => [k, original[k]]),
        ),
        theme: null,
        level: null,
        seed: 0,
        description: 'Exact original pinned by the registered external chapter descriptor.',
        credit:
          'Original project artwork; source attribution is retained in the paired media bundle.',
        license: 'See original media provenance.',
      });
    }
  const result = [...rows.values()].sort(compare);
  required(
    canonicalJSON(result.map(({ id, owner }) => ({ id, owner }))) ===
      canonicalJSON(CURRENT_PICTURES.map(({ id, owner }) => ({ id, owner }))),
    'Current-art locator map must match every current picture owner.',
  );
  return result;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  required(
    process.argv.length === 2 || (process.argv.length === 3 && process.argv[2] === '--write'),
    'Usage: generate-current-art.mjs [--write]',
  );
  const rows = await inventoryCurrentArt();
  if (process.argv[2] === '--write')
    await fs.writeFile(
      path.join(root, 'game/presentation/current-art-sources.mjs'),
      '// Generated by scripts/generate-current-art.mjs. Trusted source locators only; no artwork bytes.\nexport const CURRENT_ART_SOURCES = ' +
        JSON.stringify(rows, null, 2) +
        ';\n',
    );
  console.log(
    JSON.stringify({
      owners: rows.length,
      fpv: rows.filter((r) => r.owner.themeId === 'fpv').length,
      procedural: rows.filter((r) => r.kind === 'procedural').length,
      images: rows.filter((r) => r.image).length,
      sourcePNGs: rows.filter((r) => r.sourceImagePath).length,
    }),
  );
}
