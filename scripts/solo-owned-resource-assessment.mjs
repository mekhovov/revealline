// Paused, post-readback evidence analysis only. This module does not open a
// browser, alter a raw verdict, establish process memory, or grant qualification.
import assert from 'node:assert/strict';

const MiB = 1024 ** 2;
export const OWNED_RESOURCE_LIMITS = Object.freeze({
  snapshots: 512,
  effectPCMBytes: 32 * MiB,
  publishedPCMBytes: 32 * MiB,
  reactionPCMBytes: 12 * MiB,
  reactionBuffers: 24,
  reactionLoads: 2,
  reactionDecodeBytes: 6 * MiB,
  legacyPixels: 16 * MiB,
  admissionDecodeBytes: 16 * MiB,
  trackBytes: 32 * MiB,
  decks: 2,
});
const phases = new Set(['menu', 'preparing', 'playing', 'paused', 'suspended']);
const canvasCategories = [
  'staticLayers',
  'sourceArt',
  'battlefieldGround',
  'adaptedSprites',
  'signalNoise',
  'jammerSurface',
  'jammerNoise',
  'demoConcealment',
];
const imageCategories = [
  'pagePresentation',
  'activePresentation',
  'actorAppearance',
  'activeBackdrop',
];
const read = (value, path) => path.split('.').reduce((item, key) => item?.[key], value);

/** The caller must first perform its existing report/chunk/source readback.
 * Bounds apply to the current exported owner model, not arbitrary applications.
 * Every snapshot is checked, including earlier and failed-attempt boundaries.
 * The selected group only determines the final comparable trend window.
 */
export function assessSoloOwnedResources(report, { group = 'completed', last = 10 } = {}) {
  assert.equal(report?.format, 'SoloQualificationReportV1');
  assert(Array.isArray(report.snapshots));
  assert(report.snapshots.length <= OWNED_RESOURCE_LIMITS.snapshots, 'Snapshot assessment cap');
  assert(typeof group === 'string' && /^[a-z0-9-]{1,80}$/.test(group));
  assert(Number.isSafeInteger(last) && last >= 3 && last <= OWNED_RESOURCE_LIMITS.snapshots);
  const rows = [];
  const paths = new Set();
  const pendingPaths = new Set();
  for (const [index, snapshot] of report.snapshots.entries()) {
    const resources = snapshot?.application?.resources;
    const validGroup =
      typeof snapshot?.group === 'string' && /^[a-z0-9-]{1,80}$/.test(snapshot.group);
    const row = {
      index,
      group: validGroup ? snapshot.group : null,
      failures: [],
      unknown: [],
      values: {},
    };
    const issue = (kind, path, code) => row[kind].push({ path, code });
    if (!validGroup) issue('failures', 'group', 'invalid-boundary-group');
    const number = (
      path,
      { maximum = Number.MAX_SAFE_INTEGER, expected, pending = false } = {},
    ) => {
      paths.add(path);
      if (pending) pendingPaths.add(path);
      const value = read(resources, path);
      row.values[path] = null;
      if (value === undefined || value === null) issue('unknown', path, 'missing-counter');
      else if (!Number.isSafeInteger(value) || value < 0)
        issue('failures', path, 'invalid-nonnegative-integer');
      else {
        row.values[path] = value;
        if (value > maximum) issue('failures', path, 'source-limit-exceeded');
        if (expected !== undefined && value !== expected)
          issue('failures', path, 'source-constant-disagrees');
      }
      return row.values[path];
    };
    const boolean = (path) => {
      paths.add(path);
      const value = read(resources, path);
      row.values[path] = null;
      if (value === undefined || value === null) issue('unknown', path, 'missing-counter');
      else if (typeof value !== 'boolean') issue('failures', path, 'invalid-boolean');
      else row.values[path] = Number(value);
      return row.values[path];
    };
    const equal = (path, actual, expected) => {
      if (actual !== null && expected !== null && actual !== expected)
        issue('failures', path, 'accounting-disagrees');
    };
    const sum = (values) => {
      if (values.some((value) => value === null)) return null;
      const result = values.reduce((total, value) => total + value, 0);
      if (!Number.isSafeInteger(result)) {
        issue('failures', 'accounting', 'sum-overflow');
        return null;
      }
      return result;
    };
    const pixels = (path, count = 'canvases') => {
      const n = number(`${path}.${count}`);
      const p = number(`${path}.pixels`, { maximum: Math.floor(Number.MAX_SAFE_INTEGER / 4) });
      const bytes = number(`${path}.rgbaBytesEstimate`);
      equal(`${path}.rgbaBytesEstimate`, bytes, p === null ? null : p * 4);
      if (n === 0 && p > 0) issue('failures', path, 'pixels-without-owner');
      return { count: n, pixels: p, bytes };
    };
    const renderer = pixels('renderer.ownedCanvases');
    const categories = canvasCategories.map((name) =>
      pixels(`renderer.ownedCanvases.categories.${name}`),
    );
    for (const key of ['count', 'pixels', 'bytes'])
      equal(
        `renderer.ownedCanvases.${key}`,
        renderer[key],
        sum(categories.map((item) => item[key])),
      );
    const retained = number('renderer.ownedCanvases.retainedPixelBufferBytes');
    equal(
      'renderer.ownedCanvases.retainedPixelBufferBytes',
      retained,
      number('renderer.ownedCanvases.categories.demoConcealment.pixelBufferBytes'),
    );
    const legacyReserved = number('renderer.legacyImages.reservedPixels');
    const legacyRetained = number('renderer.legacyImages.retainedPixels');
    number('renderer.legacyImages.pixelLimit', { expected: OWNED_RESOURCE_LIMITS.legacyPixels });
    const legacyTotal = sum([legacyReserved, legacyRetained]);
    if (legacyTotal !== null && legacyTotal > OWNED_RESOURCE_LIMITS.legacyPixels)
      issue('failures', 'renderer.legacyImages', 'source-limit-exceeded');
    number('renderer.legacyImages.active', { maximum: 1, pending: true });
    number('renderer.legacyImages.pending', { pending: true });
    for (const key of ['entries', 'reservedBytes', 'decodedBytes', 'ownedLeases'])
      number(`renderer.enemyImages.${key}`);
    number('renderer.enemyImages.active', { maximum: 1, pending: true });
    number('renderer.enemyImages.queued', { pending: true });

    const phaser = pixels('phaser', 'uniqueCanvases');
    if (phaser.count > 2) issue('failures', 'phaser.uniqueCanvases', 'source-limit-exceeded');
    const surfaces = ['displayed', 'detachedBoard'].map((name) => {
      const path = `phaser.${name}`;
      const dimensions = pixels(path);
      const width = number(`${path}.width`),
        height = number(`${path}.height`);
      equal(
        `${path}.pixels`,
        dimensions.pixels,
        width === null || height === null ? null : width * height,
      );
      return { ...dimensions, width, height };
    });
    if (phaser.count === 2)
      equal('phaser.pixels', phaser.pixels, sum(surfaces.map((item) => item.pixels)));
    if (phaser.count === 0) {
      equal('phaser.pixels', phaser.pixels, 0);
      for (const item of surfaces) {
        equal('phaser.surfaces', item.count, 0);
        equal('phaser.surfaces', item.pixels, 0);
      }
    }
    if (phaser.count === 1) {
      const populated = surfaces.filter((item) => item.pixels > 0);
      if (surfaces.every((item) => item.pixels !== null))
        equal('phaser.pixels', phaser.pixels, populated[0]?.pixels ?? 0);
      if (populated.length === 2)
        for (const key of ['pixels', 'width', 'height'])
          equal(`phaser.sharedSurface.${key}`, populated[0][key], populated[1][key]);
    }

    const images = pixels('sharedPresentationImages.uniqueObserved', 'images');
    const imageRows = imageCategories.map((name) =>
      pixels(`sharedPresentationImages.categories.${name}`, 'images'),
    );
    const refs = number('sharedPresentationImages.sharedCategoryReferences');
    const imageCount = sum(imageRows.map((item) => item.count));
    equal(
      'sharedPresentationImages.sharedCategoryReferences',
      refs,
      imageCount === null || images.count === null ? null : imageCount - images.count,
    );
    for (const prefix of ['uniqueObserved', ...imageCategories.map((name) => `categories.${name}`)])
      if (number(`sharedPresentationImages.${prefix}.unknownDimensions`) > 0)
        issue('unknown', `sharedPresentationImages.${prefix}`, 'unobserved-image-dimensions');
    if (number('sharedPresentationImages.unavailableSnapshots') > 0)
      issue('unknown', 'sharedPresentationImages', 'unavailable-image-owner');

    for (const [owner, limit] of [
      ['effects', OWNED_RESOURCE_LIMITS.effectPCMBytes],
      ['published', OWNED_RESOURCE_LIMITS.publishedPCMBytes],
      ['reactions', OWNED_RESOURCE_LIMITS.reactionPCMBytes],
    ]) {
      number(`pcm.${owner}.decodedBytes`, { maximum: limit });
      number(`pcm.${owner}.decodedBytesLimit`, { expected: limit });
      number(
        `pcm.${owner}.${owner === 'published' ? 'cacheEntries' : 'buffers'}`,
        owner === 'reactions' ? { maximum: 24 } : {},
      );
      number(`pcm.${owner}.loading`, {
        pending: true,
        ...(owner === 'reactions' ? { maximum: OWNED_RESOURCE_LIMITS.reactionLoads } : {}),
      });
    }
    number('pcm.reactions.buffersLimit', { expected: OWNED_RESOURCE_LIMITS.reactionBuffers });
    number('pcm.reactions.perDecodeBytesLimit', {
      expected: OWNED_RESOURCE_LIMITS.reactionDecodeBytes,
    });
    boolean('pcm.reactions.closed');
    number('pcm.proceduralNoise.buffers', { maximum: 1 });
    number('pcm.proceduralNoise.decodedBytes');
    if (read(resources, 'pcm.proceduralNoise.durationLimitSeconds') === undefined)
      issue('unknown', 'pcm.proceduralNoise.durationLimitSeconds', 'missing-counter');
    else if (read(resources, 'pcm.proceduralNoise.durationLimitSeconds') !== 0.25)
      issue('failures', 'pcm.proceduralNoise.durationLimitSeconds', 'source-constant-disagrees');

    for (const prefix of ['media', 'soundtrack.admission']) {
      const phase = read(resources, `${prefix}.phase`);
      if (phase === undefined || phase === null)
        issue('unknown', `${prefix}.phase`, 'missing-phase');
      else if (!phases.has(phase)) issue('failures', `${prefix}.phase`, 'invalid-phase');
      number(`${prefix}.queued`, { pending: true });
      for (const [kind, maximum] of [
        ['fetch', 2],
        ['decode', 1],
        ['inspect', 1],
        ['main', 1],
      ])
        number(`${prefix}.active.${kind}`, { maximum, pending: true });
      number(`${prefix}.reservedDecodeBytes`, {
        maximum: OWNED_RESOURCE_LIMITS.admissionDecodeBytes,
        pending: true,
      });
    }
    const owned = boolean('soundtrack.inspection.workerOwned');
    const active = boolean('soundtrack.inspection.workerActive');
    const requests = number('soundtrack.inspection.pendingRequests', { pending: true });
    const inspectBytes = number('soundtrack.inspection.workerOwnedBytes', { pending: true });
    if (active === 1 && (owned === 0 || requests === 0))
      issue('failures', 'soundtrack.inspection', 'active-worker-without-owner-or-request');
    if (requests === 0 && inspectBytes > 0)
      issue('failures', 'soundtrack.inspection', 'bytes-without-request');
    if (
      requests !== null &&
      inspectBytes !== null &&
      inspectBytes / OWNED_RESOURCE_LIMITS.trackBytes > requests
    )
      issue('failures', 'soundtrack.inspection.workerOwnedBytes', 'source-limit-exceeded');
    const deckCount = number('soundtrack.playback.ownedBlobURLCount', { maximum: 2 });
    const deckBytes = number('soundtrack.playback.ownedBlobBytes', {
      maximum: 2 * OWNED_RESOURCE_LIMITS.trackBytes,
    });
    const decks = read(resources, 'soundtrack.playback.decks');
    if (decks === undefined || decks === null)
      issue('unknown', 'soundtrack.playback.decks', 'missing-decks');
    else if (!Array.isArray(decks) || decks.length > 2 || decks.length < 1)
      issue('failures', 'soundtrack.playback.decks', 'invalid-deck-count');
    else {
      const counts = [],
        bytes = [];
      for (let i = 0; i < decks.length; i++) {
        const prefix = `soundtrack.playback.decks.${i}`;
        number(`${prefix}.index`, { expected: i });
        const count = number(`${prefix}.ownedBlobURLCount`, { maximum: 1 });
        const size = number(`${prefix}.ownedBlobBytes`, {
          maximum: OWNED_RESOURCE_LIMITS.trackBytes,
        });
        counts.push(count);
        bytes.push(size);
        if ((count === 0 && size > 0) || (count === 1 && size === 0))
          issue('failures', prefix, 'blob-owner-bytes-disagree');
      }
      equal('soundtrack.playback.ownedBlobURLCount', deckCount, sum(counts));
      equal('soundtrack.playback.ownedBlobBytes', deckBytes, sum(bytes));
    }
    const revokeCount = number('soundtrack.playback.failedRevocationCount');
    const revokeBytes = number('soundtrack.playback.failedRevocationBytes');
    if (revokeCount === 0 && revokeBytes > 0)
      issue('failures', 'soundtrack.playback', 'revocation-counters-disagree');
    if (revokeCount > 0 || revokeBytes > 0)
      issue('unknown', 'soundtrack.playback', 'browser-release-uncertain');
    rows.push(row);
  }
  const selected = rows.filter((row) => row.group === group).slice(-last);
  const series = [...paths].sort().map((path) => {
    const values = selected.map((row) => row.values[path] ?? null);
    const observed = values.length === last && values.every((value) => value !== null);
    const minimum = observed ? Math.min(...values) : null;
    const maximum = observed ? Math.max(...values) : null;
    return {
      path,
      values,
      status: !observed
        ? 'unobserved'
        : minimum === maximum
          ? 'observed-flat'
          : 'requires-owner-trend-review',
      minimum,
      maximum,
      firstToLast: observed ? values.at(-1) - values[0] : null,
    };
  });
  const failures = rows.reduce((n, row) => n + row.failures.length, 0);
  const unknown = rows.reduce((n, row) => n + row.unknown.length, 0);
  const complete = rows.length > 0 && !unknown;
  const pending = series.filter((item) => pendingPaths.has(item.path));
  return {
    format: 'SoloOwnedResourceAssessmentV1',
    sourceRevision:
      typeof report.sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(report.sourceRevision)
        ? report.sourceRevision
        : null,
    rawFailurePresent: Boolean(report.failure),
    rawPerformanceGateStatus:
      typeof report.performanceGateStatus === 'string' &&
      /^[a-z0-9-]{1,64}$/.test(report.performanceGateStatus)
        ? report.performanceGateStatus
        : null,
    bounds: {
      status: failures ? 'fail' : complete ? 'pass' : 'inconclusive',
      failures,
      unknown,
      checkedSnapshots: rows.length,
    },
    retention: {
      status:
        selected.length !== last || series.some((item) => item.status === 'unobserved')
          ? 'inconclusive'
          : 'requires-owner-trend-review',
      group,
      requested: last,
      observed: selected.length,
      pendingAtObservedBoundaries: pending.some((item) => item.status === 'unobserved')
        ? 'unobserved'
        : pending.some((item) => item.maximum > 0)
          ? 'observed-pending'
          : 'observed-idle',
      series,
    },
    rows,
    gameplayQualification: false,
    nativeMemoryQualification: false,
    scope:
      'Source-proved owner bounds and exact counters only. Flat values are observations, not a new retention tolerance or a leak verdict. Reservations, PCM, compressed originals and overlapping image pools are not summed. Native/GPU/process memory and active voices are unobserved. Raw failures remain authoritative.',
  };
}
