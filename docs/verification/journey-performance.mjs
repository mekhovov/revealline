// Development-only observer. Not in build-config.json's release include list.
// It reads DOM presentation and browser timing, never engine state or inputs.
const frame = document.querySelector('#game');
const status = document.querySelector('#status');
const log = document.querySelector('#log');
const records = [];
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
          (pending.action === 'Load to playable menu' ? menu : running() && targetMatches);
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
    const nav = win.performance.getEntriesByType('navigation')[0];
    const paint = win.performance.getEntriesByName('first-contentful-paint')[0];
    report({
      action: 'Navigation timing',
      mode,
      outcome: 'browser entries; no device qualification',
      domContentLoadedMs: nav?.domContentLoadedEventEnd ?? null,
      firstContentfulPaintMs: paint?.startTime ?? null,
      resourcesAtFrameLoad: win.performance.getEntriesByType('resource').length,
    });
    dispose = () => {
      fail('navigation/disposal; sample discarded');
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
  frame.src = `${path}?journey=whole-spatial-v4`;
  status.textContent = `Loading ${mode}…`;
});
