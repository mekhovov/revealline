import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { analyzeNamedHeap, compareFlightHeaps, FPV_HEAP_LIMITS } from './analyze-fpv-heap.mjs';
import {
  validateDiscoveryObservation,
  summarizeDiscoveryLifecycle,
} from '../docs/verification/discovery-comparison.mjs';

// Names exist in these runtime modules. Name matches are not exclusive ownership:
// exported factories remain resident, and another module can share a callback name.
export const DISCOVERY_HEAP_COHORTS = Object.freeze({
  'game/ui/edition-rewards.mjs': Object.freeze([
    'mountEditionRewards',
    'releaseMedia',
    'releaseShelfPictures',
    'releaseResultImage',
    'renderViewer',
    'openReward',
    'retainReadingFocus',
  ]),
  'game/ui/reward-media.mjs': Object.freeze(['mountRewardMedia']),
  'game/ui/reward-audio-group.mjs': Object.freeze(['mountRewardAudioGroup']),
  'game/ui/reward-knowledge.mjs': Object.freeze(['mountRewardKnowledge']),
  'game/ui/reward-cosmetic.mjs': Object.freeze(['mountRewardCosmetic']),
  'game/ui/discovery-exploration.mjs': Object.freeze(['mountDiscoveryExploration']),
  'game/ui/discovery-diagram.mjs': Object.freeze(['mountDiscoveryDiagram']),
  'game/rewards/store.mjs': Object.freeze(['createRewardStore']),
});
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const hash = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
const commit = (value) => typeof value === 'string' && /^[a-f0-9]{40,64}$/.test(value);
const fail = (message) => {
  throw new TypeError(`Discovery heap: ${message}`);
};
const boundedText = (value) => typeof value === 'string' && value.length > 0 && value.length <= 256;
const exactKeys = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  keys.every((key) => Object.hasOwn(value, key));
const encoded = (value) => JSON.stringify(value);
const same = (left, right, label) => {
  if (encoded(left) !== encoded(right)) fail(`different ${label}`);
};
function reference(value, limit) {
  if (
    !exactKeys(value, ['path', 'bytes', 'sha256']) ||
    !/^[A-Za-z0-9][A-Za-z0-9._/-]{0,255}$/.test(value.path ?? '') ||
    value.path.split('/').some((part) => !part || part === '.' || part === '..') ||
    !Number.isSafeInteger(value.bytes) ||
    value.bytes < 1 ||
    value.bytes > limit ||
    !hash(value.sha256)
  )
    fail('invalid bounded evidence reference');
  return value;
}
function closed(value) {
  if (
    !value ||
    value.rewardViewer !== false ||
    value.wonResult !== false ||
    value.collection !== false ||
    !Array.isArray(value.openDialogIds) ||
    value.openDialogIds.length
  )
    fail('heap snapshots require closed result, viewer and Collection surfaces');
}
function validateCycles(input, binding, environment) {
  if (
    input?.format !== 'revealline-discovery-desktop-cycles.v1' ||
    input.qualified !== false ||
    input.kind !== 'earned-result'
  )
    fail('expected ordinary earned-result cycles');
  const report = validateDiscoveryObservation(input.observation);
  if (
    report.binding.sourceKind !== 'compiled-artifact' ||
    report.binding.sourceIdentity !== binding.artifactSha256 ||
    report.binding.editionId !== binding.editionId ||
    report.binding.gameplayId !== binding.gameplayId
  )
    fail('cycle artifact/gameplay binding differs');
  same(report.environment, environment, 'cycle environment');
  if (
    report.cycles.result !== 20 ||
    report.cycles.rewardViewer !== 20 ||
    report.cycles.collection !== 0
  )
    fail('require exactly twenty observed result/viewer pairs per interval');
  let stage = 'viewer',
    ordinal = 1,
    previous = -1;
  for (const record of report.records) {
    if (!Number.isFinite(record.atMs) || record.atMs < previous) fail('unordered cycle records');
    previous = record.atMs;
    if (record.kind === 'cycle') {
      if (
        ordinal > 20 ||
        record.ordinal !== ordinal ||
        record.surface !==
          (stage === 'viewer' ? 'rewardViewer' : stage === 'result' ? 'result' : null)
      )
        fail('cycle order/ordinal differs from closed-view protocol');
      stage = stage === 'viewer' ? 'result' : 'closed';
    } else if (record.kind === 'checkpoint' && /^closed result /.test(record.label ?? '')) {
      if (stage !== 'closed' || record.label !== `closed result ${ordinal}`)
        fail('missing or duplicate closed checkpoint');
      if (
        record.state?.rewardViewer !== false ||
        record.state?.wonResult !== false ||
        record.state?.collection !== false
      )
        fail('cycle checkpoint is not closed');
      const resources = record.resources;
      for (const key of ['rewardDialogs', 'rewardShelves', 'rewardResults'])
        if (resources?.[key] !== 1) fail('cycle reward host ownership differs');
      for (const key of ['connectedVideo', 'connectedBlobMedia', 'uniqueConnectedBlobURLs'])
        if (resources?.[key] !== 0) fail('closed cycle retains connected reward media');
      ordinal++;
      stage = 'viewer';
    }
  }
  if (ordinal !== 21 || stage !== 'viewer') fail('twenty closed checkpoints are required');
  return { report, lifecycle: summarizeDiscoveryLifecycle(report) };
}

/** Bounded, offline descriptive evidence. Never an automatic leak-free gate.
 * Capture context binds one CDP isolate/document; node IDs are compared only there. */
export async function analyzeDiscoveryRetention(input, { read } = {}) {
  const text = typeof input === 'string' ? input : encoded(input);
  if (!text || Buffer.byteLength(text) > 64 * 1024) fail('capture manifest exceeds64KiB');
  const manifest = JSON.parse(text);
  if (
    manifest.format !== 'revealline-discovery-retention-capture.v1' ||
    manifest.qualified !== false ||
    typeof read !== 'function'
  )
    fail('expected an unqualified capture and exact evidence reader');
  const binding = manifest.binding;
  if (
    !exactKeys(binding, [
      'artifactSha256',
      'manifestSha256',
      'sourceRevision',
      'sourceTree',
      'editionId',
      'gameplayId',
    ]) ||
    !hash(binding.artifactSha256) ||
    !hash(binding.manifestSha256) ||
    !commit(binding.sourceRevision) ||
    !commit(binding.sourceTree) ||
    !boundedText(binding.editionId) ||
    !boundedText(binding.gameplayId)
  )
    fail('missing exact artifact/source/gameplay binding');
  const readExact = async (value, limit) => {
    reference(value, limit);
    const bytes = await read(value);
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength !== value.bytes ||
      sha(bytes) !== value.sha256
    )
      fail(`evidence bytes differ: ${value.path}`);
    return bytes;
  };
  if (
    !Array.isArray(manifest.instrumentation) ||
    manifest.instrumentation.length < 4 ||
    manifest.instrumentation.length > 16 ||
    new Set(manifest.instrumentation.map((item) => item.path)).size !==
      manifest.instrumentation.length
  )
    fail('missing unique instrumentation pins');
  for (const item of manifest.instrumentation) await readExact(item, 2 * 1024 * 1024);
  const instrumentationSha256 = sha(
    encoded(
      [...manifest.instrumentation].sort((a, b) =>
        a.path < b.path ? -1 : a.path > b.path ? 1 : 0,
      ),
    ),
  );
  if (
    !Array.isArray(manifest.snapshots) ||
    manifest.snapshots.length !== 3 ||
    !Array.isArray(manifest.intervals) ||
    manifest.intervals.length !== 2
  )
    fail('require warm, after20 and after40 snapshots with two cycle intervals');
  const analyses = [],
    summaries = [],
    seenHeaps = new Set();
  let captureContext;
  for (let index = 0; index < 3; index++) {
    const snapshot = manifest.snapshots[index],
      context = snapshot.context;
    if (
      snapshot.phase !== ['warm', 'after20', 'after40'][index] ||
      snapshot.forcedGC !== true ||
      !Number.isFinite(snapshot.atMs) ||
      snapshot.atMs < 0 ||
      (index && snapshot.atMs <= manifest.snapshots[index - 1].atMs)
    )
      fail('invalid snapshot order/GC status');
    if (
      !exactKeys(context, ['binding', 'instrumentationSha256', 'isolateId', 'timeOrigin']) ||
      !boundedText(context.isolateId) ||
      !Number.isFinite(context.timeOrigin) ||
      context.timeOrigin <= 0
    )
      fail('missing isolate/document context');
    same(context.binding, binding, 'snapshot artifact/source');
    if (context.instrumentationSha256 !== instrumentationSha256)
      fail('snapshot instrumentation differs');
    captureContext ??= context;
    same(context, captureContext, 'snapshot isolate/document/instrumentation');
    closed(snapshot.closed);
    if (seenHeaps.has(snapshot.heap?.path)) fail('snapshot files must be distinct');
    seenHeaps.add(snapshot.heap?.path);
    const bytes = await readExact(snapshot.heap, FPV_HEAP_LIMITS.bytes);
    const analysis = analyzeNamedHeap(JSON.parse(Buffer.from(bytes).toString('utf8')), {
      closures: Object.values(DISCOVERY_HEAP_COHORTS).flat(),
    });
    analyses.push(analysis);
    summaries.push({
      phase: snapshot.phase,
      file: snapshot.heap,
      atMs: snapshot.atMs,
      nodeCount: analysis.nodeCount,
      edgeCount: analysis.edgeCount,
      strongReachableNodes: analysis.strongReachableNodes,
      shallowBytes: analysis.shallowBytes,
      detachedNodes: analysis.detachedNodes,
      cohorts: analysis.cohorts.map(({ name, count, shallowBytes }) => ({
        name,
        count,
        shallowBytes,
      })),
    });
  }
  const intervals = [];
  let firstReport;
  for (let index = 0; index < 2; index++) {
    const interval = manifest.intervals[index];
    same(interval.context, captureContext, 'cycle isolate/document/instrumentation');
    if (
      !Number.isFinite(interval.startMs) ||
      !Number.isFinite(interval.endMs) ||
      interval.startMs <= manifest.snapshots[index].atMs ||
      interval.endMs <= interval.startMs ||
      interval.endMs >= manifest.snapshots[index + 1].atMs
    )
      fail('cycle interval does not lie between snapshots');
    const bytes = await readExact(interval.report, 2 * 1024 * 1024),
      { report, lifecycle } = validateCycles(
        JSON.parse(Buffer.from(bytes).toString('utf8')),
        binding,
        manifest.environment,
      );
    firstReport ??= report;
    same(report.binding, firstReport.binding, 'cycle observer/settings binding');
    if (report.records.at(-1)?.atMs > interval.endMs - interval.startMs)
      fail('cycle records exceed captured interval');
    intervals.push({
      report: interval.report,
      startMs: interval.startMs,
      endMs: interval.endMs,
      lifecycle,
    });
  }
  return {
    format: 'revealline-discovery-retention-analysis.v1',
    qualified: false,
    binding,
    instrumentation: manifest.instrumentation,
    instrumentationSha256,
    captureContext,
    environment: manifest.environment,
    snapshots: summaries,
    intervals,
    firstInterval: compareFlightHeaps(analyses[0], analyses[1]),
    secondInterval: compareFlightHeaps(analyses[1], analyses[2]),
    completeInterval: compareFlightHeaps(analyses[0], analyses[2]),
    cohortSources: DISCOVERY_HEAP_COHORTS,
    limits: [
      'One declared CDP isolate/document with exact artifact and instrumentation pins; ordinary closed-view cycles only.',
      'Forced-GC heap diagnostics alter execution. They are not natural pacing or a five-percent regression comparison.',
      'Shallow sizes and named populations are not dominator retained sizes or exclusive reward ownership.',
      'Names may match other modules; exported factory closures can remain resident without a mounted viewer.',
      'No threshold automatically qualifies stability. Surviving and added IDs require investigation.',
      'Native media wrappers do not measure decoders, GPU/process allocations or all outstanding object URLs.',
      'Raw heaps may contain player data and must stay private; this summary omits object strings, IDs and retaining paths.',
      'Repeated viewing of one earned reward is not edition-switching, twenty new wins or physical-device evidence.',
    ],
  };
}
export async function readDiscoveryRetention(file) {
  const root = path.dirname(path.resolve(file));
  const info = await stat(file);
  if (!info.isFile() || info.size > 64 * 1024) fail('capture manifest exceeds64KiB');
  return analyzeDiscoveryRetention(await readFile(file, 'utf8'), {
    read: async (entry) => {
      const target = path.resolve(root, entry.path);
      if (!target.startsWith(root + path.sep)) fail('evidence path escapes capture directory');
      const info = await stat(target);
      if (!info.isFile() || info.size !== entry.bytes) fail('evidence size differs');
      return readFile(target);
    },
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.length !== 3)
    fail('Usage: node scripts/analyze-discovery-heap.mjs capture.json');
  process.stdout.write(
    JSON.stringify(await readDiscoveryRetention(process.argv[2]), null, 2) + '\n',
  );
}
