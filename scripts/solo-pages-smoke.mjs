/* global document, location, getComputedStyle, window, MutationObserver */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import {
  executeSharedModePublicReturn,
  assessSharedModePublicReturn,
} from './solo-qualification-shared-mode.mjs';

import { executePagesBackupFlow, assertPagesBackupEvidence } from './solo-pages-backup.mjs';
export { assertPagesBackupEvidence } from './solo-pages-backup.mjs';

const planPath = new URL(
  '../docs/performance/solo-published-pages-smoke-plan.json',
  import.meta.url,
);
export const PAGES_ROOT = 'https://mekhovov.github.io/revealline/';
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
export function validatePagesSmokePlan(plan) {
  assert.equal(plan.format, 'RevealLinePublishedPagesSmokeV1');
  assert.equal(plan.root, PAGES_ROOT);
  assert.equal(plan.expectedDeployment, 'manual-main-github.sha');
  assert.equal(plan.ownerTimeoutMs, 600000);
  assert.equal(plan.outerTimeoutSeconds, 720);
  assert.equal(plan.jobTimeoutMinutes, 32);
  assert.equal(plan.flowTimeoutMs, 570000);
  assert.equal(plan.cleanupTimeoutMs, 10000);
  assert.equal(plan.sharedModeTimeoutMs, 180000);
  assert.equal(plan.reportBytes, 262144);
  assert.equal(plan.maximumEvents, 128);
  assert.equal(plan.retries, 0);
  assert.equal(plan.performanceExcluded, true);
  assert.equal(plan.repository, 'mekhovov/revealline');
  assert.equal(plan.node, '22.13.1');
  assert.equal(plan.playwright, '1.62.1');
  assert.deepEqual(plan.engines, ['chromium', 'webkit']);
  assert.deepEqual(plan.diagnosticModes, ['none', 'missions', 'backup']);
  assert.equal(plan.defaultDiagnostic, 'none');
  assert.deepEqual(plan.backupDiagnostic, {
    scope: 'fresh-profile-progress-backup',
    maximumRetainedReadBytes: 1048576,
    acquisitionBound: 'existing-browser-context-and-owner-limits',
    downloadRetention: 'metadata-only-after-owned-delete',
    performanceExcluded: true,
  });
  assert.deepEqual(plan.missionsDiagnostic, {
    scope: 'missions-first-open-stage-observation',
    initialSoloQuery: 'performance=1',
    requiredCompleteOpenings: 2,
    transport: 'bounded-scalar-console-v1',
    performanceExcluded: true,
  });
  assert.equal(plan.profile, 'fresh-ephemeral');
  assert.equal(plan.credential, 'REVEALLINE_PAGES_TEST_PASSWORD');
  assert.equal(plan.credentialEntry, 'ordinary-public-password-form');
  assert.equal(plan.rssBytes, 6 * 1024 ** 3);
  assert.equal(plan.privateOutputBytes, 1024 ** 2);
  assert.equal(plan.privateEvidenceBytes, 4 * 1024 ** 2);
  assert.equal(plan.artifactBytes, 4 * 1024 ** 2);
  assert.equal(plan.metadataBytes, 16384);
  assert.equal(plan.manifestBytes, 1048576);
  assert.equal(plan.assetBytes, 2097152);
  assert.deepEqual(plan.assets, [
    'game/index.html',
    'game/access-gate.mjs',
    'game/app.mjs',
    'game/couch/index.html',
    'game/couch/relay-rescue.html',
  ]);
  assert.deepEqual(plan.flows, [
    'solo-direct-start-pause-resume',
    'missions-current-selection',
    'settings-demo-return',
    'team-versus-public-return',
  ]);
  return plan;
}
export function pagesDiagnosticScope(diagnostic = 'none') {
  assert(['none', 'missions', 'backup'].includes(diagnostic), 'Fixed Pages diagnostic required');
  return diagnostic === 'missions'
    ? 'missions-first-open-stage-observation'
    : diagnostic === 'backup'
      ? 'fresh-profile-progress-backup'
      : 'public-critical-flow-smoke';
}
export function assertPagesMissionsEvidence(pageEvidence) {
  const evidence = pageEvidence?.missions;
  assert.equal(evidence?.format, 'PagesMissionsStagesV1', 'Missions stage evidence missing');
  assert.equal(evidence.performanceExcluded, true);
  assert.equal(evidence.capacity, 64);
  assert.equal(evidence.openingCapacity, 8);
  assert.equal(evidence.invalid, 0, 'Invalid Missions stage evidence');
  assert.equal(evidence.omitted, 0, 'Missing Missions stage evidence');
  assert.equal(evidence.overflow, false, 'Missions stage overflow');
  assert.equal(evidence.incomplete, false, 'Incomplete Missions stage evidence');
  assert.equal(evidence.openings.length, 2, 'Both public Missions openings required');
  assert(evidence.first.length <= 16 && evidence.tail.length <= 48);
  const rows = [...evidence.first, ...evidence.tail];
  assert(rows.length > 0 && rows.length <= 64 && evidence.total === rows.length);
  assert.equal(new Set(evidence.openings.map((owner) => owner.opening)).size, 2);
  assert.equal(
    rows.length,
    evidence.openings.reduce((count, owner) => count + owner.sequence, 0),
  );
  for (const owner of evidence.openings) {
    assert.equal(owner.terminal, 'missions-complete', 'Missions opening did not complete');
    const observed = rows.filter((row) => row.opening === owner.opening);
    assert(observed.length >= 2 && observed.length === owner.sequence);
    assert.equal(observed[0].kind, 'missions-opening');
    assert.equal(observed.at(-1).kind, owner.terminal);
    assert.equal(owner.lastKind, owner.terminal);
    for (const [index, row] of observed.entries()) {
      assert.equal(row.sequence, index + 1);
      for (const key of ['build', 'generation', 'tick']) assert.equal(row[key], owner[key]);
    }
  }
  return {
    scope: 'missions-first-open-stage-observation',
    completeOpenings: 2,
    performanceExcluded: true,
  };
}
export async function pagesSmokePlan() {
  return validatePagesSmokePlan(JSON.parse(await readFile(planPath, 'utf8')));
}
export function redactPagesText(value, password, cap = 2048) {
  let text = String(value);
  if (password) {
    const variants = new Set([
      password,
      JSON.stringify(password).slice(1, -1),
      encodeURIComponent(password),
      encodeURI(password),
      Buffer.from(password).toString('base64'),
    ]);
    for (const item of [...variants].sort((a, b) => b.length - a.length))
      if (item) text = text.split(item).join('[redacted]');
  }
  return text.slice(0, cap);
}
export function safePagesURL(value, password) {
  try {
    const url = new URL(value);
    return redactPagesText(url.origin + url.pathname, password, 400);
  } catch {
    return '[invalid-url]';
  }
}
export function encodePagesReport(value, password, maximum = 262144) {
  // Redact before serialization so escaped call-log/form values cannot evade it.
  const clean = (item) => {
    if (typeof item === 'string') return redactPagesText(item, password, Number.MAX_SAFE_INTEGER);
    if (Array.isArray(item)) return item.map(clean);
    if (item && typeof item === 'object')
      return Object.fromEntries(
        Object.entries(item).map(([key, child]) => [
          redactPagesText(key, password, 512),
          clean(child),
        ]),
      );
    return item;
  };
  const result = JSON.stringify(clean(value), null, 2) + '\n';
  assert(Buffer.byteLength(result) <= maximum, 'Pages smoke report byte cap');
  return result;
}
// Passive public evidence only. No input, storage, timing qualification or
// application callbacks are changed. Mutation delivery timestamps are not RAF
// timestamps; several attribute changes may be delivered in one callback.
export function installPagesLifecycleObserver() {
  if (window.top !== window || Object.hasOwn(globalThis, '__revealLinePagesLifecycle')) return;
  const first = [],
    tail = [];
  let firstStart = null,
    firstPause = null,
    total = 0,
    omitted = 0,
    lastAt = 0,
    body = null,
    observer = null;
  const label = (value) =>
    value === null || value === undefined
      ? null
      : typeof value === 'string' && value.length <= 64
        ? value
        : '[over-limit public label]';
  const state = () => ({
    hidden: document.hidden,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    flightState: label(document.body?.dataset.flightState),
  });
  const add = (kind, detail = {}) => {
    const atMs = performance.now();
    const event = { sequence: ++total, atMs, kind, ...state(), ...detail };
    if (!Number.isFinite(atMs) || atMs < lastAt) event.clockInvalid = true;
    lastAt = atMs;
    // Reserve two slots for the first started/paused labels even when a
    // long preparation produces many earlier lifecycle events.
    if (kind === 'flight-state' && detail.to === 'running' && !firstStart) firstStart = event;
    else if (
      kind === 'flight-state' &&
      detail.from === 'running' &&
      detail.to === 'paused' &&
      !firstPause
    )
      firstPause = event;
    else if (first.length < 14) first.push(event);
    else {
      if (tail.length === 48) {
        tail.shift();
        omitted++;
      }
      tail.push(event);
    }
  };
  const attach = () => {
    if (!document.body || body) return;
    body = document.body;
    add('body-observed');
    observer = new MutationObserver((records) => {
      const changes = records.filter(
        (item) => item.target === body && item.attributeName === 'data-flight-state',
      );
      for (let i = 0; i < changes.length; i++) {
        const from = changes[i].oldValue;
        const to =
          i + 1 < changes.length ? changes[i + 1].oldValue : body.getAttribute('data-flight-state');
        if (from !== to)
          add('flight-state', {
            from: label(from),
            to: label(to),
            delivery: 'mutation-observer',
          });
      }
    });
    observer.observe(body, {
      attributes: true,
      attributeFilter: ['data-flight-state'],
      attributeOldValue: true,
    });
  };
  for (const kind of ['focus', 'blur', 'pageshow', 'pagehide'])
    window.addEventListener(
      kind,
      (event) => {
        // Element focus does not establish a window lifecycle interruption.
        if (event.target !== window) return;
        add(kind, {
          ...(['pageshow', 'pagehide'].includes(kind)
            ? { persisted: event.persisted === true }
            : {}),
        });
      },
      { passive: true },
    );
  document.addEventListener('visibilitychange', () => add('visibilitychange'), { passive: true });
  document.addEventListener('DOMContentLoaded', attach, { once: true });
  Object.defineProperty(globalThis, '__revealLinePagesLifecycle', {
    value: Object.freeze({
      read() {
        return {
          format: 'PagesPublicLifecycleV1',
          timeBasis: 'document-performance.now',
          timeOrigin: performance.timeOrigin,
          total,
          omitted,
          overflow: omitted > 0,
          retained: [...first, firstStart, firstPause, ...tail]
            .filter(Boolean)
            .sort((a, b) => a.sequence - b.sequence),
          limitations: [
            'Attribute transitions are public labels, not private run state.',
            'Mutation timestamps describe observer delivery, not exact transition time.',
            'Events after the final read and retiring-document delivery are unobserved.',
          ],
        };
      },
    }),
  });
  add('installed');
  attach();
}
export function readPagesDiagnosticState() {
  const text = (id) => {
    const value = (document.getElementById(id)?.textContent ?? '').trim();
    // Never return a secret prefix created by truncating before host redaction.
    return value.length <= 1024 ? value : '[public text exceeds 1024 characters]';
  };
  return {
    hidden: document.hidden,
    focused: document.hasFocus(),
    visibility: document.visibilityState,
    flightState: document.body?.dataset.flightState ?? null,
    runMessage: text('run-message'),
    runMessageCue: (() => {
      const value = document.getElementById('run-message')?.dataset.cue ?? null;
      return value === null || value.length <= 64 ? value : '[over-limit public label]';
    })(),
    preparation: text('flight-preparation-status'),
    presentation: text('presentation-preparation-status'),
    lifecycle: globalThis.__revealLinePagesLifecycle?.read() ?? null,
  };
}
export async function retainPagesPublicEvidence(
  observers,
  password,
  timeoutMs = 5000,
  isCurrent = () => true,
) {
  assert(timeoutMs > 0 && timeoutMs <= 5000, 'Public evidence cleanup budget');
  let timer,
    expired = false;
  try {
    await Promise.race([
      (async () => {
        for (const observer of observers) {
          assert(!expired && isCurrent(), 'Public evidence read deadline');
          if (observer.page.isClosed()) continue;
          await observer.capturePublic({ isCurrent: () => !expired && isCurrent() });
        }
      })(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          expired = true;
          reject(new Error('Public evidence read deadline'));
        }, timeoutMs);
      }),
    ]);
    return null;
  } catch (error) {
    return redactPagesText(error?.message ?? error, password);
  } finally {
    clearTimeout(timer);
  }
}

const MISSIONS_STAGE_PREFIX = 'RevealLineMissionsStageV1 ';
const MISSIONS_STAGE_KINDS = Object.freeze([
  'missions-opening',
  'missions-after-pause',
  'missions-build-cached',
  'missions-build-joined',
  'missions-imports-begin',
  'missions-imports-end',
  'missions-data-begin',
  'missions-data-end',
  'missions-sources-begin',
  'missions-sources-end',
  'missions-supplemental-imports-begin',
  'missions-supplemental-imports-end',
  'missions-hunt-begin',
  'missions-hunt-end',
  'missions-duel-begin',
  'missions-duel-end',
  'missions-team-begin',
  'missions-team-end',
  'missions-installed-begin',
  'missions-installed-end',
  'missions-chooser-build-begin',
  'missions-chooser-build-end',
  'missions-refresh-begin',
  'missions-refresh-end',
  'missions-open-begin',
  'missions-campaigns-begin',
  'missions-campaigns-end',
  'missions-render-begin',
  'missions-render-end',
  'missions-modal-begin',
  'missions-modal-end',
  'missions-complete',
  'missions-cancelled',
  'missions-failed',
  'missions-observer-overflow',
]);
function retainMissionsStage(result, page, message) {
  // Rare runtime-emitted scalar records are received without page.evaluate.
  // Console transport is best effort; absent messages never prove completion.
  let text;
  try {
    text = message.text();
  } catch {
    return;
  }
  if (!text.startsWith(MISSIONS_STAGE_PREFIX)) return;
  const target = (result.missions ??= {
    format: 'PagesMissionsStagesV1',
    performanceExcluded: true,
    timeBasis:
      'atMs=document-performance.now; receivedAtMs=host-performance.now; never subtract across origins',
    capacity: 64,
    openingCapacity: 8,
    total: 0,
    invalid: 0,
    omitted: 0,
    overflow: false,
    incomplete: true,
    openings: [],
    first: [],
    tail: [],
    limitations: [
      'Only received records survive an unresponsive page; final delivery is unobserved.',
      'A pending stage is not proof that it caused a stall; elapsed spans are not CPU time.',
      'Joined builds retain their original observer; a joining trace has no inherited substages.',
      'Generation zero means no accepted run generation was available to the numeric ring.',
    ],
  });
  target.total++;
  const refuse = () => {
    target.invalid++;
    target.incomplete = true;
  };
  try {
    assert(text.length <= 512, 'Missions transport bound');
    const source = new URL(message.location().url);
    const documentURL = new URL(page.url());
    const expected = new URL('game/app.mjs', PAGES_ROOT);
    assert(source.href === expected.href, 'Missions source');
    assert(
      documentURL.origin === expected.origin &&
        documentURL.pathname === new URL('game/', PAGES_ROOT).pathname &&
        documentURL.searchParams.get('performance') === '1',
      'Missions document',
    );
    const row = JSON.parse(text.slice(MISSIONS_STAGE_PREFIX.length));
    assert(Array.isArray(row) && row.length === 8, 'Missions scalar record');
    const [opening, build, sequence, kind, generation, tick, atMs, timeOrigin] = row;
    for (const value of [opening, build, sequence, generation, tick])
      assert(Number.isSafeInteger(value) && value >= 0, 'Missions integer identity');
    assert(opening > 0 && sequence > 0 && sequence <= 64, 'Missions sequence bound');
    assert(MISSIONS_STAGE_KINDS.includes(kind), 'Missions stage');
    assert(
      Number.isFinite(atMs) &&
        atMs >= 0 &&
        atMs <= Number.MAX_SAFE_INTEGER &&
        Number.isFinite(timeOrigin) &&
        timeOrigin > 0 &&
        timeOrigin <= Number.MAX_SAFE_INTEGER,
      'Missions clock',
    );
    if (target.timeOrigin === undefined) target.timeOrigin = timeOrigin;
    assert(timeOrigin === target.timeOrigin, 'Missions document changed');
    let owner = target.openings.find((item) => item.opening === opening);
    if (!owner) {
      assert(target.openings.length < target.openingCapacity, 'Missions opening bound');
      assert(sequence === 1 && kind === 'missions-opening', 'Missions beginning missing');
      owner = { opening, build, generation, tick, sequence: 0, atMs: -1, terminal: null };
      target.openings.push(owner);
    }
    assert(
      !owner.terminal &&
        owner.build === build &&
        owner.generation === generation &&
        owner.tick === tick &&
        sequence === owner.sequence + 1 &&
        atMs >= owner.atMs,
      'Missions identity/order changed',
    );
    const receivedAtMs = performance.now();
    assert(Number.isFinite(receivedAtMs), 'Missions receive clock');
    owner.sequence = sequence;
    owner.atMs = atMs;
    owner.lastKind = kind;
    if (
      [
        'missions-complete',
        'missions-cancelled',
        'missions-failed',
        'missions-observer-overflow',
      ].includes(kind)
    )
      owner.terminal = kind;
    if (kind === 'missions-observer-overflow') target.overflow = true;
    const event = { opening, build, sequence, kind, generation, tick, atMs, receivedAtMs };
    if (target.first.length < 16) target.first.push(event);
    else {
      if (target.tail.length === 48) {
        target.tail.shift();
        target.omitted++;
        target.overflow = true;
      }
      target.tail.push(event);
    }
    target.incomplete =
      target.invalid > 0 || target.overflow || target.openings.some((item) => !item.terminal);
  } catch {
    refuse();
  }
}
function pagesDiagnosticsClean(item) {
  return (
    item.total === 0 &&
    !item.overflow &&
    (!item.missions ||
      (!item.missions.invalid && !item.missions.overflow && !item.missions.incomplete))
  );
}

export function createPagesDiagnostics(page, password, maximum = 128) {
  const result = { events: [], total: 0, overflow: false };
  const add = (event) => {
    result.total++;
    if (result.events.length >= maximum) {
      result.overflow = true;
      return;
    }
    result.events.push(event);
  };
  const handlers = {
    pageerror: (error) =>
      add({ kind: 'pageerror', message: redactPagesText(error?.message, password, 1024) }),
    console: (message) => {
      if (message.type() === 'debug') retainMissionsStage(result, page, message);
      if (['error', 'warning'].includes(message.type())) {
        try {
          // Read only Playwright's text string, never argument objects/handles.
          // Redaction precedes the byte-independent character cap.
          add({
            kind: 'console',
            type: message.type(),
            message: redactPagesText(message.text(), password, 1024),
          });
        } catch {
          add({
            kind: 'console',
            type: message.type(),
            message: '[console text unavailable]',
            textReadFailure: true,
          });
        }
      }
    },
    requestfailed: (request) =>
      add({
        kind: 'requestfailed',
        url: safePagesURL(request.url(), password),
        resourceType: redactPagesText(request.resourceType(), password, 40),
        error: redactPagesText(request.failure()?.errorText ?? 'unavailable', password, 512),
      }),
    response: (response) => {
      if (response.status() >= 400)
        add({
          kind: 'http',
          status: response.status(),
          url: safePagesURL(response.url(), password),
        });
    },
  };
  for (const [name, handler] of Object.entries(handlers)) page.on(name, handler);
  return {
    page,
    result,
    async capturePublic({ isCurrent = () => true } = {}) {
      assert(isCurrent(), 'Public evidence read deadline');
      const value = await page.evaluate(readPagesDiagnosticState);
      assert(isCurrent(), 'Public evidence read deadline');
      result.publicEvidence = JSON.parse(encodePagesReport(value, password, 32768));
      const lifecycle = value?.lifecycle;
      assert(lifecycle?.format === 'PagesPublicLifecycleV1', 'Public lifecycle observer missing');
      assert(
        lifecycle.omitted === 0 && lifecycle.overflow === false,
        'Public lifecycle evidence overflow',
      );
      assert(
        !lifecycle.retained.some((event) => event.clockInvalid),
        'Public lifecycle clock invalid',
      );
    },
    detach() {
      for (const [name, handler] of Object.entries(handlers)) page.off(name, handler);
    },
  };
}
export function pagesBudget(timeoutMs, now = () => performance.now()) {
  const deadline = now() + timeoutMs;
  let stopped = false;
  const remaining = () => {
    assert(!stopped && now() < deadline, 'Pages smoke deadline expired');
    return deadline - now();
  };
  return {
    deadline,
    now,
    remaining,
    async step(label, work, cap = 10000) {
      const budget = Math.min(cap, remaining());
      let timer;
      try {
        const value = await Promise.race([
          Promise.resolve().then(() => {
            remaining();
            return work(budget);
          }),
          new Promise((_, reject) => {
            timer = setTimeout(() => {
              stopped = true;
              reject(new Error('Pages operation expired: ' + label));
            }, budget);
          }),
        ]);
        remaining();
        return value;
      } catch (error) {
        stopped = true;
        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
async function boundedPublicRead(relative, cap, budget, fetchImpl) {
  return budget.step(
    'public identity ' + relative,
    async (timeout) => {
      const response = await fetchImpl(new URL(relative, PAGES_ROOT), {
        cache: 'no-store',
        redirect: 'error',
        headers: { 'cache-control': 'no-cache', pragma: 'no-cache' },
        signal: AbortSignal.timeout(Math.max(1, Math.floor(timeout))),
      });
      assert.equal(response.status, 200, 'Public identity HTTP status');
      assert.equal(response.url, new URL(relative, PAGES_ROOT).href, 'Public identity redirect');
      let bytes = 0;
      const chunks = [];
      for await (const data of response.body) {
        bytes += data.length;
        assert(bytes <= cap, 'Public identity byte cap');
        chunks.push(data);
      }
      return Buffer.concat(chunks);
    },
    30000,
  );
}
export async function readPagesBinding(expected, budget, fetchImpl = fetch) {
  assert.match(expected, /^[a-f0-9]{40}$/);
  const metadataBytes = await boundedPublicRead('main-deployment.json', 16384, budget, fetchImpl);
  const metadata = JSON.parse(metadataBytes);
  assert.equal(metadata.format, 'revealline-main-deployment.v1');
  assert.equal(metadata.channel, 'main');
  assert.equal(metadata.sourceRevision, expected, 'Published source does not match this dispatch');
  assert.equal(metadata.buildVersion, 'main-' + expected.slice(0, 12));
  assert.equal(metadata.play, 'game/');
  const manifestBytes = await boundedPublicRead('manifest.json', 1048576, budget, fetchImpl);
  const manifest = JSON.parse(manifestBytes);
  assert.equal(manifest.sourceRevision, expected);
  assert(Array.isArray(manifest.files) && manifest.files.length <= 10000);
  const plan = await pagesSmokePlan();
  const assets = [];
  for (const path of plan.assets) {
    const entries = manifest.files.filter((entry) => entry.path === path);
    assert.equal(entries.length, 1, 'Unique public inventory entry required');
    const entry = entries[0];
    assert(Number.isSafeInteger(entry.bytes) && entry.bytes > 0 && entry.bytes <= 2097152);
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const bytes = await boundedPublicRead(path, 2097152, budget, fetchImpl);
    assert.equal(bytes.length, entry.bytes);
    assert.equal(hash(bytes), entry.sha256, 'Published critical asset digest');
    assets.push({ path, bytes: bytes.length, sha256: hash(bytes) });
  }
  return {
    sourceRevision: expected,
    buildVersion: metadata.buildVersion,
    metadata: { bytes: metadataBytes.length, sha256: hash(metadataBytes) },
    manifest: { bytes: manifestBytes.length, sha256: hash(manifestBytes) },
    assets,
    scope:
      'Five critical public files checked against this public manifest; not a full payload readback.',
  };
}
export function readPagesPublicState() {
  const visible = (element) =>
    Boolean(
      element &&
        element.isConnected &&
        !element.hidden &&
        !element.closest('[hidden]') &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden' &&
        element.getClientRects().length,
    );
  const text = (id) => (document.getElementById(id)?.textContent ?? '').trim().slice(0, 256);
  const boundedDiagnosticText = (id) => {
    const value = (document.getElementById(id)?.textContent ?? '').trim();
    return value.length <= 1024 ? value : '[public text exceeds 1024 characters]';
  };
  const control = (id) => {
    const element = document.getElementById(id);
    return {
      visible: visible(element),
      enabled: Boolean(element && !element.disabled),
      open: Boolean(element?.open),
    };
  };
  const ids = [
    'shell-home',
    'shell-featured',
    'mission-replace-dialog',
    'mode-leave-dialog',
    'journey-chooser',
    'journey-back',
    'shell-play',
    'start-button',
    'pause-button',
    'shell-menu',
    'settings-dialog',
    'settings-tab-extras',
    'shell-demo',
    'demo-dialog',
    'demo-back',
  ];
  const current = [...document.querySelectorAll('.journey-card[data-current="true"]')]
    .filter(visible)
    .map((element) => ({
      enabled: !element.disabled,
      availability: element.dataset.availabilityState,
    }));
  return {
    href: location.href,
    hidden: document.hidden,
    focused: document.hasFocus(),
    bootState: document.documentElement.dataset.bootState,
    bootHidden: document.getElementById('boot-screen')?.hidden === true,
    access: document.documentElement.dataset.accessState,
    flightState: document.body.dataset.flightState,
    runMessage: boundedDiagnosticText('run-message'),
    preparation: boundedDiagnosticText('flight-preparation-status'),
    presentation: boundedDiagnosticText('presentation-preparation-status'),
    time: text('time'),
    lives: text('lives'),
    coverage: text('coverage'),
    controls: Object.fromEntries(ids.map((id) => [id, control(id)])),
    journeyMode: document.getElementById('journey-mode')?.value,
    current,
    demoScene: document.getElementById('demo-dialog')?.dataset.scene,
    demoLevel: text('demo-level'),
    demoStatus: text('demo-status'),
  };
}
function foreground(state) {
  assert.equal(state.hidden, false, 'Public document hidden');
  assert.equal(state.focused, true, 'Public document not focused');
}
export async function executePagesSoloFlows(page, budget, record) {
  const read = async (cap = 10000) => {
    const state = await budget.step(
      'public state',
      () => page.evaluate(readPagesPublicState),
      Math.min(10000, cap),
    );
    foreground(state);
    assert(
      !state.controls['mission-replace-dialog'].open && !state.controls['mode-leave-dialog'].open,
      'Unexpected replacement/departure confirmation',
    );
    record.lastPublicState = state;
    return state;
  };
  const until = async (label, accept, cap = 60000) => {
    const end = Math.min(budget.deadline, budget.now() + cap);
    for (;;) {
      assert(budget.now() < end, 'Public state deadline: ' + label);
      const state = await read(end - budget.now());
      assert(budget.now() < end, 'Public state deadline: ' + label);
      if (accept(state)) return state;
      const remaining = end - budget.now();
      await budget.step(
        'public state wait',
        () => page.waitForTimeout(Math.min(100, remaining)),
        Math.min(1000, remaining),
      );
    }
  };
  const click = async (selector) => {
    await budget.step('public click ' + selector, (timeout) =>
      page.locator(selector).click({ timeout }),
    );
    record.actions.push(selector);
  };
  const visibleOpen = (s, id) => s.controls[id].visible && s.controls[id].open;
  const ready = await until(
    'Home',
    (s) => s.bootState === 'ready' && s.bootHidden && visibleOpen(s, 'shell-home'),
    120000,
  );
  record.samples.push({ phase: 'home', state: ready });
  assert(
    ready.controls['shell-featured'].visible && ready.controls['shell-featured'].enabled,
    'Fresh Home Direct Start required',
  );
  await click('#shell-featured');
  const running = await until(
    'Solo running',
    (s) => s.flightState === 'running' && !s.controls['start-button'].visible,
  );
  record.samples.push({
    phase: 'solo-running',
    state: await until(
      'Solo clock advancement',
      (s) => s.flightState === 'running' && s.time.length > 0 && s.time !== running.time,
    ),
  });
  await click('#pause-button');
  const paused = await until(
    'Solo paused',
    (s) => s.flightState === 'paused' && s.controls['start-button'].visible,
  );
  await budget.step('paused observation', () => page.waitForTimeout(500), 1500);
  const still = await read();
  assert.equal(still.flightState, 'paused');
  assert.equal(still.time, paused.time, 'Paused clock changed');
  assert.equal(still.lives, paused.lives);
  record.samples.push({ phase: 'solo-paused', state: still });
  await click('#start-button');
  const resumed = await until('Solo resumed', (s) => s.flightState === 'running');
  record.samples.push({
    phase: 'solo-resumed',
    state: await until(
      'Resumed clock advancement',
      (s) => s.flightState === 'running' && s.time !== resumed.time,
    ),
  });
  await click('#pause-button');
  await until('Pause for Missions', (s) => s.flightState === 'paused');
  await click('#shell-menu');
  await until('Home from pause', (s) => visibleOpen(s, 'shell-home'));
  await click('#shell-play');
  await until('Missions', (s) => visibleOpen(s, 'journey-chooser') && s.journeyMode === 'solo');
  await click('#journey-back');
  await until(
    'Missions return',
    (s) => !s.controls['journey-chooser'].open && visibleOpen(s, 'shell-home'),
  );
  await click('#shell-play');
  const chooser = await until(
    'Current mission',
    (s) => visibleOpen(s, 'journey-chooser') && s.current.length > 0,
  );
  assert.equal(chooser.current.length, 1, 'Exactly one current visible mission required');
  assert.equal(chooser.current[0].enabled, true);
  assert(
    ['included', 'ready'].includes(chooser.current[0].availability),
    'Current mission is not available',
  );
  await click('.journey-card[data-current="true"]:visible');
  const briefing = (s) =>
    !s.controls['journey-chooser'].open &&
    !s.controls['shell-home'].open &&
    !s.controls['mission-replace-dialog'].open &&
    s.flightState === 'briefing' &&
    s.controls['start-button'].visible &&
    s.controls['start-button'].enabled;
  record.samples.push({
    phase: 'mission-briefing',
    state: await until('Mission briefing', briefing),
  });
  await click('#shell-menu');
  await until('Home from briefing', (s) => visibleOpen(s, 'shell-home'));
  await click('#shell-options');
  const parent = await until('Settings', (s) => visibleOpen(s, 'settings-dialog'));
  assert(['briefing', 'paused'].includes(parent.flightState), 'Settings parent must be inactive');
  await click('#settings-tab-extras');
  await click('#shell-demo');
  const demo = await until(
    'Demo playing',
    (s) =>
      visibleOpen(s, 'demo-dialog') &&
      s.demoScene === 'playing' &&
      s.demoLevel.length > 0 &&
      s.demoStatus.length > 0,
  );
  record.samples.push({
    phase: 'demo-advanced',
    state: await until(
      'Demo public readout',
      (s) =>
        visibleOpen(s, 'demo-dialog') &&
        s.demoScene === 'playing' &&
        s.demoStatus !== demo.demoStatus,
    ),
  });
  await click('#demo-back');
  record.samples.push({
    phase: 'settings-restored',
    state: await until(
      'Settings restored',
      (s) =>
        !s.controls['demo-dialog'].open &&
        visibleOpen(s, 'settings-dialog') &&
        s.flightState === parent.flightState &&
        s.time === parent.time &&
        s.lives === parent.lives,
    ),
  });
}
export async function observePagesSmoke({
  engine,
  diagnostic = 'none',
  expectedRevision,
  password,
  browserType,
  checkpoint = async () => {},
  binding = readPagesBinding,
  soloFlows = executePagesSoloFlows,
  backupFlow = executePagesBackupFlow,
  sharedFlows = executeSharedModePublicReturn,
  sharedAssessment = assessSharedModePublicReturn,
  now = () => performance.now(),
}) {
  assert(['chromium', 'webkit'].includes(engine), 'Fixed browser engine required');
  const diagnosticScope = pagesDiagnosticScope(diagnostic);
  const soloURL =
    PAGES_ROOT +
    'game/?journey=whole-spatial-v25' +
    (diagnostic === 'missions' ? '&performance=1' : '');
  assert.match(expectedRevision, /^[a-f0-9]{40}$/);
  assert(
    typeof password === 'string' &&
      password.length > 0 &&
      password.length <= 512 &&
      !password.includes('\0'),
    'Protected Pages credential required',
  );
  const plan = await pagesSmokePlan();
  const budget = pagesBudget(plan.flowTimeoutMs, now);
  const report = {
    format: 'RevealLinePublishedPagesSmokeReportV1',
    status: 'incomplete',
    expectedRevision,
    engine,
    diagnostic,
    diagnosticScope,
    root: PAGES_ROOT,
    performanceExcluded: true,
    profile: 'fresh-ephemeral',
    scope: plan.limitations,
    stages: [],
    pages: [],
    cleanup: { context: 'not-created', browser: 'not-created' },
  };
  let browser, context;
  const observers = [];
  const retain = async () => checkpoint(JSON.parse(encodePagesReport(report, password)));
  const cleanup = async (name, work) => {
    let timer;
    try {
      await Promise.race([
        Promise.resolve().then(work),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(name + ' cleanup deadline')),
            plan.cleanupTimeoutMs,
          );
        }),
      ]);
      report.cleanup[name] = 'closed';
    } catch (error) {
      report.cleanup[name] = 'failed';
      report.cleanupFailure = redactPagesText(error?.message ?? error, password);
    } finally {
      clearTimeout(timer);
    }
  };
  try {
    report.bindingBefore = await binding(expectedRevision, budget);
    await retain();
    const env = { ...process.env };
    for (const key of [
      'REVEALLINE_PAGES_TEST_PASSWORD',
      'FPV_LIVE_TEST_PASSWORD',
      'DEBUG',
      'PWDEBUG',
      'NODE_OPTIONS',
    ])
      delete env[key];
    browser = await budget.step(
      'fresh browser',
      (timeout) =>
        browserType.launch({
          headless: true,
          timeout,
          env,
        }),
      60000,
    );
    report.cleanup.browser = 'pending';
    report.browserVersion = browser.version();
    assert(
      typeof report.browserVersion === 'string' &&
        report.browserVersion.length > 0 &&
        report.browserVersion.length <= 128,
      'Bounded actual browser version required',
    );
    context = await budget.step('fresh context', () =>
      browser.newContext({
        viewport: { width: 1440, height: 900 },
        locale: 'en-US',
      }),
    );
    report.cleanup.context = 'pending';
    await budget.step('passive public lifecycle observer', () =>
      context.addInitScript(installPagesLifecycleObserver),
    );
    assert.equal(context.pages().length, 0, 'Fresh context unexpectedly contains a page');
    const page = await budget.step('new Solo page', () => context.newPage());
    assert.deepEqual(context.pages(), [page], 'Solo page ownership is ambiguous');
    const soloDiagnostic = createPagesDiagnostics(page, password);
    observers.push(soloDiagnostic);
    report.pages.push(soloDiagnostic.result);
    await budget.step(
      'published Solo',
      (timeout) =>
        page.goto(soloURL, {
          timeout,
          waitUntil: 'domcontentloaded',
        }),
      60000,
    );
    const field = page.locator('#access-gate input[type="password"]');
    await budget.step(
      'ordinary password form',
      (timeout) => field.waitFor({ state: 'visible', timeout }),
      60000,
    );
    assert.equal(page.url(), soloURL, 'Credential document changed before entry');
    await budget.step('ordinary password entry', (timeout) => field.fill(password, { timeout }));
    assert.equal(page.url(), soloURL, 'Credential document changed before submission');
    await budget.step('ordinary password submission', (timeout) =>
      page.locator('#access-gate button[type="submit"]').click({ timeout }),
    );
    await budget.step(
      'ordinary password accepted',
      (timeout) =>
        page.waitForFunction(
          () =>
            document.documentElement.dataset.accessState === 'unlocked' &&
            !document.querySelector('#access-gate'),
          null,
          { timeout },
        ),
      60000,
    );
    report.stages.push('ordinary-password-accepted');
    await retain();
    if (diagnostic === 'backup') {
      report.backup = {};
      await backupFlow(page, budget, report.backup);
      report.backupAssessment = assertPagesBackupEvidence(report.backup);
      report.stages.push('fresh-profile-progress-backup');
      await retain();
    } else {
      report.solo = { actions: [], samples: [] };
      await soloFlows(page, budget, report.solo);
      if (diagnostic === 'missions')
        report.missionsAssessment = assertPagesMissionsEvidence(soloDiagnostic.result);
      report.stages.push(...plan.flows.slice(0, 3));
      await retain();
      await budget.step(
        'retain Solo public evidence',
        async (timeout) => {
          const failure = await retainPagesPublicEvidence(
            [soloDiagnostic],
            password,
            Math.min(5000, timeout),
            () => {
              try {
                budget.remaining();
                return true;
              } catch {
                return false;
              }
            },
          );
          assert.equal(failure, null, failure ?? 'Public evidence incomplete');
        },
        5000,
      );
      await budget.step('close Solo page', () => page.close());
      assert.equal(context.pages().length, 0, 'Solo page did not close');
      const sharedPage = await budget.step('new shared-route page', () => context.newPage());
      assert.deepEqual(context.pages(), [sharedPage], 'Shared page ownership is ambiguous');
      const sharedDiagnostic = createPagesDiagnostics(sharedPage, password);
      observers.push(sharedDiagnostic);
      report.pages.push(sharedDiagnostic.result);
      await budget.step(
        'published shared starting route',
        (timeout) =>
          sharedPage.goto(PAGES_ROOT + 'game/?journey=legacy', {
            timeout,
            waitUntil: 'domcontentloaded',
          }),
        60000,
      );
      report.shared = {};
      await sharedFlows({
        page: sharedPage,
        deadline: Math.min(budget.deadline, now() + plan.sharedModeTimeoutMs),
        record: report.shared,
        now,
      });
      report.sharedAssessment = sharedAssessment(report.shared);
      report.stages.push('team-versus-public-return');
      await retain();
    }
    report.bindingAfter = await binding(expectedRevision, budget);
    assert.deepEqual(
      report.bindingAfter,
      report.bindingBefore,
      'Published deployment changed during smoke',
    );
    assert(
      report.pages.every(pagesDiagnosticsClean),
      'Page/resource/console diagnostics require review',
    );
    report.controlsComplete = true;
  } catch (error) {
    report.failure = redactPagesText(error?.message ?? error, password);
  } finally {
    // Flow 570s + final public read 5s + two cleanup slots 10s each remains
    // inside the unchanged 600s owned child. Failure never authorizes more actions.
    const evidenceFailure = await retainPagesPublicEvidence(observers, password);
    if (evidenceFailure) {
      report.publicEvidenceFailure = evidenceFailure;
      report.failure ??= 'Public evidence incomplete';
    }
    if (context) await cleanup('context', () => context.close());
    if (browser) await cleanup('browser', () => browser.close());
    for (const observer of observers) observer.detach();
    if (diagnostic === 'missions') {
      try {
        report.missionsAssessment = assertPagesMissionsEvidence(report.pages[0]);
      } catch (error) {
        report.missionsEvidenceFailure = redactPagesText(error?.message ?? error, password);
        report.failure ??= 'Missions stage evidence incomplete';
      }
    }
    if (!report.pages.every(pagesDiagnosticsClean))
      report.failure ??= 'Page/resource/console diagnostics require review';
    report.status =
      report.controlsComplete && !report.failure && !report.cleanupFailure
        ? 'passed-controls'
        : 'failed';
    await retain();
  }
  return report;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [expectedRevision, engine, playwrightPath, output, diagnostic = 'none'] =
    process.argv.slice(2);
  const password = process.env.REVEALLINE_PAGES_TEST_PASSWORD;
  delete process.env.REVEALLINE_PAGES_TEST_PASSWORD;
  for (const key of ['DEBUG', 'PWDEBUG', 'NODE_OPTIONS']) delete process.env[key];
  try {
    const playwright = await import(pathToFileURL(playwrightPath).href);
    const report = await observePagesSmoke({
      expectedRevision,
      engine,
      diagnostic,
      password,
      browserType: playwright[engine],
      checkpoint: (value) => writeFile(output, encodePagesReport(value, password), { mode: 0o600 }),
    });
    process.exitCode = report.status === 'passed-controls' ? 0 : 1;
  } catch (error) {
    const failure = {
      format: 'RevealLinePublishedPagesSmokeReportV1',
      engine,
      diagnostic,
      status: 'failed',
      failure: redactPagesText(error?.message ?? error, password),
      controlsComplete: false,
    };
    try {
      await writeFile(output, encodePagesReport(failure, password), { mode: 0o600 });
    } catch {
      /* Parent retains missing report as failure. */
    }
    process.exitCode = 1;
  }
}
