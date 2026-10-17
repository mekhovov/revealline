// Opt-in qualification evidence only. No game module imports or active I/O.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open, realpath } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

export const HITCH_LIMITS = Object.freeze({
  records: 174000,
  recordBytes: 24,
  durationMs: 2400000,
  documents: 64,
  descriptorBytes: 65536,
});

export function qualificationHitchJournalOptions(flags, scenario, scenarioBytes) {
  const preparation = flags.filter((flag) => flag.startsWith('--hitch-journal-preparation'));
  const selected = flags.filter(
    (flag) => flag.startsWith('--hitch-journal') && !flag.startsWith('--hitch-journal-preparation'),
  );
  assert(!preparation.length || selected.length, 'Preparation policy requires the journal');
  if (!selected.length) return null;
  assert.deepEqual(selected, ['--hitch-journal'], 'One exact --hitch-journal flag required');
  assert(flags.includes('--work-probe'), 'Hitch journal requires the work probe');
  assert(scenario.timeoutMs <= HITCH_LIMITS.durationMs, 'Hitch journal forty-minute bound');
  if (preparation.length) {
    assert.deepEqual(preparation, ['--hitch-journal-preparation=first-return-anchored-v1']);
    assert.equal(
      createHash('sha256').update(scenarioBytes).digest('hex'),
      '079d4dd76fbd914ddd4da7311f8e6cee4a0ff4fc3bc951842b2921c94c53b8ff',
    );
    assert.deepEqual(scenario, JSON.parse(scenarioBytes), 'Preparation recipe bytes changed');
    assert.equal(scenario.id, 'thirty-minute-lifecycle-soak-first-return-anchored-v1');
    assert.equal(scenario.entryPath, 'playground/');
    assert.equal(scenario.readySelector, '#import-file');
    assert.equal(scenario.actions[4].type, 'follow');
    assert.equal(scenario.actions[4].selector, '#open-preview');
    return { ...HITCH_LIMITS, preparationPolicy: 'first-return-anchored-v1' };
  }
  return HITCH_LIMITS;
}

// Self-contained when serialized into the observed document. Numeric writes only
// on existing callbacks; metadata and encoding are explicitly pause-only.
export function createBrowserHitchJournal(options = {}, environment = globalThis) {
  const capacity = options.records ?? 174000;
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 174000)
    throw Error('Hitch record capacity');
  let buffer = new ArrayBuffer(capacity * 24),
    view = new DataView(buffer);
  const observed = new Float64Array(7),
    retained = new Float64Array(7);
  const startedAt = environment.performance.now();
  let limit = capacity,
    deadline = startedAt + 2400000,
    used = 0,
    documentId = null,
    configured = false,
    sealed = false,
    clockInvalid = false,
    durationExceeded = false,
    firstOverflowAt = null,
    workStart = null,
    workPhase = 0,
    workFlags = 0,
    workSubscribedAt = null,
    phase = 0,
    visible = !environment.document.hidden,
    focused = environment.document.hasFocus(),
    postSealActive = false,
    firstCallback = null,
    nativeObserver = null,
    nativeDropped = null,
    nativeFailure = false;
  let identity = { role: 'solo', origin: null, path: null, action: null },
    runningSeen = false,
    workCallsSeen = false,
    activeFrames = 0,
    activeWorkWindows = 0,
    activeElapsedMs = 0,
    firstActiveAt = null,
    lastActiveAt = null;
  const active = (start, end) => {
    firstActiveAt = firstActiveAt === null ? start : Math.min(firstActiveAt, start);
    lastActiveAt = lastActiveAt === null ? end : Math.max(lastActiveAt, end);
  };
  let lastFrameEnd = null,
    lastWorkEnd = null;
  const nativeSupported =
    environment.PerformanceObserver?.supportedEntryTypes?.includes('longtask') === true;
  const flags = () => (visible ? 1 : 0) | (focused ? 2 : 0);
  let previousFrameFlags = flags();
  const append = (kind, start, end, before, after, beforeFlags, afterFlags) => {
    if (sealed) {
      if (before === 2 || after === 2) postSealActive = true;
      return;
    }
    observed[kind]++;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
      clockInvalid = true;
      return;
    }
    if (end > deadline) durationExceeded = true;
    if (used >= limit) {
      if (firstOverflowAt === null) firstOverflowAt = end;
      return;
    }
    const offset = used * 24;
    view.setFloat64(offset, start, true);
    view.setFloat64(offset + 8, end, true);
    view.setUint32(
      offset + 16,
      kind | (before << 4) | (after << 8) | (beforeFlags << 12) | (afterFlags << 14),
      true,
    );
    view.setUint32(offset + 20, used, true);
    used++;
    retained[kind]++;
  };
  const nativeEntries = (entries) => {
    let previousStart = -Infinity;
    for (const entry of entries) {
      if (entry.startTime < previousStart) clockInvalid = true;
      previousStart = entry.startTime;
      if (entry.duration >= 50)
        append(3, entry.startTime, entry.startTime + entry.duration, 6, 6, 0, 0);
    }
  };
  if (nativeSupported) {
    try {
      nativeObserver = new environment.PerformanceObserver((list, _observer, details) => {
        nativeEntries(list.getEntries());
        if (Number.isFinite(details?.droppedEntriesCount))
          nativeDropped = Math.max(nativeDropped ?? 0, details.droppedEntriesCount);
      });
      nativeObserver.observe({ type: 'longtask', buffered: true });
    } catch {
      nativeFailure = true;
    }
  }
  const state = () => {
    const now = environment.performance.now();
    if (!sealed && now > deadline) durationExceeded = true;
    return {
      format: 'SoloHitchJournalDocumentV1',
      documentId,
      identity,
      location:
        identity.origin === null
          ? null
          : { origin: environment.location?.origin, path: environment.location?.pathname },
      workScope:
        identity.role === 'preparation'
          ? 'unobserved-preparation'
          : workSubscribedAt === null
            ? 'unobserved'
            : 'subscribed-solo',
      runningSeen,
      workCallsSeen,
      activeFrames,
      activeWorkWindows,
      activeElapsedMs,
      firstActiveAt,
      lastActiveAt,
      configured,
      sealed,
      startedAt,
      deadline,
      timeOrigin: environment.performance.timeOrigin,
      workSubscribedAt,
      firstCallback,
      phase,
      records: used,
      capacity: limit,
      bufferBytes: buffer?.byteLength ?? 0,
      observed: Array.from(observed),
      retained: Array.from(retained),
      firstOverflowAt,
      clockInvalid,
      durationExceeded,
      unmatchedWorkStart: workStart,
      postSealActive,
      nativeTasks: nativeSupported ? (nativeFailure ? 'failed' : 'observed') : 'unobserved',
      nativeDropped,
      complete:
        configured &&
        firstCallback !== null &&
        (identity.role === 'preparation'
          ? !runningSeen && !workCallsSeen && workSubscribedAt === null
          : workSubscribedAt !== null) &&
        firstOverflowAt === null &&
        !clockInvalid &&
        !durationExceeded &&
        workStart === null &&
        !postSealActive &&
        !nativeFailure &&
        !(nativeDropped > 0),
    };
  };
  const journal = {
    configure(allocation) {
      if (configured || sealed) throw Error('Hitch document already configured/sealed');
      if (
        !Number.isInteger(allocation.id) ||
        allocation.id < 1 ||
        allocation.id > 64 ||
        !Number.isInteger(allocation.records) ||
        allocation.records < 0 ||
        allocation.records > capacity ||
        !Number.isFinite(allocation.remainingMs) ||
        allocation.remainingMs < 0 ||
        allocation.remainingMs > 2400000
      )
        throw Error('Hitch document allocation');
      documentId = allocation.id;
      identity = allocation.identity ?? identity;
      if (!['solo', 'preparation'].includes(identity.role))
        throw Error('Unknown hitch document role');
      if (
        identity.origin !== null &&
        (environment.location?.origin !== identity.origin ||
          environment.location?.pathname !== identity.path)
      )
        throw Error('Hitch document location mismatch');
      limit = allocation.records;
      deadline = Math.min(deadline, environment.performance.now() + allocation.remainingMs);
      // Init runs before navigation returns. Preserve its boot records, but never
      // let a subsequent document renew the row-wide retained-record allowance.
      if (used > limit) {
        firstOverflowAt ??= view.getFloat64(limit * 24 + 8, true);
        for (let index = limit; index < used; index++)
          retained[view.getUint32(index * 24 + 16, true) & 15]--;
        used = limit;
      }
      configured = true;
      return state();
    },
    phase(next, at = environment.performance.now()) {
      if (!Number.isInteger(next) || next < 0 || next > 6) {
        clockInvalid = true;
        return;
      }
      if (next !== phase) append(4, at, at, phase, next, flags(), flags());
      if (next === 2) runningSeen = true;
      phase = next;
    },
    frame(start, end, before, after) {
      if (before === 2 || after === 2) runningSeen = true;
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        end < start ||
        (lastFrameEnd !== null && start < lastFrameEnd)
      )
        clockInvalid = true;
      else if (end - start > 33) append(1, start, end, before, after, previousFrameFlags, flags());
      else if (sealed && (before === 2 || after === 2)) postSealActive = true;
      if (!sealed && !clockInvalid && before === 2 && after === 2 && end > start) {
        activeFrames++;
        activeElapsedMs += end - start;
        active(start, end);
      }
      lastFrameEnd = end;
      previousFrameFlags = flags();
    },
    first(timestampMs, callbackAtMs) {
      if (!Number.isFinite(timestampMs) || !Number.isFinite(callbackAtMs)) clockInvalid = true;
      if (firstCallback === null)
        firstCallback = { timestampMs, callbackAtMs, registeredAtMs: startedAt };
    },
    subscribe(at) {
      if (!Number.isFinite(at)) clockInvalid = true;
      workSubscribedAt ??= at;
    },
    beginWork(at, currentPhase) {
      workCallsSeen = true;
      if (currentPhase === 2) runningSeen = true;
      if (workStart !== null || !Number.isFinite(at) || (lastWorkEnd !== null && at < lastWorkEnd))
        clockInvalid = true;
      workStart = at;
      workPhase = currentPhase;
      workFlags = flags();
    },
    endWork(at, currentPhase) {
      if (workStart === null) {
        clockInvalid = true;
        return;
      }
      if (!Number.isFinite(at) || at < workStart) clockInvalid = true;
      else if (at - workStart >= 50)
        append(2, workStart, at, workPhase, currentPhase, workFlags, flags());
      else if (sealed && (workPhase === 2 || currentPhase === 2)) postSealActive = true;
      if (!sealed && !clockInvalid && workPhase === 2 && currentPhase === 2 && at > workStart) {
        activeWorkWindows++;
        active(workStart, at);
      }
      lastWorkEnd = at;
      workStart = null;
    },
    state,
    seal(currentPhase) {
      if (sealed) throw Error('Hitch journal may export once per document');
      if (
        identity.origin !== null &&
        (environment.location?.origin !== identity.origin ||
          environment.location?.pathname !== identity.path)
      )
        throw Error('Hitch document location changed before export');
      if (currentPhase === 'running' || currentPhase === 2)
        throw Error('Hitch journal export requires a non-running boundary');
      if (identity.role === 'preparation') {
        if (
          currentPhase !== undefined ||
          phase !== 6 ||
          runningSeen ||
          workCallsSeen ||
          workSubscribedAt !== null
        )
          throw Error('Preparation document cannot claim Solo work or flight state');
        currentPhase = 'declared-preparation';
      } else if (currentPhase === 'declared-preparation')
        throw Error('Undeclared preparation boundary');
      if (
        ![
          'boot',
          'briefing',
          'paused',
          'result',
          'picture',
          'other',
          'declared-preparation',
        ].includes(currentPhase)
      )
        throw Error('Hitch journal public boundary unavailable');
      if (nativeObserver) {
        nativeEntries(nativeObserver.takeRecords());
        nativeObserver.disconnect();
      }
      const header = state();
      sealed = true;
      header.sealed = true;
      header.endedAt = environment.performance.now();
      header.publicPhase = currentPhase;
      const bytes = new Uint8Array(buffer, 0, used * 24),
        parts = [];
      for (let offset = 0; offset < bytes.length; offset += 32766) {
        let chunk = '';
        const stop = Math.min(bytes.length, offset + 32766);
        for (let index = offset; index < stop; index++) chunk += String.fromCharCode(bytes[index]);
        parts.push(environment.btoa(chunk));
      }
      const base64 = parts.join('');
      buffer = null;
      view = null;
      return { header, base64 };
    },
  };
  const visibility = () => {
    const before = flags();
    visible = !environment.document.hidden;
    const at = environment.performance.now();
    append(5, at, at, phase, phase, before, flags());
  };
  const focus = (value) => {
    const before = flags();
    focused = value;
    const at = environment.performance.now();
    append(6, at, at, phase, phase, before, flags());
  };
  environment.document.addEventListener('visibilitychange', visibility);
  environment.addEventListener('focus', () => focus(true));
  environment.addEventListener('blur', () => focus(false));
  return journal;
}

export function hitchJournalInitScript() {
  return `if (window.top === window) window.soloQualificationHitchJournal = (${createBrowserHitchJournal.toString()})();`;
}

export function* decodeHitchJournal(bytes) {
  assert(bytes.byteLength <= HITCH_LIMITS.records * 24 && bytes.byteLength % 24 === 0);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const previousEnd = [null, null, null];
  for (let offset = 0; offset < bytes.byteLength; offset += 24) {
    const startMs = view.getFloat64(offset, true),
      endMs = view.getFloat64(offset + 8, true),
      packed = view.getUint32(offset + 16, true),
      sequence = view.getUint32(offset + 20, true),
      kind = packed & 15,
      before = (packed >>> 4) & 15,
      after = (packed >>> 8) & 15;
    assert(Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs);
    assert(sequence === offset / 24 && kind >= 1 && kind <= 6 && before <= 6 && after <= 6);
    assert(packed >>> 16 === 0, 'Unknown hitch flags');
    assert(kind !== 1 || endMs - startMs > 33, 'Invalid rAF hitch threshold');
    assert(![2, 3].includes(kind) || endMs - startMs >= 50, 'Invalid work/task threshold');
    assert(kind < 4 || startMs === endMs, 'Invalid boundary duration');
    // Native entries are asynchronous; cross-kind append order is not time order.
    if (kind <= 2) {
      assert(previousEnd[kind] === null || startMs >= previousEnd[kind], 'Retrograde hitch stream');
      previousEnd[kind] = endMs;
    }
    yield { startMs, endMs, durationMs: endMs - startMs, kind, before, after, packed, sequence };
  }
}

export async function verifyHitchJournalFile(path, expectedBytes, expectedSha256) {
  assert(
    Number.isSafeInteger(expectedBytes) &&
      expectedBytes >= 0 &&
      expectedBytes <= HITCH_LIMITS.records * 24,
  );
  assert(/^[0-9a-f]{64}$/.test(expectedSha256));
  const file = await open(path, 'r');
  try {
    const initial = await file.stat();
    assert(initial.isFile() && initial.size === expectedBytes, 'Hitch readback byte count');
    const bytes = Buffer.alloc(expectedBytes);
    let offset = 0;
    while (offset < bytes.length) {
      const result = await file.read(bytes, offset, bytes.length - offset, offset);
      assert(result.bytesRead > 0, 'Truncated hitch readback');
      offset += result.bytesRead;
    }
    assert.equal((await file.stat()).size, expectedBytes, 'Changed hitch readback size');
    assert.equal(
      createHash('sha256').update(bytes).digest('hex'),
      expectedSha256,
      'Hitch readback hash',
    );
    return { bytes: offset, sha256: expectedSha256, readbackVerified: true };
  } finally {
    await file.close();
  }
}

export function createHitchJournalStore(output, now = () => performance.now(), options = {}) {
  assert(
    options.preparationPolicy === undefined ||
      options.preparationPolicy === 'first-return-anchored-v1',
  );
  const soloURL = options.soloURL ? new URL(options.soloURL) : null;
  assert(!options.preparationPolicy || soloURL, 'Preparation requires the admitted Solo URL');
  const report = {
    format: 'SoloHitchJournalV1',
    status: 'observing',
    limits: HITCH_LIMITS,
    bytes: 0,
    records: 0,
    documents: [],
    failures: [],
    activePlayCoverage: 'unobserved',
    preparationPolicy: options.preparationPolicy ?? null,
    scope:
      'Individual observed rAF>33ms and work>=50ms windows; native tasks feature-detected. Pending native entries drain at seal; later/unreported delivery is unobserved and absent drop-count capability is not zero. No physical display or overhead-free claim.',
  };
  let startedAt = null,
    current = null;
  const fail = (reason) => {
    report.status = 'incomplete';
    if (report.failures.length < 64) {
      let retained = String(reason).slice(0, 256);
      // JSON escaping and multibyte text must fit the reserved byte budget too.
      while (Buffer.byteLength(JSON.stringify(retained)) > 256) retained = retained.slice(0, -1);
      report.failures.push(retained);
    }
  };
  const documentIdentity = (navigation, index) => {
    if (!soloURL) return { role: 'solo', origin: null, path: null, action: null };
    const target = new URL(navigation?.url);
    assert.equal(target.origin, soloURL.origin, 'Hitch document origin');
    let role = 'solo';
    if (options.preparationPolicy) {
      assert(index <= 2, 'Only the declared preparation and Solo documents are admitted');
      assert.equal(
        navigation.action,
        index === 1 ? 'initial' : 'follow-4',
        'Hitch navigation action',
      );
      role = index === 1 ? 'preparation' : 'solo';
    }
    assert.equal(
      target.pathname,
      role === 'preparation' ? new URL('playground/', soloURL).pathname : soloURL.pathname,
      'Hitch document path',
    );
    assert(navigation.action.length <= 128);
    return { role, origin: target.origin, path: target.pathname, action: navigation.action };
  };
  return {
    report,
    fail,
    beginDocument(navigation) {
      startedAt ??= now();
      if (current?.status === 'open') {
        current.status = 'lost';
        fail('Document replaced before its single export');
      }
      assert(report.documents.length < HITCH_LIMITS.documents, 'Hitch document cap');
      const identity = documentIdentity(navigation, report.documents.length + 1);
      const next = { id: report.documents.length + 1, status: 'open', identity };
      assert(
        Buffer.byteLength(JSON.stringify({ ...report, documents: [...report.documents, next] })) <=
          HITCH_LIMITS.descriptorBytes - 20480,
        'Hitch descriptor cap',
      );
      current = next;
      report.documents.push(current);
      return {
        id: current.id,
        identity,
        records: HITCH_LIMITS.records - report.records,
        remainingMs: Math.max(0, HITCH_LIMITS.durationMs - (now() - startedAt)),
      };
    },
    allocation() {
      assert(current?.status === 'open');
      return {
        id: current.id,
        identity: current.identity,
        records: HITCH_LIMITS.records - report.records,
        remainingMs: Math.max(0, HITCH_LIMITS.durationMs - (now() - startedAt)),
      };
    },
    async retain(result, boundary) {
      assert(current?.status === 'open', 'Hitch document already exported');
      const header = result?.header;
      assert(header?.format === 'SoloHitchJournalDocumentV1');
      assert.equal(header.documentId, current.id, 'Lost/unconfigured document');
      assert.deepEqual(header.identity, current.identity, 'Changed hitch document identity');
      assert.deepEqual(
        header.location,
        current.identity.origin === null
          ? null
          : { origin: current.identity.origin, path: current.identity.path },
        'Changed hitch document location',
      );
      const preparation = current.identity.role === 'preparation';
      assert.equal(
        header.workScope,
        preparation
          ? 'unobserved-preparation'
          : header.workSubscribedAt === null
            ? 'unobserved'
            : 'subscribed-solo',
      );
      if (preparation) {
        assert.equal(boundary, 'before-follow-4');
        assert.equal(header.publicPhase, 'declared-preparation');
        assert.equal(header.workSubscribedAt, null);
        assert.equal(header.runningSeen, false);
        assert.equal(header.workCallsSeen, false);
        assert.equal(header.phase, 6);
      } else assert.notEqual(header.publicPhase, 'declared-preparation');
      assert.equal(header.sealed, true);
      assert.equal(header.configured, true);
      assert(Number.isSafeInteger(header.records) && header.records >= 0);
      assert(
        Number.isSafeInteger(header.capacity) &&
          header.capacity >= header.records &&
          header.capacity <= HITCH_LIMITS.records - report.records,
      );
      assert(
        [
          'boot',
          'briefing',
          'paused',
          'result',
          'picture',
          'other',
          'declared-preparation',
        ].includes(header.publicPhase),
      );
      assert.equal(typeof result.base64, 'string');
      assert(result.base64.length <= 5568000 && /^[A-Za-z0-9+/]*={0,2}$/.test(result.base64));
      const bytes = Buffer.from(result.base64, 'base64');
      assert.equal(bytes.toString('base64'), result.base64, 'Noncanonical hitch encoding');
      assert.equal(bytes.length, header.records * 24);
      assert(report.records + header.records <= HITCH_LIMITS.records, 'Row hitch budget');
      assert(
        Number.isFinite(header.timeOrigin) &&
          Number.isFinite(header.endedAt) &&
          Number.isFinite(header.startedAt),
      );
      assert(header.startedAt >= 0 && header.endedAt >= header.startedAt);
      assert(
        Number.isFinite(header.deadline) &&
          header.deadline >= header.startedAt &&
          header.deadline <= header.startedAt + HITCH_LIMITS.durationMs,
      );
      for (const key of ['clockInvalid', 'durationExceeded', 'postSealActive', 'complete'])
        assert.equal(typeof header[key], 'boolean');
      for (const key of ['firstOverflowAt', 'unmatchedWorkStart', 'workSubscribedAt'])
        assert(header[key] === null || Number.isFinite(header[key]));
      assert(
        header.firstCallback === null ||
          ['timestampMs', 'callbackAtMs', 'registeredAtMs'].every((key) =>
            Number.isFinite(header.firstCallback[key]),
          ),
      );
      assert(['observed', 'unobserved', 'failed'].includes(header.nativeTasks));
      assert(
        header.nativeDropped === null ||
          (Number.isSafeInteger(header.nativeDropped) && header.nativeDropped >= 0),
      );
      const retained = Array(7).fill(0);
      for (const row of decodeHitchJournal(bytes)) retained[row.kind]++;
      assert.deepEqual(retained, header.retained);
      assert(Array.isArray(header.observed) && header.observed.length === 7);
      assert(
        header.observed.every(
          (value, index) => Number.isSafeInteger(value) && value >= retained[index],
        ),
      );
      assert.equal(header.observed[0], 0);
      assert.equal(typeof header.runningSeen, 'boolean');
      assert.equal(typeof header.workCallsSeen, 'boolean');
      for (const key of ['activeFrames', 'activeWorkWindows'])
        assert(Number.isSafeInteger(header[key]) && header[key] >= 0);
      assert(Number.isFinite(header.activeElapsedMs) && header.activeElapsedMs >= 0);
      for (const key of ['firstActiveAt', 'lastActiveAt'])
        assert(header[key] === null || Number.isFinite(header[key]));
      if (header.activeFrames || header.activeWorkWindows) {
        assert(
          header.runningSeen &&
            header.firstActiveAt !== null &&
            header.lastActiveAt > header.firstActiveAt,
        );
      } else
        assert(
          header.firstActiveAt === null &&
            header.lastActiveAt === null &&
            header.activeElapsedMs === 0,
        );
      if (preparation) assert(header.activeFrames === 0 && header.activeWorkWindows === 0);
      if (header.complete) {
        assert(header.firstCallback !== null && (preparation || header.workSubscribedAt !== null));
        assert(header.firstOverflowAt === null && header.unmatchedWorkStart === null);
        assert(!header.clockInvalid && !header.durationExceeded && !header.postSealActive);
        assert(header.nativeTasks !== 'failed' && !(header.nativeDropped > 0));
        assert(header.endedAt <= header.deadline);
        assert(
          header.lastActiveAt === null ||
            (header.firstActiveAt >= 0 && header.lastActiveAt <= header.endedAt),
          'Active timestamps outside document observation',
        );
        assert(header.activeElapsedMs <= HITCH_LIMITS.durationMs);
        assert.deepEqual(header.observed, retained, 'Missing observed hitch records');
      }
      const path = `${resolve(output)}.hitches.d${String(current.id).padStart(2, '0')}.bin`;
      assert.equal(await realpath(dirname(path)), dirname(path), 'Hitch output parent alias');
      const descriptor = {
        ...current,
        status: header.complete ? 'complete' : 'incomplete',
        boundary,
        path,
        bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        readbackVerified: true,
        header,
      };
      // Reserve room for every bounded failure reason and remaining lost/open
      // document descriptors, even if a later export cannot be retained.
      assert(
        Buffer.byteLength(
          JSON.stringify({ ...report, documents: [...report.documents.slice(0, -1), descriptor] }),
        ) <=
          HITCH_LIMITS.descriptorBytes - 20480,
        'Hitch descriptor cap',
      );
      const file = await open(path, 'wx');
      try {
        await file.writeFile(bytes);
        await file.sync();
      } finally {
        await file.close();
      }
      await verifyHitchJournalFile(path, bytes.length, descriptor.sha256);
      Object.assign(current, descriptor);
      report.records += header.records;
      report.bytes += bytes.length;
      if (!header.complete) fail(`Incomplete document ${current.id}`);
      return descriptor;
    },
    finish() {
      if (current?.status === 'open') {
        current.status = 'lost';
        fail('Final document unavailable');
      }
      if (!report.documents.length) fail('No observed document');
      const final = report.documents.at(-1);
      const active =
        final?.status === 'complete' &&
        final.identity.role === 'solo' &&
        ['paused', 'result', 'picture'].includes(final.header.publicPhase) &&
        final.header.workScope === 'subscribed-solo' &&
        final.header.activeFrames > 0 &&
        final.header.activeWorkWindows > 0 &&
        final.header.activeElapsedMs > 0 &&
        final.header.lastActiveAt > final.header.firstActiveAt;
      report.activePlayCoverage = active ? 'observed-final-solo' : 'incomplete';
      if (!active) fail('No positive final Solo frame/work coverage');
      if (startedAt !== null && now() - startedAt > HITCH_LIMITS.durationMs)
        fail('Row observation exceeded forty minutes');
      if (!report.failures.length) report.status = 'complete';
      return report;
    },
  };
}
