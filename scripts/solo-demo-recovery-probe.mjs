// Boundary-only functional observer. Serialized into the page; no scheduling hooks.
export function installDemoRecoveryProbe(env = globalThis) {
  let PhaserValue,
    game,
    run,
    painter,
    check,
    drawCount = 0,
    last = null,
    nextId = 1,
    resourceContract = null,
    closeCapture = null,
    closeCaptureCount = 0;
  const ids = new WeakMap(),
    namespaces = new WeakSet(),
    surfaces = new Map();
  const identity = (value) => {
    if (!value) return null;
    if (!ids.has(value)) ids.set(value, nextId++);
    return ids.get(value);
  };
  const record = (value) =>
    value
      ? {
          id: identity(value),
          tick: value.tick,
          status: value.status,
          level: structuredClone(value.level),
          classId: value.classId,
          checkpoint: check(value),
        }
      : null;
  Object.defineProperty(env, 'Phaser', {
    configurable: true,
    get: () => PhaserValue,
    set(value) {
      PhaserValue = value;
      if (namespaces.has(value)) return;
      namespaces.add(value);
      const Game = value.Game;
      value.Game = class extends Game {
        constructor(...args) {
          super(...args);
          game = this;
        }
      };
    },
  });
  const snapshot = (label, diagnostics = null) => {
    const doc = env.document,
      parent = game?.scene?.scenes?.find((s) => s.lastPaint?.run);
    return {
      label,
      atMs: env.performance.now(),
      visible: !doc.hidden,
      focused: doc.hasFocus(),
      viewport: { width: env.innerWidth, height: env.innerHeight, dpr: env.devicePixelRatio },
      phase: doc.body?.dataset.flightState,
      open: Boolean(doc.getElementById('demo-dialog')?.open),
      practice: doc.getElementById('demo-dialog')?.classList.contains('is-practice') ?? false,
      scene: doc.getElementById('demo-dialog')?.dataset.scene,
      watchPaused: doc.getElementById('demo-watch-pause')?.getAttribute('aria-pressed'),
      reducedPreference: doc.getElementById('settings-reduced-effects')?.checked,
      mutePressed: doc.getElementById('demo-audio-mute')?.getAttribute('aria-pressed'),
      ordinary: record(parent?.lastPaint?.run),
      demo: record(run),
      painterId: identity(painter),
      drawCount,
      lastDraw: last,
      diagnosticsSource: diagnostics ? 'public-paused-export' : 'not-requested',
      quality: diagnostics?.quality ?? null,
      calibration: diagnostics?.cadenceCalibration ?? null,
      ...(resourceContract && diagnostics
        ? {
            resourceContract: { ...resourceContract },
            resources: structuredClone(diagnostics.resources),
          }
        : {}),
      disabled: Object.fromEntries(
        ['demo-resume', 'demo-takeover', 'demo-next', 'demo-watch-pause', 'demo-return'].map(
          (id) => [id, doc.getElementById(id)?.disabled],
        ),
      ),
    };
  };
  function select(surface) {
    const display = env.document.getElementById('demo-canvas');
    if (surface === 'display') return { canvas: display, name: 'display' };
    const rows = [...(painter?.layers?.entries() ?? [])].filter(
      ([, layer]) => layer.canvas?.width > 0 && layer.canvas?.height > 0,
    );
    const selected = rows.find(([name]) => name === 'concealment');
    if (!selected) throw Error('No actual owned cached layer');
    return { canvas: selected[1].canvas, name: String(selected[0]) };
  }
  env.demoRecoveryProbe = {
    configureResources(contract) {
      if (
        resourceContract ||
        contract?.format !== 'DemoOwnedResourcesV1' ||
        typeof contract.sourceRevision !== 'string' ||
        !/^[a-f0-9]{40}$/.test(contract.sourceRevision) ||
        Object.keys(contract).length !== 2
      )
        throw Error('Exact one-time Demo resource contract required');
      resourceContract = { ...contract };
    },
    armCloseBoundary({ label, runId, painterId, eventType }) {
      const activation = eventType !== undefined;
      if (
        !resourceContract ||
        closeCapture ||
        closeCaptureCount >= 20 ||
        !(activation
          ? /^(spectator|practice)-(?:[1-9]|10)-close-activation$/.test(label) &&
            eventType === (label.startsWith('spectator-') ? 'pointerdown' : 'click')
          : /^(spectator|practice)-(?:[1-9]|10)-close-click$/.test(label)) ||
        !Number.isSafeInteger(runId) ||
        !Number.isSafeInteger(painterId)
      )
        throw Error('Bounded resource Close capture required');
      const doc = env.document,
        button = doc.getElementById('demo-back');
      if (!button || typeof doc.addEventListener !== 'function')
        throw Error('Actual Demo Back control required');
      const capture = {
        button,
        listener: null,
        value: null,
        count: 0,
        failure: null,
        eventType: eventType ?? 'click',
      };
      capture.listener = (event) => {
        if (event.target !== button && !button.contains?.(event.target)) return;
        capture.count++;
        if (
          capture.count !== 1 ||
          event.isTrusted !== true ||
          (activation && event.type !== capture.eventType) ||
          (eventType === 'pointerdown' && (event.button !== 0 || event.isPrimary !== true))
        ) {
          capture.failure = 'Exactly one trusted Demo Back activation required';
          return;
        }
        try {
          const value = snapshot(label);
          if (
            !value.open ||
            !value.visible ||
            !value.focused ||
            !value.lastDraw?.paused ||
            value.demo?.id !== runId ||
            value.painterId !== painterId ||
            (activation && value.practice !== label.startsWith('practice-'))
          ) {
            capture.failure = 'Paused Demo Close owner changed';
            return;
          }
          value[activation ? 'closeActivation' : 'closeClick'] = {
            format: activation ? 'DemoTrustedCloseActivationV2' : 'DemoTrustedCloseBoundaryV1',
            isTrusted: true,
            target: 'demo-back',
            ...(activation ? { eventType: capture.eventType } : {}),
          };
          capture.value = value;
        } catch {
          capture.failure = 'Demo Close boundary snapshot failed';
        }
      };
      doc.addEventListener(capture.eventType, capture.listener, true);
      closeCapture = capture;
      closeCaptureCount++;
    },
    takeCloseBoundary() {
      if (!closeCapture || closeCapture.failure || closeCapture.count !== 1 || !closeCapture.value)
        throw Error(closeCapture?.failure || 'Trusted Demo Close boundary missing');
      return structuredClone(closeCapture.value);
    },
    disarmCloseBoundary() {
      if (!closeCapture) return;
      env.document.removeEventListener(closeCapture.eventType, closeCapture.listener, true);
      closeCapture = null;
    },
    install(Painter, checkpoint) {
      if (check) throw Error('Observer installed twice');
      check = checkpoint;
      const original = Painter.prototype.draw;
      Painter.prototype.draw = function (context, state, dt, options) {
        const result = Reflect.apply(original, this, [context, state, dt, options]);
        if (context?.canvas?.id === 'demo-canvas') {
          run = state;
          painter = this;
          drawCount++;
          last = {
            quality: options.quality ?? 'full',
            reduced: options.reduced,
            paused: options.paused,
            width: options.displayCSSWidth,
          };
        }
        return result;
      };
    },
    // Full diagnostics retain their public paused-only authority. Fault and
    // retired-owner boundaries observe existing state without requesting export.
    snapshot: (label) => snapshot(label, env.RevealLineSoloPerformance?.export()),
    state: (label) => snapshot(label),
    readiness() {
      return { id: identity(run), tick: run?.tick, paused: last?.paused, drawCount };
    },
    retain(surface, key) {
      if (surfaces.size >= 5 || surfaces.has(key)) throw Error('Surface bound/identity violated');
      const selected = select(surface);
      surfaces.set(key, selected);
      return {
        key,
        name: selected.name,
        canvasId: identity(selected.canvas),
        painterId: identity(painter),
        width: selected.canvas.width,
        height: selected.canvas.height,
      };
    },
    event(key, type) {
      if (!['contextlost', 'contextrestored'].includes(type)) throw Error('Unknown fault');
      const selected = surfaces.get(key);
      if (!selected) throw Error('Unknown surface');
      const before = snapshot(`${key}-${type}-before`),
        event = new env.Event(type, { cancelable: true });
      selected.canvas.dispatchEvent(event);
      return {
        key,
        type,
        isTrusted: event.isTrusted,
        defaultPrevented: event.defaultPrevented,
        before,
        after: snapshot(`${key}-${type}-after`),
      };
    },
  };
}
