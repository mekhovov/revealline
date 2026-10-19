import { readFile, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

const requireValue = (condition, message) => {
  if (!condition) throw new Error(message);
};
const localContact = /^http:\/\/127\.0\.0\.1:\d+\/contact\.html$/;
const vendorStep =
  /^step \(http:\/\/127\.0\.0\.1:\d+\/optional-practice\/civilian-fpv\/vendor\/rapier\/rapier\.mjs:/;
const wasmFunction =
  /^wasm-function\[(\d+)\] \(http:\/\/127\.0\.0\.1:\d+\/optional-practice\/civilian-fpv\/vendor\/rapier\/rapier\.mjs line 1 > WebAssembly\.instantiate:(\d+)\)$/;

/** Summarize only this owned tape's content thread and measured replay intervals.
 * Counts are samples, not timings or symbolicated native instruction attribution. */
export function summarizeGeckoContact(profile) {
  requireValue(profile?.meta?.version === 34, 'Unsupported Gecko profile format');
  const pending = [profile],
    matches = [];
  let processes = 0;
  while (pending.length) {
    const process = pending.pop();
    requireValue(++processes <= 32, 'Too many processes');
    if (process.pages?.some((page) => localContact.test(page.url))) matches.push(process);
    pending.push(...(process.processes ?? []));
  }
  requireValue(matches.length === 1, 'Expected one local contact content process');
  const process = matches[0],
    threads = process.threads.filter((thread) => thread.name === 'GeckoMain');
  requireValue(threads.length === 1, 'Expected one content main thread');
  const thread = threads[0],
    windows = [];
  const table = (name, fields) => {
    const value = thread[name];
    requireValue(
      value && Array.isArray(value.data) && value.data.length <= 1000000,
      `Invalid ${name}`,
    );
    for (const field of fields)
      requireValue(
        Number.isSafeInteger(value.schema?.[field]) && value.schema[field] >= 0,
        `Missing ${name}.${field}`,
      );
    return value;
  };
  const markers = table('markers', ['startTime', 'endTime', 'data']),
    samples = table('samples', ['time', 'stack']),
    frames = table('frameTable', ['location']),
    stacks = table('stackTable', ['prefix', 'frame']);
  requireValue(Array.isArray(thread.stringTable), 'Missing frame strings');
  for (const marker of markers.data) {
    const data = marker[markers.schema.data];
    if (
      data?.type !== 'UserTiming' ||
      data.entryType !== 'measure' ||
      !/^contact-replay-[0-2]$/.test(data.name)
    )
      continue;
    const start = marker[markers.schema.startTime],
      end = marker[markers.schema.endTime];
    requireValue(
      Number.isFinite(start) && Number.isFinite(end) && end > start,
      'Invalid replay interval',
    );
    windows.push({ repeat: Number(data.name.at(-1)), start, end });
  }
  windows.sort((a, b) => a.repeat - b.repeat);
  requireValue(
    windows.length === 3 &&
      windows.every(
        (window, index) =>
          window.repeat === index && (!index || window.start > windows[index - 1].end),
      ),
    'Expected three disjoint replay intervals',
  );
  const stackNames = (index) => {
    const names = [],
      visited = new Set();
    while (index !== null) {
      requireValue(
        Number.isSafeInteger(index) &&
          index >= 0 &&
          index < stacks.data.length &&
          !visited.has(index) &&
          visited.size < 1024,
        'Invalid or cyclic sample stack',
      );
      visited.add(index);
      const stack = stacks.data[index],
        frameIndex = stack[stacks.schema.frame];
      requireValue(
        Number.isSafeInteger(frameIndex) && frameIndex >= 0 && frameIndex < frames.data.length,
        'Invalid frame index',
      );
      const location = frames.data[frameIndex][frames.schema.location];
      requireValue(
        Number.isSafeInteger(location) && typeof thread.stringTable[location] === 'string',
        'Invalid frame location',
      );
      names.push(thread.stringTable[location]);
      index = stack[stacks.schema.prefix];
    }
    return names;
  };
  const results = windows.map((window) => {
    let replaySamples = 0,
      stepSamples = 0,
      wasmLeafSamples = 0;
    const self = new Map(),
      inclusive = new Map();
    for (const row of samples.data) {
      const time = row[samples.schema.time];
      requireValue(Number.isFinite(time), 'Invalid sample timestamp');
      if (time < window.start || time >= window.end) continue;
      replaySamples++;
      const names = stackNames(row[samples.schema.stack]);
      if (!names.some((name) => vendorStep.test(name))) continue;
      stepSamples++;
      const leaf = names[0]?.match(wasmFunction);
      if (leaf) {
        wasmLeafSamples++;
        const key = `wasm-function[${leaf[1]}]@${leaf[2]}`;
        self.set(key, (self.get(key) ?? 0) + 1);
      }
      const functions = new Set(
        names
          .map((name) => name.match(wasmFunction))
          .filter(Boolean)
          .map((match) => `wasm-function[${match[1]}]@${match[2]}`),
      );
      for (const name of functions) inclusive.set(name, (inclusive.get(name) ?? 0) + 1);
    }
    const top = (counts) =>
      [...counts]
        .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
        .slice(0, 12)
        .map(([functionLocation, samples]) => ({ functionLocation, samples }));
    return {
      ...window,
      replaySamples,
      stepSamples,
      wasmLeafSamples,
      topSelf: top(self),
      topInclusive: top(inclusive),
    };
  });
  requireValue(
    results.every((result) => result.stepSamples > 0),
    'No sampled physics steps',
  );
  return {
    format: 'FpvGeckoContactSamples.v1',
    profileVersion: profile.meta.version,
    configuration: profile.meta.configuration,
    process: { pid: thread.pid, tid: thread.tid, name: thread.processName, thread: thread.name },
    results,
    limitations: [
      'Sample counts are neither measured function durations nor exclusive CPU percentages.',
      'Only replay intervals and stacks containing the pinned vendor step wrappers are counted.',
      'WASM function indices/offsets are bound to the exact binary; source function names and generated machine instructions remain unresolved.',
    ],
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  requireValue(
    input && output && process.argv.length === 4,
    'Usage: node scripts/analyze-fpv-gecko-contact.mjs <local-profile.json> <new-summary.json>',
  );
  requireValue((await stat(input)).size <= 64 * 1024 * 1024, 'Profile exceeds 64 MiB bound');
  const bytes = await readFile(input),
    summary = summarizeGeckoContact(JSON.parse(bytes));
  summary.profile = {
    path: input,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
  await writeFile(output, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
}
