/** Offline diagnostic tooling only. A trace never grants replay admission. */
export const DEMO_TICK_TRACE_FORMAT = 'DemoTickTraceV1';
export const DEMO_TICK_RECEIPT_FORMAT = 'DemoTickTraceReceiptV1';
export const DEMO_TICK_LIMIT = 30 * 60 * 120;
const MAX_TRACE_BYTES = 32 * 1024 * 1024;
const identityPattern = /^[a-f0-9]{8,128}$/;
const shaPattern = /^[a-f0-9]{64}$/;
const bindingKeys = [
  'modeId',
  'levelId',
  'variantId',
  'contentIdentity',
  'simulationIdentity',
  'recordingIdentity',
];
const outcomes = ['won', 'lost', 'complete', 'failed', 'expired'];

function plain(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value, keys, name) {
  if (!plain(value) || Object.keys(value).sort().join('\0') !== [...keys].sort().join('\0'))
    throw new TypeError(`Invalid ${name} fields.`);
}
function abort(signal) {
  if (signal?.aborted) throw signal.reason ?? new DOMException('Cancelled', 'AbortError');
}
function canonical(value, depth = 0) {
  if (depth > 40) throw new RangeError('Diagnostic data exceeds its depth limit.');
  if (value === null || typeof value === 'boolean' || typeof value === 'string')
    return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonical(item, depth + 1)).join(',')}]`;
  if (plain(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key], depth + 1)}`)
      .join(',')}}`;
  throw new TypeError('Diagnostic identity requires finite JSON data.');
}
export async function demoTickSHA256(value) {
  const bytes = new TextEncoder().encode(canonical(value));
  if (bytes.length > MAX_TRACE_BYTES) throw new RangeError('Diagnostic data exceeds 32 MiB.');
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
function owned(value) {
  const text = canonical(value);
  if (new TextEncoder().encode(text).length > MAX_TRACE_BYTES)
    throw new RangeError('Diagnostic data exceeds 32 MiB.');
  return JSON.parse(text);
}
function checkBinding(value) {
  exactKeys(value, bindingKeys, 'trace binding');
  if (
    !['solo', 'snake', 'sim', 'survival'].includes(value.modeId) ||
    bindingKeys.some(
      (key) => typeof value[key] !== 'string' || !value[key] || value[key].length > 1024,
    ) ||
    !shaPattern.test(value.recordingIdentity)
  )
    throw new TypeError('Invalid exact recording, content or simulation binding.');
  return owned(value);
}
function checkRuntime(value) {
  exactKeys(value, ['engine', 'version', 'implementation'], 'runtime provenance');
  for (const key of Object.keys(value))
    if (typeof value[key] !== 'string' || !value[key].trim() || value[key].length > 1024)
      throw new TypeError('Runtime provenance must identify engine, version and implementation.');
  return owned(value);
}
function checkSummary(value, maxTicks) {
  exactKeys(value, ['terminalTick', 'terminalIdentity', 'outcome'], 'native terminal verification');
  if (
    !Number.isSafeInteger(value.terminalTick) ||
    value.terminalTick < 1 ||
    value.terminalTick > maxTicks ||
    typeof value.terminalIdentity !== 'string' ||
    !identityPattern.test(value.terminalIdentity) ||
    !outcomes.includes(value.outcome)
  )
    throw new TypeError('A complete native terminal verification is required.');
  return owned(value);
}
function checkAdapter(adapter) {
  if (
    !adapter ||
    typeof adapter.verify !== 'function' ||
    typeof adapter.observe !== 'function' ||
    !Number.isSafeInteger(adapter.maxTicks) ||
    adapter.maxTicks < 1 ||
    adapter.maxTicks > DEMO_TICK_LIMIT
  )
    throw new TypeError('Invalid native trace adapter.');
  return checkBinding(adapter.binding);
}
function checkTick(row, next, maxTicks) {
  if (
    !plain(row) ||
    row.tick !== next ||
    next > maxTicks ||
    typeof row.stateIdentity !== 'string' ||
    !identityPattern.test(row.stateIdentity)
  )
    throw new TypeError(
      'Trace observation must contain every consecutive native tick, starting at 0.',
    );
}
function checkObserved(summary, hashes, maxTicks) {
  const result = checkSummary(summary, maxTicks);
  if (hashes.length !== result.terminalTick + 1 || hashes.at(-1) !== result.terminalIdentity)
    throw new Error('Observed trace does not reach its claimed native terminal state.');
  return result;
}

/** Produce a reference only after independent full native verification. Observe
 * a second complete replay and require its terminal result to match exactly. */
export async function captureDemoTickTrace(adapter, { runtime, signal, yieldTask } = {}) {
  const binding = checkAdapter(adapter);
  const provenance = checkRuntime(runtime);
  abort(signal);
  const verification = checkSummary(await adapter.verify({ signal, yieldTask }), adapter.maxTicks);
  abort(signal);
  const hashes = [];
  const observed = await adapter.observe({
    signal,
    yieldTask,
    onTick(row) {
      abort(signal);
      checkTick(row, hashes.length, Math.min(adapter.maxTicks, verification.terminalTick));
      hashes.push(row.stateIdentity);
    },
  });
  abort(signal);
  const terminal = checkObserved(observed, hashes, adapter.maxTicks);
  if (canonical(terminal) !== canonical(verification))
    throw new Error('Observed trace differs from the independently verified native result.');
  if (canonical(checkBinding(adapter.binding)) !== canonical(binding))
    throw new Error('Recording binding changed during reference capture.');
  const trace = {
    format: DEMO_TICK_TRACE_FORMAT,
    binding,
    runtime: provenance,
    verification,
    hashes,
  };
  const receipt = {
    format: DEMO_TICK_RECEIPT_FORMAT,
    traceSha256: await demoTickSHA256(trace),
    bindingSha256: await demoTickSHA256(binding),
  };
  abort(signal);
  return { trace, receipt };
}

async function admitReference(source, receiptSource, binding, maxTicks) {
  const trace = owned(source);
  const receipt = owned(receiptSource);
  exactKeys(trace, ['format', 'binding', 'runtime', 'verification', 'hashes'], 'reference trace');
  exactKeys(receipt, ['format', 'traceSha256', 'bindingSha256'], 'reference receipt');
  if (
    trace.format !== DEMO_TICK_TRACE_FORMAT ||
    receipt.format !== DEMO_TICK_RECEIPT_FORMAT ||
    !shaPattern.test(receipt.traceSha256) ||
    !shaPattern.test(receipt.bindingSha256)
  )
    throw new TypeError('Unsupported reference trace or receipt.');
  checkRuntime(trace.runtime);
  checkBinding(trace.binding);
  checkSummary(trace.verification, maxTicks);
  if (
    !Array.isArray(trace.hashes) ||
    trace.hashes.length !== trace.verification.terminalTick + 1 ||
    trace.hashes.some((hash) => typeof hash !== 'string' || !identityPattern.test(hash)) ||
    trace.hashes.at(-1) !== trace.verification.terminalIdentity
  )
    throw new TypeError('The reference trace is incomplete or has malformed state identities.');
  if (
    canonical(trace.binding) !== canonical(binding) ||
    (await demoTickSHA256(binding)) !== receipt.bindingSha256
  )
    throw new Error(
      'Reference trace belongs to different recording, content, simulation or variant.',
    );
  if ((await demoTickSHA256(trace)) !== receipt.traceSha256)
    throw new Error('Reference trace does not match its independently retained receipt.');
  return { trace, traceSha256: receipt.traceSha256 };
}
function errorDiagnostic(error) {
  return {
    name: String(error?.name ?? 'Error').slice(0, 120),
    message: String(error?.message ?? error).slice(0, 2000),
    ...(typeof error?.code === 'string' ? { code: error.code.slice(0, 120) } : {}),
  };
}

/** Diagnostic comparison only. The unchanged native verifier runs separately;
 * no hash, checkpoint, recording, or native verification result is rewritten. */
export async function compareDemoTickTrace(
  adapter,
  { trace: source, receipt },
  { signal, yieldTask, runtime } = {},
) {
  const binding = checkAdapter(adapter);
  abort(signal);
  const { trace, traceSha256 } = await admitReference(source, receipt, binding, adapter.maxTicks);
  abort(signal);
  const result = {
    format: 'DemoTickComparisonV1',
    binding,
    referenceRuntime: trace.runtime,
    ...(runtime ? { candidateRuntime: checkRuntime(runtime) } : {}),
    referenceTraceSha256: traceSha256,
    match: false,
    firstDivergentTick: null,
    lastMatchingTick: null,
    nativeVerification: null,
  };
  try {
    const summary = checkSummary(await adapter.verify({ signal, yieldTask }), adapter.maxTicks);
    result.nativeVerification = { passed: true, ...summary };
  } catch (error) {
    abort(signal);
    if (error?.name === 'AbortError') throw error;
    result.nativeVerification = { passed: false, error: errorDiagnostic(error) };
  }
  abort(signal);
  let next = 0;
  const divergence = new Error('Exact trace mismatch located.');
  const mismatch = (tick, expected, actual, kind) => {
    Object.assign(result, { firstDivergentTick: tick, expected, actual, kind });
  };
  try {
    const observed = await adapter.observe({
      signal,
      yieldTask,
      onTick(row) {
        abort(signal);
        checkTick(row, next, adapter.maxTicks);
        const expected = trace.hashes[next] ?? null;
        if (row.stateIdentity !== expected) {
          mismatch(
            next,
            expected,
            row.stateIdentity,
            expected === null ? 'extra-native-tick' : 'state-mismatch',
          );
          throw divergence;
        }
        result.lastMatchingTick = next++;
      },
    });
    abort(signal);
    if (next !== trace.hashes.length) {
      mismatch(next, trace.hashes[next], null, 'missing-native-tick');
    } else {
      const terminal = checkSummary(observed, adapter.maxTicks);
      if (terminal.terminalTick !== next - 1 || terminal.terminalIdentity !== trace.hashes.at(-1))
        throw new Error('Candidate observation does not reach its declared terminal state.');
      if (canonical(terminal) !== canonical(trace.verification)) {
        result.kind = 'terminal-summary-mismatch';
        result.observedTerminal = terminal;
      } else if (!result.nativeVerification.passed) result.kind = 'native-verification-failed';
      else {
        const { passed, ...verified } = result.nativeVerification;
        void passed;
        if (canonical(verified) !== canonical(trace.verification))
          result.kind = 'native-terminal-mismatch';
        else {
          result.match = true;
          result.kind = 'identical-native-trace';
        }
      }
    }
  } catch (error) {
    abort(signal);
    if (error?.name === 'AbortError') throw error;
    if (error !== divergence) {
      result.kind = 'observation-failed';
      result.observationError = errorDiagnostic(error);
    }
  }
  if (canonical(checkBinding(adapter.binding)) !== canonical(binding))
    throw new Error('Recording binding changed during candidate observation.');
  return result;
}
