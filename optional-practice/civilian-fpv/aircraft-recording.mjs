import { boundedJSON, dataIdentity, exactKeys, required } from '../../game/data-json.mjs';

export const AIRCRAFT_RECORDING_FORMAT = 'AdvancedAircraftRecording.v1';
export const AIRCRAFT_RECORDING_BYTES = 32 * 1024 * 1024;
export const AIRCRAFT_SNAPSHOT_BYTES = 40 * 1024 * 1024;
export const AIRCRAFT_SEGMENT_TICKS = 60 * 50;
// Leave room for every sample in one maximum-frequency mission interval.
// A caller may choose a larger byte budget, but exports must remain importable.
const SEGMENT_EVENT_ROTATION = 24000;
const clone = (value) => structuredClone(value);
const bytes = (value) => new TextEncoder().encode(JSON.stringify(value)).byteLength;

/** This recorder is deliberately outside the physical state. Only accepted
 * mission boundaries may append/rotate, so terrain rollback cannot publish a
 * rejected input, checkpoint, or segment. A recorder failure never stops flight. */
export function createAircraftRecorder({
  identity,
  config,
  checkpoint,
  hash,
  enabled = true,
  maxBytes = 24 * 1024 * 1024,
  segmentBytes = 1024 * 1024,
  maxSegments = 3,
} = {}) {
  required(
    Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 24 * 1024 * 1024,
    'Invalid recent recording budget',
  );
  required(
    Number.isSafeInteger(segmentBytes) && segmentBytes > 0 && segmentBytes <= maxBytes,
    'Invalid recording segment budget',
  );
  required(
    Number.isInteger(maxSegments) && maxSegments >= 1 && maxSegments <= 3,
    'Invalid retained segment count',
  );
  let segments = [],
    serial = 0,
    error = null,
    durableTick = null,
    active = enabled,
    currentBytes = 0,
    retainedBytes = 0,
    latestTick = checkpoint.state.missionTick;
  function begin(saved, stateHash) {
    const segment = {
      format: 'AdvancedAircraftSegment.v1',
      index: serial++,
      previous: segments.length ? dataIdentity(segments.at(-1)) : null,
      startTick: saved.state.missionTick,
      endTick: saved.state.missionTick,
      checkpoint: clone(saved),
      initialHash: stateHash,
      events: [],
      hashes: [],
      finalHash: stateHash,
    };
    segments.push(segment);
    currentBytes = bytes(segment);
    retainedBytes += currentBytes;
    trim();
  }
  function trim() {
    while (segments.length > 1 && (segments.length > maxSegments || retainedBytes > maxBytes))
      retainedBytes -= bytes(segments.shift());
    if (retainedBytes > maxBytes) {
      active = false;
      error = 'recording-capacity';
      // A checkpoint larger than the entire budget is not a valid recent clip.
      if (segments.length === 1 && segments[0].events.length === 0) {
        segments = [];
        currentBytes = retainedBytes = 0;
      }
    }
  }
  if (active) begin(checkpoint, hash);
  function append({ events = [], tick, stateHash, checkpoint: capture }) {
    latestTick = tick;
    if (!active) return;
    try {
      const segment = segments.at(-1);
      const additions = events.map(clone);
      let growth = additions.reduce((sum, event) => sum + bytes(event) + 1, 0);
      segment.events.push(...additions);
      segment.endTick = tick;
      segment.finalHash = stateHash;
      if (tick > segment.startTick && tick % 50 === 0 && segment.hashes.at(-1)?.[0] !== tick) {
        const entry = [tick, stateHash];
        segment.hashes.push(entry);
        growth += bytes(entry) + 1;
      }
      currentBytes += growth;
      retainedBytes += growth;
      if (
        (tick > segment.startTick &&
          (tick - segment.startTick >= AIRCRAFT_SEGMENT_TICKS || currentBytes >= segmentBytes)) ||
        segment.events.length >= SEGMENT_EVENT_ROTATION
      )
        begin(capture(), stateHash);
      trim();
    } catch {
      active = false;
      error = 'recording-unavailable';
    }
  }
  return {
    append,
    status() {
      return {
        format: 'AircraftRecordingStatus.v1',
        state: active ? 'recording' : enabled ? 'unavailable' : 'disabled',
        retainedFromSeconds: segments.length ? segments[0].startTick / 50 : null,
        retainedThroughSeconds: segments.length ? segments.at(-1).endTick / 50 : null,
        lastRecoverableSeconds: durableTick === null ? null : durableTick / 50,
        currentSeconds: latestTick / 50,
        retainedSegments: segments.length,
        retainedBytes,
        error,
      };
    },
    reportPersistence({ savedThroughMission, error: failure = null } = {}) {
      if (savedThroughMission !== undefined) {
        required(
          Number.isSafeInteger(savedThroughMission) &&
            savedThroughMission >= 0 &&
            savedThroughMission <= latestTick,
          'Invalid durable recovery point',
        );
        durableTick = Math.max(durableTick ?? 0, savedThroughMission);
      }
      if (failure !== null) error = 'storage-unavailable';
      else if (error === 'storage-unavailable') error = null;
      return this.status();
    },
    recording() {
      required(segments.length > 0, 'No retained recording is available');
      return boundedJSON(
        {
          format: AIRCRAFT_RECORDING_FORMAT,
          identity,
          config,
          scored: false,
          origin: 'checkpoint',
          startMissionTick: segments[0].startTick,
          missionTicks: segments.at(-1).endTick,
          segments,
          finalHash: segments.at(-1).finalHash,
        },
        {
          maxBytes: AIRCRAFT_RECORDING_BYTES,
          maxNodes: 3000000,
          maxArray: 500000,
          maxString: 12 * 1024 * 1024,
          maxDepth: 40,
        },
      );
    },
    restore(record) {
      const next = validateAircraftRecording(record);
      required(next.identity === identity, 'Recording belongs to another configuration');
      segments = clone(next.segments);
      serial = segments.at(-1).index + 1;
      latestTick = segments.at(-1).endTick;
      currentBytes = bytes(segments.at(-1));
      retainedBytes = segments.reduce((sum, segment) => sum + bytes(segment), 0);
      trim();
    },
  };
}

export function validateAircraftRecording(source) {
  const record = boundedJSON(source, {
    maxBytes: AIRCRAFT_RECORDING_BYTES,
    maxNodes: 3000000,
    maxArray: 500000,
    maxString: 12 * 1024 * 1024,
    maxDepth: 40,
  });
  exactKeys(
    record,
    [
      'format',
      'identity',
      'config',
      'scored',
      'origin',
      'startMissionTick',
      'missionTicks',
      'segments',
      'finalHash',
    ],
    'Aircraft recording',
  );
  required(
    record.format === AIRCRAFT_RECORDING_FORMAT &&
      record.scored === false &&
      record.origin === 'checkpoint' &&
      /^[a-f0-9]{16}$/.test(record.identity) &&
      Number.isSafeInteger(record.startMissionTick) &&
      record.startMissionTick >= 0 &&
      Number.isSafeInteger(record.missionTicks) &&
      record.missionTicks >= record.startMissionTick &&
      Array.isArray(record.segments) &&
      record.segments.length > 0 &&
      record.segments.length <= 3,
    'Unsupported aircraft recording',
  );
  let previous = null;
  for (const segment of record.segments) {
    exactKeys(
      segment,
      [
        'format',
        'index',
        'previous',
        'startTick',
        'endTick',
        'checkpoint',
        'initialHash',
        'events',
        'hashes',
        'finalHash',
      ],
      'Aircraft recording segment',
    );
    required(
      segment.format === 'AdvancedAircraftSegment.v1' &&
        Number.isSafeInteger(segment.index) &&
        segment.index >= 0 &&
        Number.isSafeInteger(segment.startTick) &&
        segment.startTick >= 0 &&
        Number.isSafeInteger(segment.endTick) &&
        segment.endTick >= segment.startTick &&
        segment.endTick - segment.startTick <= AIRCRAFT_SEGMENT_TICKS &&
        segment.checkpoint?.state?.missionTick === segment.startTick &&
        /^[a-f0-9]{8}$/.test(segment.initialHash) &&
        /^[a-f0-9]{8}$/.test(segment.finalHash) &&
        (segment.previous === null || /^[a-f0-9]{16}$/.test(segment.previous)) &&
        Array.isArray(segment.events) &&
        segment.events.length <= 25000 &&
        Array.isArray(segment.hashes),
      'Invalid aircraft recording segment',
    );
    if (previous)
      required(
        segment.index === previous.index + 1 &&
          segment.startTick === previous.endTick &&
          segment.initialHash === previous.finalHash &&
          segment.previous === dataIdentity(previous),
        'Missing or reordered aircraft segment',
      );
    const expectedHashes = Math.floor(segment.endTick / 50) - Math.floor(segment.startTick / 50);
    required(segment.hashes.length === expectedHashes, 'Aircraft hash coverage changed');
    for (let index = 0; index < segment.hashes.length; index++) {
      const entry = segment.hashes[index];
      required(
        Array.isArray(entry) &&
          entry.length === 2 &&
          entry[0] === (Math.floor(segment.startTick / 50) + index + 1) * 50 &&
          /^[a-f0-9]{8}$/.test(entry[1]),
        'Invalid aircraft verification schedule',
      );
    }
    previous = segment;
  }
  required(
    record.startMissionTick === record.segments[0].startTick &&
      record.missionTicks === previous.endTick &&
      record.finalHash === previous.finalHash,
    'Aircraft recording range changed',
  );
  return record;
}
