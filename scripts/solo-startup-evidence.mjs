import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { open } from 'node:fs/promises';
import { createReadStream } from 'node:fs';

export async function startupDeadline(promise, label, milliseconds = 10000) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} exceeded ${milliseconds} ms`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// Keep the actual bytes even when a stream is capped or interrupted. Such a file
// may be incomplete JSON and is never admitted to the trace analysis.
export async function retainStartupTrace(cdp, stream, file, maximumBytes = 64 * 1024 * 1024) {
  assert(Number.isSafeInteger(maximumBytes) && maximumBytes > 0);
  const report = { file, status: 'partial', bytes: 0, maximumBytes };
  let handle;
  const readDeadline = Date.now() + 30000;
  try {
    handle = await open(file, 'wx');
    for (;;) {
      const remaining = readDeadline - Date.now();
      assert(remaining > 0, 'Trace stream exceeded 30 seconds');
      const chunk = await startupDeadline(
        cdp.send('IO.read', { handle: stream, size: 65536 }),
        'Trace read',
        Math.min(10000, remaining),
      );
      const bytes = Buffer.from(chunk.data, chunk.base64Encoded ? 'base64' : 'utf8');
      const retained = bytes.subarray(0, maximumBytes - report.bytes);
      await handle.writeFile(retained);
      report.bytes += retained.length;
      if (retained.length !== bytes.length || (!chunk.eof && report.bytes === maximumBytes)) {
        report.failure = 'Trace byte limit reached; the partial file is not complete evidence.';
        report.capped = true;
        break;
      }
      if (chunk.eof) {
        report.status = 'complete';
        break;
      }
    }
  } catch (error) {
    report.failure = String(error.stack ?? error);
  } finally {
    if (handle) {
      try {
        await handle.close();
        const hash = createHash('sha256');
        let actualBytes = 0;
        for await (const bytes of createReadStream(file)) {
          hash.update(bytes);
          actualBytes += bytes.length;
        }
        report.bytes = actualBytes;
        report.sha256 = hash.digest('hex');
      } catch (error) {
        report.status = 'partial';
        report.readbackFailure = String(error.message);
      }
    }
    await startupDeadline(cdp.send('IO.close', { handle: stream }), 'Trace stream close').catch(
      (error) => {
        report.closeFailure = String(error.message);
      },
    );
  }
  return report;
}

export function summarizeStartupResources(snapshot) {
  assert(Array.isArray(snapshot?.resources), 'Resource entries are unavailable');
  const modules = snapshot.resources.filter((entry) => {
    try {
      return /\.(?:mjs|js)$/i.test(new URL(entry.name).pathname);
    } catch {
      return false;
    }
  });
  const missingSizes = modules.filter((entry) =>
    ['transferSize', 'encodedBodySize', 'decodedBodySize'].some(
      (key) => !Number.isFinite(entry[key]) || entry[key] < 0,
    ),
  ).length;
  const sum = (key) =>
    modules.reduce((total, entry) => total + (Number.isFinite(entry[key]) ? entry[key] : 0), 0);
  return {
    status:
      snapshot.resourceBufferFull || snapshot.resourcesTruncated || missingSizes || !modules.length
        ? 'incomplete'
        : 'observed',
    missingScriptSizeRows: missingSizes,
    allResourceCount: snapshot.resources.length,
    scriptResourceCount: modules.length,
    scriptTransferBytes: sum('transferSize'),
    scriptEncodedBodyBytes: sum('encodedBodySize'),
    scriptDecodedBodyBytes: sum('decodedBodySize'),
    zeroTransferScriptResources: modules.filter((entry) => entry.transferSize === 0).length,
    scope:
      'Cumulative .js/.mjs resource entries for this document, including lazy requests before the snapshot. Never add multiple snapshots from one document. Transfer includes protocol headers; encoded/decoded sizes describe response bodies. Zero transfer does not independently prove a cache hit. Missing or overflowed entries are not estimated.',
  };
}

const category = (name) => {
  if (/^(?:Evaluate(?:Script|Module)|v8\.evaluate(?:Script|Module))$/i.test(name))
    return 'evaluation';
  if (/^(?:Compile(?:Script|Module|Code)|v8\..*compil)/i.test(name)) return 'compilation';
  if (/^v8\..*pars/i.test(name)) return 'parsing';
  return null;
};
const unionDuration = (spans) => {
  let total = 0,
    end = -Infinity;
  for (const [start, finish] of spans.sort((a, b) => a[0] - b[0])) {
    if (finish > end) total += finish - Math.max(start, end);
    end = Math.max(end, finish);
  }
  return total;
};

export function analyzeStartupTrace(trace) {
  assert(Array.isArray(trace?.traceEvents), 'Complete traceEvents required');
  const markers = trace.traceEvents.filter(
    (event) => event.name?.startsWith('solo-startup:') && Number.isFinite(event.ts),
  );
  const documents = markers
    .filter((event) => event.name === 'solo-startup:document')
    .sort((a, b) => a.ts - b.ts);
  assert(documents.length, 'No document timing anchor observed');
  const final = Math.max(...markers.map((event) => event.ts));
  const evaluations = trace.traceEvents.filter(
    (event) =>
      event.ph === 'X' &&
      category(event.name) &&
      Number.isFinite(event.ts) &&
      Number.isFinite(event.dur) &&
      event.dur >= 0,
  );
  return {
    status: evaluations.some(
      (event) =>
        category(event.name) === 'evaluation' &&
        documents.some(
          (document) =>
            event.pid === document.pid &&
            event.tid === document.tid &&
            event.ts + event.dur > document.ts &&
            event.ts < final,
        ),
    )
      ? 'observed'
      : 'unobserved',
    scope:
      'Renderer-main-thread trace evaluation/compilation/parsing spans. Inclusive rows can overlap and must not be summed; union time counts overlap once. Events without a recognized name or source URL remain unassigned, not zero evaluation cost. This is profiling, not a startup speed gate.',
    markers: markers.map(({ name, ts, pid, tid }) => ({ name, timestampUs: ts, pid, tid })),
    documents: documents.map((document, index) => {
      const end = documents[index + 1]?.ts ?? final;
      const spans = [],
        grouped = new Map();
      for (const event of evaluations) {
        if (event.pid !== document.pid || event.tid !== document.tid) continue;
        const start = Math.max(document.ts, event.ts),
          finish = Math.min(end, event.ts + event.dur);
        if (finish <= start) continue;
        const url = event.args?.data?.url ?? event.args?.url ?? event.args?.data?.fileName ?? null;
        const key = JSON.stringify([category(event.name), event.name, url]);
        const row = grouped.get(key) ?? {
          category: category(event.name),
          eventName: event.name,
          url,
          count: 0,
          inclusiveMs: 0,
        };
        row.count++;
        row.inclusiveMs += (finish - start) / 1000;
        grouped.set(key, row);
        spans.push([start, finish]);
      }
      return {
        index,
        startTimeUs: document.ts,
        endTimeUs: end,
        unionMs: unionDuration(spans) / 1000,
        rows: [...grouped.values()].sort((a, b) => b.inclusiveMs - a.inclusiveMs),
      };
    }),
  };
}
