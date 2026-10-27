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
export function assessSoloOwnedResources(report, { group = 'completed', last = 10, demo } = {}) {
  assert.equal(report?.format, 'SoloQualificationReportV1');
  assert(Array.isArray(report.snapshots));
  assert(report.snapshots.length <= OWNED_RESOURCE_LIMITS.snapshots, 'Snapshot assessment cap');
  assert(typeof group === 'string' && /^[a-z0-9-]{1,80}$/.test(group));
  assert(Number.isSafeInteger(last) && last >= 3 && last <= OWNED_RESOURCE_LIMITS.snapshots);
  if (demo !== undefined) {
    assert.equal(demo?.format, 'DemoOwnedResourcesV1', 'Explicit Demo resource schema required');
    assert(
      typeof demo.sourceRevision === 'string' && /^[a-f0-9]{40}$/.test(demo.sourceRevision),
      'Exact Demo source revision required',
    );
    assert.equal(demo.sourceRevision, report.sourceRevision, 'Demo source revision mismatch');
  }
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
    const ownership = (path, bootstrap = false) => {
      const value = read(resources, path);
      if (value === undefined) return null; // Historical missing counters stay unknown.
      const expected = ['format', 'state', ...(bootstrap ? ['bootstrapMediaElementCreated'] : [])];
      const states = [
        'never-created',
        'creating',
        'active',
        'retired',
        'failed',
        'disposed',
        'unavailable',
      ];
      if (
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== expected.length ||
        !expected.every((key) => Object.hasOwn(value, key)) ||
        value.format !== 'SoloOptionalOwnerStateV1' ||
        !states.includes(value.state) ||
        (bootstrap && typeof value.bootstrapMediaElementCreated !== 'boolean')
      ) {
        issue('failures', path, 'invalid-owner-lifecycle');
        return 'invalid';
      }
      (row.ownership ??= {})[path] = { ...value };
      if (
        bootstrap &&
        ['creating', 'active'].includes(value.state) &&
        !value.bootstrapMediaElementCreated
      )
        issue('failures', path, 'player-without-bootstrap');
      if (!['never-created', 'active'].includes(value.state))
        issue('unknown', path, 'owner-not-active');
      return value.state;
    };
    const publishedOwner = ownership('pcm.publishedOwner');
    const soundtrackOwner = ownership('soundtrackOwner', true);
    if (!validGroup) issue('failures', 'group', 'invalid-boundary-group');
    const number = (
      path,
      { maximum = Number.MAX_SAFE_INTEGER, expected, pending = false, record = true } = {},
      value = read(resources, path),
    ) => {
      if (record) paths.add(path);
      if (pending) pendingPaths.add(path);
      let result = null;
      if (value === undefined || value === null) issue('unknown', path, 'missing-counter');
      else if (!Number.isSafeInteger(value) || value < 0)
        issue('failures', path, 'invalid-nonnegative-integer');
      else {
        result = value;
        if (value > maximum) issue('failures', path, 'source-limit-exceeded');
        if (expected !== undefined && value !== expected)
          issue('failures', path, 'source-constant-disagrees');
      }
      if (record) row.values[path] = result;
      return result;
    };
    const boolean = (path, { pending = false } = {}, value = read(resources, path)) => {
      paths.add(path);
      if (pending) pendingPaths.add(path);
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
    const pixels = (path, count = 'canvases', options = {}) => {
      const n = number(`${path}.${count}`, options);
      const p = number(`${path}.pixels`, {
        ...options,
        maximum: Math.floor(Number.MAX_SAFE_INTEGER / 4),
      });
      const bytes = number(`${path}.rgbaBytesEstimate`, options);
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
    if (publishedOwner === 'never-created')
      for (const name of ['decodedBytes', 'cacheEntries', 'loading'])
        if (read(resources, `pcm.published.${name}`) !== 0)
          issue('failures', `pcm.published.${name}`, 'never-created-owner-disagrees');
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
    if (soundtrackOwner !== null && soundtrackOwner !== 'invalid')
      for (const name of [
        'phase',
        'queued',
        'reservedDecodeBytes',
        'active.fetch',
        'active.decode',
        'active.inspect',
        'active.main',
      ]) {
        const shared = read(resources, `media.${name}`);
        const player = read(resources, `soundtrack.admission.${name}`);
        if (
          shared !== undefined &&
          shared !== null &&
          player !== undefined &&
          player !== null &&
          shared !== player
        )
          issue('failures', `soundtrack.admission.${name}`, 'shared-admission-disagrees');
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
    else if (
      !Array.isArray(decks) ||
      decks.length > 2 ||
      (decks.length < 1 && soundtrackOwner !== 'never-created')
    )
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
    if (soundtrackOwner === 'never-created') {
      for (const [path, expected] of [
        ['inspection.workerOwned', false],
        ['inspection.workerActive', false],
        ['inspection.workerOwnedBytes', 0],
        ['inspection.pendingRequests', 0],
        ['playback.ownedBlobURLCount', 0],
        ['playback.ownedBlobBytes', 0],
        ['playback.failedRevocationCount', 0],
        ['playback.failedRevocationBytes', 0],
      ])
        if (read(resources, `soundtrack.${path}`) !== expected)
          issue('failures', `soundtrack.${path}`, 'never-created-owner-disagrees');
      if (!Array.isArray(decks) || decks.length !== 0)
        issue('failures', 'soundtrack.playback.decks', 'never-created-owner-disagrees');
    }
    if (demo !== undefined) {
      const format = read(resources, 'demo.format');
      if (format === undefined || format === null)
        issue('unknown', 'demo.format', 'missing-schema');
      else if (format !== demo.format) issue('failures', 'demo.format', 'invalid-schema');
      const activeDemo = boolean('demo.active');
      const disposedDemo = boolean('demo.disposed');
      if (activeDemo === 1 && disposedDemo === 1)
        issue('failures', 'demo', 'disposed-active-owner');
      const phase = read(resources, 'demo.phase');
      if (phase === undefined) issue('unknown', 'demo.phase', 'missing-phase');
      else if (activeDemo === 0 && phase !== null)
        issue('failures', 'demo.phase', 'inactive-phase-disagrees');
      else if (activeDemo === 1 && !['paused', 'suspended'].includes(phase))
        issue('failures', 'demo.phase', 'not-paused-demo-boundary');
      for (const path of ['demo.pendingSourceLoads', 'demo.pendingPreparations']) {
        const pending = number(path, { pending: true });
        // Closing is allowed while noncancelable work still owns a reservation.
        // An active Demo may export only after its scene preparation settles.
        if (activeDemo === 1 && pending > 0)
          issue('failures', path, 'active-unsettled-preparation');
      }
      const scenes = number('demo.scenes');
      for (const path of ['demo.display', 'demo.transition', 'demo.reward.poster']) {
        const surface = pixels(path);
        if (surface.count > 1) issue('failures', path, 'single-surface-owner-disagrees');
        equal(
          `${path}.canvases`,
          surface.count,
          surface.pixels === null ? null : Number(surface.pixels > 0),
        );
      }
      boolean('demo.transition.loading', { pending: true });
      const painters = read(resources, 'demo.painters');
      const totals = { count: [], pixels: [], bytes: [], retained: [], leases: [] };
      // Evidence-processing bound only, never an asserted runtime owner budget.
      // Painter array positions are not persistent identities or trend series.
      if (!Array.isArray(painters)) {
        issue(
          painters == null ? 'unknown' : 'failures',
          'demo.painters',
          'missing-or-invalid-painters',
        );
      } else if (painters.length > 64) {
        issue('failures', 'demo.painters', 'painter-evidence-cap-exceeded');
      } else {
        if (scenes !== null && painters.length > scenes)
          issue('failures', 'demo.painters', 'painters-without-scene-owner');
        for (let i = 0; i < painters.length; i++) {
          const path = `demo.painters.${i}`;
          const owned = pixels(`${path}.ownedCanvases`, 'canvases', { record: false });
          const categories = canvasCategories.map((name) =>
            pixels(`${path}.ownedCanvases.categories.${name}`, 'canvases', { record: false }),
          );
          for (const key of ['count', 'pixels', 'bytes']) {
            equal(`${path}.ownedCanvases.${key}`, owned[key], sum(categories.map((c) => c[key])));
            totals[key].push(owned[key]);
          }
          const retained = number(`${path}.ownedCanvases.retainedPixelBufferBytes`, {
            record: false,
          });
          equal(
            `${path}.ownedCanvases.retainedPixelBufferBytes`,
            retained,
            number(`${path}.ownedCanvases.categories.demoConcealment.pixelBufferBytes`, {
              record: false,
            }),
          );
          totals.retained.push(retained);
          totals.leases.push(number(`${path}.enemyImages.ownedLeases`, { record: false }));
          // These are replicas of page pools, not extra per-painter allocations.
          for (const [pool, names] of [
            [
              'legacyImages',
              ['pending', 'active', 'reservedPixels', 'retainedPixels', 'pixelLimit'],
            ],
            ['enemyImages', ['entries', 'reservedBytes', 'decodedBytes', 'active', 'queued']],
          ]) {
            for (const name of names) {
              const value = number(`${path}.${pool}.${name}`, { record: false });
              const shared = row.values[`renderer.${pool}.${name}`] ?? null;
              equal(`${path}.${pool}.${name}`, value, shared);
            }
          }
          const reserved = number(`${path}.legacyImages.reservedPixels`, { record: false });
          const retainedImages = number(`${path}.legacyImages.retainedPixels`, { record: false });
          const totalImages = sum([reserved, retainedImages]);
          if (totalImages !== null && totalImages > OWNED_RESOURCE_LIMITS.legacyPixels)
            issue('failures', `${path}.legacyImages`, 'source-limit-exceeded');
          number(`${path}.legacyImages.pixelLimit`, {
            record: false,
            expected: OWNED_RESOURCE_LIMITS.legacyPixels,
          });
          number(`${path}.legacyImages.active`, { record: false, maximum: 1 });
          number(`${path}.enemyImages.active`, { record: false, maximum: 1 });
        }
      }
      const validPainters = Array.isArray(painters) && painters.length <= 64;
      for (const [key, name] of [
        ['count', 'canvases'],
        ['pixels', 'pixels'],
        ['bytes', 'rgbaBytesEstimate'],
        ['retained', 'retainedPixelBufferBytes'],
        ['leases', 'ownedEnemyLeases'],
      ])
        number(`demo.painterTotals.${name}`, {}, validPainters ? sum(totals[key]) : null);

      const handles = number('demo.workers.observedHandles');
      const created = number('demo.workers.created');
      const terminated = number('demo.workers.terminationRequests');
      equal('demo.workers.created', created, sum([handles, terminated]));

      const images = pixels('demo.sharedImages.uniqueObserved', 'images');
      const imageRows = ['presentation', 'actors', 'backdrop'].map((name) =>
        pixels(`demo.sharedImages.categories.${name}`, 'images'),
      );
      for (const key of ['count', 'pixels', 'bytes']) {
        const total = sum(imageRows.map((item) => item[key]));
        if (images[key] !== null && total !== null && images[key] > total)
          issue('failures', 'demo.sharedImages.uniqueObserved', 'union-exceeds-category-sum');
        if (
          images[key] !== null &&
          imageRows.some((item) => item[key] !== null && item[key] > images[key])
        )
          issue('failures', 'demo.sharedImages.uniqueObserved', 'union-below-category');
      }
      for (const prefix of [
        'uniqueObserved',
        'categories.presentation',
        'categories.actors',
        'categories.backdrop',
      ])
        if (number(`demo.sharedImages.${prefix}.unknownDimensions`) > 0)
          issue('unknown', `demo.sharedImages.${prefix}`, 'unobserved-image-dimensions');
      if (number('demo.sharedImages.unavailableSnapshots') > 0)
        issue('unknown', 'demo.sharedImages', 'unavailable-image-owner');

      number('demo.reward.pendingPreparations', { pending: true });
      const unavailable = boolean('demo.reward.presentationUnavailable');
      if (unavailable === 1)
        issue('unknown', 'demo.reward.presentation', 'unavailable-media-owner');
      const presentation = read(resources, 'demo.reward.presentation');
      // Explicit null + available inspection proves only absence of this JS owner.
      // It never proves native decode buffers were released.
      const absent = presentation === null && unavailable === 0;
      const media = number(
        'demo.reward.presentation.mediaElements',
        { maximum: 1 },
        absent ? 0 : presentation?.mediaElements,
      );
      const urls = number(
        'demo.reward.presentation.ownedBlobURLs',
        { maximum: 1 },
        absent ? 0 : presentation?.ownedBlobURLs,
      );
      const bytes = number(
        'demo.reward.presentation.ownedBlobBytes',
        {},
        absent ? 0 : presentation?.ownedBlobBytes,
      );
      const play = boolean(
        'demo.reward.presentation.pendingPlayCommand',
        { pending: true },
        absent ? false : presentation?.pendingPlayCommand,
      );
      const disposed = boolean(
        'demo.reward.presentation.disposed',
        {},
        absent ? false : presentation?.disposed,
      );
      if ((urls === 0 && bytes > 0) || (urls === 1 && bytes === 0))
        issue('failures', 'demo.reward.presentation', 'blob-owner-bytes-disagree');
      if ((play === 1 && media === 0) || (disposed === 1 && (media > 0 || urls > 0 || play === 1)))
        issue('failures', 'demo.reward.presentation', 'retired-or-missing-media-owner');
      if (presentation && presentation.nativeDecodedBytes !== null)
        issue(
          'failures',
          'demo.reward.presentation.nativeDecodedBytes',
          'native-allocation-not-observable',
        );
    }
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
    ...(demo !== undefined
      ? {
          demoContract: { format: demo.format, sourceRevision: demo.sourceRevision },
          demoScope:
            'Manual paused/closed Demo owners only; closed display remains retained. Canceled reservations remain pending until settlement. Worker termination is a request, not native exit. Shared images and page-pool replicas are nonadditive. Cumulative created/termination counters are not live retention. The 64-painter limit bounds evidence processing only. No native memory or leak verdict.',
        }
      : {}),
    scope:
      'Source-proved owner bounds and exact counters only. Flat values are observations, not a new retention tolerance or a leak verdict. Reservations, PCM, compressed originals and overlapping image pools are not summed. Native/GPU/process memory and active voices are unobserved. Raw failures remain authoritative.',
  };
}
