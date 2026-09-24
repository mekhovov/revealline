import {
  boundedJSON,
  canonicalJSON,
  dataIdentity,
  exactKeys,
  required,
  stableId,
} from '../data-json.mjs';
import { compileContentProject } from '../content-design/project.mjs';
import { freezeDesign } from '../content-design/catalogs.mjs';
import { creatorAbort, creatorSHA256, ownCreatorBlob } from './bytes.mjs';
import { CREATOR_IMAGE_LIMITS, prepareCreatorImage } from './image.mjs';
import { generateCreatorProject } from './templates.mjs';

export const CREATOR_BATCH_FORMAT = 'revealline-creator-batch.v1';
export const CREATOR_BATCH_LIMITS = Object.freeze({
  items: 50,
  campaigns: 12,
  checkpointBytes: 256 * 1024,
  packageBytes: 24 * 1024 * 1024,
});

const STATUSES = new Set(['ready', 'failed']);
const packagePlans = new WeakMap();
const hashValid = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const uint32 = (value) => Number.isInteger(value) && value >= 0 && value <= 0xffffffff;
const text = (value, max) =>
  typeof value === 'string' && value.trim().length > 0 && value.length <= max;
const compareText = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const checkpointCopy = (value) =>
  boundedJSON(value, {
    maxBytes: CREATOR_BATCH_LIMITS.checkpointBytes,
    maxNodes: 10000,
    maxDepth: 8,
    maxArray: CREATOR_BATCH_LIMITS.items,
    maxString: 1024,
  });

function naturalParts(value) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .match(/\d+|\D+/gu);
}

/** Locale-independent natural order. Names affect presentation order and default
 * titles only; source hashes and item IDs remain independent of filenames. */
export function compareCreatorFileNames(left, right) {
  const a = naturalParts(left);
  const b = naturalParts(right);
  for (let index = 0; index < Math.min(a.length, b.length); index++) {
    if (a[index] === b[index]) continue;
    const digitsA = /^\d+$/.test(a[index]);
    const digitsB = /^\d+$/.test(b[index]);
    if (digitsA && digitsB) {
      const numeric = BigInt(a[index]) - BigInt(b[index]);
      if (numeric) return numeric < 0 ? -1 : 1;
      if (a[index].length !== b[index].length) return a[index].length - b[index].length;
    }
    const compared = compareText(a[index], b[index]);
    if (compared) return compared;
  }
  return a.length - b.length || compareText(left.normalize('NFKC'), right.normalize('NFKC'));
}

function generationSeed(rootSeed, itemId, sourceSha256, revision) {
  const identity = dataIdentity({ rootSeed, itemId, sourceSha256, revision });
  return Number(BigInt(`0x${identity}`) & 0xffffffffn);
}

function defaultTitle(fileName) {
  const title = fileName.replace(/\.[^.]+$/u, '').trim();
  return (title || 'Picture').slice(0, 160);
}

function validateConfig(source) {
  const value = checkpointCopy(source);
  exactKeys(value, ['draftId', 'name', 'seed', 'fit'], 'batch settings');
  required(
    stableId(value.draftId) && text(value.name, 160) && uint32(value.seed),
    'Choose a batch identity, collection name and unsigned 32-bit seed.',
  );
  required(['contain', 'cover'].includes(value.fit), 'Choose a supported picture fitting mode.');
  return value;
}

function itemDocument(item) {
  return {
    id: item.id,
    sourceSha256: item.sourceSha256,
    sourceBytes: item.sourceBytes,
    fileName: item.fileName,
    title: item.title,
    alt: item.alt,
    fit: item.fit,
    generationRevision: item.generationRevision,
    generationSeed: item.generationSeed,
    status: item.status,
    error: item.error,
    excluded: item.excluded,
  };
}

function batchDocument(batch) {
  return validateCheckpoint({
    format: CREATOR_BATCH_FORMAT,
    draftId: batch.draftId,
    name: batch.name,
    seed: batch.seed,
    items: batch.items.map(itemDocument),
    campaigns: batch.campaigns.map((campaign) => ({
      id: campaign.id,
      name: campaign.name,
      itemIds: [...campaign.itemIds],
    })),
  });
}

function validateCheckpoint(source) {
  const value = checkpointCopy(source);
  exactKeys(value, ['format', 'draftId', 'name', 'seed', 'items', 'campaigns'], 'batch checkpoint');
  required(
    value.format === CREATOR_BATCH_FORMAT &&
      stableId(value.draftId) &&
      text(value.name, 160) &&
      uint32(value.seed),
    'Invalid batch checkpoint identity.',
  );
  required(
    Array.isArray(value.items) &&
      value.items.length >= 1 &&
      value.items.length <= CREATOR_BATCH_LIMITS.items,
    'Batch checkpoint has an invalid item count.',
  );
  const ids = new Set();
  for (const item of value.items) {
    exactKeys(
      item,
      [
        'id',
        'sourceSha256',
        'sourceBytes',
        'fileName',
        'title',
        'alt',
        'fit',
        'generationRevision',
        'generationSeed',
        'status',
        'error',
        'excluded',
      ],
      'batch item',
    );
    required(
      stableId(item.id) &&
        !ids.has(item.id) &&
        hashValid(item.sourceSha256) &&
        Number.isSafeInteger(item.sourceBytes) &&
        item.sourceBytes > 0 &&
        item.sourceBytes <= CREATOR_IMAGE_LIMITS.sourceBytes &&
        text(item.fileName, 255) &&
        !/[\\/\0]/u.test(item.fileName) &&
        text(item.title, 160) &&
        text(item.alt, 512) &&
        ['contain', 'cover'].includes(item.fit) &&
        Number.isInteger(item.generationRevision) &&
        item.generationRevision >= 0 &&
        item.generationRevision <= 1000 &&
        uint32(item.generationSeed) &&
        STATUSES.has(item.status) &&
        (item.error === null || text(item.error, 512)) &&
        typeof item.excluded === 'boolean',
      'Invalid batch item.',
    );
    required(
      item.generationSeed ===
        generationSeed(value.seed, item.id, item.sourceSha256, item.generationRevision),
      'Batch item generation seed differs from its deterministic recipe.',
    );
    required(
      (item.status === 'ready' && item.error === null) ||
        (item.status === 'failed' && item.error !== null),
      'Batch item status and error disagree.',
    );
    ids.add(item.id);
  }
  required(
    Array.isArray(value.campaigns) &&
      value.campaigns.length >= 1 &&
      value.campaigns.length <= CREATOR_BATCH_LIMITS.campaigns,
    'Batch checkpoint has an invalid campaign count.',
  );
  const campaignIds = new Set();
  const membership = new Set();
  for (const campaign of value.campaigns) {
    exactKeys(campaign, ['id', 'name', 'itemIds'], 'batch campaign');
    required(
      stableId(campaign.id) &&
        !campaignIds.has(campaign.id) &&
        text(campaign.name, 160) &&
        Array.isArray(campaign.itemIds) &&
        campaign.itemIds.length >= 1,
      'Invalid batch campaign.',
    );
    for (const id of campaign.itemIds) {
      required(ids.has(id) && !membership.has(id), 'Batch campaigns must assign every item once.');
      membership.add(id);
    }
    campaignIds.add(campaign.id);
  }
  required(membership.size === ids.size, 'Batch campaigns must assign every item once.');
  return freezeDesign(value);
}

function createState({ document, items }) {
  const byId = new Map(items.map((item) => [item.id, item]));
  required(
    document.items.every((item) => byId.has(item.id)),
    'Batch runtime items differ from its checkpoint.',
  );
  return Object.freeze({
    format: CREATOR_BATCH_FORMAT,
    draftId: document.draftId,
    name: document.name,
    seed: document.seed,
    items: Object.freeze(document.items.map((item) => Object.freeze(byId.get(item.id)))),
    campaigns: Object.freeze(
      document.campaigns.map((campaign) =>
        Object.freeze({ ...campaign, itemIds: Object.freeze([...campaign.itemIds]) }),
      ),
    ),
  });
}

async function notifyCheckpoint(batch, onCheckpoint) {
  if (onCheckpoint) await onCheckpoint(batchDocument(batch));
}

async function prepareOne(item, batch, { signal, prepareImage, onActivity }) {
  creatorAbort(signal);
  onActivity?.({ stage: 'prepare', itemId: item.id, activeFullSize: 1 });
  try {
    const image = await prepareImage(item.source, { alt: item.alt, fit: item.fit }, { signal });
    creatorAbort(signal);
    const base = generateCreatorProject({
      id: item.id,
      name: batch.name,
      seed: item.generationSeed,
    });
    const project = structuredClone(base.project);
    const mapId = `${item.id}-map`;
    project.maps[0].id = mapId;
    project.missions[0].id = item.id;
    project.missions[0].map.id = mapId;
    project.campaigns[0].missionIds = [item.id];
    const asset = structuredClone(image.asset);
    asset.id = `${item.id}-asset`;
    project.assets = [asset];
    project.missions[0].name = item.title;
    project.missions[0].presentation.backgroundAssetId = asset.id;
    const compiledProject = compileContentProject(project).source;
    const generated = freezeDesign({
      project: compiledProject,
      provenance: { ...base.provenance, missionId: item.id },
    });
    return Object.freeze({
      ...item,
      status: 'ready',
      error: null,
      image,
      generated,
      project: compiledProject,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    return Object.freeze({
      ...item,
      status: 'failed',
      error: String(error?.message ?? error).slice(0, 512) || 'Picture preparation failed.',
      image: null,
      generated: null,
      project: null,
    });
  } finally {
    onActivity?.({ stage: 'prepare', itemId: item.id, activeFullSize: 0 });
  }
}

function inputMetadata(input, index, defaultFit) {
  required(input && typeof input === 'object', `Picture ${index + 1} is invalid.`);
  const fileName = input.name;
  required(
    text(fileName, 255) && !/[\\/\0]/u.test(fileName),
    `Picture ${index + 1} needs a safe filename.`,
  );
  const source = ownCreatorBlob(input.blob, CREATOR_IMAGE_LIMITS.sourceBytes, fileName);
  const title = input.title ?? defaultTitle(fileName);
  const alt = input.alt ?? title;
  const fit = input.fit ?? defaultFit;
  required(
    text(title, 160) && text(alt, 512),
    `${fileName} needs a bounded title and description.`,
  );
  required(['contain', 'cover'].includes(fit), `${fileName} has an unsupported fitting mode.`);
  return { source, fileName, title: title.trim(), alt: alt.trim(), fit, index };
}

/** Inspect and prepare all inputs serially. A checkpoint is emitted after each
 * item, and item-level failures remain attached for review and explicit exclusion. */
export async function prepareCreatorBatch(
  inputs,
  settings,
  { signal, prepareImage = prepareCreatorImage, onCheckpoint, onActivity } = {},
) {
  const config = validateConfig(settings);
  required(
    Array.isArray(inputs) && inputs.length >= 1 && inputs.length <= CREATOR_BATCH_LIMITS.items,
    `Choose 1 to ${CREATOR_BATCH_LIMITS.items} pictures.`,
  );
  const inspected = [];
  for (let index = 0; index < inputs.length; index++) {
    creatorAbort(signal);
    const metadata = inputMetadata(inputs[index], index, config.fit);
    onActivity?.({ stage: 'hash', itemId: null, activeFullSize: 1 });
    try {
      const bytes = await metadata.source.arrayBuffer();
      creatorAbort(signal);
      inspected.push({ ...metadata, sourceSha256: await creatorSHA256(bytes) });
    } finally {
      onActivity?.({ stage: 'hash', itemId: null, activeFullSize: 0 });
    }
  }
  const duplicateCounts = new Map();
  for (const item of inspected) {
    const occurrence = (duplicateCounts.get(item.sourceSha256) ?? 0) + 1;
    duplicateCounts.set(item.sourceSha256, occurrence);
    item.id = `picture-${item.sourceSha256.slice(0, 32)}${occurrence === 1 ? '' : `-${occurrence}`}`;
  }
  inspected.sort(
    (a, b) =>
      compareCreatorFileNames(a.fileName, b.fileName) ||
      compareText(a.sourceSha256, b.sourceSha256) ||
      a.index - b.index,
  );
  const pending = inspected.map((item) => ({
    id: item.id,
    sourceSha256: item.sourceSha256,
    sourceBytes: item.source.size,
    source: item.source,
    fileName: item.fileName,
    title: item.title,
    alt: item.alt,
    fit: item.fit,
    generationRevision: 0,
    generationSeed: generationSeed(config.seed, item.id, item.sourceSha256, 0),
    status: 'failed',
    error: 'Picture preparation has not completed.',
    excluded: false,
    image: null,
    generated: null,
    project: null,
  }));
  let batch = {
    format: CREATOR_BATCH_FORMAT,
    draftId: config.draftId,
    name: config.name.trim(),
    seed: config.seed,
    items: pending,
    campaigns: [
      { id: 'pictures', name: config.name.trim(), itemIds: pending.map((item) => item.id) },
    ],
  };
  for (let index = 0; index < batch.items.length; index++) {
    const item = await prepareOne(batch.items[index], batch, { signal, prepareImage, onActivity });
    batch = { ...batch, items: batch.items.with(index, item) };
    await notifyCheckpoint(batch, onCheckpoint);
  }
  return createState({ document: batchDocument(batch), items: batch.items });
}

export function serializeCreatorBatchCheckpoint(batch) {
  return canonicalJSON(batchDocument(batch));
}

export function parseCreatorBatchCheckpoint(source) {
  return validateCheckpoint(source);
}

/** Reopening binds sources by SHA-256, never by mutable filenames. */
export async function reopenCreatorBatchCheckpoint(
  source,
  sources,
  { signal, prepareImage = prepareCreatorImage, onCheckpoint, onActivity } = {},
) {
  const document = validateCheckpoint(source);
  required(Array.isArray(sources) && sources.length >= 1, 'Select the retained source pictures.');
  const blobs = new Map();
  for (const candidate of sources) {
    creatorAbort(signal);
    const blob = ownCreatorBlob(candidate, CREATOR_IMAGE_LIMITS.sourceBytes, 'Source picture');
    onActivity?.({ stage: 'hash', itemId: null, activeFullSize: 1 });
    try {
      const hash = await creatorSHA256(await blob.arrayBuffer());
      creatorAbort(signal);
      if (!blobs.has(hash)) blobs.set(hash, blob);
    } finally {
      onActivity?.({ stage: 'hash', itemId: null, activeFullSize: 0 });
    }
  }
  const items = document.items.map((item) => {
    const blob = blobs.get(item.sourceSha256);
    required(blob && blob.size === item.sourceBytes, `${item.fileName} source bytes are missing.`);
    return { ...item, source: blob, image: null, generated: null, project: null };
  });
  let batch = { ...document, items };
  for (let index = 0; index < items.length; index++) {
    const item = await prepareOne(batch.items[index], batch, { signal, prepareImage, onActivity });
    batch = { ...batch, items: batch.items.with(index, item) };
    await notifyCheckpoint(batch, onCheckpoint);
  }
  return createState({ document: batchDocument(batch), items: batch.items });
}

function updateState(batch, items, campaigns = batch.campaigns) {
  const candidate = { ...batch, items, campaigns };
  return createState({ document: batchDocument(candidate), items });
}

export function setCreatorBatchItemExcluded(batch, itemId, excluded = true) {
  required(typeof excluded === 'boolean', 'Excluded state must be explicit.');
  let found = false;
  const items = batch.items.map((item) => {
    if (item.id !== itemId) return item;
    found = true;
    return Object.freeze({ ...item, excluded });
  });
  required(found, 'Batch item is missing.');
  return updateState(batch, items);
}

export function reorderCreatorBatchItems(batch, itemIds) {
  required(
    Array.isArray(itemIds) &&
      itemIds.length === batch.items.length &&
      new Set(itemIds).size === itemIds.length,
    'Reorder must include every batch item exactly once.',
  );
  const items = new Map(batch.items.map((item) => [item.id, item]));
  required(
    itemIds.every((id) => items.has(id)),
    'Reorder contains an unknown batch item.',
  );
  const rank = new Map(itemIds.map((id, index) => [id, index]));
  const campaigns = batch.campaigns.map((campaign) => ({
    ...campaign,
    itemIds: [...campaign.itemIds].sort((a, b) => rank.get(a) - rank.get(b)),
  }));
  return updateState(
    batch,
    itemIds.map((id) => items.get(id)),
    campaigns,
  );
}

export function setCreatorBatchCampaigns(batch, campaigns) {
  const candidate = campaigns.map((campaign) => ({
    id: campaign.id,
    name: campaign.name,
    itemIds: [...campaign.itemIds],
  }));
  return updateState(batch, batch.items, candidate);
}

export async function regenerateCreatorBatchItem(
  batch,
  itemId,
  { signal, prepareImage = prepareCreatorImage, onActivity } = {},
) {
  const index = batch.items.findIndex((item) => item.id === itemId);
  required(index >= 0, 'Batch item is missing.');
  const previous = batch.items[index];
  const revision = previous.generationRevision + 1;
  required(revision <= 1000, 'This item reached its regeneration limit.');
  const pending = {
    ...previous,
    generationRevision: revision,
    generationSeed: generationSeed(batch.seed, previous.id, previous.sourceSha256, revision),
  };
  const item = await prepareOne(pending, batch, { signal, prepareImage, onActivity });
  return updateState(batch, batch.items.with(index, item));
}

/** Compose only reviewed, included items. Failed items must be explicitly excluded
 * so approval cannot silently omit them. */
function assembleCreatorBatchSelection(batch, selectedItemIds = null) {
  const unresolved = batch.items.filter((item) => item.status !== 'ready' && !item.excluded);
  required(
    unresolved.length === 0,
    'Exclude each failed item or regenerate it before preparing the campaign.',
  );
  const selected = selectedItemIds ? new Set(selectedItemIds) : null;
  if (selected)
    required(
      selected.size === selectedItemIds.length &&
        selectedItemIds.every((id) => batch.items.some((item) => item.id === id)),
      'Package part must select known items exactly once.',
    );
  const included = batch.items.filter(
    (item) => !item.excluded && (!selected || selected.has(item.id)),
  );
  required(included.length >= 1, 'Keep at least one ready item in the campaign.');
  required(
    included.every((item) => item.project && item.generated),
    'Regenerate missing batch output.',
  );
  const project = structuredClone(included[0].project);
  project.id = batch.draftId;
  project.name = batch.name;
  project.maps = [];
  project.missions = [];
  project.assets = [];
  for (const item of included) {
    project.maps.push(...structuredClone(item.project.maps));
    project.missions.push(...structuredClone(item.project.missions));
    project.assets.push(...structuredClone(item.project.assets));
  }
  const includedIds = new Set(included.map((item) => item.id));
  project.campaigns = batch.campaigns
    .map((campaign) => ({
      format: 'CampaignDesignV1',
      id: campaign.id,
      revision: '1',
      name: campaign.name,
      band: 1,
      missionIds: campaign.itemIds.filter((id) => includedIds.has(id)),
    }))
    .filter((campaign) => campaign.missionIds.length);
  project.packs = [
    {
      format: 'PackDesignV1',
      id: 'collection',
      revision: '1',
      name: batch.name,
      campaignIds: project.campaigns.map((campaign) => campaign.id),
    },
  ];
  return freezeDesign({
    project: compileContentProject(project).source,
    packId: 'collection',
    provenance: included.map((item) => item.generated.provenance),
    itemIds: included.map((item) => item.id),
  });
}

export function assembleCreatorBatchProject(batch) {
  return assembleCreatorBatchSelection(batch);
}

/** Materialize one explicit split-plan part. Every mission, campaign, map and
 * runtime picture is closed over that part; no selected item is silently lost. */
export function assembleCreatorBatchPackage(batch, plan, part) {
  required(packagePlans.get(plan) === batch, 'Recalculate the package plan for this batch.');
  required(Number.isInteger(part) && part >= 1, 'Choose a package part.');
  required(
    plan.decision !== 'review-required' && plan.decision !== 'cannot-fit',
    'Resolve every failed or oversized item before preparing package parts.',
  );
  const selected = plan.packages.find((entry) => entry.part === part);
  required(selected, 'Choose a package part from the reviewed plan.');
  const assembled = assembleCreatorBatchSelection(batch, selected.itemIds);
  const selectedItems = new Map(batch.items.map((item) => [item.id, item]));
  const assets = [];
  const hashes = new Set();
  for (const itemId of selected.itemIds) {
    const item = selectedItems.get(itemId);
    const sha256 = item.image.runtime.sha256;
    if (!hashes.has(sha256)) assets.push(Object.freeze({ sha256, blob: item.image.runtime.blob }));
    hashes.add(sha256);
  }
  required(
    assembled.project.assets.every((asset) => hashes.has(asset.sha256)),
    'Package part is missing a runtime picture dependency.',
  );
  return Object.freeze({
    ...assembled,
    assets: Object.freeze(assets),
    part,
    parts: plan.packages.length,
  });
}

/** Produce an explicit greedy transfer decision using actual runtime byte sizes.
 * Every eligible item appears in a package or in unassigned with a reason. */
export function planCreatorBatchPackages(
  batch,
  {
    maxBytes = CREATOR_BATCH_LIMITS.packageBytes,
    reserveBytes = 256 * 1024,
    perItemOverheadBytes = 16 * 1024,
  } = {},
) {
  required(
    Number.isSafeInteger(maxBytes) &&
      Number.isSafeInteger(reserveBytes) &&
      Number.isSafeInteger(perItemOverheadBytes) &&
      maxBytes > 0 &&
      reserveBytes >= 0 &&
      perItemOverheadBytes >= 0 &&
      reserveBytes < maxBytes,
    'Invalid package capacity.',
  );
  const eligible = batch.items.filter((item) => !item.excluded && item.status === 'ready');
  const packages = [];
  const failed = batch.items.filter((item) => !item.excluded && item.status === 'failed');
  const unassigned = failed.map((item) =>
    Object.freeze({
      itemId: item.id,
      requiredBytes: null,
      reason: 'item-not-ready',
    }),
  );
  let oversized = false;
  let current = null;
  for (const item of eligible) {
    const runtimeBytes = item.image?.runtime?.blob?.size;
    required(
      Number.isSafeInteger(runtimeBytes) && runtimeBytes > 0,
      'Prepared picture bytes are missing.',
    );
    const itemBytes = runtimeBytes + perItemOverheadBytes;
    if (reserveBytes + itemBytes > maxBytes) {
      oversized = true;
      unassigned.push(
        Object.freeze({
          itemId: item.id,
          requiredBytes: reserveBytes + itemBytes,
          reason: 'item-exceeds-package-capacity',
        }),
      );
      continue;
    }
    if (!current || current.estimatedBytes + itemBytes > maxBytes) {
      current = { itemIds: [], estimatedBytes: reserveBytes };
      packages.push(current);
    }
    current.itemIds.push(item.id);
    current.estimatedBytes += itemBytes;
  }
  const result = {
    decision: failed.length
      ? 'review-required'
      : oversized
        ? 'cannot-fit'
        : packages.length <= 1
          ? 'single-package'
          : 'split-required',
    maxBytes,
    reserveBytes,
    perItemOverheadBytes,
    selectedItemIds: batch.items.filter((item) => !item.excluded).map((item) => item.id),
    eligibleItemIds: eligible.map((item) => item.id),
    excludedItemIds: batch.items.filter((item) => item.excluded).map((item) => item.id),
    failedItemIds: failed.map((item) => item.id),
    packages: packages.map((entry, index) =>
      Object.freeze({
        part: index + 1,
        itemIds: Object.freeze(entry.itemIds),
        estimatedBytes: entry.estimatedBytes,
      }),
    ),
    unassigned: Object.freeze(unassigned),
  };
  const frozen = freezeDesign(result);
  packagePlans.set(frozen, batch);
  return frozen;
}
