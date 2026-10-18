/* global window */
// Explicit correctness-only observer. Historical timing recipes and gates stay intact.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createQualificationReplayIdentity } from './solo-qualification-replay-identity.mjs';

export const READINESS_PILOT = Object.freeze({
  protocol: 'first-running-v1',
  sourceRevision: 'ab45bfde5d54d612cbba9b038a46f13d13f417ec',
  scenarioSHA256: 'aa3a4c98c6f272ea515d1e8c9e0fb3238d78782065bfb96ae8fe4e304041e2c5',
  records: 8,
  bytes: 16384,
});
export const RESUME_READINESS_PILOTS = Object.freeze({
  'warm-resume-v1': Object.freeze({
    protocol: 'warm-resume-v1',
    sourceRevision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
    scenarioSHA256: '95f77f635658a53ae5ab89ca9879321a37c22e512c2a0bb751ad5ed194699545',
    documents: 1,
    records: 8,
    bytes: 16384,
  }),
  'saved-resume-v1': Object.freeze({
    protocol: 'saved-resume-v1',
    sourceRevision: '4bf5e9b3b7f2f06fbe24f50ff9457efb70a7b1a7',
    scenarioSHA256: 'b739f37f5bd9c341931ed528a955614aaf1ba05075bb1baab1c2a655a5bcd527',
    documents: 2,
    records: 8,
    bytes: 16384,
  }),
});
export const SELECTED_FONT_PILOT = Object.freeze({
  protocol: 'selected-font-cancel-v1',
  sourceRevision: 'c696af41857840359ae473558b90682f3d71f2db',
  scenarioSHA256: 'd4c774b80df93896cfd4a1f82d66c16f58a9ed68938ed88229449a2bb001cc67',
  documents: 1,
  records: 8,
  bytes: 16384,
});
export const SELECTED_FONT_JOINED_PILOT = Object.freeze({
  protocol: 'selected-font-cancel-joined-v2',
  sourceRevision: '0febd334619731adc26dfa3df78aab02991563af',
  scenarioSHA256: 'e46e4f0a75ef5f982373b464a487efe74e63fa7145500e4ff2ac93cb4a3d46d5',
  requestPolicy: 'same-url-two-v2',
  documents: 1,
  records: 8,
  bytes: 16384,
});
export const SELECTED_FONT_JOINED_C696_PILOT = Object.freeze({
  ...SELECTED_FONT_JOINED_PILOT,
  sourceRevision: SELECTED_FONT_PILOT.sourceRevision,
});
export const SELECTED_FONT_POST_COMMAND_PILOT = Object.freeze({
  protocol: 'selected-font-cancel-post-command-v3',
  sourceRevision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  scenarioSHA256: '55b0f0dcc10163d4192e71fe5cb323d6bd6101f68087f1e4defc58cd546072ba',
  requestPolicy: 'same-url-two-v2',
  cancelBoundaryObservation: 'post-command-v3',
  documents: 1,
  records: 8,
  bytes: 16384,
});
export const SELECTED_FONT_SETTLEMENT_PILOT = Object.freeze({
  ...SELECTED_FONT_POST_COMMAND_PILOT,
  protocol: 'selected-font-request-settlement-v4',
  scenarioSHA256: 'de25a01e745fb70db09642d5f419969e2ca31a69db19aa252f04eb87b015bd3b',
  settlementObservation: 'original-demand-v1',
});
export const SELECTED_FONT_SOURCE_BINDING = Object.freeze({
  revision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  css: Object.freeze({
    path: 'game/ui/field-kit-fonts.css',
    bytes: 1045,
    sha256: '620b327398af390290dd5ce2ed1a1d6b9d26bf22bd0f2b1129daf15c0e49692c',
  }),
  themeHost: Object.freeze({
    path: 'game/presentation/theme-host.mjs',
    bytes: 18674,
    sha256: '033b7c05cf1602326ca0d7783f2b45d2c9d04e52d4b38211c34d92d53cf6e76a',
  }),
  attribution:
    'Exact admitted source and direct stylesheet rule; FontFace-to-CSS-rule identity is not exposed.',
});
export const COMPACT_SAVED_READINESS_PILOT = Object.freeze({
  protocol: 'saved-resume-v1',
  sourceRevision: 'c696af41857840359ae473558b90682f3d71f2db',
  scenarioSHA256: '0cd16229c6e490023bc2a6ce1b83e5631cb92d0460a2c2fb712ce38c0e2a2270',
  documents: 2,
  records: 8,
  bytes: 16384,
});
// Exact verified corrected-layout production source; remote package admission remains required.
// No command-line override can activate this prospective source selector.
export const GEOMETRY_READINESS_SOURCE = Object.freeze({
  revision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
  tree: '58f19392e25384620d896098fce8616b538e318d',
});
export function geometryReadinessPilot(protocol) {
  assert.match(
    GEOMETRY_READINESS_SOURCE.revision ?? '',
    /^[a-f0-9]{40}$/,
    'Geometry source is held',
  );
  assert.match(GEOMETRY_READINESS_SOURCE.tree ?? '', /^[a-f0-9]{40}$/, 'Geometry tree is held');
  assert(['first-running-v1', 'warm-resume-v1', 'saved-resume-v1'].includes(protocol));
  const original =
    protocol === 'first-running-v1'
      ? READINESS_PILOT
      : protocol === 'saved-resume-v1'
        ? COMPACT_SAVED_READINESS_PILOT
        : RESUME_READINESS_PILOTS[protocol];
  return Object.freeze({
    ...original,
    sourceRevision: GEOMETRY_READINESS_SOURCE.revision,
    geometryObservation: 'phase-boundary-v1',
    documents: protocol === 'saved-resume-v1' ? 2 : 1,
  });
}
// Exact prospective source/recipe support. No remote declaration or package is admitted here.
export const MEDIA_FAULT_PILOTS = Object.freeze({
  'optional-audio-start-missing-v1': Object.freeze({
    protocol: 'optional-audio-start-missing-v1',
    sourceRevision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    scenarioSHA256: '05ce2d60b858eff3f1ee67d23c17c815efe1a0c7f3da196c89b98b931139d096',
    documents: 1,
    records: 8,
    bytes: 16384,
  }),
  'required-original-cancel-v1': Object.freeze({
    protocol: 'required-original-cancel-v1',
    sourceRevision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    scenarioSHA256: '411c385f4c31ab2308c78d326a028a743ab47e79a4edfbcb2a9a1835b9d86b39',
    documents: 1,
    records: 8,
    bytes: 16384,
  }),
  'optional-icon-missing-v1': Object.freeze({
    protocol: 'optional-icon-missing-v1',
    sourceRevision: 'e1cc5dd7656bab349715cd1c3ce6e9f783508c17',
    scenarioSHA256: '80ec6fe25c99330a3d3ae787eeb8d95bfbde4f051b0e7ee4c29c87f06232fd1f',
    documents: 1,
    records: 8,
    bytes: 16384,
  }),
});
export const OPTIONAL_AUDIO_SETTINGS_PILOT = Object.freeze({
  ...MEDIA_FAULT_PILOTS['optional-audio-start-missing-v1'],
  scenarioSHA256: '307f46d055838f1b76fc8e825b22317a0fb85231a8ca3a7cfd43de92f7109e11',
  publicRoute: 'settings-gameplay-v2',
});
export const REQUIRED_ORIGINAL_START_PILOT = Object.freeze({
  ...MEDIA_FAULT_PILOTS['required-original-cancel-v1'],
  sourceRevision: '239c574ecddd5bb6d5896e621d9edc53e7f6a313',
  scenarioSHA256: '2c4186d9748ffd173ef478f5412b3542f05c06651cd2a15e03342322d181460f',
  requiredStartRetention: 'trusted-initial-start-v1',
});
export const COMPACT_WARM_READINESS_PILOT = Object.freeze({
  ...RESUME_READINESS_PILOTS['warm-resume-v1'],
  sourceRevision: '239c574ecddd5bb6d5896e621d9edc53e7f6a313',
  scenarioSHA256: 'bc65978e26f21507b84d8c999928c069478b0ac1d91fc4866a2c2a7616314829',
  geometryObservation: 'phase-boundary-v1',
});
export function qualificationReadinessOptions(flags, scenario, bytes) {
  const selected = flags.filter((flag) => flag.startsWith('--readiness-probe'));
  const requiredStart = flags.filter((flag) => flag.startsWith('--readiness-required-start'));
  if (requiredStart.length) {
    assert.deepEqual(requiredStart, ['--readiness-required-start=trusted-initial-start-v1']);
    assert.deepEqual(selected, ['--readiness-probe=required-original-cancel-v1']);
  }
  const geometry = flags.filter((flag) => flag.startsWith('--readiness-geometry'));
  const cancel = flags.filter((flag) => flag.startsWith('--readiness-cancel-boundary'));
  if (cancel.length) {
    assert.deepEqual(cancel, ['--readiness-cancel-boundary=post-command-v3']);
    assert(
      selected.length === 1 &&
        [
          '--readiness-probe=selected-font-cancel-post-command-v3',
          '--readiness-probe=selected-font-request-settlement-v4',
        ].includes(selected[0]),
    );
    assert.equal(geometry.length, 0);
  }
  if (
    selected.some((flag) =>
      [
        '--readiness-probe=selected-font-cancel-post-command-v3',
        '--readiness-probe=selected-font-request-settlement-v4',
      ].includes(flag),
    )
  )
    assert.equal(cancel.length, 1, 'Post-command font requires exact boundary opt-in');
  if (geometry.length) {
    assert.deepEqual(geometry, ['--readiness-geometry=phase-boundary-v1']);
    assert.equal(selected.length, 1, 'Geometry requires one exact readiness protocol');
    assert(
      !flags.some((flag) => /^--(?:density-comparison|visual-quality-observation)/.test(flag)),
      'Geometry and density are separate observations',
    );
  }
  if (!selected.length) {
    assert(
      !scenario.selectedFontCancellation && !scenario.mediaReadinessFault,
      'Media fault requires exact readiness opt-in',
    );
    return null;
  }
  const protocol = selected[0]?.slice('--readiness-probe='.length);
  const successorSaved =
    protocol === 'saved-resume-v1' &&
    flags.includes('--source-revision=c696af41857840359ae473558b90682f3d71f2db');
  const pilot =
    protocol === 'optional-audio-start-missing-v1' &&
    scenario.mediaReadinessFault?.route === 'settings-gameplay-v2'
      ? OPTIONAL_AUDIO_SETTINGS_PILOT
      : requiredStart.length
        ? REQUIRED_ORIGINAL_START_PILOT
        : geometry.length
          ? protocol === 'warm-resume-v1' &&
            flags.includes('--source-revision=' + COMPACT_WARM_READINESS_PILOT.sourceRevision)
            ? COMPACT_WARM_READINESS_PILOT
            : geometryReadinessPilot(protocol)
          : successorSaved
            ? COMPACT_SAVED_READINESS_PILOT
            : protocol === READINESS_PILOT.protocol
              ? READINESS_PILOT
              : protocol === SELECTED_FONT_PILOT.protocol
                ? SELECTED_FONT_PILOT
                : protocol === SELECTED_FONT_JOINED_PILOT.protocol
                  ? flags.includes('--source-revision=' + SELECTED_FONT_PILOT.sourceRevision)
                    ? SELECTED_FONT_JOINED_C696_PILOT
                    : SELECTED_FONT_JOINED_PILOT
                  : protocol === SELECTED_FONT_POST_COMMAND_PILOT.protocol
                    ? SELECTED_FONT_POST_COMMAND_PILOT
                    : protocol === SELECTED_FONT_SETTLEMENT_PILOT.protocol
                      ? SELECTED_FONT_SETTLEMENT_PILOT
                      : (MEDIA_FAULT_PILOTS[protocol] ?? RESUME_READINESS_PILOTS[protocol]);
  assert(pilot, 'Unknown readiness protocol');
  if (MEDIA_FAULT_PILOTS[protocol]) {
    assert.deepEqual(scenario.mediaReadinessFault, {
      protocol,
      sourceRevision: pilot.sourceRevision,
      ...(pilot.publicRoute ? { route: pilot.publicRoute } : {}),
      ...(pilot.requiredStartRetention ? { startRetention: pilot.requiredStartRetention } : {}),
    });
    assert.equal(scenario.kind, 'lifecycle');
    assert(!scenario.cacheMode);
    assert(flags.includes('--server-fixture-access'));
    assert(
      !flags.some((flag) =>
        /^--(?:density-comparison|visual-quality-observation|readiness-geometry|public-url|manifest|fixture-access)/.test(
          flag,
        ),
      ),
      'Media faults are separate exact-source observations',
    );
  }
  if (
    [
      SELECTED_FONT_JOINED_PILOT,
      SELECTED_FONT_JOINED_C696_PILOT,
      SELECTED_FONT_POST_COMMAND_PILOT,
      SELECTED_FONT_SETTLEMENT_PILOT,
    ].includes(pilot)
  )
    assert(
      !flags.some((flag) => /^--(?:density-comparison|visual-quality-observation)/.test(flag)),
      'Font and density are separate observations',
    );
  assert.deepEqual(selected, [`--readiness-probe=${pilot.protocol}`]);
  assert.deepEqual(
    flags.filter((flag) => flag.startsWith('--source-revision')),
    [`--source-revision=${pilot.sourceRevision}`],
  );
  for (const flag of ['--work-probe', '--hitch-journal', '--cadence=settled120'])
    assert(flags.includes(flag), `Readiness requires ${flag}`);
  assert(
    !flags.some((flag) =>
      /^--(?:memory-profile|audio-proof|cpu-profile|journal-cost-probe|baseline-runtime|snapshot-chunks|hitch-journal-preparation)/.test(
        flag,
      ),
    ),
    'Readiness is an independent exact-recipe correctness observation',
  );
  assert.equal(createHash('sha256').update(bytes).digest('hex'), pilot.scenarioSHA256);
  assert.deepEqual(scenario, JSON.parse(bytes));
  assert.equal(scenario.timeoutMs, 240000);
  if (
    [
      SELECTED_FONT_PILOT,
      SELECTED_FONT_JOINED_PILOT,
      SELECTED_FONT_JOINED_C696_PILOT,
      SELECTED_FONT_POST_COMMAND_PILOT,
      SELECTED_FONT_SETTLEMENT_PILOT,
    ].includes(pilot)
  ) {
    assert.equal(scenario.kind, 'lifecycle');
    assert(!scenario.cacheMode, 'Font routing cannot qualify warm HTTP caching');
    assert(flags.includes('--server-fixture-access'));
    assert(
      !flags.some(
        (flag) =>
          flag === '--fixture-access' ||
          flag.startsWith('--public-url') ||
          flag.startsWith('--manifest'),
      ),
    );
  }
  if ([SELECTED_FONT_POST_COMMAND_PILOT, SELECTED_FONT_SETTLEMENT_PILOT].includes(pilot)) {
    assert.equal(scenario.selectedFontCancellation.protocol, pilot.protocol);
    assert.equal(scenario.selectedFontCancellation.sourceRevision, pilot.sourceRevision);
  }
  return pilot;
}

// Serialized unchanged into the top document. Called only on actual trusted
// Start clicks and phase changes, never from rAF/update/draw. No app export.
export function createBrowserReadinessProbe(
  getScene,
  environment = globalThis,
  protocol = 'first-running-v1',
  geometryObservation = false,
  cancelBoundaryObservation = false,
  initialRequiredStart = null,
) {
  if (
    ![
      'first-running-v1',
      'warm-resume-v1',
      'saved-resume-v1',
      'selected-font-cancel-v1',
      'selected-font-cancel-joined-v2',
      'selected-font-cancel-post-command-v3',
      'selected-font-request-settlement-v4',
      'required-original-cancel-v1',
      'optional-icon-missing-v1',
      'optional-audio-start-missing-v1',
    ].includes(protocol)
  )
    throw new Error('Unknown readiness protocol');
  if (typeof geometryObservation !== 'boolean') throw new Error('Exact geometry opt-in required');
  if (
    geometryObservation &&
    !['first-running-v1', 'warm-resume-v1', 'saved-resume-v1'].includes(protocol)
  )
    throw new Error('Geometry is a separate readiness diagnostic');
  if (
    initialRequiredStart !== null &&
    (protocol !== 'required-original-cancel-v1' || typeof initialRequiredStart !== 'function')
  )
    throw new Error('Required-original Start callback requires its explicit protocol');
  let initialRequiredStartSeen = false;
  const resume = protocol.endsWith('-resume-v1'),
    postCommand = [
      'selected-font-cancel-post-command-v3',
      'selected-font-request-settlement-v4',
    ].includes(protocol),
    font = [
      'selected-font-cancel-v1',
      'selected-font-cancel-joined-v2',
      'selected-font-cancel-post-command-v3',
      'selected-font-request-settlement-v4',
    ].includes(protocol);
  if (
    cancelBoundaryObservation !== false &&
    (cancelBoundaryObservation !== true ||
      ![
        'selected-font-cancel-joined-v2',
        'selected-font-cancel-post-command-v3',
        'selected-font-request-settlement-v4',
      ].includes(protocol))
  )
    throw new Error('Cancel boundary observation requires the explicit joined-font protocol');
  if (postCommand && !cancelBoundaryObservation)
    throw new Error('Post-command font requires the boundary witness');
  let cancelEvent = null,
    cancelPath = null,
    commandCompleted = false;
  const documentRef = environment.document,
    records = [],
    runs = new WeakMap();
  let dropped = 0,
    errors = 0,
    runSequence = 0,
    firstRunning = false,
    disposed = false,
    previousPhase = null;
  const number = (value) => (Number.isFinite(value) ? value : null);
  // Read only at declared passive boundaries. Early microtasks are not completion. These
  // are source-derived ordinary-opening branches, not access to private owners.
  const nodeIdentity = (node) =>
    node === documentRef
      ? { tag: '#document', id: null }
      : node === environment
        ? { tag: '#window', id: null }
        : node && typeof node.tagName === 'string'
          ? {
              tag: node.tagName.slice(0, 24),
              id: typeof node.id === 'string' ? node.id.slice(0, 48) : null,
            }
          : { tag: 'unknown', id: null };
  function exactFontInventory() {
    const fonts = documentRef.fonts;
    const out = {
      format: 'SoloExactFontInventoryV1',
      available: false,
      scanned: 0,
      scanLimit: 64,
      matchLimit: 8,
      overflow: false,
      matchesOverflow: false,
      invalid: false,
      faces: [],
    };
    if (!fonts || typeof fonts[Symbol.iterator] !== 'function') return out;
    out.available = true;
    try {
      const iterator = fonts[Symbol.iterator]();
      let completed = false;
      for (let i = 0; i < 64; i++) {
        const next = iterator.next();
        if (next.done) {
          completed = true;
          break;
        }
        out.scanned++;
        const face = next.value;
        if (typeof face?.family !== 'string' || face.family.length > 96) {
          out.invalid = true;
          continue;
        }
        const family = face.family.replace(/^(['"])(.*)\1$/, '$2');
        if (family !== 'Field Kit Display') continue;
        if (out.faces.length >= 8) {
          out.matchesOverflow = true;
          continue;
        }
        const weight =
          typeof face.weight === 'string' && face.weight.length <= 32 ? face.weight : null;
        const status = ['unloaded', 'loading', 'loaded', 'error'].includes(face.status)
          ? face.status
          : null;
        if (weight === null || status === null) out.invalid = true;
        out.faces.push({ family: face.family, weight, status, exactWeight: weight === '600' });
      }
      // Reaching the scan bound is explicitly incomplete, even if the last item
      // happened to be the set's last face; no 65th native iterator operation.
      out.overflow = !completed;
    } catch {
      out.invalid = true;
    }
    return out;
  }
  const firstIdentities = (nodes) => {
    const out = [];
    for (let index = 0; index < Math.min(nodes.length, 4); index++)
      out.push(nodeIdentity(nodes[index]));
    return out;
  };
  function cancelBoundary(event, eventPath) {
    const elementState = (id) => {
      const node = documentRef.getElementById(id);
      if (!node) return { present: false };
      const style = environment.getComputedStyle?.(node);
      return {
        present: true,
        identity: nodeIdentity(node),
        connected: node.isConnected === true,
        hidden: typeof node.hidden === 'boolean' ? node.hidden : null,
        disabled: typeof node.disabled === 'boolean' ? node.disabled : null,
        open: typeof node.open === 'boolean' ? node.open : null,
        hiddenAncestor: !!node.closest?.('[hidden],[inert],[aria-hidden="true"]'),
        display: typeof style?.display === 'string' ? style.display.slice(0, 24) : null,
        visibility: typeof style?.visibility === 'string' ? style.visibility.slice(0, 24) : null,
        kind: typeof node.dataset?.kind === 'string' ? node.dataset.kind.slice(0, 32) : null,
        state: typeof node.dataset?.state === 'string' ? node.dataset.state.slice(0, 32) : null,
      };
    };
    const dialogs = documentRef.querySelectorAll('dialog[open]'),
      markers = documentRef.querySelectorAll('[data-menu-input]'),
      active = documentRef.activeElement,
      overlay = elementState('game-overlay'),
      result = elementState('show-result'),
      scene = getScene(),
      run = scene?.lastPaint?.run;
    let derived = 'unknown';
    // The declared route is ordinary opening/First Return. Multiple dialogs,
    // embedded focus, unexpected run/phase or absent nodes remain unknown.
    if (dialogs.length === 1) derived = 'single-open-dialog';
    else if (
      dialogs.length === 0 &&
      active?.tagName !== 'IFRAME' &&
      documentRef.body?.dataset.flightState === 'briefing' &&
      run?.level?.id === 'first-return' &&
      run?.tick === 0 &&
      run?.status === 'running' &&
      overlay.present &&
      result.present
    ) {
      if (overlay.hidden === false) derived = 'body-composite-from-reflected-overlay';
      else if (overlay.hidden === true && result.hidden === true)
        derived = 'document-from-no-overlay';
    }
    return {
      format: 'SoloCancelBoundaryWitnessV1',
      sourceDerivedRoot: derived,
      exactFontInventory: exactFontInventory(),
      privateRootObserved: false,
      scope: 'Exact ordinary opening source branch only; markers can include previous roots.',
      activeElement: nodeIdentity(active),
      eventTarget: nodeIdentity(event?.target),
      eventPath: eventPath?.nodes ?? [],
      eventPathTruncated: eventPath?.truncated ?? false,
      eventPathAvailable: eventPath?.available ?? false,
      key: typeof event?.key === 'string' ? event.key.slice(0, 24) : null,
      code: typeof event?.code === 'string' ? event.code.slice(0, 24) : null,
      repeat: event?.repeat === true,
      modifiers: [
        event?.altKey === true,
        event?.ctrlKey === true,
        event?.metaKey === true,
        event?.shiftKey === true,
      ],
      defaultPrevented: event?.defaultPrevented === true,
      eventPhase: number(event?.eventPhase),
      dialogs: firstIdentities(dialogs),
      dialogsTruncated: dialogs.length > 4,
      markedRoots: firstIdentities(markers),
      markedRootsTruncated: markers.length > 4,
      overlay,
      result,
      preparation: elementState('flight-preparation-status'),
      start: elementState('start-button'),
      arena: elementState('arena-shell'),
    };
  }
  function record(kind, event = null, eventPath = null) {
    if (disposed) return;
    if (records.length >= 8) {
      dropped = Math.min(65535, dropped + 1);
      return;
    }
    try {
      const scene = getScene(),
        run = scene?.lastPaint?.run,
        c = scene?.cadence?.snapshot(),
        phase = documentRef.body?.dataset.flightState;
      if (run && !runs.has(run)) runs.set(run, ++runSequence);
      const row = {
        kind,
        atMs: number(environment.performance.now()),
        phase: ['briefing', 'running', 'paused', 'result', 'picture'].includes(phase)
          ? phase
          : 'other',
        visible: documentRef.hidden === false,
        focused: documentRef.hasFocus(),
        trusted: event ? event.isTrusted === true : null,
        run: run ? runs.get(run) : null,
        tick: number(run?.tick),
        prepared: typeof scene?.prepared === 'function' ? scene.prepared() === true : null,
        displayedBoardValid:
          typeof scene?.displayedBoardValid === 'boolean' ? scene.displayedBoardValid : null,
        preparedRunMatches: run ? scene?.preparedState?.run === run : null,
        submittedRunMatches: run ? scene?.submittedRun === run : null,
        levelId:
          typeof run?.level?.id === 'string' && run.level.id.length <= 128 ? run.level.id : null,
        cadence: c
          ? {
              samples: number(c.samples),
              required: number(c.required),
              baselineMs: number(c.baselineMs),
              restartedSamples: number(c.restartedSamples),
              waiting: typeof c.waiting === 'boolean' ? c.waiting : null,
              status: ['pending-quiet-preparation', 'measured-before-play'].includes(c.status)
                ? c.status
                : 'unknown',
            }
          : null,
      };
      if (protocol === 'optional-audio-start-missing-v1') {
        // MainScene retains the exact submitted lease; painter options are derived separately.
        const style = scene?.lastPaint?.actors?.pin?.()?.style;
        row.actorStyle = ['campaign', 'fpv'].includes(style) ? style : null;
      }
      if (geometryObservation && ['first-running', 'resumed-running'].includes(kind)) {
        const canvas = scene?.game?.canvas;
        // These reflected layout reads are restricted to the declared phase boundary.
        // They are correctness instrumentation, not uninstrumented timing evidence.
        row.geometry = {
          clientWidth: number(canvas?.clientWidth),
          clientHeight: number(canvas?.clientHeight),
          displayCSSWidth: number(scene?.displayCSSWidth),
          displayCSSHeight: number(scene?.displayCSSHeight),
          revision: number(scene?.revision),
          preparedRevision: number(scene?.preparedState?.revision),
          flightLayout:
            documentRef.body?.dataset.flightLayout === undefined
              ? null
              : documentRef.body.dataset.flightLayout === 'preparing'
                ? 'preparing'
                : 'other',
          screenControls: ['shown', 'hidden'].includes(documentRef.body?.dataset.screenControls)
            ? documentRef.body.dataset.screenControls
            : null,
        };
      }
      if (font) {
        row.font = {
          openDialogs: Math.min(9, documentRef.querySelectorAll('dialog[open]').length),
          preparation:
            documentRef.getElementById('flight-preparation-status')?.dataset.state ?? null,
          acceptedTheme: documentRef.documentElement.dataset.interfaceTheme ?? null,
          selectedTheme:
            documentRef
              .getElementById('theme-card-dnipro-porcelain')
              ?.getAttribute('aria-pressed') === 'true',
          loaded:
            documentRef.fonts?.check(
              '600 16px "Field Kit Display"',
              'Workshop Майстерня 012345',
            ) === true,
          defaultPrevented: event ? event.defaultPrevented === true : null,
        };
      }
      if (
        postCommand &&
        !['cancel-back', 'cancel-early-microtask', 'cancel-command-complete'].includes(kind)
      )
        row.font.exactFontInventory = exactFontInventory();
      if (
        cancelBoundaryObservation &&
        [
          'cancel-back',
          'cancel-complete',
          'cancel-early-microtask',
          'cancel-command-complete',
        ].includes(kind)
      )
        row.cancelBoundary = cancelBoundary(event, eventPath);
      records.push(row);
    } catch {
      errors = Math.min(65535, errors + 1);
    }
  }
  function click(event) {
    if (event.isTrusted !== true) return;
    const button = event.target?.closest?.('#shell-featured, #start-button');
    if (button) {
      record('start-click', event);
      if (
        initialRequiredStart &&
        !initialRequiredStartSeen &&
        event.target?.closest?.('#start-button')?.id === 'start-button'
      ) {
        initialRequiredStartSeen = true;
        try {
          if (initialRequiredStart(event) !== true)
            throw new Error('Initial required Start was not retained');
        } catch {
          errors = Math.min(65535, errors + 1);
        }
      }
    }
  }
  function back(event) {
    if (
      !font ||
      event.isTrusted !== true ||
      event.code !== 'Escape' ||
      event.repeat ||
      documentRef.querySelectorAll('dialog[open]').length ||
      documentRef.getElementById('flight-preparation-status')?.dataset.state !== 'busy'
    )
      return;
    let eventPath = null;
    if (cancelBoundaryObservation) {
      const nodes = typeof event.composedPath === 'function' ? event.composedPath() : null;
      eventPath = {
        available: Array.isArray(nodes),
        nodes: Array.isArray(nodes) ? nodes.slice(0, 8).map(nodeIdentity) : [],
        truncated: Array.isArray(nodes) && nodes.length > 8,
      };
    }
    if (postCommand) {
      if (cancelEvent) {
        errors = Math.min(65535, errors + 1);
        return;
      }
      cancelEvent = event;
      cancelPath = eventPath;
    }
    record('cancel-back', event, eventPath);
    environment.queueMicrotask(() =>
      record(postCommand ? 'cancel-early-microtask' : 'cancel-complete', event, eventPath),
    );
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    cancelEvent = null;
    cancelPath = null;
    documentRef.removeEventListener('click', click, true);
    if (font) documentRef.removeEventListener('keydown', back, true);
    environment.removeEventListener('pagehide', dispose);
  }
  documentRef.addEventListener('click', click, true);
  if (font) documentRef.addEventListener('keydown', back, true);
  environment.addEventListener('pagehide', dispose, { once: true });
  return {
    cancelCommandComplete() {
      if (
        !postCommand ||
        disposed ||
        !cancelEvent ||
        commandCompleted ||
        records.at(-1)?.kind !== 'cancel-early-microtask'
      )
        throw new Error('Invalid selected-font post-command boundary');
      commandCompleted = true;
      record('cancel-command-complete', cancelEvent, cancelPath);
      cancelEvent = null;
      cancelPath = null;
    },
    boundary(label) {
      if (
        !font ||
        label !== 'font-release-no-start' ||
        documentRef.body?.dataset.flightState === 'running'
      )
        throw new Error('Invalid selected-font passive boundary');
      record('font-release-no-start');
    },
    phase(phase) {
      if (disposed || phase === previousPhase) return;
      previousPhase = phase;
      if (phase === 'running' && !firstRunning) {
        firstRunning = true;
        record('first-running');
      } else if (resume && firstRunning && phase === 'running') record('resumed-running');
      else if (firstRunning && phase !== 'running') record('after-running');
    },
    export() {
      if (documentRef.body?.dataset.flightState === 'running')
        throw new Error('Readiness export requires an existing non-running boundary');
      const result = {
        format: 'SoloFirstRunningReadinessV1',
        protocol,
        capacity: 8,
        maximumBytes: 16384,
        dropped,
        errors,
        disposed,
        ...(geometryObservation ? { geometryObservation: 'phase-boundary-v1' } : {}),
        records: records.map((row) => ({
          ...row,
          cadence: row.cadence && { ...row.cadence },
          ...(row.geometry ? { geometry: { ...row.geometry } } : {}),
          ...(row.cancelBoundary ? { cancelBoundary: structuredClone(row.cancelBoundary) } : {}),
          ...(postCommand && row.font ? { font: structuredClone(row.font) } : {}),
        })),
        scope:
          'Passive public-click/phase boundary snapshots; not proof of physical display completion.',
      };
      if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 16384)
        throw new Error('Readiness evidence cap exceeded');
      return result;
    },
    dispose,
  };
}

export function assessReadinessPilot(observation, application, documents) {
  const failures = [];
  const check = (condition, reason) => {
    if (!condition) failures.push(reason);
  };
  check(documents === 1, 'exactly-one-observed-document');
  check(observation?.format === 'SoloFirstRunningReadinessV1', 'readiness-format');
  check(observation?.protocol === READINESS_PILOT.protocol, 'readiness-protocol');
  check(observation?.capacity === 8 && observation.maximumBytes === 16384, 'readiness-bounds');
  const encoded = JSON.stringify(observation ?? null);
  check(Buffer.byteLength(encoded) <= READINESS_PILOT.bytes, 'readiness-byte-limit');
  const records = Array.isArray(observation?.records) ? observation.records : [];
  check(records.length > 0 && records.length <= 8, 'bounded-records-present');
  check(observation?.dropped === 0 && observation?.errors === 0, 'complete-readiness-observation');
  const clicks = records.filter((row) => row.kind === 'start-click'),
    running = records.filter((row) => row.kind === 'first-running');
  check(clicks.length === 1 && clicks[0]?.trusted === true, 'one-trusted-public-start');
  check(running.length === 1, 'one-first-running-boundary');
  const start = clicks[0],
    active = running[0],
    cadence = active?.cadence;
  check(
    Number.isFinite(start?.atMs) &&
      start.atMs >= 0 &&
      Number.isFinite(active?.atMs) &&
      start.atMs <= active.atMs,
    'public-start-before-running',
  );
  check(active?.phase === 'running' && active.visible && active.focused, 'foreground-running');
  check(active?.tick === 0 && active.levelId === 'first-return', 'initial-authoritative-tick');
  check(Number.isSafeInteger(active?.run) && active.run > 0, 'observed-run-identity');
  check(
    active?.prepared === true &&
      active.displayedBoardValid === true &&
      active.preparedRunMatches === true &&
      active.submittedRunMatches === true,
    'accepted-prepared-board-submitted',
  );
  check(
    cadence?.samples === 30 &&
      cadence.required === 30 &&
      cadence.status === 'measured-before-play' &&
      cadence.waiting === false &&
      Number.isFinite(cadence.baselineMs) &&
      cadence.baselineMs >= 4 &&
      cadence.baselineMs <= 50,
    'complete-pre-play-cadence',
  );
  check(
    application?.cadenceCalibration?.status === 'measured-before-play' &&
      application.cadenceCalibration.samples === 30 &&
      application.cadenceCalibration.required === 30 &&
      application.cadenceCalibration.baselineMs === cadence?.baselineMs &&
      application.baselineMs === cadence?.baselineMs,
    'paused-export-retains-accepted-baseline',
  );
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    startBranch:
      start?.cadence?.status === 'measured-before-play' && start.cadence.samples === 30
        ? 'already-ready-observed; pending-path-unobserved'
        : start?.cadence?.status === 'pending-quiet-preparation' &&
            Number.isInteger(start.cadence.samples) &&
            start.cadence.samples >= 0 &&
            start.cadence.samples < 30
          ? 'incomplete-at-public-click-observed'
          : 'pre-click-cadence-unobserved',
    performanceQualification: false,
    scope:
      'Single diagnostic readiness observation; original numerical and replay verdicts remain independent. No physical-device, display completion or broad performance qualification.',
  };
}

// Reuse the existing exact-byte pair owner for saved restoration. Only scalar
// receipts survive each already-acquired public export; final replay remains
// under the qualifier's existing single native replay owner.
export function createResumeReplayEvidence(protocol) {
  const saved = protocol === 'saved-resume-v1';
  assert(saved || protocol === 'warm-resume-v1');
  const expected = saved
    ? ['before-resume', 'saved-restored', 'after-resume']
    : ['before-resume', 'after-resume'];
  const pair = saved ? createQualificationReplayIdentity() : null;
  const report = {
    format: 'SoloResumeReplayEvidenceV1',
    protocol,
    status: 'pending',
    receipts: [],
    ...(pair ? { restoration: pair.report } : {}),
  };
  return {
    report,
    observe(label, text) {
      try {
        assert.equal(label, expected[report.receipts.length], 'Exact Resume export order');
        const bytes = Buffer.byteLength(text);
        assert(bytes > 0 && bytes <= 32 * 1024 ** 2, 'Resume replay byte bound');
        const recording = JSON.parse(text),
          replay = recording.replay ?? recording;
        assert(Number.isSafeInteger(replay.ticks) && replay.ticks > 0 && replay.ticks <= 28800);
        assert.equal(replay.level?.id, 'first-return');
        const checkpoint = JSON.stringify(replay.checkpoint);
        assert(checkpoint && checkpoint.length < 16384, 'Bounded replay checkpoint');
        const receipt = {
          label,
          bytes,
          sha256: createHash('sha256').update(text).digest('hex'),
          ticks: replay.ticks,
          checkpointSHA256: createHash('sha256').update(checkpoint).digest('hex'),
        };
        if (pair && report.receipts.length < 2) pair.observe(text);
        report.receipts.push(receipt);
        return receipt;
      } catch (error) {
        report.status = 'failed';
        report.failure = String(error.message).slice(0, 1024);
        throw error;
      }
    },
    finish() {
      assert.notEqual(report.status, 'failed');
      assert.equal(report.receipts.length, expected.length);
      pair?.finish();
      report.status = 'complete';
      return report;
    },
  };
}

export function assessResumeReadiness({
  protocol,
  documents,
  observations,
  applications,
  replayEvidence,
  finalReplayText,
}) {
  const failures = [],
    check = (condition, name) => {
      if (!condition) failures.push(name);
    };
  const saved = protocol === 'saved-resume-v1',
    pilot = RESUME_READINESS_PILOTS[protocol];
  check(Boolean(pilot), 'exact-resume-protocol');
  const expectedDocuments = saved ? 2 : 1;
  check(documents === expectedDocuments, 'exact-document-count');
  check(
    Array.isArray(observations) && observations.length === expectedDocuments,
    'document-observations',
  );
  const list = Array.isArray(observations) ? observations : [];
  check(Buffer.byteLength(JSON.stringify(list)) <= 16384, 'aggregate-readiness-byte-cap');
  check(
    list.reduce((sum, row) => sum + (row?.records?.length ?? 0), 0) <= 8,
    'aggregate-record-cap',
  );
  for (const observation of list) {
    check(
      observation?.format === 'SoloFirstRunningReadinessV1' && observation.protocol === protocol,
      'readiness-format',
    );
    check(observation?.capacity === 8 && observation.maximumBytes === 16384, 'readiness-bounds');
    check(observation?.dropped === 0 && observation.errors === 0, 'complete-observation');
    const records = Array.isArray(observation?.records) ? observation.records : [];
    check(
      records.every(
        (row, i) =>
          Number.isFinite(row.atMs) &&
          row.atMs >= 0 &&
          (i === 0 || row.atMs >= records[i - 1].atMs),
      ),
      'monotonic-document-records',
    );
  }
  const first = Array.isArray(list[0]?.records) ? list[0].records : [],
    last = Array.isArray(list.at(-1)?.records) ? list.at(-1).records : [];
  check(
    JSON.stringify(first.map((r) => r.kind)) ===
      JSON.stringify(
        saved
          ? ['start-click', 'first-running', 'after-running']
          : [
              'start-click',
              'first-running',
              'after-running',
              'start-click',
              'resumed-running',
              'after-running',
            ],
      ),
    'exact-initial-boundaries',
  );
  if (saved)
    check(
      JSON.stringify(last.map((r) => r.kind)) ===
        JSON.stringify(['start-click', 'first-running', 'after-running']),
      'exact-restored-boundaries',
    );
  const initialClick = first[0],
    initial = first[1],
    paused = first[2],
    click = saved ? last[0] : first[3],
    resumed = saved ? last[1] : first[4],
    final = last.at(-1);
  const completeCadence = (c) =>
    c?.samples === 30 &&
    c.required === 30 &&
    c.waiting === false &&
    c.status === 'measured-before-play' &&
    Number.isFinite(c.baselineMs) &&
    c.baselineMs >= 4 &&
    c.baselineMs <= 50;
  const prepared = (row) =>
    row?.prepared === true &&
    row.displayedBoardValid === true &&
    row.preparedRunMatches === true &&
    row.submittedRunMatches === true;
  const foreground = (row) => row?.visible === true && row.focused === true;
  check(initialClick?.trusted === true && click?.trusted === true, 'trusted-public-clicks');
  check(
    initial?.phase === 'running' &&
      initial.tick === 0 &&
      initial.levelId === 'first-return' &&
      foreground(initial),
    'initial-tick-zero',
  );
  check(prepared(initial) && completeCadence(initial?.cadence), 'initial-preparation');
  check(
    [initial, resumed].every((r) => Number.isSafeInteger(r?.run) && r.run > 0),
    'observed-local-run-identities',
  );
  check(
    paused?.phase === 'paused' &&
      Number.isSafeInteger(paused.tick) &&
      paused.tick > 0 &&
      paused.run === initial?.run,
    'initial-authoritative-pause',
  );
  check(
    click?.phase === 'paused' && click.tick === paused?.tick && foreground(click),
    'explicit-resume-at-paused-tick',
  );
  check(
    resumed?.phase === 'running' &&
      resumed.tick === click?.tick &&
      resumed.run === click?.run &&
      foreground(resumed),
    'resume-before-first-new-tick',
  );
  if (!saved) check(click?.run === initial?.run, 'same-warm-run');
  check(prepared(resumed), 'accepted-prepared-board-submitted');
  check(completeCadence(resumed?.cadence), 'complete-resume-cadence');
  if (!saved)
    check(
      resumed?.cadence?.baselineMs === initial?.cadence?.baselineMs &&
        click?.cadence?.baselineMs === initial?.cadence?.baselineMs,
      'warm-baseline-retained',
    );
  check(
    final?.phase === 'paused' &&
      final.run === resumed?.run &&
      Number.isSafeInteger(final.tick) &&
      final.tick > resumed?.tick &&
      foreground(final),
    'positive-resumed-play-then-public-pause',
  );
  check(
    Number.isFinite(resumed?.atMs) && final?.atMs - resumed.atMs >= 400,
    'declared-no-new-input-window',
  );
  // This compares actual elapsed browser time, never a hidden/preparation delta.
  // It is not an inspection of the application's private accumulator.
  check(
    Number.isFinite(final?.atMs) &&
      final?.tick - resumed?.tick <= Math.ceil(((final.atMs - resumed.atMs) * 120) / 1000),
    'no-ticks-beyond-observed-resumed-time',
  );
  const apps = Array.isArray(applications) ? applications : [];
  check(
    apps.length === (saved ? 3 : 2) &&
      apps.every((a) => a && typeof a.cadenceCalibration === 'object'),
    'all-paused-application-exports',
  );
  const matchingApp = (app, c) =>
    completeCadence(app?.cadenceCalibration) &&
    app.baselineMs === c?.baselineMs &&
    app.cadenceCalibration.baselineMs === c?.baselineMs;
  check(matchingApp(apps[0], initial?.cadence), 'initial-paused-baseline');
  check(matchingApp(apps.at(-1), resumed?.cadence), 'resumed-paused-baseline');
  const receipts = replayEvidence?.receipts ?? [];
  check(
    replayEvidence?.format === 'SoloResumeReplayEvidenceV1' &&
      replayEvidence.protocol === protocol &&
      replayEvidence.status === 'complete' &&
      !replayEvidence.failure,
    'complete-public-replay-receipts',
  );
  check(
    JSON.stringify(receipts.map((r) => r.label)) ===
      JSON.stringify(
        saved
          ? ['before-resume', 'saved-restored', 'after-resume']
          : ['before-resume', 'after-resume'],
      ),
    'exact-replay-export-order',
  );
  check(
    receipts.every(
      (r) =>
        Number.isSafeInteger(r.bytes) &&
        r.bytes > 0 &&
        r.bytes <= 32 * 1024 ** 2 &&
        /^[a-f0-9]{64}$/.test(r.sha256) &&
        /^[a-f0-9]{64}$/.test(r.checkpointSHA256),
    ),
    'bounded-export-identities',
  );
  check(
    receipts[0]?.ticks === paused?.tick && receipts.at(-1)?.ticks === final?.tick,
    'observed-ticks-match-public-replay',
  );
  if (saved) {
    const a = receipts[0],
      b = receipts[1],
      pair = replayEvidence?.restoration;
    check(
      a?.bytes === b?.bytes &&
        a?.sha256 === b?.sha256 &&
        a?.checkpointSHA256 === b?.checkpointSHA256 &&
        b?.ticks === click?.tick,
      'exact-saved-checkpoint-and-recording',
    );
    check(
      pair?.format === 'SoloPublicReplayIdentityPairV1' &&
        pair.mode === 'exact-public-bytes-pair' &&
        pair.status === 'pass' &&
        !pair.failure &&
        pair.observations?.length === 2 &&
        pair.observations.every(
          (r, i) => r.bytes === receipts[i]?.bytes && r.sha256 === receipts[i]?.sha256,
        ),
      'existing-restoration-pair-proof',
    );
  }
  let neutralTicks = 0,
    directions = [];
  try {
    assert(
      typeof finalReplayText === 'string' && Buffer.byteLength(finalReplayText) <= 32 * 1024 ** 2,
    );
    const receipt = receipts.at(-1);
    assert.equal(Buffer.byteLength(finalReplayText), receipt?.bytes);
    assert.equal(createHash('sha256').update(finalReplayText).digest('hex'), receipt?.sha256);
    const recording = JSON.parse(finalReplayText),
      replay = recording.replay ?? recording;
    assert.equal(replay.ticks, final?.tick);
    assert.equal(
      createHash('sha256').update(JSON.stringify(replay.checkpoint)).digest('hex'),
      receipt.checkpointSHA256,
    );
    assert(Array.isArray(replay.segments) && replay.segments.length <= 28800);
    let offset = 0;
    const seenDirections = new Set();
    for (const segment of replay.segments) {
      assert(Number.isSafeInteger(segment.ticks) && segment.ticks > 0 && segment.ticks <= 28800);
      const end = offset + segment.ticks;
      assert(end <= 28800);
      const overlap = Math.max(0, Math.min(end, final.tick) - Math.max(offset, resumed.tick));
      if (overlap) {
        const input = segment.input;
        assert(
          input.boost === false &&
            input.action === false &&
            input.pickup === false &&
            input.switchClass === null,
        );
        assert([null, 'left', 'right', 'up', 'down'].includes(input.direction));
        seenDirections.add(input.direction);
        neutralTicks += overlap;
      }
      offset = end;
    }
    assert.equal(offset, replay.ticks);
    assert.equal(neutralTicks, final.tick - resumed.tick);
    assert(neutralTicks > 0);
    directions = [...seenDirections];
  } catch {
    check(false, 'neutral-discrete-replay-commands-through-resumed-window');
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    protocol,
    neutralTicks,
    directions,
    observedResumedMs:
      Number.isFinite(final?.atMs) && Number.isFinite(resumed?.atMs)
        ? final.atMs - resumed.atMs
        : null,
    performanceQualification: false,
    scope:
      'Resume correctness only. Continuous steering may persist; discrete commands remain neutral. Private clock debt and physical display completion are not directly observed. Final strict source-native replay is independently required.',
  };
}

export const selectedFont = Object.freeze({
  relativePath: 'ui/fonts/field-kit/handjet-display-600.woff2',
  bytes: 38120,
  sha256: '4797c11d5e17c3f5f9b5b3fa96efb4fd2aabb877fb4d625dfc8eb7465464e145',
  fetchTimeoutMs: 10000,
  maximumHoldMs: 60000,
  cleanupReserveMs: 2000,
  records: 16,
  maximumEvidenceBytes: 16384,
});
// Opt-in correctness-only request witness. No response mutation, controller abort,
// polling, frame callback, or replacement native Promise. The caller supplies the
// already captured scene inventory and exact source-native checkpoint function.
export function installRequiredOriginalRequestWitness(
  getScenes,
  checkpoint,
  entryURL,
  environment = globalThis,
  { startRetention = null } = {},
) {
  if (environment.top !== environment) return null;
  if (startRetention !== null && startRetention !== 'trusted-initial-start-v1')
    throw Error('Unknown required-original Start retention');
  const retainStart = startRetention === 'trusted-initial-start-v1';
  const target = new URL('content-design/assets/horizon-r1/first-return.png', entryURL).href;
  const documentRef = environment.document,
    originalFetch = environment.fetch;
  const requests = [],
    boundaries = [];
  let sequence = 0,
    failure = null,
    closed = false,
    retained = null,
    initialStart = null,
    afterCancel = null,
    capturedCancelEvent = null,
    lastClock = -Infinity;
  const fail = (message) => {
    failure ??= String(message).slice(0, 256);
  };
  const clock = () => {
    const value = environment.performance.now();
    if (!Number.isFinite(value) || value < 0 || value < lastClock)
      throw Error('Invalid request witness clock');
    lastClock = value;
    return value;
  };
  function state(kind, event) {
    const scenes = getScenes();
    if (!Array.isArray(scenes) || scenes.length > 64) throw Error('Invalid scene inventory');
    const candidates = scenes.filter((scene) => scene.lastPaint?.run);
    if (candidates.length > 1 || (!retained && candidates.length !== 1))
      throw Error('Ambiguous or missing submitted run');
    if (retained && !scenes.includes(retained.scene))
      throw Error('Cancelled attempt scene removed');
    const scene = candidates[0] ?? retained.scene,
      run = scene.lastPaint?.run ?? retained.run;
    if (retained && (scene !== retained.scene || run !== retained.run))
      throw Error('Cancelled attempt run replaced');
    const phase = documentRef.body?.dataset.flightState;
    if (!['briefing', 'paused'].includes(phase))
      throw Error('Request checkpoint requires inactive run');
    const value = checkpoint(run),
      text = JSON.stringify(value);
    if (
      !value ||
      typeof value !== 'object' ||
      !text ||
      new TextEncoder().encode(text).byteLength > 2048
    )
      throw Error('Invalid bounded checkpoint');
    const result = {
      kind,
      atMs: clock(),
      trusted: event?.isTrusted === true,
      defaultPrevented: event?.defaultPrevented === true,
      visible: documentRef.hidden === false,
      focused: documentRef.hasFocus(),
      phase,
      openDialogs: documentRef.querySelectorAll('dialog[open]').length,
      preparation: documentRef.getElementById('flight-preparation-status')?.dataset.state ?? null,
      tick: run.tick,
      levelId: run.level?.id ?? null,
      checkpoint: structuredClone(value),
      runEvidence: scene.lastPaint?.run === run ? 'submitted-board' : 'retained-inactive-reference',
      requests: requests.map((row) => ({
        id: row.id,
        aborted: row.signal.aborted === true,
        settlement: row.settlement,
      })),
    };
    if (!retained) retained = { scene, run };
    return result;
  }
  function wrappedFetch(...args) {
    // URL inspection is deliberately restricted to native strings/URLs/Requests;
    // unrelated fetches are passed through without reading their other options.
    let url;
    try {
      const input = args[0];
      url =
        typeof input === 'string'
          ? new URL(input, documentRef.baseURI).href
          : input instanceof environment.URL
            ? input.href
            : input instanceof environment.Request
              ? input.url
              : null;
    } catch {
      /* Native fetch retains authority for invalid unrelated inputs. */
    }
    if (url !== target || closed) return Reflect.apply(originalFetch, this, args);
    let row;
    try {
      if (requests.length >= 2) throw Error('Required-original request cap exceeded');
      const signal =
        args[1]?.signal ?? (args[0] instanceof environment.Request ? args[0].signal : null);
      if (!(signal instanceof environment.AbortSignal) || signal.aborted)
        throw Error('Exact original requires live native AbortSignal');
      row = {
        id: ++sequence,
        atMs: clock(),
        signal,
        abortedAtMs: null,
        settlement: 'pending',
        errorName: null,
      };
      row.abort = () => {
        try {
          row.abortedAtMs ??= clock();
        } catch (error) {
          fail(error.message);
        }
      };
      signal.addEventListener('abort', row.abort, { once: true });
      requests.push(row);
    } catch (error) {
      fail(error.message);
    }
    let result;
    try {
      result = Reflect.apply(originalFetch, this, args);
    } catch (error) {
      if (row) {
        row.settlement = 'threw';
        row.errorName = typeof error?.name === 'string' ? error.name.slice(0, 64) : null;
        row.signal.removeEventListener('abort', row.abort);
      }
      throw error;
    }
    if (row) {
      const settle = (status, error) => {
        try {
          row.settlement = status;
          row.errorName = typeof error?.name === 'string' ? error.name.slice(0, 64) : null;
          row.settledAtMs = clock();
          row.signal.removeEventListener('abort', row.abort);
        } catch (problem) {
          fail(problem.message);
        }
      };
      try {
        result.then(
          () => settle('resolved'),
          (error) => settle('rejected', error),
        );
      } catch (error) {
        fail(error.message);
      }
    }
    return result;
  }
  function back(event) {
    if (closed || event.isTrusted !== true || event.code !== 'Escape' || event.repeat) return;
    if (documentRef.querySelectorAll('dialog[open]').length) return;
    if (documentRef.getElementById('flight-preparation-status')?.dataset.state !== 'busy') return;
    try {
      if (boundaries.length) throw Error('Repeated public cancellation');
      if (retainStart && !initialStart) throw Error('Missing trusted submitted Start boundary');
      boundaries.push(state('cancel-back', event));
    } catch (error) {
      fail(error.message);
      return;
    }
    capturedCancelEvent = event;
  }
  environment.fetch = wrappedFetch;
  documentRef.addEventListener('keydown', back, true);
  function close() {
    if (closed) return;
    closed = true;
    documentRef.removeEventListener('keydown', back, true);
    capturedCancelEvent = null;
    environment.removeEventListener('pagehide', close);
    if (environment.fetch === wrappedFetch) environment.fetch = originalFetch;
    else fail('Fetch owner changed before restoration');
    for (const row of requests) row.signal.removeEventListener('abort', row.abort);
    if (requests.some((row) => row.settlement === 'pending'))
      fail('Witness closed with unsettled native fetch');
  }
  environment.addEventListener('pagehide', close, { once: true });
  return {
    close,
    captureStart(event) {
      if (!retainStart || closed) return false;
      try {
        if (initialStart) throw Error('Repeated initial Start boundary');
        if (
          event?.isTrusted !== true ||
          event.target?.closest?.('#start-button')?.id !== 'start-button'
        )
          throw Error('Required-original Start must be the trusted direct public control');
        const row = state('initial-start', event);
        if (
          !row.visible ||
          !row.focused ||
          row.openDialogs !== 0 ||
          row.tick !== 0 ||
          row.levelId !== 'first-return' ||
          row.runEvidence !== 'submitted-board'
        )
          throw Error('Invalid submitted initial Start boundary');
        initialStart = row;
        return true;
      } catch (error) {
        fail(error.message);
        return false;
      }
    },
    completeCancellation() {
      if (closed || !capturedCancelEvent || boundaries.length !== 1)
        throw Error('Invalid native cancellation completion boundary');
      boundaries.push(state('cancel-complete', capturedCancelEvent));
      capturedCancelEvent = null;
    },
    captureAfterCancel() {
      if (closed || afterCancel || boundaries.length !== 2)
        throw Error('Invalid post-cancellation boundary');
      afterCancel = state('no-automatic-start', null);
      return structuredClone(afterCancel);
    },
    snapshot() {
      const result = {
        format: retainStart
          ? 'SoloRequiredOriginalCancellationWitnessV2'
          : 'SoloRequiredOriginalCancellationWitnessV1',
        ...(retainStart
          ? { startRetention, initialStart: initialStart && structuredClone(initialStart) }
          : {}),
        targetPath: new URL(target).pathname,
        failure,
        closed,
        boundaries: structuredClone(boundaries),
        afterCancel: afterCancel && structuredClone(afterCancel),
        requests: requests.map(
          ({ id, atMs, abortedAtMs, settlement, errorName, settledAtMs, signal }) => ({
            id,
            atMs,
            abortedAtMs,
            settlement,
            errorName,
            settledAtMs: settledAtMs ?? null,
            aborted: signal.aborted === true,
          }),
        ),
      };
      if (new TextEncoder().encode(JSON.stringify(result)).byteLength > 8192)
        throw Error('Request witness byte bound');
      return result;
    },
  };
}

export function assertRequiredOriginalCancellation(witness, claimed) {
  const retainedStart = witness?.format === 'SoloRequiredOriginalCancellationWitnessV2';
  assert(retainedStart || witness?.format === 'SoloRequiredOriginalCancellationWitnessV1');
  assert.equal(witness.failure, null);
  assert(Buffer.byteLength(JSON.stringify(witness)) <= 8192);
  assert(Number.isSafeInteger(claimed) && claimed >= 1 && claimed <= 2);
  assert.equal(witness.requests?.length, claimed);
  const [before, after] = witness.boundaries ?? [];
  assert.deepEqual(
    witness.boundaries.map((row) => row.kind),
    ['cancel-back', 'cancel-complete'],
  );
  for (const row of [before, after]) {
    assert(row.trusted && row.visible && row.focused);
    assert(['briefing', 'paused'].includes(row.phase));
    assert.equal(row.openDialogs, 0);
    assert.equal(row.tick, 0);
    assert.equal(row.levelId, 'first-return');
    assert(Number.isFinite(row.atMs) && row.atMs >= 0);
    assert.equal(row.requests.length, claimed);
  }
  if (retainedStart) {
    assert.equal(witness.startRetention, 'trusted-initial-start-v1');
    const initial = witness.initialStart;
    assert.equal(initial?.kind, 'initial-start');
    assert(initial.trusted && initial.visible && initial.focused);
    assert(['briefing', 'paused'].includes(initial.phase));
    assert.equal(initial.openDialogs, 0);
    assert.equal(initial.tick, 0);
    assert.equal(initial.levelId, 'first-return');
    assert.equal(initial.runEvidence, 'submitted-board');
    assert(Number.isFinite(initial.atMs) && initial.atMs >= 0 && initial.atMs <= before.atMs);
    assert(before.atMs - initial.atMs <= 10000, 'No renewed initial Start observation deadline');
    assert.deepEqual(initial.checkpoint, before.checkpoint);
    assert(['submitted-board', 'retained-inactive-reference'].includes(before.runEvidence));
  } else assert.equal(before.runEvidence, 'submitted-board');
  assert(['submitted-board', 'retained-inactive-reference'].includes(after.runEvidence));
  assert.equal(before.preparation, 'busy');
  assert.equal(after.preparation, 'cancelled');
  assert.equal(after.defaultPrevented, true);
  assert(after.atMs >= before.atMs && after.atMs - before.atMs <= 1000);
  assert.deepEqual(after.checkpoint, before.checkpoint);
  assert(before.checkpoint && Object.keys(before.checkpoint).length > 0);
  witness.requests.forEach((row, index) => {
    assert.equal(row.id, index + 1);
    assert.equal(before.requests[index].id, row.id);
    assert.equal(after.requests[index].id, row.id);
    assert.equal(before.requests[index].aborted, false);
    assert.equal(before.requests[index].settlement, 'pending');
    assert.equal(after.requests[index].aborted, true);
    assert.equal(row.aborted, true);
    assert.equal(row.settlement, 'rejected');
    assert.equal(row.errorName, 'AbortError');
    assert(Number.isFinite(row.atMs) && row.atMs >= 0 && before.atMs >= row.atMs);
    assert(
      before.atMs - row.atMs < 10000,
      'User cancellation must precede the original hold timeout',
    );
    assert(
      Number.isFinite(row.abortedAtMs) &&
        row.abortedAtMs >= before.atMs &&
        row.abortedAtMs <= after.atMs,
    );
    assert(
      Number.isFinite(row.settledAtMs) &&
        row.settledAtMs >= row.abortedAtMs &&
        row.settledAtMs - after.atMs <= 2000,
    );
  });
  return after;
}

export const requiredOriginal = Object.freeze({
  relativePath: 'content-design/assets/horizon-r1/first-return.png',
  bytes: 2366738,
  sha256: '3acf496d9a6bc9db2f83ac01d8255223b3913e7ae0a157e48559ac981c80b95d',
  fetchTimeoutMs: 10000,
  maximumHoldMs: 20000,
  cleanupReserveMs: 2000,
  records: 16,
  maximumEvidenceBytes: 16384,
});
export const optionalPageIcon = Object.freeze({
  relativePath:
    'presentation/compiled/assets/d5227e40b6ef6c1d722bbfb09c828789facf18b0021d6e600a456fdd37ba7e11.png',
  bytes: 162,
  sha256: 'd5227e40b6ef6c1d722bbfb09c828789facf18b0021d6e600a456fdd37ba7e11',
  fetchTimeoutMs: 10000,
  maximumHoldMs: 20000,
  cleanupReserveMs: 2000,
  records: 8,
  maximumEvidenceBytes: 8192,
});
export function createSelectedFontHold(entryURL, options = {}) {
  return createReadinessOriginalOwner(entryURL, options);
}
export const optionalStartAudio = Object.freeze({
  relativePath: 'audio/effects/start.wav',
  bytes: 28844,
  sha256: '4f9093b56201eca492f784986446c247fbde5dcd6f67e364e145984e03c80135',
  fetchTimeoutMs: 10000,
  maximumHoldMs: 20000,
  cleanupReserveMs: 2000,
  records: 8,
  maximumEvidenceBytes: 8192,
});
export function createOptionalStartAudio404(entryURL, options = {}) {
  return createReadinessOriginalOwner(
    entryURL,
    { ...options, requestPolicy: 'single-v1' },
    'optional-audio',
  );
}
// Exact opt-in fault owners; executable remote package admission remains separate.
export function createRequiredOriginalHold(entryURL, options = {}) {
  return createReadinessOriginalOwner(
    entryURL,
    { ...options, requestPolicy: 'same-url-two-v2' },
    'required-original',
  );
}
export function createOptionalIcon404(entryURL, options = {}) {
  return createReadinessOriginalOwner(
    entryURL,
    { ...options, requestPolicy: 'single-v1' },
    'optional-icon',
  );
}

function createReadinessOriginalOwner(
  entryURL,
  {
    now = () => performance.now(),
    setTimer = setTimeout,
    clearTimer = clearTimeout,
    requestPolicy = 'single-v1',
    releaseBoundary = 'public-cancellation',
  } = {},
  fault = null,
) {
  const spec =
    fault === 'required-original'
      ? requiredOriginal
      : fault === 'optional-icon'
        ? optionalPageIcon
        : fault === 'optional-audio'
          ? optionalStartAudio
          : selectedFont;
  assert(['single-v1', 'same-url-two-v2'].includes(requestPolicy));
  const joined = fault !== null || requestPolicy === 'same-url-two-v2';
  assert(['public-cancellation', 'native-hidden'].includes(releaseBoundary));
  assert(
    releaseBoundary !== 'native-hidden' || (fault === null && joined),
    'Hidden completion requires joined ownership',
  );
  const injected404 = ['optional-icon', 'optional-audio'].includes(fault);
  const contentType = fault === 'optional-audio' ? 'audio/wav' : fault ? 'image/png' : 'font/woff2';
  const requestLimit = injected404 ? 1 : joined ? 2 : 1;
  const routes = [];
  let forwarding = false,
    rejectedOwned = 0;
  let lastClock = -Infinity;
  const clock = () => {
    const value = now();
    assert(
      Number.isFinite(value) && value >= 0 && value >= lastClock,
      'Finite monotonic font-owner clock',
    );
    lastClock = value;
    return value;
  };
  clock();
  const target = new URL(spec.relativePath, entryURL);
  assert(['http:', 'https:'].includes(target.protocol));
  let claimed = 0,
    released = false,
    done = false,
    closing = false,
    timer,
    decide,
    validated,
    cancelWait,
    task = null,
    deadline,
    cleanupDeadline,
    operationId = 0;
  const releaseDecision = new Promise((resolve) => {
    decide = resolve;
  });
  const ready = new Promise((resolve) => {
    validated = resolve;
  });
  const cancellation = new Promise((resolve) => {
    cancelWait = () => resolve({ cancelled: true });
  });
  const pending = new Map(),
    ownedResponses = new Set(),
    disposedResponses = new WeakSet();
  const report = {
    format:
      fault === 'required-original'
        ? 'SoloRequiredOriginalHoldV1'
        : fault === 'optional-icon'
          ? 'SoloOptionalIcon404V1'
          : fault === 'optional-audio'
            ? 'SoloOptionalStartAudio404V1'
            : joined
              ? 'SoloSelectedFontHoldV2'
              : 'SoloSelectedFontHoldV1',
    ...(releaseBoundary === 'native-hidden' ? { releaseBoundary } : {}),
    ...(joined ? { requestPolicy, maximumRequests: requestLimit } : {}),
    ...(fault ? { fault, cancellationObserved: false, injected404: false } : {}),
    targetPath: target.pathname,
    expected: spec,
    status: 'unobserved',
    released: false,
    responseDisposed: false,
    abortSettled: false,
    records: [],
    dropped: 0,
    failure: null,
    timedOutOperations: [],
  };
  const record = (kind) => {
    if (report.records.length < spec.records) report.records.push({ kind, atMs: clock() });
    else report.dropped = Math.min(65535, report.dropped + 1);
  };
  const fail = (error) => {
    report.status = 'failed';
    report.failure ??= String(error?.message ?? error).slice(0, 1024);
    decide(false);
    validated(false);
  };
  async function bounded(promise, until, label, cancellable) {
    let timeout;
    const expired = () => {
      if (!report.timedOutOperations.includes(label) && report.timedOutOperations.length < 8)
        report.timedOutOperations.push(label);
      fail(new Error(label + ' deadline reached'));
      return { timedOut: true };
    };
    assert(Number.isFinite(until) && until >= 0, 'Finite font-owner deadline');
    if (clock() >= until) return expired();
    try {
      const result = await Promise.race([
        promise,
        new Promise((resolve) => {
          timeout = setTimer(() => resolve({ timedOut: true }), Math.max(0, until - clock()));
        }),
        ...(cancellable ? [cancellation] : []),
      ]);
      if (result.timedOut || clock() >= until) return expired();
      return result;
    } finally {
      clearTimer(timeout);
    }
  }
  async function operation(label, action, until, { cleanup = false, onLate } = {}) {
    assert(Number.isFinite(until) && until >= 0, 'Finite font-owner operation deadline');
    if (clock() >= until) {
      if (!report.timedOutOperations.includes(label) && report.timedOutOperations.length < 8)
        report.timedOutOperations.push(label);
      throw new Error(label + ' deadline reached before native action');
    }
    const id = ++operationId;
    assert(id <= 8, 'Selected-font native operation cap');
    pending.set(id, label);
    // Both handlers are attached immediately; late rejection is never unhandled.
    const completion = Promise.resolve()
      .then(() => {
        assert(clock() < until, label + ' deadline reached before native action');
        return action();
      })
      .then(
        (value) => {
          pending.delete(id);
          return { ok: true, value };
        },
        (error) => {
          pending.delete(id);
          fail(error);
          return { ok: false, error };
        },
      );
    const result = await bounded(completion, until, label, !cleanup);
    if (result.timedOut || result.cancelled) {
      if (onLate)
        void completion.then((outcome) => (outcome.ok ? onLate(outcome.value) : null)).catch(fail);
      throw new Error(label + (result.timedOut ? ' timed out' : ' cancelled'));
    }
    if (!result.ok) throw result.error;
    return result.value;
  }
  function beginCleanup() {
    cleanupDeadline ??= Math.min(deadline ?? clock(), clock()) + spec.cleanupReserveMs;
    return cleanupDeadline;
  }
  async function disposeResponse(response) {
    if (disposedResponses.has(response)) return;
    ownedResponses.add(response);
    disposedResponses.add(response);
    try {
      await operation(
        'response-dispose',
        async () => {
          await response.dispose();
          ownedResponses.delete(response);
          report.responseDisposed = true;
          record('response-disposed');
        },
        beginCleanup(),
        { cleanup: true },
      );
    } catch (error) {
      fail(error);
    }
  }
  return {
    async handle(route) {
      const request = route.request();
      if (request.url() !== target.href) return false;
      claimed++;
      if (claimed > requestLimit || closing || (joined && (done || forwarding))) {
        if (joined) rejectedOwned++;
        fail(new Error('Duplicate or closed selected-font request'));
        cancelWait();
        try {
          await operation(
            'duplicate-abort',
            async () => {
              await route.abort('failed');
              if (joined) rejectedOwned--;
            },
            beginCleanup(),
            { cleanup: true },
          );
        } catch (error) {
          fail(error);
        }
        return true;
      }
      const entry = { route, fulfillmentSettled: false, abortionSettled: false };
      routes.push(entry);
      if (joined && claimed > 1) {
        try {
          assert.equal(request.method(), 'GET');
          assert.equal(request.resourceType(), fault ? 'fetch' : 'font');
          assert.equal(request.headers().range, undefined);
          record('same-original-request-joined');
        } catch (error) {
          fail(error);
          cancelWait();
        }
        await task;
        return true;
      }
      deadline = clock() + spec.maximumHoldMs;
      timer = setTimer(() => {
        report.timedOutOperations.push('hold');
        fail(new Error('Selected-font hold deadline reached'));
        cancelWait();
      }, spec.maximumHoldMs);
      task = (async () => {
        let response,
          fulfilled = false;
        try {
          assert.equal(request.method(), 'GET');
          assert.equal(request.resourceType(), fault ? 'fetch' : 'font');
          assert.equal(request.headers().range, undefined);
          report.status = 'fetching';
          record('request-matched');
          response = await operation(
            'response-fetch',
            () => route.fetch({ timeout: spec.fetchTimeoutMs, maxRedirects: 0, maxRetries: 0 }),
            Math.min(deadline, clock() + spec.fetchTimeoutMs),
            { onLate: disposeResponse },
          );
          ownedResponses.add(response);
          assert.equal(response.url(), target.href, 'Redirected font response');
          assert.equal(response.status(), 200, 'Original font must be available');
          const headers = response.headers();
          assert.equal(headers['content-type']?.split(';')[0].trim().toLowerCase(), contentType);
          assert.equal(headers['content-length'], String(spec.bytes));
          const bytes = await operation('response-body', () => response.body(), deadline);
          assert.equal(bytes.length, spec.bytes);
          report.actualBytes = bytes.length;
          report.actualSHA256 = createHash('sha256').update(bytes).digest('hex');
          assert.equal(report.actualSHA256, spec.sha256, 'Original font integrity mismatch');
          if (closing || report.failure)
            throw new Error('Font owner cancelled before original response settled');
          report.status = 'held';
          record('original-response-validated');
          validated(true);
          const shouldRelease = injected404 ? true : await releaseDecision;
          assert(shouldRelease && !closing && !report.failure, 'Font hold was cancelled');
          if (fault === 'required-original') {
            assert.equal(shouldRelease, 'cancel-original');
            report.cancellationObserved = true;
            record('original-user-cancel-observed');
            return;
          }
          forwarding = true;
          // The original APIResponse, bytes and headers are shared without a second fetch.
          // Joining closes when forwarding starts; every admitted route stays owned to settlement.
          await Promise.all(
            routes.map((item) =>
              operation(
                'response-fulfill',
                async () => {
                  await item.route.fulfill(
                    injected404
                      ? { status: 404, contentType, body: Buffer.alloc(0) }
                      : { response },
                  );
                  item.fulfillmentSettled = true;
                },
                deadline,
              ),
            ),
          );
          fulfilled = true;
          report.released = true;
          if (injected404) report.injected404 = true;
          record(injected404 ? 'declared-optional-404-settled' : 'original-response-forwarded');
        } catch (error) {
          fail(error);
        } finally {
          const end = beginCleanup();
          if (!fulfilled)
            await Promise.all(
              routes
                .filter((item) => !item.fulfillmentSettled)
                .map(async (item) => {
                  try {
                    await operation(
                      'request-abort',
                      async () => {
                        await item.route.abort('failed');
                        item.abortionSettled = true;
                        report.abortSettled = routes.every(
                          (r) => r.fulfillmentSettled || r.abortionSettled,
                        );
                        record('request-aborted');
                      },
                      end,
                      { cleanup: true },
                    );
                  } catch (error) {
                    fail(error);
                  }
                }),
            );
          if (response) await disposeResponse(response);
          clearTimer(timer);
          done = true;
          if (
            !report.failure &&
            (fulfilled ||
              (fault === 'required-original' &&
                report.cancellationObserved &&
                report.abortSettled)) &&
            report.responseDisposed &&
            pending.size === 0
          )
            report.status = 'complete';
        }
      })();
      await task;
      return true;
    },
    async waitUntilHeld() {
      const result = await bounded(
        ready.then((ok) => ({ ok })),
        clock() + spec.fetchTimeoutMs,
        'request-observation',
        true,
      );
      assert(
        result.ok && report.status === 'held',
        'Validated selected-font response was not held before Start',
      );
    },
    async cancelRequiredOriginal(witness) {
      assert.equal(fault, 'required-original');
      assert.equal(witness.targetPath, target.pathname);
      assertRequiredOriginalCancellation(witness, claimed);
      assert.equal(report.status, 'held');
      assert.equal(released, false);
      released = true;
      record('declared-public-image-cancel-boundary');
      decide('cancel-original');
      await task;
      assert.equal(report.status, 'complete', 'Canceled original native operations did not settle');
    },
    ...(releaseBoundary === 'native-hidden'
      ? {
          releaseAfterNativeHidden() {
            assert.equal(
              report.status,
              'held',
              'Only the validated pending original may be released',
            );
            assert.equal(released, false, 'No repeated release');
            released = true;
            record('declared-native-hidden-boundary');
            decide(true);
          },
        }
      : {
          releaseAfterPublicCancellation() {
            assert.equal(fault, null, 'Only shared fonts may be released after cancellation');
            assert.equal(
              report.status,
              'held',
              'Only the validated pending original may be released',
            );
            assert.equal(released, false, 'No repeated release');
            released = true;
            record('declared-public-cancel-boundary');
            decide(true);
          },
        }),
    async close() {
      closing = true;
      if (!done) {
        fail(new Error('Selected-font owner closed before release settled'));
        cancelWait();
      }
      if (task && !done)
        await bounded(
          task.then(
            () => ({ ok: true }),
            (error) => {
              fail(error);
              return { ok: false };
            },
          ),
          beginCleanup(),
          'owner-close',
          false,
        );
      clearTimer(timer);
    },
    snapshot() {
      const result = {
        ...report,
        claimed,
        done,
        closed:
          closing &&
          done &&
          pending.size === 0 &&
          ownedResponses.size === 0 &&
          (!joined ||
            (rejectedOwned === 0 &&
              routes.every((r) => r.fulfillmentSettled || r.abortionSettled))),
        ...(joined
          ? {
              ownedRouteCount:
                routes.filter((r) => !r.fulfillmentSettled && !r.abortionSettled).length +
                rejectedOwned,
              routes: routes.map((r, index) => ({
                index,
                fulfillmentSettled: r.fulfillmentSettled,
                abortionSettled: r.abortionSettled,
              })),
              rejectedOwned,
              joinsClosed: forwarding || closing || done,
            }
          : {}),
        ownedResponseCount: ownedResponses.size,
        pendingOperations: [...pending.values()],
        records: report.records.map((row) => ({ ...row })),
        timedOutOperations: [...report.timedOutOperations],
      };
      assert(Buffer.byteLength(JSON.stringify(result)) <= spec.maximumEvidenceBytes);
      return result;
    },
  };
}

// Public-action boundary only: this is checked before releasing the held response.
export function assertSelectedFontCancelled(observation, protocol = SELECTED_FONT_PILOT.protocol) {
  assert([SELECTED_FONT_PILOT.protocol, SELECTED_FONT_JOINED_PILOT.protocol].includes(protocol));
  assert.equal(observation?.format, 'SoloFirstRunningReadinessV1');
  assert.equal(observation.protocol, protocol);
  assert.equal(observation.capacity, 8);
  assert.equal(observation.maximumBytes, 16384);
  assert.equal(observation.dropped, 0);
  assert.equal(observation.errors, 0);
  assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
  assert.deepEqual(
    observation.records.map((row) => row.kind),
    ['start-click', 'cancel-back', 'cancel-complete'],
  );
  const [start, back, cancelled] = observation.records;
  assert(start.trusted && back.trusted && cancelled.trusted);
  for (const row of [back, cancelled]) {
    assert(row.visible && row.focused && row.phase !== 'running');
    assert.equal(row.tick, 0);
    assert(Number.isSafeInteger(row.run) && row.run > 0);
    assert.equal(row.levelId, 'first-return');
    assert.equal(row.font?.openDialogs, 0);
    assert.equal(row.font.selectedTheme, true);
    assert.equal(row.font.loaded, false);
    assert.notEqual(row.font.acceptedTheme, 'dnipro-porcelain');
  }
  assert.equal(back.font.preparation, 'busy');
  assert.equal(cancelled.font.preparation, 'cancelled');
  assert.equal(cancelled.font.defaultPrevented, true);
  assert.equal(back.run, cancelled.run);
  assert(start.atMs <= back.atMs && back.atMs <= cancelled.atMs);
  return cancelled;
}
export function assessSelectedFontReadiness(
  observation,
  application,
  documents,
  transport,
  requestPolicy = 'single-v1',
) {
  const protocol =
    requestPolicy === 'same-url-two-v2'
      ? SELECTED_FONT_JOINED_PILOT.protocol
      : SELECTED_FONT_PILOT.protocol;
  const failures = [];
  try {
    assert.equal(documents, 1);
    assert.equal(observation?.format, 'SoloFirstRunningReadinessV1');
    assert.equal(observation.protocol, protocol);
    assert.equal(observation.capacity, 8);
    assert.equal(observation.maximumBytes, 16384);
    assert.equal(observation.dropped, 0);
    assert.equal(observation.errors, 0);
    assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
    const rows = observation.records;
    assert.deepEqual(
      rows.map((row) => row.kind),
      [
        'start-click',
        'cancel-back',
        'cancel-complete',
        'font-release-no-start',
        'start-click',
        'first-running',
        'after-running',
      ],
    );
    const cancelled = assertSelectedFontCancelled(
      { ...observation, records: rows.slice(0, 3) },
      protocol,
    );
    const released = rows[3],
      start = rows[4],
      active = rows[5];
    for (let i = 0; i < rows.length; i++) {
      assert(Number.isFinite(rows[i].atMs) && rows[i].atMs >= 0);
      if (i) assert(rows[i].atMs >= rows[i - 1].atMs);
    }
    for (const row of [released, start, active]) {
      assert.equal(row.run, cancelled.run);
      assert.equal(row.tick, 0);
      assert.equal(row.levelId, 'first-return');
      assert(row.visible && row.focused);
      assert.equal(row.font?.openDialogs, 0);
      assert.equal(row.font.selectedTheme, true);
      assert.equal(row.font.loaded, true);
      assert.equal(row.font.acceptedTheme, 'dnipro-porcelain');
    }
    assert.notEqual(released.phase, 'running');
    assert.notEqual(start.phase, 'running');
    assert.equal(start.trusted, true);
    assert.equal(active.phase, 'running');
    assertSelectedFontTransport(transport, requestPolicy);
    const ready = assessReadinessPilot(
      { ...observation, protocol: READINESS_PILOT.protocol, records: [start, active, rows[6]] },
      application,
      documents,
    );
    assert.equal(ready.status, 'passed', ready.failures.join(', '));
  } catch (error) {
    failures.push(String(error.message ?? error).slice(0, 2048));
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    scope:
      'One exact native shared-font response withheld through trusted public cancellation, then unchanged response and explicit Start; no performance or physical-display qualification.',
  };
}

// V3 is a new diagnostic, not a reinterpretation of V1/V2 frozen snapshots.
function assertExactSelectedFace(row, expected) {
  const inventory = row.cancelBoundary?.exactFontInventory ?? row.font?.exactFontInventory;
  assert.equal(inventory?.format, 'SoloExactFontInventoryV1');
  assert.equal(inventory.available, true);
  assert.equal(inventory.scanLimit, 64);
  assert.equal(inventory.matchLimit, 8);
  assert.equal(inventory.overflow, false);
  assert.equal(inventory.matchesOverflow, false);
  assert.equal(inventory.invalid, false);
  assert(
    Number.isSafeInteger(inventory.scanned) && inventory.scanned > 0 && inventory.scanned < 64,
  );
  assert(
    Array.isArray(inventory.faces) && inventory.faces.length > 0 && inventory.faces.length <= 8,
  );
  assert(inventory.faces.length <= inventory.scanned);
  const exact = inventory.faces.filter((face) => face.weight === '600');
  assert(exact.length > 0, 'An actual matching face is required; check() alone is insufficient');
  for (const face of inventory.faces) {
    assert.equal(face.family.replace(/^(['"])(.*)\1$/, '$2'), 'Field Kit Display');
    assert.equal(face.exactWeight, face.weight === '600');
    assert(['unloaded', 'loading', 'loaded', 'error'].includes(face.status));
  }
  for (const face of exact) assert.equal(face.status, expected);
}
export function assertSelectedFontPostCommandCancelled(observation) {
  assert.equal(observation?.format, 'SoloFirstRunningReadinessV1');
  assert.equal(observation.protocol, SELECTED_FONT_POST_COMMAND_PILOT.protocol);
  assert.equal(observation.capacity, 8);
  assert.equal(observation.maximumBytes, 16384);
  assert.equal(observation.dropped, 0);
  assert.equal(observation.errors, 0);
  assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
  assert.deepEqual(
    observation.records.map((row) => row.kind),
    ['start-click', 'cancel-back', 'cancel-early-microtask', 'cancel-command-complete'],
  );
  const [start, back, early, completed] = observation.records;
  assert(start.trusted && back.trusted && early.trusted && completed.trusted);
  for (const row of [back, early, completed]) {
    assert(row.visible && row.focused && row.phase !== 'running');
    assert.equal(row.tick, 0);
    assert(Number.isSafeInteger(row.run) && row.run > 0);
    assert.equal(row.run, back.run);
    assert.equal(row.levelId, 'first-return');
    assert.equal(row.font?.openDialogs, 0);
    assert.equal(row.font.selectedTheme, true);
    assert.notEqual(row.font.acceptedTheme, 'dnipro-porcelain');
    assertExactSelectedFace(row, 'loading');
  }
  assert.equal(back.font.preparation, 'busy');
  assert.equal(completed.font.preparation, 'cancelled');
  assert.equal(completed.font.defaultPrevented, true);
  assert.equal(completed.cancelBoundary.defaultPrevented, true);
  assert.deepEqual(back.cancelBoundary.eventPath, completed.cancelBoundary.eventPath);
  for (let i = 0; i < observation.records.length; i++) {
    assert(Number.isFinite(observation.records[i].atMs) && observation.records[i].atMs >= 0);
    if (i) assert(observation.records[i].atMs >= observation.records[i - 1].atMs);
  }
  return completed;
}
export function assessSelectedFontPostCommandReadiness(
  observation,
  application,
  documents,
  transport,
) {
  const failures = [];
  try {
    assert.equal(documents, 1);
    assert.deepEqual(
      observation?.records?.map((row) => row.kind),
      [
        'start-click',
        'cancel-back',
        'cancel-early-microtask',
        'cancel-command-complete',
        'font-release-no-start',
        'start-click',
        'first-running',
        'after-running',
      ],
    );
    assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
    const rows = observation.records;
    const cancelled = assertSelectedFontPostCommandCancelled({
      ...observation,
      records: rows.slice(0, 4),
    });
    const [released, start, active, after] = rows.slice(4);
    for (let i = 0; i < rows.length; i++) {
      assert(Number.isFinite(rows[i].atMs) && rows[i].atMs >= 0);
      if (i) assert(rows[i].atMs >= rows[i - 1].atMs);
    }
    for (const row of [released, start, active]) {
      assert.equal(row.run, cancelled.run);
      assert.equal(row.tick, 0);
      assert.equal(row.levelId, 'first-return');
      assert(row.visible && row.focused);
      assert.equal(row.font?.openDialogs, 0);
      assert.equal(row.font.selectedTheme, true);
      assert.equal(row.font.acceptedTheme, 'dnipro-porcelain');
      assertExactSelectedFace(row, 'loaded');
    }
    assert.notEqual(released.phase, 'running');
    assert.notEqual(start.phase, 'running');
    assert.equal(start.trusted, true);
    assert.equal(active.phase, 'running');
    assertSelectedFontTransport(transport, 'same-url-two-v2');
    const ready = assessReadinessPilot(
      { ...observation, protocol: READINESS_PILOT.protocol, records: [start, active, after] },
      application,
      documents,
    );
    assert.equal(ready.status, 'passed', ready.failures.join(', '));
  } catch (error) {
    failures.push(String(error.message ?? error).slice(0, 2048));
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    scope:
      'Post-native-command cancellation with retained early snapshots and exact FontFace evidence; unchanged response, explicit Start and independent replay/numeric gates. No physical-device qualification.',
  };
}

// Explicit prospective transport admission; legacy callers retain single-v1.
export function assertSelectedFontTransport(
  transport,
  requestPolicy = 'single-v1',
  releaseBoundary = 'public-cancellation',
) {
  assert(['single-v1', 'same-url-two-v2'].includes(requestPolicy));
  const joined = requestPolicy === 'same-url-two-v2';
  assert(['public-cancellation', 'native-hidden'].includes(releaseBoundary));
  assert(
    releaseBoundary !== 'native-hidden' || joined,
    'Hidden completion requires joined ownership',
  );
  assert.equal(
    transport?.releaseBoundary,
    releaseBoundary === 'native-hidden' ? releaseBoundary : undefined,
  );
  assert.equal(transport?.format, joined ? 'SoloSelectedFontHoldV2' : 'SoloSelectedFontHoldV1');
  assert.equal(transport.status, 'complete');
  if (joined) {
    assert.equal(transport.requestPolicy, requestPolicy);
    assert.equal(transport.maximumRequests, 2);
    assert(
      Number.isSafeInteger(transport.claimed) && transport.claimed >= 1 && transport.claimed <= 2,
    );
    assert.equal(transport.routes?.length, transport.claimed);
    assert.equal(transport.ownedRouteCount, 0);
    assert.equal(transport.rejectedOwned, 0);
    assert.equal(transport.joinsClosed, true);
    transport.routes.forEach((route, index) =>
      assert.deepEqual(route, {
        index,
        fulfillmentSettled: true,
        abortionSettled: false,
      }),
    );
  } else assert.equal(transport.claimed, 1);
  assert.equal(transport.released, true);
  assert.equal(transport.done, true);
  assert.equal(transport.closed, true);
  assert.equal(transport.responseDisposed, true);
  assert.equal(transport.ownedResponseCount, 0);
  assert.deepEqual(transport.pendingOperations, []);
  assert.deepEqual(transport.timedOutOperations, []);
  assert.equal(transport.failure, null);
  assert.equal(transport.dropped, 0);
  assert.deepEqual(transport.expected, selectedFont);
  assert.equal(transport.actualBytes, selectedFont.bytes);
  assert.equal(transport.actualSHA256, selectedFont.sha256);
  assert(Array.isArray(transport.records) && transport.records.length <= selectedFont.records);
  const events = transport.records.map((r) => r.kind);
  if (joined) {
    assert.equal(
      events.filter((kind) => kind === 'same-original-request-joined').length,
      transport.claimed - 1,
    );
    const join = events.indexOf('same-original-request-joined');
    assert(join < 0 || (join > 0 && join < events.indexOf('original-response-forwarded')));
  }
  assert.deepEqual(
    joined ? events.filter((kind) => kind !== 'same-original-request-joined') : events,
    [
      'request-matched',
      'original-response-validated',
      releaseBoundary === 'native-hidden'
        ? 'declared-native-hidden-boundary'
        : 'declared-public-cancel-boundary',
      'original-response-forwarded',
      'response-disposed',
    ],
  );
  assert(Buffer.byteLength(JSON.stringify(transport)) <= selectedFont.maximumEvidenceBytes);
  return true;
}

// Supplemental correctness predicate only. The existing source/replay/readiness
// assessment remains independently mandatory; no package selector is admitted here.
export function assessReadinessGeometry(observations, protocol) {
  const failures = [],
    check = (condition, reason) => {
      if (!condition) failures.push(reason);
    };
  const saved = protocol === 'saved-resume-v1',
    warm = protocol === 'warm-resume-v1';
  check(
    ['first-running-v1', 'warm-resume-v1', 'saved-resume-v1'].includes(protocol),
    'exact-geometry-protocol',
  );
  const list = Array.isArray(observations) ? observations : [];
  check(list.length === (saved ? 2 : 1), 'exact-geometry-documents');
  check(Buffer.byteLength(JSON.stringify(observations ?? null)) <= 16384, 'geometry-byte-cap');
  let records = 0,
    active = 0;
  for (const document of list) {
    check(
      document?.format === 'SoloFirstRunningReadinessV1' &&
        document.protocol === protocol &&
        document.geometryObservation === 'phase-boundary-v1',
      'explicit-geometry-observation',
    );
    check(
      document?.capacity === 8 &&
        document.maximumBytes === 16384 &&
        document.dropped === 0 &&
        document.errors === 0,
      'complete-bounded-geometry',
    );
    const rows = Array.isArray(document?.records) ? document.records : [];
    records += rows.length;
    const activeRows = rows.filter((r) => ['first-running', 'resumed-running'].includes(r?.kind));
    check(
      JSON.stringify(activeRows.map((r) => r.kind)) ===
        JSON.stringify(warm ? ['first-running', 'resumed-running'] : ['first-running']),
      'exact-geometry-boundaries',
    );
    for (const row of rows) {
      if (!['first-running', 'resumed-running'].includes(row?.kind)) {
        check(!Object.hasOwn(row ?? {}, 'geometry'), 'geometry-only-at-active-boundaries');
        continue;
      }
      active++;
      const g = row.geometry;
      check(
        row.phase === 'running' && row.visible === true && row.focused === true,
        'foreground-geometry-boundary',
      );
      check(
        row.prepared === true &&
          row.displayedBoardValid === true &&
          row.preparedRunMatches === true &&
          row.submittedRunMatches === true,
        'geometry-prepared-run-acknowledgments',
      );
      check(
        ['clientWidth', 'clientHeight', 'displayCSSWidth', 'displayCSSHeight'].every(
          (k) => Number.isSafeInteger(g?.[k]) && g[k] > 0,
        ),
        'positive-finite-geometry',
      );
      check(
        g?.clientWidth === g?.displayCSSWidth && g?.clientHeight === g?.displayCSSHeight,
        'accepted-cache-matches-visible-css-geometry',
      );
      check(
        Number.isSafeInteger(g?.revision) && g.revision >= 0 && g.preparedRevision === g.revision,
        'accepted-geometry-revision',
      );
      check(g?.flightLayout === null, 'preparation-layout-marker-cleared');
      check(['shown', 'hidden'].includes(g?.screenControls), 'observed-screen-control-state');
    }
  }
  check(records > 0 && records <= 8, 'aggregate-geometry-record-cap');
  check(active === (protocol === 'first-running-v1' ? 1 : 2), 'exact-active-geometry-count');
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    protocol,
    activeBoundaries: active,
    performanceQualification: false,
    scope:
      'Phase-boundary application geometry acknowledgments only; existing readiness and native replay checks remain required. No physical-display or uninstrumented timing proof.',
  };
}

export function assertHiddenPreparationProof(raw) {
  assert(!raw.fontCleanupFailure, 'Final shared-font cleanup failed');
  assert.equal(raw.preparationRetention, 'visible-busy-shared-font-v1');
  assert.equal(raw.runRetentionPolicy, 'retained-paused-run-with-visible-rejoin-v1');
  const state = (name) => {
    const rows = raw.snapshots.filter((row) => row.label === name);
    assert.equal(rows.length, 1, 'Missing/duplicate hidden preparation snapshot: ' + name);
    return rows[0];
  };
  const initial = state('retained-initial-preparation'),
    away = state('preparation-native-away'),
    completed = state('preparation-completed-hidden');
  const returned = state('preparation-returned-before-start'),
    waiting = state('preparation-returned-still-paused'),
    before = state('before-explicit-resume');
  assert.equal(initial.runTick, 0);
  assert.equal(initial.levelId, 'first-return');
  assert(Number.isSafeInteger(initial.runId) && initial.runId > 0);
  assert.match(initial.checkpoint?.hash ?? '', /^[a-f0-9]{16}$/);
  for (const row of [initial, away, completed, returned, waiting, before]) {
    assert(['briefing', 'paused'].includes(row.phase));
    assert.equal(row.runId, initial.runId);
    assert.equal(row.runTick, 0);
    assert.deepEqual(row.checkpoint, initial.checkpoint);
    assert.equal(row.identityFailure, false);
    assert.equal(row.preparationDetails?.status, 'observed');
    assert.equal(row.preparationDetails.selectedTheme, true);
    assert.equal(row.preparationDetails.openDialogs, 0);
    assert(
      row.preparationDetails.matchingFaces.length >= 1 &&
        row.preparationDetails.matchingFaces.length <= 2,
    );
  }
  assert.equal(initial.visibility, 'visible');
  assert.equal(initial.focused, true);
  assert.equal(initial.preparation, 'busy');
  assert.equal(initial.preparationDetails.waitingLabelMatches, true);
  assert.equal(initial.preparationDetails.label, initial.preparationDetails.expectedLabel);
  for (const row of [initial, away]) {
    assert.notEqual(row.preparationDetails.acceptedTheme, 'dnipro-porcelain');
    assert(
      row.preparationDetails.matchingFaces.every(
        (face) =>
          face.family === 'Field Kit Display' && face.weight === '600' && face.status === 'loading',
      ),
    );
  }
  for (const row of [completed, returned, waiting, before]) {
    assert.equal(row.preparationDetails.acceptedTheme, 'dnipro-porcelain');
    assert(
      row.preparationDetails.matchingFaces.every(
        (face) =>
          face.family === 'Field Kit Display' && face.weight === '600' && face.status === 'loaded',
      ),
    );
  }
  for (const row of [away, completed]) assert.equal(row.visibility, 'hidden');
  assert(completed.atMs - away.atMs >= 10000);
  const probe = raw.lifecycle;
  const hiddenIndex = probe.events.findIndex(
    (event) =>
      event.type === 'visibilitychange' &&
      event.trusted &&
      event.visibility === 'hidden' &&
      event.atMs >= initial.atMs &&
      event.atMs <= away.atMs,
  );
  assert(hiddenIndex >= 0);
  // Event order distinguishes an earlier visible callback on a coarse clock.
  // Separate phase records have no shared sequence, so equal time stays ambiguous.
  for (const row of probe.events.slice(hiddenIndex + 1))
    assert(
      !(row.atMs <= completed.atMs && row.visibility === 'visible'),
      'Hidden interval was interrupted after the trusted hidden event',
    );
  for (const row of probe.phases)
    assert(
      !(row.atMs >= away.atMs && row.atMs <= completed.atMs && row.visibility === 'visible'),
      'Hidden interval contains visible or ambiguous phase evidence',
    );
  for (const row of [initial, returned, waiting, before]) {
    assert.equal(row.visibility, 'visible');
    assert.equal(row.focused, true);
    assert.equal(row.runEvidence, 'submitted-board');
    assert.equal(row.retainedIdentityMatched, true);
  }
  assert(waiting.atMs - returned.atMs >= 500);
  assert.equal(raw.fontTransportBeforeHidden.status, 'held');
  assert.equal(raw.fontTransportBeforeHidden.released, false);
  assertSelectedFontTransport(raw.fontTransport, 'same-url-two-v2', 'native-hidden');
  const resumed = state('resumed-neutral-no-key'),
    fresh = state('fresh-movement');
  assert.equal(probe.preparationRetention, raw.preparationRetention);
  assert.equal(probe.runRetentionPolicy, raw.runRetentionPolicy);
  assert.equal(probe.identityFailure, false);
  assert.deepEqual(probe.dropped, { events: 0, phases: 0 });
  assert(probe.events.length <= 128 && probe.phases.length <= 64);
  assert(probe.frames.length > 0 && probe.frames.length <= 16);
  assert(
    probe.events
      .slice(hiddenIndex + 1)
      .some(
        (event) =>
          event.type === 'visibilitychange' &&
          event.trusted &&
          event.visibility === 'visible' &&
          event.atMs >= completed.atMs &&
          event.atMs <= returned.atMs,
      ),
  );
  assert(!probe.phases.some((row) => row.phase === 'running' && row.atMs < before.atMs));
  const gesture = probe.resumeGesture;
  assert(gesture?.trusted && gesture.type === 'click' && gesture.atMs >= before.atMs);
  assert.equal(gesture.runId, initial.runId);
  assert.equal(gesture.runEvidence, 'submitted-board');
  assert.equal(gesture.retainedIdentityMatched, true);
  assert(
    !probe.events.some(
      (event) =>
        event.type === 'click' &&
        event.trusted &&
        event.atMs > initial.atMs &&
        event.atMs < before.atMs &&
        ['start-button', 'shell-featured'].includes(event.target),
    ),
  );
  const phase = probe.resumePhase;
  const anchor =
    phase &&
    phase.atMs <= probe.frames[0].atMs &&
    phase.runId === initial.runId &&
    phase.runEvidence === 'submitted-board' &&
    phase.retainedIdentityMatched
      ? phase
      : gesture;
  assert.deepEqual(raw.resumeWitness?.anchor, anchor);
  assert.equal(raw.resumeWitness.simulationRateHz, 120);
  assert.equal(raw.resumeWitness.roundingMarginTicks, 1);
  assert.equal(
    raw.resumeWitness.anchorKind,
    anchor === phase ? 'public-running-phase-mutation' : 'trusted-public-Resume-click',
  );
  assert.deepEqual(
    raw.resumeWitness.submittedFrameBounds,
    probe.frames.map((frame) => ({
      atMs: frame.atMs,
      elapsedMs: frame.atMs - anchor.atMs,
      actualTicks: frame.runTick,
      maximumTicks: Math.ceil(((frame.atMs - anchor.atMs) * 120) / 1000) + 1,
    })),
  );
  assert(anchor && anchor.atMs >= gesture.atMs && anchor.atMs <= probe.frames[0].atMs);
  assert.equal(anchor.runId, initial.runId);
  let previous = anchor.atMs;
  probe.frames.forEach((frame) => {
    assert.equal(frame.phase, 'running');
    assert.equal(frame.visibility, 'visible');
    assert.equal(frame.runId, initial.runId);
    assert.equal(frame.identityFailure, false);
    assert.equal(frame.runEvidence, 'submitted-board');
    assert.equal(frame.retainedIdentityMatched, true);
    assert(Number.isFinite(frame.atMs) && frame.atMs >= previous);
    previous = frame.atMs;
    assert(
      Number.isSafeInteger(frame.runTick) &&
        frame.runTick >= 0 &&
        frame.runTick <= Math.ceil(((frame.atMs - anchor.atMs) * 120) / 1000) + 1,
    );
  });
  assert.deepEqual(raw.resumeProbe.frames, probe.frames);
  assert.deepEqual(raw.resumeProbe.resumeGesture, gesture);
  assert.deepEqual(raw.resumeProbe.resumePhase, probe.resumePhase);
  for (const row of [
    resumed,
    fresh,
    state('final-paused'),
    state('after-public-export'),
    probe.current,
  ]) {
    assert.equal(row.runId, initial.runId);
    assert.equal(row.runEvidence, 'submitted-board');
    assert.equal(row.retainedIdentityMatched, true);
    assert.equal(row.identityFailure, false);
    assert.equal(row.visibility, 'visible');
    assert.equal(row.focused, true);
  }
  assert(resumed.runTick > 0);
  assert.equal(resumed.phase, 'running');
  assert.deepEqual(resumed.player, initial.player);
  assert.equal(fresh.phase, 'running');
  assert(fresh.player.x < resumed.player.x);
  assert(
    probe.events.some(
      (event) =>
        event.type === 'keydown' &&
        event.key === 'ArrowLeft' &&
        event.trusted &&
        event.atMs > resumed.atMs,
    ),
  );
  const final = state('final-paused'),
    exported = state('after-public-export');
  assert.equal(final.phase, 'paused');
  assert.equal(exported.phase, 'paused');
  assert(final.runTick >= fresh.runTick);
  assert.equal(final.runTick, exported.runTick);
  assert.deepEqual(final.checkpoint, exported.checkpoint);
}

export function assertRequiredOriginalAfterCancel(witness) {
  const cancelled = assertRequiredOriginalCancellation(witness, witness?.requests?.length);
  assert.equal(witness.closed, true, 'Passive fetch observer must retire before fresh Start');
  const after = witness.afterCancel;
  assert.equal(after?.kind, 'no-automatic-start');
  assert(after.visible && after.focused && ['briefing', 'paused'].includes(after.phase));
  assert.equal(after.openDialogs, 0);
  assert.equal(after.preparation, 'cancelled');
  assert.equal(after.tick, 0);
  assert.equal(after.levelId, 'first-return');
  assert(['submitted-board', 'retained-inactive-reference'].includes(after.runEvidence));
  assert(Number.isFinite(after.atMs) && after.atMs - cancelled.atMs >= 500);
  assert(after.atMs - cancelled.atMs <= 10000, 'No renewed cancellation observation deadline');
  assert.deepEqual(after.checkpoint, cancelled.checkpoint);
  assert.deepEqual(
    after.requests,
    witness.requests.map(({ id }) => ({ id, aborted: true, settlement: 'rejected' })),
  );
  return after;
}

// Explicit inactive public boundary, never a frame or layout sample.
export function captureOptionalIconFallback(environment = globalThis) {
  const document = environment.document;
  const warning = document.getElementById('asset-warning');
  const expected = environment.RevealLineI18n?.t(
    'interface:releaseArtworkIsUnavailableSourceArtworkIsShown',
  );
  const text = warning?.textContent;
  return {
    format: 'SoloOptionalIconFallbackV1',
    atMs: environment.performance.now(),
    phase: document.body?.dataset.flightState ?? null,
    visible: document.hidden === false,
    focused: document.hasFocus(),
    hidden: warning?.hidden ?? null,
    text: typeof text === 'string' && text.length <= 2048 ? text : null,
    expected:
      typeof expected === 'string' && expected.length > 0 && expected.length <= 1024
        ? expected
        : null,
  };
}
export function assertOptionalIconFallback(value) {
  assert.equal(value?.format, 'SoloOptionalIconFallbackV1');
  assert(Buffer.byteLength(JSON.stringify(value)) <= 8192);
  assert(Number.isFinite(value.atMs) && value.atMs >= 0);
  assert(value.visible && value.focused && ['briefing', 'paused'].includes(value.phase));
  assert.equal(value.hidden, false);
  assert(typeof value.expected === 'string' && value.expected.length > 0);
  assert(typeof value.text === 'string' && value.text.includes(value.expected));
  return value;
}
export function assertReadinessMediaTransport(value, protocol) {
  const required = protocol === 'required-original-cancel-v1';
  const audio = protocol === 'optional-audio-start-missing-v1';
  assert(required || audio || protocol === 'optional-icon-missing-v1');
  const spec = required ? requiredOriginal : audio ? optionalStartAudio : optionalPageIcon;
  assert.equal(
    value?.format,
    required
      ? 'SoloRequiredOriginalHoldV1'
      : audio
        ? 'SoloOptionalStartAudio404V1'
        : 'SoloOptionalIcon404V1',
  );
  assert(Buffer.byteLength(JSON.stringify(value)) <= spec.maximumEvidenceBytes);
  assert.equal(value.status, 'complete');
  assert.equal(value.failure, null);
  assert.equal(value.dropped, 0);
  assert.equal(value.closed, true);
  assert.equal(value.done, true);
  assert.equal(value.responseDisposed, true);
  assert.equal(value.ownedResponseCount, 0);
  assert.deepEqual(value.pendingOperations, []);
  assert.deepEqual(value.timedOutOperations, []);
  assert.deepEqual(value.expected, spec);
  assert.equal(value.actualSHA256, spec.sha256);
  assert.equal(value.actualBytes, spec.bytes);
  assert(
    typeof value.targetPath === 'string' && value.targetPath.endsWith('/' + spec.relativePath),
  );
  assert(
    Number.isSafeInteger(value.claimed) &&
      value.claimed >= 1 &&
      value.claimed <= (required ? 2 : 1),
  );
  if (required) {
    assert.equal(value.cancellationObserved, true);
    assert.equal(value.abortSettled, true);
    assert.equal(value.released, false);
    assert.equal(value.ownedRouteCount, 0);
    assert.equal(value.rejectedOwned, 0);
    assert.equal(value.routes.length, value.claimed);
    assert(value.routes.every((row) => row.abortionSettled && !row.fulfillmentSettled));
  } else {
    assert.equal(value.injected404, true);
    assert.equal(value.released, true);
  }
  return value;
}
export function assessReadinessMediaFault({
  protocol,
  observation,
  application,
  documents,
  transport,
  witness,
  fallback,
  cleanupFailure,
  audioCheck,
  startRetention = null,
}) {
  const failures = [];
  let projected;
  try {
    assert(MEDIA_FAULT_PILOTS[protocol]);
    assert.equal(observation?.protocol, protocol);
    assert(!cleanupFailure, 'Media cleanup failed');
    assertReadinessMediaTransport(transport, protocol);
    const required = protocol === 'required-original-cancel-v1';
    if (startRetention !== null) assert(required && startRetention === 'trusted-initial-start-v1');
    if (required)
      assert.equal(
        witness?.format,
        startRetention
          ? 'SoloRequiredOriginalCancellationWitnessV2'
          : 'SoloRequiredOriginalCancellationWitnessV1',
      );
    const records = observation.records;
    assert.deepEqual(
      records.map((row) => row.kind),
      required
        ? ['start-click', 'start-click', 'first-running', 'after-running']
        : ['start-click', 'first-running', 'after-running'],
    );
    if (required) {
      const after = assertRequiredOriginalAfterCancel(witness);
      assert.equal(witness.requests.length, transport.claimed);
      assert.equal(witness.targetPath, transport.targetPath);
      const first = records[0],
        fresh = records[1];
      assert(first.trusted && first.visible && first.focused);
      assert(['briefing', 'paused'].includes(first.phase));
      assert(first.atMs <= witness.boundaries[0].atMs);
      assert(fresh.trusted && fresh.atMs >= after.atMs);
      assert(['briefing', 'paused'].includes(fresh.phase));
      assert(fresh.visible && fresh.focused);
      if (witness.format === 'SoloRequiredOriginalCancellationWitnessV2') {
        assert.equal(first.submittedRunMatches, true);
        assert(
          witness.initialStart.atMs >= first.atMs && witness.initialStart.atMs - first.atMs <= 1000,
        );
        for (const row of records.slice(1)) {
          assert.equal(row.run, first.run, 'Fresh Start must rejoin the initially submitted run');
          assert.equal(row.submittedRunMatches, true, 'Rejoin requires current submitted board');
        }
      }
    } else if (protocol === 'optional-audio-start-missing-v1') {
      assertOptionalAudioFallback(application, audioCheck);
      assert.equal(
        records[1].actorStyle,
        'campaign',
        'Actual launch appearance must use start.wav',
      );
      assert.equal(
        records[2].actorStyle,
        'campaign',
        'Final appearance must retain campaign style',
      );
    } else {
      assertOptionalIconFallback(fallback);
      assert(fallback.atMs <= records[0].atMs, 'Optional failure must be observed before Start');
    }
    projected = {
      ...observation,
      protocol: READINESS_PILOT.protocol,
      records: required ? records.slice(1) : records,
    };
    const final = records.at(-1),
      active = records.at(-2);
    assert.equal(final.phase, 'paused');
    assert.equal(final.run, active.run);
    assert(final.tick >= 120 && final.visible && final.focused);
    const readiness = assessReadinessPilot(projected, application, documents);
    failures.push(...readiness.failures);
  } catch (error) {
    failures.push(String(error.message).slice(0, 1024));
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    protocol,
    performanceQualification: false,
    scope:
      'Injected media acquisition correctness only. Raw failed responses/numerical gates and strict source-native replay remain independent; no decoder-stall, display-completion or performance credit.',
  };
}

// Explicit paused diagnostic settlement only; this does not create or activate owners.
// Serialized into the browser; retain a compact pre-wait observation, then use the
// same fixed predicate under the existing action/scenario deadline.
export function observeOptionalAudioSettlement(reportOnly = false) {
  const phase = globalThis.document.body.dataset.flightState;
  if (phase !== 'paused') throw new Error('Optional audio settlement requires public Pause');
  const application = globalThis.RevealLineSoloPerformance?.export();
  const media = application?.resources?.media;
  const observation = {
    phase,
    effectsLoading: application?.resources?.pcm?.effects?.loading ?? null,
    queued: media?.queued ?? null,
    active: Object.fromEntries(
      ['fetch', 'decode', 'inspect', 'main'].map((key) => [key, media?.active?.[key] ?? null]),
    ),
    reservedDecodeBytes: media?.reservedDecodeBytes ?? null,
  };
  const idle =
    observation.effectsLoading === 0 &&
    observation.queued === 0 &&
    observation.reservedDecodeBytes === 0 &&
    Object.values(observation.active).every((value) => value === 0);
  return reportOnly ? { ...observation, idle } : idle && observation;
}

// Existing paused diagnostic snapshots only; no audible-output claim.
export function assertOptionalAudioFallback(application, audioCheck) {
  assert.equal(application?.audio?.muted, false, 'Public unmute required');
  assert(
    Number.isFinite(application.audio.volume) &&
      application.audio.volume > 0 &&
      application.audio.volume <= 1,
  );
  assert.deepEqual(audioCheck?.master, application.audio);
  assert.deepEqual(audioCheck.requirement, { unmuted: true, nativeStartsAtLeast: 1 });
  const counts = audioCheck.observed;
  for (const key of [
    'sourceStarts',
    'oscillatorStarts',
    'sourceStartFailures',
    'mediaPlayRequests',
    'mediaPlayResolved',
    'mediaPlayRejected',
  ])
    assert(
      Number.isSafeInteger(counts?.[key]) && counts[key] >= 0 && counts[key] <= 1000000,
      'Bounded observed audio operations',
    );
  assert(
    counts.sourceStarts + counts.oscillatorStarts + counts.mediaPlayResolved >= 1,
    'Native audio activation unobserved',
  );
  assert.equal(counts.sourceStartFailures, 0);
  assert.equal(counts.mediaPlayRejected, 0);
  assert.equal(
    application.resources?.pcm?.effects?.loading,
    0,
    'Optional effect requests must settle',
  );
  const media = application.resources?.media;
  assert.equal(media?.queued, 0, 'Shared preparation must be idle at the retained paused boundary');
  assert.equal(media.reservedDecodeBytes, 0);
  assert.deepEqual(media.active, { fetch: 0, decode: 0, inspect: 0, main: 0 });
  return {
    scope:
      'Nonblocking gameplay fallback and observed native operation calls only; no specific replacement tone, audibility, native decoder memory or timing proof.',
  };
}

// Separate explicit diagnostic; no remote declaration or workflow is supplied.
// Serialized into the original document immediately before theme selection. Does not
// invoke FontFace.load or make an additional FontFaceSet.load request.
export function createSelectedFontSettlementProbe(environment = globalThis) {
  const doc = environment.document;
  const fonts = doc?.fonts;
  const target = "600 16px 'Field Kit Display', 'Handjet', sans-serif";
  const sample = 'Workshop Майстерня 012345';
  const faces = [],
    calls = [],
    boundaries = [],
    events = [];
  const identities = new WeakMap();
  let css = null;
  let disposed = false,
    invalid = false,
    overflow = false,
    sequence = 0;
  let installed = false,
    windowListening = false,
    lastAt = -1;
  const listening = [];
  const original = fonts?.load;
  const own = fonts && Object.getOwnPropertyDescriptor(fonts, 'load');
  const now = () => {
    const at = environment.performance?.now();
    if (!Number.isFinite(at) || at < 0 || at < lastAt) {
      invalid = true;
      throw new Error('Invalid font witness clock');
    }
    lastAt = at;
    return at;
  };
  const text = (value, cap) => (typeof value === 'string' && value.length <= cap ? value : null);
  const errorText = (error) => {
    const out = {};
    for (const key of ['name', 'message']) {
      try {
        out[key] = text(error?.[key], 160);
      } catch {
        out[key] = null;
      }
    }
    return out;
  };
  const event = (kind, fields = {}) => {
    if (disposed) return;
    if (events.length >= 32) {
      overflow = true;
      return;
    }
    try {
      events.push({ kind, atMs: now(), ...fields });
    } catch {
      invalid = true;
    }
  };
  function observe(face) {
    if (!face || typeof face !== 'object') {
      invalid = true;
      return null;
    }
    if (identities.has(face)) return identities.get(face);
    let family;
    try {
      family = text(face.family, 96)?.replace(/^(['"])(.*)\1$/, '$2');
    } catch {
      invalid = true;
      return null;
    }
    if (family !== 'Field Kit Display') return null;
    if (faces.length >= 8) {
      overflow = true;
      return null;
    }
    const row = {
      id: ++sequence,
      firstSeenAtMs: now(),
      firstSeenBoundaryCount: boundaries.length,
      descriptors: {},
      settlement: 'unsettled-observed',
    };
    for (const key of ['family', 'weight', 'style', 'stretch', 'unicodeRange', 'display']) {
      try {
        row.descriptors[key] = text(face[key], key === 'unicodeRange' ? 128 : 96);
      } catch {
        row.descriptors[key] = null;
      }
      if (row.descriptors[key] === null) invalid = true;
    }
    if (row.descriptors.weight !== '600') return null;
    identities.set(face, row.id);
    faces.push(row);
    event('face-observed', { face: row.id });
    try {
      // Native promise observation is passive; reading loaded does not demand a font.
      Promise.prototype.then
        .call(
          face.loaded,
          (resolved) => {
            if (disposed) return;
            if (resolved !== face) {
              invalid = true;
              return;
            }
            row.settlement = 'fulfilled';
            row.settledAtMs = now();
            event('face-fulfilled', { face: row.id });
          },
          (error) => {
            if (disposed) return;
            row.settlement = 'rejected';
            row.settledAtMs = now();
            row.error = errorText(error);
            event('face-rejected', { face: row.id });
          },
        )
        .catch(() => {
          if (!disposed) invalid = true;
        });
    } catch {
      invalid = true;
    }
    return row.id;
  }
  function scan() {
    const result = [];
    try {
      const iterator = fonts[Symbol.iterator]();
      let done = false;
      for (let i = 0; i < 64; i++) {
        const next = iterator.next();
        if (next.done) {
          done = true;
          break;
        }
        const id = observe(next.value);
        if (id === null) continue;
        const status = next.value.status;
        if (!['unloaded', 'loading', 'loaded', 'error'].includes(status)) invalid = true;
        result.push({ id, status, settlement: faces.find((row) => row.id === id).settlement });
      }
      if (!done) overflow = true;
    } catch {
      invalid = true;
    }
    return result;
  }
  function directCss() {
    // The admitted page has more than 32 stylesheets. Observe only the exact
    // existing boot link; unrelated stylesheets do not belong to this witness.
    const links = doc.querySelectorAll?.(
      'link[rel="stylesheet"][data-boot-href="ui/field-kit-fonts.css"]',
    );
    if (!links || links.length !== 1) throw new Error('One selected-font stylesheet link required');
    const link = links[0],
      sheet = link.sheet;
    if (
      link.ownerDocument !== doc ||
      link.isConnected !== true ||
      !sheet ||
      sheet.ownerNode !== link ||
      typeof link.href !== 'string' ||
      sheet.href !== link.href
    )
      throw new Error('Selected-font stylesheet owner unavailable');
    const matched = [];
    for (const sheet of [link.sheet]) {
      if (typeof sheet.href !== 'string') continue;
      const href = new URL(sheet.href, doc.baseURI);
      if (
        href.origin !== new URL(doc.baseURI).origin ||
        href.pathname !== '/game/ui/field-kit-fonts.css'
      )
        continue;
      const visit = (rules, depth) => {
        if (!rules || !Number.isSafeInteger(rules.length) || rules.length > 8 || depth > 2)
          throw new Error('Selected-font CSS rule bound');
        for (const rule of rules) {
          if (rule.type === 5) {
            const property = (key) => text(rule.style.getPropertyValue(key), 256)?.trim();
            const family = property('font-family')?.replace(/^(['"])(.*)\1$/, '$2');
            if (family !== 'Field Kit Display') continue;
            const src = property('src'),
              match = /^url\(["']?([^"')]+)["']?\)\s+format\(["']woff2["']\)$/.exec(src ?? '');
            if (!match) throw new Error('Exact selected-font CSS src unavailable');
            const source = new URL(match[1], href);
            if (source.origin !== href.origin) throw new Error('Selected-font CSS origin changed');
            matched.push({
              format: 'SoloSelectedFontDirectCssRuleV1',
              hrefPath: href.pathname,
              family,
              weight: property('font-weight'),
              style: property('font-style'),
              display: property('font-display'),
              sourcePath: source.pathname,
            });
          } else if (rule.type !== 3 && rule.cssRules) visit(rule.cssRules, depth + 1);
        }
      };
      visit(sheet.cssRules, 0);
    }
    if (matched.length !== 1) throw new Error('One direct selected-font CSS rule required');
    return matched[0];
  }
  function observedLoad(...args) {
    if (disposed || this !== fonts || args.length !== 2 || args[0] !== target || args[1] !== sample)
      return Reflect.apply(original, this, args);
    let row;
    if (calls.length >= 8) overflow = true;
    else
      try {
        scan();
        row = { id: calls.length + 1, atMs: now(), settlement: 'unsettled-observed', faces: [] };
        calls.push(row);
      } catch {
        invalid = true;
      }
    let promise;
    try {
      promise = Reflect.apply(original, this, args);
    } catch (error) {
      if (row) {
        row.settlement = 'threw';
        row.error = errorText(error);
      }
      throw error;
    }
    if (row) {
      event('existing-load-invoked', { call: row.id });
      try {
        Promise.prototype.then
          .call(
            promise,
            (loaded) => {
              if (disposed) return;
              if (!Array.isArray(loaded) || loaded.length > 8) {
                invalid = true;
                return;
              }
              row.faces = loaded.map(observe);
              if (
                !row.faces.length ||
                row.faces.some((id) => id === null) ||
                new Set(row.faces).size !== row.faces.length
              )
                invalid = true;
              row.settlement = 'fulfilled';
              row.settledAtMs = now();
              event('existing-load-fulfilled', { call: row.id, faces: row.faces.slice() });
            },
            (error) => {
              if (disposed) return;
              row.settlement = 'rejected';
              row.settledAtMs = now();
              row.error = errorText(error);
              event('existing-load-rejected', { call: row.id });
            },
          )
          .catch(() => {
            if (!disposed) invalid = true;
          });
      } catch {
        invalid = true;
      }
    }
    return promise; // Exact original identity, fulfillment and rejection remain caller-owned.
  }
  const changed = (e) => {
    if (disposed) return;
    if (events.length >= 32) {
      overflow = true;
      return;
    }
    scan();
    event(e.type);
  };
  const pagehide = () => dispose();
  function dispose() {
    if (disposed) return;
    disposed = true; // A reentrant native cleanup cannot amend or revive this observation.
    if (installed)
      try {
        if (fonts?.load === observedLoad) {
          if (own) Object.defineProperty(fonts, 'load', own);
          else delete fonts.load;
        } else invalid = true;
      } catch {
        invalid = true;
      }
    for (const name of listening)
      try {
        fonts.removeEventListener(name, changed);
      } catch {
        invalid = true;
      }
    if (windowListening)
      try {
        environment.removeEventListener('pagehide', pagehide);
      } catch {
        invalid = true;
      }
  }
  if (
    typeof original !== 'function' ||
    typeof fonts?.[Symbol.iterator] !== 'function' ||
    typeof fonts.addEventListener !== 'function' ||
    typeof fonts.removeEventListener !== 'function'
  )
    throw new Error('Native font settlement observation unavailable');
  try {
    Object.defineProperty(fonts, 'load', {
      value: observedLoad,
      writable: true,
      configurable: true,
    });
    installed = true;
    for (const name of ['loading', 'loadingdone', 'loadingerror']) {
      fonts.addEventListener(name, changed);
      listening.push(name);
    }
    if (
      typeof environment.addEventListener === 'function' &&
      typeof environment.removeEventListener === 'function'
    ) {
      environment.addEventListener('pagehide', pagehide, { once: true });
      windowListening = true;
    }
    scan();
  } catch (error) {
    dispose();
    throw error;
  }
  return {
    boundary(label) {
      if (
        disposed ||
        !['before-selection', 'cancel-command-complete', 'after-original-release'].includes(
          label,
        ) ||
        boundaries.some((row) => row.label === label)
      )
        throw new Error('Invalid font diagnostic boundary');
      if (doc.body?.dataset.flightState === 'running')
        throw new Error('Font diagnostic cannot sample active play');
      const expected = ['before-selection', 'cancel-command-complete', 'after-original-release'][
        boundaries.length
      ];
      if (expected !== label) throw new Error('Font diagnostic boundary order');
      if (label === 'before-selection') css = directCss();
      boundaries.push({
        label,
        atMs: now(),
        faces: scan(),
        calls: calls.map((row) => ({ id: row.id, settlement: row.settlement })),
      });
    },
    export() {
      if (doc.body?.dataset.flightState === 'running')
        throw new Error('Font diagnostic export requires paused state');
      const value = {
        format: 'SoloSelectedFontSettlementDiagnosticV1',
        target,
        sample,
        bounds: { faces: 8, scan: 64, calls: 8, events: 32, bytes: 16384 },
        disposed,
        invalid,
        overflow,
        faces,
        calls,
        boundaries,
        events,
        css,
        scope:
          'Passive settlement of original demand only; status error is not a rejection witness. No qualification verdict.',
      };
      const serialized = JSON.stringify(value);
      if (new TextEncoder().encode(serialized).byteLength > 16384)
        throw new Error('Font diagnostic evidence cap');
      return JSON.parse(serialized);
    },
    dispose,
  };
}

// One original document; short setup/readback operations within one fixed observation
// deadline. Unsettled native work never authorizes the next public action.
export function createSelectedFontSettlementOwner({
  page,
  now = () => performance.now(),
  setTimer = setTimeout,
  clearTimer = clearTimeout,
}) {
  const started = now(),
    deadline = started + 60000,
    cleanupDeadline = deadline + 2000;
  assert(Number.isFinite(started) && started >= 0 && Number.isFinite(cleanupDeadline));
  let last = started,
    stopped = false,
    installed = false,
    closed = false,
    evidence = null;
  const operations = [],
    failures = [];
  const clock = () => {
    const at = now();
    assert(Number.isFinite(at) && at >= last, 'Invalid font owner clock');
    last = at;
    return at;
  };
  async function native(kind, work, cleanup = false) {
    assert(operations.length < 5, 'Font owner operation cap');
    assert(cleanup || !stopped, 'Font observation stopped');
    let timer;
    const row = { kind, invoked: false, settled: false, timedOut: false };
    operations.push(row);
    try {
      const at = clock(),
        until = Math.min(cleanup ? cleanupDeadline : deadline, at + 2000);
      assert(until > at, 'Font observation deadline');
      const pending = Promise.resolve().then(() => {
        assert(clock() < until, 'Font operation expired before invocation');
        row.invoked = true;
        return work();
      });
      const handled = pending.then(
        (value) => {
          row.settled = true;
          return value;
        },
        (error) => {
          row.settled = true;
          throw error;
        },
      );
      // Install both handlers before any further clock read, including failed prechecks.
      handled.catch(() => {});
      const remaining = until - clock();
      assert(remaining > 0, 'Font operation expired before wait');
      const result = await Promise.race([
        handled,
        new Promise((_, reject) => {
          timer = setTimer(() => {
            row.timedOut = true;
            reject(new Error('Font operation timeout'));
          }, remaining);
        }),
      ]);
      assert(clock() < until && !row.timedOut, 'Late font operation result');
      return result;
    } catch (error) {
      stopped = true;
      failures.push(String(error.message ?? error).slice(0, 256));
      throw error;
    } finally {
      if (timer !== undefined) clearTimer(timer);
    }
  }
  return {
    async install() {
      assert(!installed && operations.length === 0, 'One font installation');
      evidence = await native('install-before-selection', () =>
        page.evaluate(`(() => {
        if (window.soloQualificationFontSettlement) throw new Error('Duplicate font observer');
        const probe = (${createSelectedFontSettlementProbe.toString()})();
        window.soloQualificationFontSettlement = probe;
        try { probe.boundary('before-selection'); return probe.export(); }
        catch (error) { probe.dispose(); throw error; }
      })()`),
      );
      installed = true;
      assertSelectedFontSettlementEvidence(evidence, 1);
    },
    async boundary(label) {
      assert(installed && !closed, 'Font observer is not installed');
      evidence = await native(label, () =>
        page.evaluate((name) => {
          const probe = window.soloQualificationFontSettlement;
          probe.boundary(name);
          return probe.export();
        }, label),
      );
      assertSelectedFontSettlementEvidence(evidence, label === 'cancel-command-complete' ? 2 : 3);
      return evidence;
    },
    async close() {
      if (closed) return;
      // Do not race cleanup against a native installation/readback still in flight.
      if (operations.some((row) => !row.settled)) {
        stopped = true;
        return;
      }
      evidence = await native(
        'dispose-readback',
        () =>
          page.evaluate(() => {
            const probe = window.soloQualificationFontSettlement;
            if (!probe) throw new Error('Missing font observer at cleanup');
            probe.dispose();
            return probe.export();
          }),
        true,
      );
      closed = true;
    },
    snapshot() {
      return {
        format: 'SoloSelectedFontSettlementOwnerV1',
        sourceBinding: SELECTED_FONT_SOURCE_BINDING,
        bounds: { durationMs: 60000, operationMs: 2000, cleanupMs: 2000, operations: 5 },
        installed,
        closed,
        stopped,
        operations: operations.map((row) => ({ ...row })),
        failures: failures.slice(),
        evidence: evidence === null ? null : structuredClone(evidence),
      };
    },
  };
}

export function assertSelectedFontSettlementEvidence(value, boundaryCount) {
  assert.equal(value?.format, 'SoloSelectedFontSettlementDiagnosticV1');
  assert.equal(value.target, "600 16px 'Field Kit Display', 'Handjet', sans-serif");
  assert.equal(value.sample, 'Workshop Майстерня 012345');
  assert.deepEqual(value.bounds, { faces: 8, scan: 64, calls: 8, events: 32, bytes: 16384 });
  assert.equal(value.invalid, false);
  assert.equal(value.overflow, false);
  assert(Buffer.byteLength(JSON.stringify(value)) <= 16384);
  assert(value.faces.length > 0 && value.faces.length <= 8);
  assert(value.calls.length <= 8 && value.events.length <= 32);
  assert.equal(value.boundaries.length, boundaryCount);
  assert.deepEqual(
    value.boundaries.map((row) => row.label),
    ['before-selection', 'cancel-command-complete', 'after-original-release'].slice(
      0,
      boundaryCount,
    ),
  );
  assert.equal(value.css?.format, 'SoloSelectedFontDirectCssRuleV1');
  assert.equal(value.css.hrefPath, '/game/ui/field-kit-fonts.css');
  assert.equal(value.css.family, 'Field Kit Display');
  assert.equal(value.css.weight, '600');
  assert.equal(value.css.style, 'normal');
  assert.equal(value.css.display, 'swap');
  assert.equal(value.css.sourcePath, '/game/ui/fonts/field-kit/handjet-display-600.woff2');
  const ids = new Set();
  for (const face of value.faces) {
    assert(Number.isSafeInteger(face.id) && face.id > 0 && !ids.has(face.id));
    ids.add(face.id);
    assert.equal(face.descriptors.family.replace(/^(['"])(.*)\1$/, '$2'), 'Field Kit Display');
    assert.equal(face.descriptors.weight, '600');
    assert(['unsettled-observed', 'fulfilled', 'rejected'].includes(face.settlement));
    assert(Number.isFinite(face.firstSeenAtMs) && face.firstSeenAtMs >= 0);
  }
  assert.equal(typeof value.disposed, 'boolean');
  const callIds = new Set();
  for (const call of value.calls) {
    assert(Number.isSafeInteger(call.id) && call.id > 0 && !callIds.has(call.id));
    callIds.add(call.id);
    assert(Number.isFinite(call.atMs) && call.atMs >= 0);
    assert(['unsettled-observed', 'fulfilled', 'rejected', 'threw'].includes(call.settlement));
    assert(Array.isArray(call.faces) && call.faces.length <= 8);
    assert(new Set(call.faces).size === call.faces.length && call.faces.every((id) => ids.has(id)));
    if (call.settlement === 'fulfilled') assert(call.faces.length > 0);
    else assert.equal(call.faces.length, 0);
    if (['fulfilled', 'rejected'].includes(call.settlement))
      assert(Number.isFinite(call.settledAtMs) && call.settledAtMs >= call.atMs);
  }
  for (const event of value.events) assert(Number.isFinite(event.atMs) && event.atMs >= 0);
  for (let i = 0; i < value.boundaries.length; i++) {
    const row = value.boundaries[i];
    assert(Number.isFinite(row.atMs) && row.atMs >= 0);
    if (i) assert(row.atMs >= value.boundaries[i - 1].atMs);
    assert(
      row.faces.length <= 8 && new Set(row.faces.map((face) => face.id)).size === row.faces.length,
    );
    assert(
      row.faces.every(
        (face) =>
          ids.has(face.id) &&
          ['unloaded', 'loading', 'loaded', 'error'].includes(face.status) &&
          ['unsettled-observed', 'fulfilled', 'rejected'].includes(face.settlement),
      ),
    );
    assert(
      row.calls.length <= 8 && new Set(row.calls.map((call) => call.id)).size === row.calls.length,
    );
    assert(
      row.calls.every(
        (call) =>
          callIds.has(call.id) &&
          ['unsettled-observed', 'fulfilled', 'rejected', 'threw'].includes(call.settlement),
      ),
    );
  }
  return value;
}

// Preserve trusted public cancellation proof, but do not confuse public display
// status with the requested face's original promise settlement.
export function assertSelectedFontSettlementCancelled(observation, evidence) {
  assert.equal(observation?.protocol, SELECTED_FONT_SETTLEMENT_PILOT.protocol);
  assert.equal(observation.format, 'SoloFirstRunningReadinessV1');
  assert.equal(observation.capacity, 8);
  assert.equal(observation.maximumBytes, 16384);
  assert.equal(observation.dropped, 0);
  assert.equal(observation.errors, 0);
  assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
  assert.deepEqual(
    observation.records.map((row) => row.kind),
    ['start-click', 'cancel-back', 'cancel-early-microtask', 'cancel-command-complete'],
  );
  const [start, back, early, completed] = observation.records;
  assert(start.trusted && back.trusted && early.trusted && completed.trusted);
  for (const row of [back, early, completed]) {
    assert(row.visible && row.focused && row.phase !== 'running');
    assert.equal(row.tick, 0);
    assert(Number.isSafeInteger(row.run) && row.run > 0);
    assert.equal(row.run, back.run);
    assert.equal(row.levelId, 'first-return');
    assert.equal(row.font?.openDialogs, 0);
    assert.equal(row.font.selectedTheme, true);
    assert.notEqual(row.font.acceptedTheme, 'dnipro-porcelain');
  }
  assert.equal(back.font.preparation, 'busy');
  assert.equal(completed.font.preparation, 'cancelled');
  assert.equal(completed.font.defaultPrevented, true);
  assert.equal(completed.cancelBoundary.defaultPrevented, true);
  assert.deepEqual(back.cancelBoundary.eventPath, completed.cancelBoundary.eventPath);
  for (let i = 0; i < observation.records.length; i++) {
    assert(Number.isFinite(observation.records[i].atMs) && observation.records[i].atMs >= 0);
    if (i) assert(observation.records[i].atMs >= observation.records[i - 1].atMs);
  }
  assertSelectedFontSettlementEvidence(evidence, 2);
  const [before, cancelled] = evidence.boundaries,
    prior = new Set(before.calls.map((row) => row.id));
  const selected = cancelled.calls.filter((row) => !prior.has(row.id));
  assert(
    selected.length > 0 && selected.every((row) => row.settlement === 'unsettled-observed'),
    'Exact selected demand was not observed unsettled through cancellation',
  );
  assert(
    cancelled.atMs >= completed.atMs,
    'Settlement snapshot predates awaited public cancellation',
  );
  return completed;
}

export function assessSelectedFontSettlementReadiness(
  observation,
  application,
  documents,
  transport,
  owner,
) {
  const failures = [];
  let attribution = null;
  try {
    assert.equal(documents, 1);
    assert.equal(owner?.format, 'SoloSelectedFontSettlementOwnerV1');
    assert.deepEqual(owner.sourceBinding, SELECTED_FONT_SOURCE_BINDING);
    assert(owner.installed && owner.closed && !owner.stopped);
    assert.deepEqual(owner.failures, []);
    assert.deepEqual(
      owner.operations.map((row) => row.kind),
      [
        'install-before-selection',
        'cancel-command-complete',
        'after-original-release',
        'dispose-readback',
      ],
    );
    assert(owner.operations.every((row) => row.invoked && row.settled && !row.timedOut));
    const e = assertSelectedFontSettlementEvidence(owner.evidence, 3);
    assert(Buffer.byteLength(JSON.stringify(observation)) <= 16384);
    for (let i = 0; i < observation.records.length; i++) {
      assert(Number.isFinite(observation.records[i].atMs) && observation.records[i].atMs >= 0);
      if (i) assert(observation.records[i].atMs >= observation.records[i - 1].atMs);
    }
    assert.equal(e.disposed, true);
    assert.deepEqual(
      observation.records.map((row) => row.kind),
      [
        'start-click',
        'cancel-back',
        'cancel-early-microtask',
        'cancel-command-complete',
        'font-release-no-start',
        'start-click',
        'first-running',
        'after-running',
      ],
    );
    const cancelled = assertSelectedFontSettlementCancelled(
      { ...observation, records: observation.records.slice(0, 4) },
      { ...e, boundaries: e.boundaries.slice(0, 2) },
    );
    const [before, cancel, released] = e.boundaries,
      prior = new Set(before.calls.map((row) => row.id));
    const selected = e.calls.filter((row) => !prior.has(row.id));
    assert(
      selected.length > 0 &&
        selected.every(
          (row) =>
            row.settlement === 'fulfilled' &&
            row.settledAtMs >= cancel.atMs &&
            row.settledAtMs <= released.atMs,
        ),
    );
    const requested = new Set(selected.flatMap((row) => row.faces));
    assert(requested.size > 0);
    for (const id of requested) {
      const face = e.faces.find((row) => row.id === id),
        pending = cancel.faces.find((row) => row.id === id);
      assert(face && pending, 'Requested face was not enrolled before cancellation');
      assert.equal(pending.settlement, 'unsettled-observed');
      assert.equal(face.settlement, 'fulfilled');
      assert(face.settledAtMs >= cancel.atMs && face.settledAtMs <= released.atMs);
    }
    attribution = {
      requestedFaces: [...requested],
      requestedErrorThenFulfilled: cancel.faces
        .filter((row) => requested.has(row.id) && row.status === 'error')
        .map((row) => row.id),
      unmatchedUnloadedFaces: cancel.faces
        .filter((row) => !requested.has(row.id) && row.status === 'unloaded')
        .map((row) => row.id),
      cssRuleIdentity: 'not-exposed; exact direct rule and admitted source bound separately',
    };
    const [release, start, active, after] = observation.records.slice(4);
    assert(
      released.atMs >= release.atMs && released.atMs <= start.atMs,
      'Final font readback must precede the later public Start',
    );
    for (const row of [release, start, active]) {
      assert.equal(row.run, cancelled.run);
      assert.equal(row.tick, 0);
      assert.equal(row.levelId, 'first-return');
      assert(row.visible && row.focused);
      assert.equal(row.font?.openDialogs, 0);
      assert.equal(row.font.selectedTheme, true);
      assert.equal(row.font.acceptedTheme, 'dnipro-porcelain');
    }
    assert.notEqual(release.phase, 'running');
    assert.notEqual(start.phase, 'running');
    assert.equal(start.trusted, true);
    assert.equal(active.phase, 'running');
    assertSelectedFontTransport(transport, 'same-url-two-v2');
    const ready = assessReadinessPilot(
      { ...observation, protocol: READINESS_PILOT.protocol, records: [start, active, after] },
      application,
      documents,
    );
    assert.equal(ready.status, 'passed', ready.failures.join(', '));
  } catch (error) {
    failures.push(String(error.message ?? error).slice(0, 2048));
  }
  return {
    status: failures.length ? 'failed' : 'passed',
    failures,
    attribution,
    scope:
      'Original requested-face settlement and trusted public Cancel/explicit Start only. Native replay, numerical gates and historical failures remain separate.',
  };
}
