/* global window, document, AudioBufferSourceNode, HTMLMediaElement */

/** Explicitly intrusive correctness probe, installed only for --audio-proof.
 * Encoded-byte hashing never reads PCM samples or changes playback controls. */
export function audioProofOptions(flags, requirements, enabled) {
  const expanded = flags.includes('--audio-proof-music-capacity');
  const importEvents = flags.includes('--audio-proof-import-events');
  if (
    (expanded || importEvents) &&
    (!enabled || !requirements?.streamedHashes?.length || requirements.recordedHashes?.length)
  )
    throw new TypeError('Music identity capacity requires an explicit streamed-only audio proof');
  return {
    aggregateEncodedBytes: (expanded ? 32 : 16) * 1024 * 1024,
    ...(importEvents ? { importEvents: true } : {}),
  };
}

export function installAudioProof({
  aggregateEncodedBytes = 16 * 1024 * 1024,
  importEvents = false,
} = {}) {
  if (typeof importEvents !== 'boolean') throw new TypeError('Invalid import event opt-in');
  if (![16 * 1024 * 1024, 32 * 1024 * 1024].includes(aggregateEncodedBytes))
    throw new RangeError('Unsupported audio proof byte capacity');
  const sources = [],
    starts = [],
    mediaEvents = [],
    urls = new Map(),
    buffers = new WeakMap();
  const elements = new Map(),
    wrapped = new Set(),
    windows = [];
  let copiedBytes = 0,
    capped = 0,
    droppedStarts = 0,
    droppedMediaEvents = 0;
  const phase = () => document.body?.dataset.flightState ?? 'boot';
  function source(kind, bytes) {
    if (
      !Number.isSafeInteger(bytes) ||
      bytes < 1 ||
      bytes > 2 * 1024 * 1024 ||
      sources.length >= 128 ||
      copiedBytes + bytes > aggregateEncodedBytes
    ) {
      capped++;
      return null;
    }
    copiedBytes += bytes;
    const row = {
      id: sources.length,
      kind,
      bytes,
      status: 'pending',
      atMs: performance.now(),
      phase: phase(),
    };
    sources.push(row);
    return row;
  }
  async function hash(row, promise) {
    if (!row) return;
    try {
      const bytes = await promise;
      const digest = await crypto.subtle.digest('SHA-256', bytes);
      row.sha256 = Array.from(new Uint8Array(digest), (n) => n.toString(16).padStart(2, '0')).join(
        '',
      );
      row.status = 'resolved';
    } catch (error) {
      row.status = 'failed';
      row.error = String(error.message);
    }
  }
  for (const Context of [window.AudioContext, window.webkitAudioContext]) {
    if (!Context || wrapped.has(Context.prototype)) continue;
    wrapped.add(Context.prototype);
    const original = Context.prototype.decodeAudioData;
    Context.prototype.decodeAudioData = function (bytes, success, failure) {
      const row = source('decodeAudioData', bytes?.byteLength);
      if (row) {
        try {
          void hash(row, new Uint8Array(bytes).slice().buffer);
        } catch (error) {
          row.status = 'failed';
          row.error = String(error.message);
        }
      }
      const accepted = (buffer) => {
        if (row && buffer) {
          buffers.set(buffer, row.id);
          row.decoded = true;
        }
      };
      const result = original.call(
        this,
        bytes,
        typeof success === 'function'
          ? (buffer) => {
              accepted(buffer);
              success(buffer);
            }
          : undefined,
        failure,
      );
      result?.then(accepted, () => {});
      return result;
    };
  }
  if (typeof AudioBufferSourceNode !== 'undefined') {
    const original = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (...args) {
      const result = original.apply(this, args);
      if (starts.length < 128)
        starts.push({
          atMs: performance.now(),
          phase: phase(),
          sourceId: buffers.get(this.buffer) ?? null,
          duration: this.buffer?.duration ?? null,
          sampleRate: this.buffer?.sampleRate ?? null,
          channels: this.buffer?.numberOfChannels ?? null,
        });
      else droppedStarts++;
      return result;
    };
  }
  const createURL = URL.createObjectURL;
  URL.createObjectURL = function (blob) {
    const url = createURL.call(this, blob);
    if (blob && /^audio\//.test(blob.type)) {
      const row = source('audio-blob-url', blob.size);
      if (row) {
        urls.set(url, row.id);
        void hash(row, blob.arrayBuffer());
      }
    }
    return url;
  };
  function sample(element, event) {
    if (mediaEvents.length >= 512) {
      droppedMediaEvents++;
      return;
    }
    const currentSrc = element.currentSrc || element.src || '';
    mediaEvents.push({
      element: elements.get(element),
      event,
      atMs: performance.now(),
      phase: phase(),
      currentSrc,
      sourceId: urls.get(currentSrc) ?? null,
      currentTime: element.currentTime,
      duration: Number.isFinite(element.duration) ? element.duration : null,
      paused: element.paused,
      readyState: element.readyState,
      playbackRate: element.playbackRate,
    });
  }
  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...args) {
    if (!elements.has(this) && elements.size < 8) {
      elements.set(this, elements.size);
      for (const name of ['playing', 'timeupdate', 'ended', 'pause', 'error', 'seeking', 'seeked'])
        this.addEventListener(name, () => sample(this, name));
    }
    const result = play.apply(this, args);
    if (elements.has(this)) {
      sample(this, 'play-request');
      result?.then(
        () => sample(this, 'play-resolved'),
        () => sample(this, 'play-rejected'),
      );
    }
    return result;
  };
  // Separate, explicit metadata diagnostic. Capture listeners run before the
  // application's non-capture probe listeners can clear the failed media source.
  // Native load calls, results, errors and application listeners remain untouched.
  let importProbe = null;
  if (importEvents) {
    const retained = new Map(),
      records = [];
    const events = ['loadedmetadata', 'loadeddata', 'durationchange', 'error', 'emptied'];
    const nativeLoad = HTMLMediaElement.prototype.load;
    let nextElement = 0,
      droppedElements = 0,
      droppedRecords = 0,
      observerErrors = 0,
      disposed = false;
    const durationValue = (value) =>
      Number.isFinite(value)
        ? { kind: 'finite', value }
        : {
            kind: Number.isNaN(value)
              ? 'NaN'
              : value === Infinity
                ? '+Infinity'
                : value === -Infinity
                  ? '-Infinity'
                  : 'non-number',
          };
    const sampleImport = (element, event) => {
      try {
        if (disposed || !retained.has(element)) return;
        if (records.length >= 64) {
          droppedRecords++;
          return;
        }
        const src = element.src || '',
          currentSrc = element.currentSrc || '';
        records.push({
          element: retained.get(element).id,
          event,
          atMs: performance.now(),
          phase: phase(),
          sourceId: urls.get(src) ?? urls.get(currentSrc) ?? null,
          currentSourceId: urls.get(currentSrc) ?? null,
          readyState: element.readyState,
          networkState: element.networkState,
          mediaErrorCode: element.error?.code ?? null,
          duration: durationValue(element.duration),
        });
      } catch {
        observerErrors++;
      }
    };
    function observedLoad(...args) {
      // Observer errors cannot suppress or replace a native call/error.
      try {
        if (!disposed && !retained.has(this)) {
          if (nextElement < 8) {
            const listeners = events.map((name) => [name, () => sampleImport(this, name)]);
            retained.set(this, { id: nextElement++, listeners });
            for (const [name, listener] of listeners) this.addEventListener(name, listener, true);
          } else droppedElements++;
        }
      } catch {
        observerErrors++;
      }
      sampleImport(this, 'load-before');
      let result;
      try {
        result = nativeLoad.apply(this, args);
      } catch (error) {
        sampleImport(this, 'load-throw');
        throw error;
      }
      sampleImport(this, 'load-after');
      return result;
    }
    const dispose = () => {
      if (disposed) return;
      disposed = true;
      for (const [element, { listeners }] of retained)
        for (const [name, listener] of listeners) element.removeEventListener(name, listener, true);
      retained.clear();
      if (HTMLMediaElement.prototype.load === observedLoad)
        HTMLMediaElement.prototype.load = nativeLoad;
      window.removeEventListener('pagehide', dispose);
    };
    HTMLMediaElement.prototype.load = observedLoad;
    window.addEventListener('pagehide', dispose, { once: true });
    importProbe = {
      dispose,
      export: () => ({
        records: records.map((row) => ({ ...row, duration: { ...row.duration } })),
        observedElements: nextElement,
        retainedElements: retained.size,
        droppedElements,
        droppedRecords,
        observerErrors,
        disposed,
        limits: { elements: 8, records: 64 },
        scope:
          'Passive native load/metadata observation; no play, seek, retry, validation bypass or timing qualification.',
      }),
    };
  }
  window.soloAudioProof = {
    ...(importProbe
      ? {
          disposeImportProbe: () => importProbe.dispose(),
          exportImportProbe: () => ({
            ...importProbe.export(),
            sources: sources.map(({ id, kind, bytes, status, sha256 }) => ({
              id,
              kind,
              bytes,
              status,
              sha256,
            })),
          }),
        }
      : {}),
    recordingsReady(hashes) {
      return hashes.every((sha256) =>
        sources.some((row) => row.sha256 === sha256 && row.status === 'resolved' && row.decoded),
      );
    },
    beginWindow(label) {
      if (windows.length >= 32) return null;
      const index = windows.length;
      windows.push({ label, startMs: performance.now(), endMs: null });
      for (const element of elements.keys()) sample(element, 'window-start');
      return index;
    },
    endWindow(index) {
      if (index === null || !windows[index]) return;
      windows[index].endMs = performance.now();
      for (const element of elements.keys()) sample(element, 'window-end');
    },
    export() {
      for (const element of elements.keys()) sample(element, 'checkpoint');
      return {
        sources: sources.map((row) => ({ ...row })),
        starts: starts.slice(),
        mediaEvents: mediaEvents.slice(),
        windows: windows.map((row) => ({ ...row })),
        ...(importProbe ? { importProbe: importProbe.export() } : {}),
        copiedBytes,
        capped,
        droppedStarts,
        droppedMediaEvents,
        limits: {
          encodedBytesPerSource: 2 * 1024 * 1024,
          aggregateEncodedBytes,
          sources: 128,
          starts: 128,
          mediaEvents: 512,
          retainedElements: 8,
          windows: 32,
        },
        scope:
          'Explicit audio identity instrumentation; copies/hashes encoded bytes and retains up to 8 media elements. Excluded from timing and memory plateau qualification. Native source start/time advancement does not establish audible output.',
      };
    },
  };
}

/** Seek/reset jumps and disjoint plays cannot masquerade as advancing media. */
export function observedMediaAdvancement(events) {
  const active = new Map();
  let witness = null;
  const sample = ({ atMs, currentTime, event }) => ({ atMs, currentTime, event });
  for (const event of events) {
    const key = `${event.element}:${event.sourceId}`;
    if (['play-request', 'pause', 'ended', 'error', 'seeking', 'seeked'].includes(event.event)) {
      active.delete(key);
      continue;
    }
    if (!Number.isFinite(event.atMs) || !Number.isFinite(event.currentTime)) continue;
    let segment = active.get(key);
    if (!segment && ['playing', 'play-resolved'].includes(event.event)) {
      segment = { first: event, previous: event };
      active.set(key, segment);
      continue;
    }
    if (!segment) continue;
    const delta = event.currentTime - segment.previous.currentTime;
    const elapsedSeconds = (event.atMs - segment.previous.atMs) / 1000;
    const rate =
      Number.isFinite(event.playbackRate) && event.playbackRate > 0 ? event.playbackRate : 1;
    if (delta < -0.000001 || elapsedSeconds < 0 || delta > elapsedSeconds * rate + 0.25) {
      active.delete(key);
      if (['playing', 'play-resolved'].includes(event.event))
        active.set(key, { first: event, previous: event });
      continue;
    }
    segment.previous = event;
    const seconds = event.currentTime - segment.first.currentTime;
    if (seconds > (witness?.seconds ?? 0))
      witness = {
        element: event.element,
        sourceId: event.sourceId,
        from: sample(segment.first),
        to: sample(event),
        seconds,
        wallSeconds: (event.atMs - segment.first.atMs) / 1000,
      };
  }
  return {
    seconds: witness?.seconds ?? 0,
    witness,
    scope:
      'Largest continuous chronological progress after native playing/play-resolved; resets, seeks, pauses and implausible jumps close the segment.',
  };
}

export function evaluateAudioProof(proof, requirements) {
  if (!proof)
    return {
      status: 'unobserved',
      reason: 'Use a separate --audio-proof execution of this scenario.',
    };
  const byId = new Map(proof.sources.map((row) => [row.id, row]));
  const checks = [];
  for (const sha256 of requirements?.recordedHashes ?? []) {
    const starts = proof.starts.filter(
      (row) =>
        byId.get(row.sourceId)?.status === 'resolved' &&
        byId.get(row.sourceId)?.sha256 === sha256 &&
        ['running', 'picture', 'result'].includes(row.phase),
    );
    checks.push({
      kind: 'decoded-recording-start',
      sha256,
      count: starts.length,
      status: starts.length ? 'pass' : 'unobserved',
      starts,
    });
  }
  const firstPlaying = [];
  for (const sha256 of requirements?.streamedHashes ?? []) {
    const events = proof.mediaEvents.filter(
      (row) =>
        byId.get(row.sourceId)?.status === 'resolved' && byId.get(row.sourceId)?.sha256 === sha256,
    );
    const playing = events.filter((row) => ['playing', 'play-resolved'].includes(row.event));
    const progress = observedMediaAdvancement(events);
    const advancement = progress.seconds;
    const minimum = requirements.minimumAdvanceSeconds ?? 0.25;
    firstPlaying.push(playing.length ? Math.min(...playing.map((row) => row.atMs)) : null);
    checks.push({
      kind: 'streamed-recording-advancement',
      sha256,
      playingEvents: playing.length,
      advancement,
      advancementWitness: progress.witness,
      advancementScope: progress.scope,
      minimum,
      status: playing.length && advancement >= minimum ? 'pass' : 'unobserved',
    });
  }
  if (firstPlaying.length > 1)
    checks.push({
      kind: 'stream-order',
      firstPlaying,
      status: firstPlaying.every(
        (value, index) => value !== null && (!index || value > firstPlaying[index - 1]),
      )
        ? 'pass'
        : 'unobserved',
    });
  const naturalTransitions = [];
  const expectedStreams = new Set(requirements?.streamedHashes ?? []);
  const media = proof.mediaEvents.map((row) => ({
    ...row,
    sha256: byId.get(row.sourceId)?.status === 'resolved' ? byId.get(row.sourceId)?.sha256 : null,
  }));
  for (const window of proof.windows ?? []) {
    if (window.label !== 'natural-music-transition' || !Number.isFinite(window.endMs)) continue;
    let active = null;
    for (const event of media) {
      if (!expectedStreams.has(event.sha256) || !['playing', 'play-resolved'].includes(event.event))
        continue;
      if (event.atMs > window.endMs) break;
      if (active?.sha256 !== event.sha256 && event.atMs >= window.startMs && active) {
        const outgoing = media.filter(
          (row) =>
            row.sha256 === active.sha256 &&
            row.element === active.element &&
            row.atMs >= window.startMs &&
            row.atMs <= event.atMs,
        );
        const nearEnd = outgoing.filter(
          (row) =>
            row.event === 'ended' ||
            (Number.isFinite(row.duration) &&
              row.duration > 0 &&
              row.currentTime >= row.duration - 4),
        );
        if (nearEnd.length)
          naturalTransitions.push({
            from: active.sha256,
            to: event.sha256,
            atMs: event.atMs,
            window,
            outgoing: nearEnd.at(-1),
            mechanism: nearEnd.some((row) => row.event === 'ended')
              ? 'native-ended'
              : 'near-end-overlap',
          });
      }
      active = event;
    }
  }
  if (requirements?.naturalTransitionsAtLeast)
    checks.push({
      kind: 'natural-stream-transition',
      count: naturalTransitions.length,
      minimum: requirements.naturalTransitionsAtLeast,
      status:
        naturalTransitions.length >= requirements.naturalTransitionsAtLeast ? 'pass' : 'unobserved',
      transitions: naturalTransitions,
    });
  return {
    status: checks.length && checks.every((row) => row.status === 'pass') ? 'pass' : 'unobserved',
    checks,
    pending: proof.sources.filter((row) => row.status === 'pending').length,
    failed: proof.sources.filter((row) => row.status === 'failed').length,
    capped: proof.capped,
    droppedStarts: proof.droppedStarts,
    droppedMediaEvents: proof.droppedMediaEvents,
    scope:
      'Exact encoded SHA256 linked to successful native playback APIs. Unresolved/capped identities cannot satisfy requirements; no speaker/output-device claim.',
  };
}

/** Public controls at an audio failure or completed import; no playback or storage writes. */
export function readAudioFailureContext() {
  const doc = globalThis.document;
  const select = doc.getElementById('soundtrack-selection');
  const status = doc.getElementById('soundtrack-status');
  const options = select?.options;
  return {
    scope: 'Bounded public music controls during intrusive audio diagnosis',
    ...(globalThis.window?.soloAudioProof?.exportImportProbe
      ? { importProbe: globalThis.window.soloAudioProof.exportImportProbe() }
      : {}),
    status: status?.textContent?.slice(0, 1200) ?? null,
    statusState: status?.dataset?.state?.slice(0, 40) ?? null,
    dialogOpen: Boolean(doc.getElementById('soundtrack-dialog')?.open),
    selection: select?.value?.slice(0, 180) ?? null,
    selectionDisabled: select ? Boolean(select.disabled) : null,
    optionCount: options?.length ?? 0,
    options: options
      ? Array.from({ length: Math.min(64, options.length) }, (_, i) => ({
          value: options[i].value.slice(0, 180),
          text: options[i].textContent.slice(0, 180),
        }))
      : [],
  };
}
