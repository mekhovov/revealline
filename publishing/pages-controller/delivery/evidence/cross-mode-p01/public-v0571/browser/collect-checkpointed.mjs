// Scoped protocol observation only. No page API replacement, storage writes, input or navigation.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import readline from 'node:readline';
const options = {};
for (let i = 2; i < process.argv.length; i += 2) options[process.argv[i].replace(/^--/, '')] = process.argv[i + 1];
const { endpoint, target, profile, scope, output } = options;
const healthPath = output + '.health.json';
if (fs.existsSync(healthPath)) throw new Error('Health path already exists');
let heartbeatTimer, healthBusy = false, input;
const collectorPid = process.pid;
const address = new URL(endpoint);
if (address.protocol !== 'ws:' || !['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname) ||
    !target || !profile?.startsWith('/') || !scope?.startsWith('https://') || !output) throw new Error('Explicit loopback browser endpoint, target, absolute profile, HTTPS scope and new output required.');
const fd = fs.openSync(output, 'wx');
const limit = 5 * 1024 * 1024;
let written = 0, capped = false, sequence = 0, nextId = 0, stopping = false;
const pending = new Map(), sessions = new Map(), workers = new Set();
let pageSession;
function health(state, facts = {}) {
  fs.writeFileSync(healthPath, JSON.stringify({ state, time: new Date().toISOString(), collectorPid, target, profile, scope, endpoint, eventSequence: sequence, logBytes: written, capped, ...facts }, null, 2) + '\n');
}
const digest = value => value == null ? null : ({ bytes: Buffer.byteLength(value), sha256: createHash('sha256').update(value).digest('hex') });
const cleanURL = value => {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? `${url.origin}${url.pathname}` : url.protocol; }
  catch { return '<invalid>'; }
};
function record(event, facts = {}) {
  if (capped || stopping) return;
  let line = JSON.stringify({ sequence: ++sequence, time: new Date().toISOString(), event, ...facts }) + '\n';
  if (written + Buffer.byteLength(line) > limit) { line = JSON.stringify({ sequence, time: new Date().toISOString(), event: 'collector-capped', limit }) + '\n'; capped = true; }
  fs.writeSync(fd, line); written += Buffer.byteLength(line);
}
record('collector-started', { collectorPid, target, profile, scope, endpoint });
const socket = new WebSocket(endpoint);
await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
function send(method, params = {}, sessionId) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method} observation timed out`)); }, 4000);
    pending.set(id, { resolve, reject, timer }); socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}
async function attachWorker(info) {
  if (info.type !== 'service_worker' || !info.url.startsWith(scope) || workers.has(info.targetId) || workers.size >= 8) return;
  workers.add(info.targetId);
  try {
    const { sessionId } = await send('Target.attachToTarget', { targetId: info.targetId, flatten: true });
    sessions.set(sessionId, info.targetId);
    record('worker-attached', { targetId: info.targetId, url: cleanURL(info.url) });
    await send('Network.enable', {}, sessionId);
  } catch (error) { record('worker-observation-limited', { targetId: info.targetId, reason: String(error.message).slice(0, 300) }); }
}
socket.addEventListener('message', event => {
  const text = String(event.data);
  if (text.length > 8 * 1024 * 1024) { record('oversize-protocol-message', { bytes: Buffer.byteLength(text) }); return; }
  const value = JSON.parse(text);
  if (value.id) {
    const operation = pending.get(value.id); if (!operation) return;
    clearTimeout(operation.timer); pending.delete(value.id);
    if (value.error) operation.reject(new Error(value.error.message)); else operation.resolve(value.result);
    return;
  }
  const p = value.params ?? {}, targetId = sessions.get(value.sessionId) ?? null;
  if (value.method === 'Target.detachedFromTarget') { record('target-detached', { sessionId: p.sessionId, targetId: p.targetId }); if (p.sessionId === pageSession) stop('observed-page-detached'); }
  if (value.method === 'Inspector.detached') { record('inspector-detached', { targetId, reason: p.reason }); if (value.sessionId === pageSession) stop('observed-inspector-detached'); }
  if (value.method === 'Target.targetCreated' || value.method === 'Target.targetInfoChanged') void attachWorker(p.targetInfo);
  if (value.method === 'Network.responseReceived') record('response', { targetId, requestId: p.requestId, type: p.type, url: cleanURL(p.response.url), status: p.response.status, fromServiceWorker: !!p.response.fromServiceWorker, fromDiskCache: !!p.response.fromDiskCache, fromPrefetchCache: !!p.response.fromPrefetchCache, protocol: p.response.protocol });
  if (value.method === 'Network.loadingFailed') record('request-failed', { targetId, requestId: p.requestId, type: p.type, errorText: p.errorText, canceled: p.canceled ?? false, blockedReason: p.blockedReason ?? null });
  if (value.method === 'Network.requestWillBeSent') record('request', { targetId, requestId: p.requestId, type: p.type, method: p.request.method, url: cleanURL(p.request.url) });
  if (value.method?.startsWith('DOMStorage.domStorage')) {
    const storageId = p.storageId ?? {};
    if (p.key === undefined || p.key.startsWith('revealline.')) record('storage-event', { targetId, kind: value.method, storageId, key: p.key ?? null, oldValue: digest(p.oldValue), newValue: digest(p.newValue) });
  }
  if (value.method === 'Page.frameNavigated') record('frame-navigated', { targetId, frameId: p.frame.id, parentId: p.frame.parentId ?? null, url: cleanURL(p.frame.url) });
  if (value.method === 'Runtime.exceptionThrown') record('exception', { targetId, text: String(p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text).slice(0, 700) });
});
const version = await send('Browser.getVersion');
const { arguments: args } = await send('Browser.getBrowserCommandLine');
const profileMatch = args.some((arg, i) => arg === `--user-data-dir=${profile}` || (arg === '--user-data-dir' && args[i + 1] === profile));
if (!profileMatch) { record('identity-refused', { expectedProfile: profile }); socket.close(); fs.closeSync(fd); throw new Error('Browser profile argument does not match explicit owned profile.'); }
const { targetInfos } = await send('Target.getTargets');
if (!targetInfos.some(info => info.targetId === target && info.type === 'page')) throw new Error('Explicit page target not present in owned browser.');
record('browser-identity', { version, arguments: args, profile, pageTarget: target, scope });
try { record('browser-processes', await send('SystemInfo.getProcessInfo')); } catch { record('browser-process-id-unavailable'); }
const { sessionId } = await send('Target.attachToTarget', { targetId: target, flatten: true });
sessions.set(sessionId, target);
pageSession = sessionId;
await send('Network.enable', {}, sessionId);
await send('DOMStorage.enable', {}, sessionId);
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Target.setDiscoverTargets', { discover: true });
for (const info of targetInfos) await attachWorker(info);
record('collector-ready', { target, profile, networkCacheChanged: false, workerBypassChanged: false });
health('ready', { pageSession });
async function heartbeat() {
  if (stopping || healthBusy) return;
  healthBusy = true;
  try {
    const reply = await send('Target.getTargetInfo', { targetId: target });
    const observed = await send('Runtime.evaluate', { expression: '({href: location.href, timeOrigin: performance.timeOrigin})', returnByValue: true }, pageSession);
    if (stopping) return;
    if (reply.targetInfo.type !== 'page' || observed.exceptionDetails) throw new Error('Page checkpoint unavailable');
    const page = observed.result.value;
    record('coverage-heartbeat', { target, url: cleanURL(page.href), timeOrigin: page.timeOrigin, networkEventsEnabled: true, storageEventsEnabled: true });
    health(capped ? 'capped' : 'ready', { pageSession, pageURL: cleanURL(page.href), timeOrigin: page.timeOrigin });
  } catch (error) { if (!stopping) { record('coverage-heartbeat-failed', { reason: error.message }); health('failed', { reason: error.message }); stop('heartbeat-failed'); } }
  finally { healthBusy = false; }
}
heartbeatTimer = setInterval(() => void heartbeat(), 2000);
await heartbeat();
if (!stopping) console.log(JSON.stringify({ ready: true, target, profile, output, healthPath, collectorPid, maxBytes: limit }));
input = readline.createInterface({ input: process.stdin });
function stop(reason) { if (stopping) return; record('collector-stopped', { reason }); health('stopped', { reason }); stopping = true; clearInterval(heartbeatTimer); socket.close(); input?.close(); for (const op of pending.values()) { clearTimeout(op.timer); op.reject(new Error('Collector stopped')); } pending.clear(); fs.closeSync(fd); }
input.on('line', line => { const mark = line.trim(); if (mark === 'STOP') stop('owner-request'); else if (/^[a-zA-Z0-9_-]{1,80}$/.test(mark)) record('owner-mark', { mark }); });
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
socket.addEventListener('close', event => { record('websocket-close', { code: event.code, reason: String(event.reason).slice(0, 300), wasClean: event.wasClean }); stop('browser-connection-closed'); });
socket.addEventListener('error', event => record('websocket-error', { message: String(event.message ?? 'WebSocket error').slice(0, 300) }));
