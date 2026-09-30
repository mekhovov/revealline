// Development-only observer. Not in build-config.json's release include list.
// It reads DOM presentation and browser timing, never engine state or inputs.
const frame = document.querySelector('#game');
const status = document.querySelector('#status');
const log = document.querySelector('#log');
const records = [];
const sampleButton = document.querySelector('#sample');
const editionSelect = document.querySelector('#edition');
const editionIds = new Set([
  '',
  'coupa-all',
  'droneaid-nl-community',
  'social-drone-ua',
  'victory-drones',
  'ukraine-culture',
  'fpv-learning',
]);
let dispose = () => {};
const report = (record) => {
  records.push(record);
  if (records.length > 100) records.shift();
  log.textContent = JSON.stringify(records, null, 2);
  status.textContent = `${record.action}: ${record.outcome}${record.ms == null ? '' : ` · ${record.ms.toFixed(1)} ms`}`;
};
const shown = (node) =>
  !!node && !node.closest('[hidden], [inert]') && node.getClientRects().length > 0;
const enabled = (node) => shown(node) && !node.disabled;
const actions = new Map([
  ['shell-continue', 'Continue'],
  ['shell-featured', 'Play'],
  ['shell-catalogue', 'Open mission library'],
  ['missions-catalogue', 'Open mission library'],
  ['race-journey-find', 'Open mission library'],
  ['start-button', 'Start/resume'],
  ['next-button', 'Next'],
  ['retry-button', 'Retry'],
  ['restart-confirm', 'Confirmed restart'],
  ['race-start', 'Start/rematch'],
  ['race-journey-next', 'Next'],
]);

document.querySelector('#load').addEventListener('click', () => {
  dispose();
  const mode = document.querySelector('#mode').value;
  const edition =
    mode === 'solo' && editionIds.has(editionSelect?.value) ? editionSelect.value : '';
  if (sampleButton) sampleButton.disabled = true;
  const path = mode === 'solo' ? '../../game/' : '../../game/couch/';
  const began = performance.now();
  let attached = false,
    abandoned = false;
  const abandon = (outcome) => {
    if (abandoned || attached) return;
    abandoned = true;
    clearTimeout(loadTimer);
    document.removeEventListener('visibilitychange', loadVisibility);
    window.removeEventListener('pagehide', loadPagehide);
    report({ action: 'Load to playable menu', mode, outcome, ms: null });
  };
  const loadVisibility = () => {
    if (document.hidden) abandon('visibility changed before load; sample discarded');
  };
  const loadPagehide = () => abandon('page left before load; sample discarded');
  const loadTimer = setTimeout(() => abandon('navigation timeout; not a passing sample'), 30000);
  document.addEventListener('visibilitychange', loadVisibility);
  window.addEventListener('pagehide', loadPagehide);
  dispose = () => abandon('navigation/disposal before load; sample discarded');
  frame.onload = () => {
    if (abandoned) return;
    if (attached) {
      dispose();
      report({ action: 'Frame navigation', mode, outcome: 'observer detached; load a new sample' });
      return;
    }
    attached = true;
    clearTimeout(loadTimer);
    document.removeEventListener('visibilitychange', loadVisibility);
    window.removeEventListener('pagehide', loadPagehide);
    const win = frame.contentWindow;
    const doc = frame.contentDocument;
    if (!doc || !win) {
      report({
        action: 'Load to playable menu',
        mode,
        outcome: 'same-origin game unavailable',
        ms: null,
      });
      return;
    }
    const finite = (value) => (Number.isFinite(value) ? value : null);
    const browserSnapshot = () => {
      const nav = win.performance.getEntriesByType('navigation')[0];
      const paints = Object.fromEntries(
        win.performance.getEntriesByType('paint').map((entry) => [entry.name, entry.startTime]),
      );
      const memory = win.performance.memory;
      return {
        navigation: nav
          ? {
              responseStartMs: finite(nav.responseStart),
              domInteractiveMs: finite(nav.domInteractive),
              domContentLoadedMs: finite(nav.domContentLoadedEventEnd),
              loadEventEndMs: finite(nav.loadEventEnd),
            }
          : null,
        paint: {
          firstPaintMs: finite(paints['first-paint']),
          firstContentfulPaintMs: finite(paints['first-contentful-paint']),
        },
        jsHeap: memory
          ? {
              supported: true,
              usedBytes: finite(memory.usedJSHeapSize),
              totalBytes: finite(memory.totalJSHeapSize),
              limitBytes: finite(memory.jsHeapSizeLimit),
            }
          : { supported: false },
      };
    };
    let stopSample = () => {};
    const sample = () => {
      stopSample();
      if (document.hidden || doc.hidden) {
        report({ action: 'Frame sample', mode, edition, outcome: 'hidden page; sample discarded' });
        return;
      }
      const beganAt = win.performance.now();
      const before = browserSnapshot();
      const beforeResources = win.performance.getEntriesByType('resource').length;
      const intervals = [];
      const tasks = [];
      let previous = null,
        sampleRaf,
        observer,
        stopped = false,
        taskSupported = false;
      const finish = (reason) => {
        if (stopped) return;
        stopped = true;
        win.cancelAnimationFrame(sampleRaf);
        clearTimeout(sampleTimer);
        if (observer) {
          collectTasks(observer.takeRecords());
          observer.disconnect();
        }
        doc.removeEventListener('visibilitychange', sampleVisibility);
        document.removeEventListener('visibilitychange', sampleVisibility);
        if (sampleButton) sampleButton.disabled = false;
        if (reason || intervals.length < 60) {
          report({
            action: 'Frame sample',
            mode,
            edition,
            outcome: reason || 'too few frames; sample discarded',
          });
          return;
        }
        const sorted = [...intervals].sort((a, b) => a - b);
        const percentile = (fraction) => sorted[Math.ceil(sorted.length * fraction) - 1];
        report({
          action: 'Frame sample',
          mode,
          edition,
          mission: mission(),
          outcome: 'passive desktop sample; compare equivalent baseline before qualification',
          durationMs: win.performance.now() - beganAt,
          frameIntervals: {
            count: intervals.length,
            medianMs: percentile(0.5),
            p95Ms: percentile(0.95),
            maxMs: sorted.at(-1),
          },
          longTasks: taskSupported
            ? {
                supported: true,
                count: tasks.length,
                over50Ms: tasks.filter((t) => t > 50).length,
                maxMs: tasks.length ? Math.max(...tasks) : 0,
              }
            : { supported: false },
          viewport: { width: win.innerWidth, height: win.innerHeight, dpr: win.devicePixelRatio },
          browserBefore: before,
          browserAfter: browserSnapshot(),
          newResourceEntries: win.performance.getEntriesByType('resource').length - beforeResources,
        });
      };
      const collectTasks = (entries) => {
        for (const entry of entries)
          if (entry.startTime >= beganAt && Number.isFinite(entry.duration) && tasks.length < 2000)
            tasks.push(entry.duration);
      };
      try {
        if (win.PerformanceObserver?.supportedEntryTypes?.includes('longtask')) {
          observer = new win.PerformanceObserver((list) => collectTasks(list.getEntries()));
          observer.observe({ type: 'longtask', buffered: false });
          taskSupported = true;
        }
      } catch {
        observer?.disconnect();
        observer = null;
      }
      const sampleVisibility = () => {
        if (document.hidden || doc.hidden) finish('visibility changed; sample discarded');
      };
      const sampleTick = () => {
        const now = win.performance.now();
        if (previous !== null && intervals.length < 10000) intervals.push(now - previous);
        previous = now;
        sampleRaf = win.requestAnimationFrame(sampleTick);
      };
      const sampleTimer = setTimeout(() => finish(), 30000);
      doc.addEventListener('visibilitychange', sampleVisibility);
      document.addEventListener('visibilitychange', sampleVisibility);
      if (sampleButton) sampleButton.disabled = true;
      sampleRaf = win.requestAnimationFrame(sampleTick);
      stopSample = () => finish('navigation/disposal; sample discarded');
    };
    if (sampleButton) {
      sampleButton.disabled = false;
      sampleButton.addEventListener('click', sample);
    }
    let pending = null,
      raf,
      attemptTimer,
      cancelled = false;
    const byId = (id) => doc.getElementById(id);
    const mission = () =>
      mode === 'solo'
        ? byId('level-select')?.value
        : byId('race-level')?.value.split('/').slice(0, -1).join('/');
    const running = () =>
      mode === 'solo'
        ? doc.body.dataset.flightState === 'running' && doc.body.dataset.pictureState === 'ready'
        : enabled(byId('race-pause')) &&
          byId('race-pause').textContent.trim() === 'Pause' &&
          shown(byId('race-boards'));
    const libraryReady = () => {
      const chooser = byId('journey-chooser');
      const card = byId('journey-cards')?.querySelector?.('.journey-card:not(:disabled)');
      return chooser?.open === true && enabled(card);
    };
    const fail = (outcome) => {
      if (!pending) return;
      clearTimeout(attemptTimer);
      report({ action: pending.action, mode, outcome, ms: null, mission: mission() });
      pending = null;
    };
    const begin = (
      action,
      started = performance.now(),
      trustedActivation = null,
      expectedMission = null,
    ) => {
      fail('superseded');
      const statusIds =
        action === 'Load to playable menu'
          ? []
          : mode === 'versus'
            ? ['race-preparation']
            : ['Continue', 'Play'].includes(action)
              ? ['shell-flight-status', 'flight-preparation-status']
              : ['flight-preparation-status'];
      pending = {
        action,
        started,
        readyFrames: 0,
        trustedActivation,
        fromMission: mission(),
        expectedMission,
        statuses: statusIds.map((id) => ({
          id,
          previous: byId(id)?.dataset.state,
          sawBusy: false,
        })),
      };
      attemptTimer = setTimeout(
        () => fail('timeout; not a passing sample'),
        Math.max(0, 30000 - (performance.now() - started)),
      );
    };
    const click = (event) => {
      const button = event.target.closest?.('button');
      if (!button || !enabled(button)) return;
      if (
        ['flight-preparation-cancel', 'shell-flight-cancel', 'race-picture-cancel'].includes(
          button.id,
        )
      ) {
        fail('cancelled by player; sample discarded');
        return;
      }
      let action = actions.get(button.id);
      if (
        ['journey-skip', 'race-journey-skip'].includes(button.id) &&
        /confirm/i.test(button.textContent)
      )
        action = 'Confirmed skip';
      if (
        button.id === 'next-button' &&
        /end of sequence|view collection|journey complete/i.test(button.textContent)
      )
        return;
      if (button.dataset.missionId) action = 'Choose mission';
      // Keyboard/controller navigation can legitimately activate a button with
      // .click(). Keep the distinction in the evidence, do not invent inputs.
      if (action)
        begin(
          action,
          performance.now(),
          event.isTrusted,
          mode === 'solo' ? button.dataset.missionId?.split('/').at(-1) : button.dataset.missionId,
        );
    };
    const visibility = () => {
      if (document.hidden || doc.hidden) fail('visibility changed; sample discarded');
    };
    doc.addEventListener('click', click, true);
    doc.addEventListener('visibilitychange', visibility);
    document.addEventListener('visibilitychange', visibility);
    const pagehide = () => fail('page left; sample discarded');
    const blur = () => fail('game focus left; sample discarded');
    win.addEventListener('pagehide', pagehide);
    win.addEventListener('blur', blur);
    window.addEventListener('pagehide', pagehide);
    begin('Load to playable menu', began);
    const tick = () => {
      if (cancelled) return;
      if (pending) {
        const menu =
          mode === 'solo'
            ? enabled(byId('shell-continue')) || enabled(byId('shell-featured'))
            : enabled(byId('race-start'));
        const targetMatches = pending.expectedMission
          ? mission() === pending.expectedMission
          : !['Next', 'Confirmed skip'].includes(pending.action) ||
            mission() !== pending.fromMission;
        const boot = doc.documentElement.dataset[mode === 'solo' ? 'bootState' : 'toolState'];
        const ready =
          boot === 'ready' &&
          (pending.action === 'Load to playable menu'
            ? menu
            : pending.action === 'Open mission library'
              ? libraryReady()
              : running() && targetMatches);
        const failed = pending.statuses.find((status) => {
          const state = byId(status.id)?.dataset.state;
          if (state === 'busy') status.sawBusy = true;
          return (
            ['error', 'cancelled', 'detached'].includes(state) &&
            (status.sawBusy || state !== status.previous)
          );
        });
        if (['failed', 'error'].includes(boot)) fail('game boot failed; sample discarded');
        else if (failed) fail(`preparation ${byId(failed.id).dataset.state}; sample discarded`);
        else if (performance.now() - pending.started > 30000) fail('timeout; not a passing sample');
        else if (ready && !document.hidden && !doc.hidden) {
          if (++pending.readyFrames >= 2) {
            const resources = win.performance.getEntriesByType('resource');
            report({
              action: pending.action,
              mode,
              outcome: 'two consecutive animation-frame readiness observations',
              ms: performance.now() - pending.started,
              mission: mission(),
              trustedActivation: pending.trustedActivation,
              ...(pending.action === 'Load to playable menu'
                ? {
                    resourcesAtReady: resources.length,
                    transferBytesAtReady: resources.reduce((n, r) => n + r.transferSize, 0),
                    jsDecodedBytesAtReady: resources
                      .filter((r) => /\.(mjs|js)(\?|$)/.test(r.name))
                      .reduce((n, r) => n + r.decodedBodySize, 0),
                    cssDecodedBytesAtReady: resources
                      .filter((r) => /\.css(\?|$)/.test(r.name))
                      .reduce((n, r) => n + r.decodedBodySize, 0),
                    zeroTransferEntries: resources.filter((r) => r.transferSize === 0).length,
                    viewport: {
                      width: win.innerWidth,
                      height: win.innerHeight,
                      dpr: win.devicePixelRatio,
                    },
                    browserAtReady: browserSnapshot(),
                  }
                : {}),
            });
            clearTimeout(attemptTimer);
            pending = null;
          }
        } else pending.readyFrames = 0;
      }
      raf = win.requestAnimationFrame(tick);
    };
    raf = win.requestAnimationFrame(tick);
    report({
      action: 'Navigation timing',
      mode,
      outcome: 'browser entries; no device qualification',
      browserAtFrameLoad: browserSnapshot(),
      resourcesAtFrameLoad: win.performance.getEntriesByType('resource').length,
    });
    dispose = () => {
      fail('navigation/disposal; sample discarded');
      stopSample();
      sampleButton?.removeEventListener('click', sample);
      cancelled = true;
      win.cancelAnimationFrame(raf);
      doc.removeEventListener('click', click, true);
      doc.removeEventListener('visibilitychange', visibility);
      document.removeEventListener('visibilitychange', visibility);
      win.removeEventListener('pagehide', pagehide);
      win.removeEventListener('blur', blur);
      window.removeEventListener('pagehide', pagehide);
    };
  };
  frame.src = `${path}?journey=1${edition ? `&edition=${encodeURIComponent(edition)}` : ''}`;
  status.textContent = `Loading ${mode}…`;
});
