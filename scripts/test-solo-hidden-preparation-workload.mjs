import assert from 'node:assert/strict';
import test from 'node:test';
import { runHiddenPreparationScenario } from './observe-solo-native-lifecycle.mjs';
import { assertHiddenPreparationProof, selectedFont } from './solo-qualification-readiness.mjs';
import { resumeBounds } from './solo-remote-lifecycle.mjs';
function model() {
  const same = {
    phase: 'paused',
    visibility: 'visible',
    focused: true,
    runId: 1,
    runTick: 0,
    levelId: 'first-return',
    identityFailure: false,
    runEvidence: 'submitted-board',
    retainedIdentityMatched: true,
    submittedPaintTick: 0,
    player: { x: 24.5, y: 0.5, direction: null, speed: 0, cutting: false },
    checkpoint: { hash: 'a'.repeat(16), sections: { movement: 'b'.repeat(16) } },
  };
  const details = (status) => ({
    status: 'observed',
    label: 'Getting ready',
    expectedLabel: 'Getting ready',
    waitingLabelMatches: true,
    selectedTheme: true,
    acceptedTheme: status === 'loading' ? 'default' : 'dnipro-porcelain',
    openDialogs: 0,
    inspectedFaces: 1,
    matchingFaces: [{ family: 'Field Kit Display', weight: '600', status }],
  });
  const row = (label, atMs, values = {}) => ({
    ...structuredClone(same),
    label,
    atMs,
    preparation: 'cancelled',
    preparationDetails: details('loaded'),
    ...values,
  });
  const snapshots = [
    row('retained-initial-preparation', 0, {
      phase: 'briefing',
      preparation: 'busy',
      preparationDetails: details('loading'),
    }),
    row('preparation-native-away', 250, {
      phase: 'briefing',
      visibility: 'hidden',
      focused: false,
      preparationDetails: details('loading'),
    }),
    row('preparation-completed-hidden', 10250, { visibility: 'hidden', focused: false }),
    row('preparation-returned-before-start', 10300),
    row('preparation-returned-still-paused', 10800),
    row('before-explicit-resume', 10801),
    row('resumed-neutral-no-key', 11210, { phase: 'running', runTick: 48 }),
    row('fresh-movement', 11310, {
      phase: 'running',
      runTick: 60,
      player: { ...same.player, x: 23.6, direction: 'left', speed: 8.84 },
    }),
    row('final-paused', 11320, { runTick: 60 }),
    row('after-public-export', 11330, { runTick: 60 }),
  ];
  const probe = {
    runRetentionPolicy: 'retained-paused-run-with-visible-rejoin-v1',
    preparationRetention: 'visible-busy-shared-font-v1',
    identityFailure: false,
    dropped: { events: 0, phases: 0 },
    events: [
      { type: 'visibilitychange', trusted: true, visibility: 'hidden', atMs: 250 },
      { type: 'visibilitychange', trusted: true, visibility: 'visible', atMs: 10300 },
      { type: 'keydown', trusted: true, key: 'ArrowLeft', atMs: 11220 },
    ],
    phases: [],
    frames: Array.from({ length: 12 }, (_, i) =>
      row('frame', 10803 + (i + 1) * 33, { phase: 'running', runTick: (i + 1) * 3 }),
    ),
    resumeGesture: {
      ...row('gesture', 10802),
      type: 'click',
      trusted: true,
      target: 'start-button',
    },
    resumePhase: row('running', 10803, { phase: 'running' }),
    current: snapshots.at(-1),
  };
  const transport = {
    format: 'SoloSelectedFontHoldV2',
    releaseBoundary: 'native-hidden',
    requestPolicy: 'same-url-two-v2',
    maximumRequests: 2,
    claimed: 1,
    routes: [{ index: 0, fulfillmentSettled: true, abortionSettled: false }],
    ownedRouteCount: 0,
    rejectedOwned: 0,
    joinsClosed: true,
    released: true,
    done: true,
    closed: true,
    responseDisposed: true,
    ownedResponseCount: 0,
    pendingOperations: [],
    timedOutOperations: [],
    failure: null,
    dropped: 0,
    expected: selectedFont,
    actualBytes: selectedFont.bytes,
    actualSHA256: selectedFont.sha256,
    status: 'complete',
    records: [
      'request-matched',
      'original-response-validated',
      'declared-native-hidden-boundary',
      'original-response-forwarded',
      'response-disposed',
    ].map((kind, i) => ({ kind, atMs: i })),
  };
  return {
    snapshots,
    lifecycle: probe,
    resumeProbe: structuredClone(probe),
    resumeWitness: resumeBounds(snapshots[5], probe),
    runRetentionPolicy: probe.runRetentionPolicy,
    preparationRetention: probe.preparationRetention,
    fontTransportBeforeHidden: { status: 'held', released: false },
    fontTransport: transport,
  };
}
test('complete hidden preparation proof permits30Hz submitted cadence without inventing sixteen frames', () => {
  const raw = model();
  assertHiddenPreparationProof(raw);
  assert.equal(raw.lifecycle.frames.length, 12);
});
test('an earlier visible event sharing the hidden timestamp remains ordered before the trusted transition', () => {
  const raw = model();
  raw.lifecycle.events.unshift({
    type: 'visibilitychange',
    trusted: true,
    visibility: 'visible',
    atMs: raw.snapshots[1].atMs,
  });
  assertHiddenPreparationProof(raw);
});
for (const [name, mutate] of [
  ['synthetic hidden', (r) => (r.lifecycle.events[0].trusted = false)],
  ['visible away', (r) => (r.snapshots[1].visibility = 'visible')],
  ['absent loading face', (r) => (r.snapshots[0].preparationDetails.matchingFaces = [])],
  [
    'check-only absent face',
    (r) => (r.snapshots[0].preparationDetails.matchingFaces[0].status = 'loaded'),
  ],
  ['wrong selected theme', (r) => (r.snapshots[0].preparationDetails.selectedTheme = false)],
  ['not theme wait label', (r) => (r.snapshots[0].preparationDetails.waitingLabelMatches = false)],
  ['hidden tick advanced', (r) => (r.snapshots[2].runTick = 1)],
  ['checkpoint changed', (r) => (r.snapshots[2].checkpoint.hash = 'c'.repeat(16))],
  ['font not accepted', (r) => (r.snapshots[2].preparationDetails.acceptedTheme = 'default')],
  [
    'font not loaded',
    (r) => (r.snapshots[2].preparationDetails.matchingFaces[0].status = 'loading'),
  ],
  ['hidden interval short', (r) => (r.snapshots[2].atMs = 10249)],
  ['visible same run missing', (r) => (r.snapshots[3].runEvidence = 'retained-paused-reference')],
  ['no quiet return', (r) => (r.snapshots[4].atMs = 10799)],
  ['automatic start', (r) => r.lifecycle.phases.push({ phase: 'running', atMs: 10301 })],
  ['fake clock anchor', (r) => (r.resumeWitness.anchor.atMs += 1)],
  ['hidden clock debt', (r) => (r.lifecycle.frames[0].runTick = 1000)],
  ['different resumed run', (r) => (r.snapshots[6].runId = 2)],
  ['no actual movement', (r) => (r.snapshots[7].player.x = 24.5)],
  ['replay export changed', (r) => (r.snapshots.at(-1).runTick = 61)],
  [
    'intervening visible event',
    (r) =>
      r.lifecycle.events.splice(1, 0, {
        type: 'visibilitychange',
        trusted: true,
        visibility: 'visible',
        atMs: 1000,
      }),
  ],
  [
    'intervening visible phase',
    (r) => r.lifecycle.phases.push({ phase: 'paused', visibility: 'visible', atMs: 1000 }),
  ],
  [
    'visible event equal to hidden boundary on coarse clock',
    (r) =>
      r.lifecycle.events.splice(1, 0, {
        type: 'visibilitychange',
        trusted: true,
        visibility: 'visible',
        atMs: r.snapshots[1].atMs,
      }),
  ],
  [
    'visible phase equal to hidden boundary on coarse clock',
    (r) =>
      r.lifecycle.phases.push({
        phase: 'paused',
        visibility: 'visible',
        atMs: r.snapshots[1].atMs,
      }),
  ],
  ['late font cleanup failure', (r) => (r.fontCleanupFailure = 'dispose rejected')],
  ['late transport failure', (r) => (r.fontTransport.status = 'failed')],
  ['owner not closed', (r) => (r.fontTransport.closed = false)],
  ['font cleanup pending', (r) => (r.fontTransport.pendingOperations = ['dispose'])],
])
  test('hidden proof rejects ' + name, () => {
    const r = model();
    mutate(r);
    assert.throws(() => assertHiddenPreparationProof(r));
  });
function harness({ hidden = true, compact = false } = {}) {
  const raw = model(),
    result = { snapshots: [], actions: [] },
    calls = [];
  let released = false,
    closed = false;
  const fontOwner = {
    waitUntilHeld: async () => calls.push('held'),
    snapshot: () => (closed ? raw.fontTransport : { status: 'held', released: false }),
    releaseAfterNativeHidden: () => {
      released = true;
      calls.push('release');
    },
    close: async () => {
      closed = true;
      calls.push('font-close');
    },
  };
  const snapshot = async (name) => {
    calls.push(name);
    const row = structuredClone(raw.snapshots.find((r) => r.label === name));
    assert(row, name);
    if (name === 'preparation-native-away' && !hidden) row.visibility = 'visible';
    result.snapshots.push(row);
    return row;
  };
  const page = {
    locator: (selector) => ({
      click: async () => calls.push('click:' + selector),
      isVisible: async () => compact,
      waitFor: async () => calls.push('expect:' + selector),
    }),
    evaluate: async (fn) => {
      const text = fn.toString();
      if (text.includes('retainPreparingRun')) return structuredClone(raw.snapshots[0]);
      if (text.includes('.export()')) return structuredClone(raw.lifecycle);
      if (text.includes('armFrames')) return;
      throw Error(text);
    },
    waitForFunction: async () => calls.push('predicate'),
    bringToFront: async () => calls.push('game-front'),
    keyboard: {
      down: async () => calls.push('left-down'),
      up: async () => calls.push('left-up'),
      press: async () => calls.push('escape'),
    },
  };
  const context = {
    newPage: async () => ({
      goto: async (url) => assert.equal(url, 'about:blank'),
      bringToFront: async () => calls.push('blank-front'),
    }),
  };
  return { raw, result, calls, fontOwner, snapshot, page, context, released: () => released };
}
test('existing page/context composition uses real public controls, release after hidden, and same bounded waits', async () => {
  for (const compact of [false, true]) {
    const h = harness({ compact });
    const waits = [];
    await runHiddenPreparationScenario({
      ...h,
      report: h.result,
      checked: async (p) => await p,
      action: (name) => h.calls.push(name),
      save: async () => {},
      waitFor: async (ms) => waits.push(ms),
    });
    assert.deepEqual(waits, [250, 10000, 500, 400, 100]);
    assert(h.calls.indexOf('preparation-native-away') < h.calls.indexOf('release'));
    assert(h.calls.indexOf('font-close') < h.calls.indexOf('game-front'));
    assert(
      h.calls.indexOf('preparation-returned-still-paused') < h.calls.indexOf('click:#start-button'),
    );
    assert.equal(
      h.calls.filter((v) => v.startsWith('click:#settings-dialog[open]')).length,
      compact ? 1 : 0,
    );
    assert.equal(h.result.snapshots.at(-1).label, 'final-paused');
  }
});
test('a browser remaining visible is unobserved and never releases held shared font', async () => {
  const h = harness({ hidden: false });
  await assert.rejects(
    runHiddenPreparationScenario({
      ...h,
      report: h.result,
      checked: async (p) => await p,
      action: (name) => h.calls.push(name),
      save: async () => {},
      waitFor: async () => {},
    }),
    /actual hidden/,
  );
  assert.equal(h.result.status, 'unobserved');
  assert.equal(h.released(), false);
  assert(!h.calls.includes('click:#start-button'));
});
