import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const [root, baseline, candidate, recordedPath, out] = process.argv.slice(2);
if (
  ![root, recordedPath, out].every((p) => p && path.isAbsolute(p)) ||
  ![baseline, candidate].every((x) => /^[a-f0-9]{40}$/.test(x))
)
  throw Error('ABS_ROOT BASELINE CANDIDATE ABS_RETAINED_NATIVE_RECEIPT ABS_NEW_RECEIPT');
const require = createRequire(path.join(root, 'package.json')),
  { parse } = require('acorn'),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const nativeBytes = await fs.readFile(recordedPath),
  native = JSON.parse(nativeBytes),
  baseState = native.hosts[0].windows[0].before.state;
const { STICK_LAYOUTS, neutralFlightInput } = await import(
  pathToFileURL(path.join(root, 'optional-practice/civilian-fpv/radio-profile.mjs'))
);
const receipt = {
  format: 'FPVHUDExactSourceFunctionParity.v1',
  baseline,
  candidate,
  source: {},
  nativeSeed: {
    sha256: sha(nativeBytes),
    course: native.hosts[0].windows[0].before.course,
  },
  checks: [],
  limitations: [
    'Bounded manual comparison of exact committed rendering functions in an isolated Node VM. No permanent unit suite and no mutation of any live flight, proof or model.',
    'The retained native state is a display seed; objective flags, criteria and radio preview values are explicit synthetic display-only branches. They are not represented as verified or reachable flight proofs.',
    'DOM/size adapters compare resulting text, attributes, flags, transforms and read order. Native geometry/source switching is qualified separately by the browser fixture; this is not physical radio/controller/mobile acceptance.',
    'Unchanged collaborators are stubs; compared code includes exact paintInput/updateHUD/stepName/modePracticeNotice/radioHelp/gamepadHelp and candidate paintText. No manual reimplementation of the changed rendering logic.',
  ],
};
function check(ok, name, detail) {
  receipt.checks.push({
    name,
    passed: Boolean(ok),
    ...(detail === undefined ? {} : { detail }),
  });
  if (!ok) throw Error(name);
}
function source(revision) {
  const value = execFileSync(
    'git',
    ['show', revision + ':optional-practice/civilian-fpv/world-app.mjs'],
    {
      cwd: root,
      env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
      maxBuffer: 2e6,
    },
  ).toString();
  const ast = parse(value, { ecmaVersion: 'latest', sourceType: 'module' }),
    found = {};
  function visit(n) {
    if (!n || typeof n !== 'object') return;
    if (n.type === 'FunctionDeclaration' && n.id) found[n.id.name] = value.slice(n.start, n.end);
    if (n.type === 'VariableDeclarator' && n.id?.type === 'Identifier' && n.init)
      found[n.id.name] = 'const ' + n.id.name + ' = ' + value.slice(n.init.start, n.init.end) + ';';
    for (const [k, v] of Object.entries(n))
      if (k !== 'start' && k !== 'end') {
        if (Array.isArray(v)) v.forEach(visit);
        else if (v && typeof v === 'object') visit(v);
      }
  }
  visit(ast);
  receipt.source[revision] = {
    bytes: Buffer.byteLength(value),
    sha256: sha(value),
  };
  return found;
}
const sources = [source(baseline), source(candidate)],
  copy = (x) => structuredClone(x),
  same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function environment(locale, options = {}) {
  const nodes = new Map(),
    events = [];
  function node(id) {
    if (nodes.has(id)) return nodes.get(id);
    let text = '';
    const classes = new Set(),
      dot = { style: {} };
    const n = {
      id,
      value: '',
      disabled: false,
      hidden: false,
      dataset: {},
      attrs: {},
      style: {},
      writes: 0,
      classList: {
        toggle(k, v) {
          if (v) classes.add(k);
          else classes.delete(k);
        },
      },
      querySelector() {
        return dot;
      },
      setAttribute(k, v) {
        this.attrs[k] = String(v);
      },
      getAttribute(k) {
        return this.attrs[k] ?? null;
      },
      get textContent() {
        return text;
      },
      set textContent(v) {
        this.writes++;
        text = String(v);
        events.push('write:' + id);
      },
      get clientWidth() {
        events.push('read:' + id);
        return options.width ?? 78;
      },
      dot,
    };
    nodes.set(id, n);
    return n;
  }
  for (const [id, value] of Object.entries({
    'flight-mode': 'self-level',
    'flight-source': 'keyboard',
    'flight-stick-display': 'expanded',
    'sim-motion': 'full',
    'flight-keyboard-preset': 'two-stick',
    'flight-drone-guide': 'off',
    'flight-guide-scale': '1',
  }))
    node(id).value = value;
  node('flight-title').textContent = 'Native authored title';
  node('flight-menu-brief').textContent = 'Native authored brief';
  events.length = 0;
  const controls = { roll: 0.25, pitch: -0.5, yaw: 0.75, throttle: 0.65 },
    logs = {};
  const env = {
    $: node,
    locale,
    txt: (a, b) => (locale === 'uk' ? b : a),
    terminal: (s) => ['complete', 'expired', 'failed', 'destroyed'].includes(s.status),
    playShell: {
      update(p) {
        logs.shell = copy(p);
      },
    },
    audio: { enabled: () => true },
    updateSectorHUD() {},
    updateGhostHUD() {},
    sceneReady: true,
    ghostLookup: null,
    beginnerCoach: { blocksArm: () => false, wantsRadioPreview: () => false },
    demonstrationFor: () => true,
    checkpointSession: null,
    replayProof: null,
    replayKind: 'recording',
    finished: false,
    modePractice: false,
    playingPlaylist: null,
    playlistIndex: 0,
    STICK_LAYOUTS,
    neutralFlightInput,
    flightToken: 1,
    stickTraceLayout: '',
    stickTraces: [
      {
        reset() {},
        update(v) {
          logs.leftTrace = copy(v);
        },
      },
      {
        reset() {},
        update(v) {
          logs.rightTrace = copy(v);
        },
      },
    ],
    radio: {
      preview: () => ({
        controls: options.unavailable ? null : controls,
        stickMode: options.stickMode ?? 2,
      }),
      status: () => ({ reason: 'ready', pickup: null }),
    },
    gamepad: { preview: () => ({ controls }) },
    input: { sample: () => controls },
    win: {
      performance: { now: () => 100 },
      matchMedia: () => ({ matches: false }),
    },
    paintStickDirections() {},
    paintDroneResponse(s, c, o) {
      logs.drone = { controls: copy(c), ...o };
    },
    paintCoach() {},
    keyboardFlightHelp: (preset, lang, o) => JSON.stringify({ preset, lang, ...o }),
    keyboardFlightPreset: () => ({ fire: 'Space' }),
  };
  function snapshot() {
    return {
      nodes: Object.fromEntries(
        [...nodes]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([id, n]) => [
            id,
            {
              text: n.textContent,
              value: n.value,
              disabled: n.disabled,
              hidden: n.hidden,
              dataset: n.dataset,
              attrs: n.attrs,
              transform: n.dot.style.transform ?? null,
            },
          ]),
      ),
      logs,
    };
  }
  return { env, nodes, node, events, snapshot };
}
function compile(source, env, entry) {
  const names =
    entry === 'updateHUD'
      ? ['stepName', 'modePracticeNotice', 'paintText', 'updateHUD']
      : ['radioHelp', 'gamepadHelp', 'paintText', 'paintInput'];
  vm.runInNewContext(
    names.map((n) => source[n] ?? '').join('\n') + '\nglobalThis.run=' + entry + ';',
    env,
  );
  return env.run;
}
const hold = { type: 'hold', ticks: 90 },
  track = {
    type: 'actor-track-v1',
    ticks: 80,
    minDistance: 1000,
    maxDistance: 9000,
    minTargetTravel: 2000,
  },
  hunt = { type: 'hunt-contact-v1', targets: ['a', 'b', 'c'], ordered: true };
const cases = [
  { name: 'hold', target: hold },
  { name: 'hold-progress', target: hold, state: { hold: 35 } },
  ...['complete', 'expired', 'failed', 'destroyed'].map((status) => ({
    name: 'terminal-' + status,
    target: hold,
    state: { status },
  })),
  ...[
    'acquire-subject',
    'subject-unavailable',
    'airborne-clearance',
    'subject-range',
    'relative-speed',
    'airframe-tilt',
    'nose-alignment',
    'subject-occluded',
    'subject-travel',
  ].map((reason) => ({
    name: 'track-' + reason,
    target: track,
    state: { hold: 25, actorTrack: { reason } },
  })),
  ...['active', 'failed', 'complete'].flatMap((status) =>
    [false, true].flatMap((ordered) =>
      [false, true].map((failure) => ({
        name: `hunt-${status}-${ordered}-${failure}`,
        target: { ...hunt, ordered },
        state: {
          status,
          hunt: {
            caught: ['a'],
            tail: [1, 2],
            failure: failure ? 'tail' : null,
          },
        },
      })),
    ),
  ),
  ...[false, true].flatMap((replay) =>
    ['full-attempt', 'section'].map((kind) => ({
      name: `checkpoint-${replay}-${kind}`,
      target: hold,
      state: { hold: 30 },
      scope: {
        checkpointSession: { kind, index: 2, startTick: 10 },
        replayProof: replay ? {} : null,
        replayKind: 'section',
      },
    })),
  ),
  {
    name: 'mode-practice',
    target: track,
    scope: { modePractice: true },
    state: { hold: 20, actorTrack: { reason: 'subject-range' } },
  },
  {
    name: 'mode-practice-checkpoint',
    target: hold,
    scope: {
      modePractice: true,
      checkpointSession: { kind: 'section', index: 1, startTick: 10 },
    },
    state: { hold: 20 },
  },
  {
    name: 'finished-replay-paused',
    target: hold,
    state: { status: 'paused' },
    scope: { replayProof: {}, finished: true },
  },
];
for (const locale of ['en', 'uk'])
  for (const c of cases) {
    const results = [];
    for (let i = 0; i < 2; i++) {
      const e = environment(locale);
      Object.assign(e.env, c.scope);
      e.env.current = {
        legacy: false,
        course: {
          actors: [{ type: 'humanoid', role: 'hostile' }],
          steps: { 'self-level': [copy(c.target)], acro: [copy(c.target)] },
        },
      };
      const state = {
        ...copy(baseState),
        status: 'active',
        step: 0,
        total: 1,
        hold: 0,
        ticks: 50,
        ...copy(c.state ?? {}),
      };
      const run = compile(sources[i], e.env, 'updateHUD');
      run(state);
      const writes = e.node('flight-objective').writes;
      run(state);
      if (i === 1)
        check(
          e.node('flight-objective').writes === writes,
          'candidate objective node retained ' + locale + '/' + c.name,
        );
      results.push(e.snapshot());
    }
    check(
      same(...results),
      'exact objective/HUD parity ' + locale + '/' + c.name,
      results[1].nodes['flight-objective'].text,
    );
  }
for (const locale of ['en', 'uk'])
  for (const stickMode of [1, 2, 3, 4])
    for (const sourceName of ['radio', 'keyboard', 'touch', 'controller', 'recording'])
      for (const width of [0, 46, 78, 106]) {
        const results = [];
        for (let i = 0; i < 2; i++) {
          const e = environment(locale, { stickMode, width });
          e.node('flight-source').value = sourceName === 'recording' ? 'keyboard' : sourceName;
          e.env.replayProof = sourceName === 'recording' ? {} : null;
          const state = {
            ...copy(baseState),
            status: 'paused',
            lastInput: {
              roll: 250,
              pitch: -500,
              yaw: 750,
              throttle: 650,
              actions: 0,
            },
          };
          const run = compile(sources[i], e.env, 'paintInput');
          run(state);
          if (i === 1) {
            const right = e.events.indexOf('read:world-right-stick'),
              leftLabel = e.events.indexOf('write:world-left-label');
            check(
              right >= 0 && right < leftLabel,
              'both reads precede stick label ' +
                locale +
                '/' +
                stickMode +
                '/' +
                sourceName +
                '/' +
                width,
            );
          }
          results.push(e.snapshot());
        }
        check(
          same(...results),
          'exact stick mode/display parity ' +
            locale +
            '/' +
            stickMode +
            '/' +
            sourceName +
            '/' +
            width,
        );
      }
receipt.completed = true;
receipt.objectiveCases = cases.length * 2;
receipt.inputCases = 2 * 4 * 5 * 4;
await fs.writeFile(out, JSON.stringify(receipt, null, 2) + '\n', {
  flag: 'wx',
});
console.log(
  JSON.stringify({
    completed: true,
    checks: receipt.checks.length,
    objectiveCases: receipt.objectiveCases,
    inputCases: receipt.inputCases,
    out,
  }),
);
