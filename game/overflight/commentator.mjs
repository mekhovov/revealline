import { attachContextualReactions } from '../ui/contextual-reactions.mjs';
import { getLocale as currentLocale, onLocaleChange } from '../i18n/index.mjs';

function attachEnabledControl(shared, host) {
  const container = host.settingsContainer;
  const doc = host.document ?? container?.ownerDocument;
  if (!container || !doc || !shared.preferences) return () => {};
  const group = doc.createElement('div'),
    label = doc.createElement('label'),
    control = doc.createElement('input'),
    text = doc.createElement('span'),
    status = doc.createElement('p'),
    retry = doc.createElement('button');
  control.type = 'checkbox';
  control.dataset.overflightCommentatorEnabled = 'true';
  status.setAttribute('role', 'status');
  retry.type = 'button';
  label.append(control, text);
  group.append(label, status, retry);
  container.prepend(group);
  const render = () => {
    const state = shared.preferences.snapshot();
    const uk = (host.getLocale ?? currentLocale)() === 'uk';
    control.checked = state.enabled;
    text.textContent = uk ? 'Коментатор' : 'Commentator';
    retry.textContent = uk ? 'Зберегти повторно' : 'Retry saving';
    status.textContent = state.error;
    status.hidden = retry.hidden = state.durable;
  };
  control.onchange = () => shared.preferences.choose(control.checked);
  retry.onclick = () => shared.preferences.retry();
  const unpreferences = shared.preferences.subscribe(render),
    unlocale = onLocaleChange(render);
  return () => {
    unpreferences();
    unlocale();
    control.onchange = retry.onclick = null;
    group.remove();
  };
}

/** Projects accepted facts into the shared commentator. No gameplay writes,
 * audio context, preference store, timer, speech synthesis or delayed event queue. */
export function createOverflightCommentator({ reactions = null, ...host } = {}) {
  const owns = !reactions;
  const shared = reactions ?? attachContextualReactions(host);
  const releaseEnabled = attachEnabledControl(shared, host);
  let owner = null,
    attempt = 0,
    last = '',
    suspended = false,
    closed = false,
    resultSent = false,
    previousKills = 0,
    clearWindowTick = 0,
    clearWindowKills = 0,
    upgraded = false,
    evolved = false,
    cleared = false,
    rushReady = false,
    replaced = false;
  const context = () => ({
    attemptId: `overflight-${attempt}`,
    mode: 'solo',
    board: 'overflight',
    speaker: 'engineer',
  });
  function reset(run = null) {
    if (closed) return;
    owner = run;
    attempt++;
    last = '';
    resultSent = upgraded = evolved = cleared = rushReady = replaced = false;
    previousKills = run?.stats?.kills ?? 0;
    clearWindowTick = run?.tick ?? 0;
    clearWindowKills = 0;
    shared.reset(context().attemptId);
    if (suspended) shared.suspend();
  }
  function update(run) {
    if (closed || !run) return;
    if (run !== owner) reset(run);
    const cursor = `${run.tick}:${run.phase}:${run.progression?.choices ?? 0}:${run.progression?.rerolls ?? 0}`;
    if (cursor === last) return;
    last = cursor;
    const kills = run.stats?.kills ?? 0;
    if (run.tick - clearWindowTick > 45) {
      clearWindowTick = run.tick;
      clearWindowKills = 0;
    }
    clearWindowKills += Math.max(0, kills - previousKills);
    previousKills = kills;
    if (run.fixture || suspended) {
      clearWindowKills = 0;
      return;
    }
    if (run.phase === 'won' || run.phase === 'lost') {
      if (resultSent) return;
      resultSent = true;
      shared.result({
        ...context(),
        owned: true,
        presentation: 'overflight',
        missionId: run.compiled.id,
        outcome: run.phase,
      });
      return;
    }
    if (run.phase !== 'playing') return;
    const events = Array.isArray(run.events) ? run.events : [];
    const has = (type) => events.some((event) => event.type === type);
    // Warnings, damage and critical hull outrank decorative commentary. Consume
    // a missed milestone now; never replay its stale voice after danger passes.
    const danger =
      has('hit') ||
      has('hunt-blocked') ||
      has('shield') ||
      has('warning') ||
      has('arrival') ||
      run.player.hull <= run.player.maxHull * 0.25 ||
      (run.priorityAttacks ?? []).some((attack) => attack.active);
    const observed = [];
    const mark = (type) => observed.push({ type, tick: run.tick, time: run.time });
    if (!upgraded && has('upgrade')) {
      upgraded = true;
      mark('overflight.upgraded');
    }
    if (!evolved && has('evolution')) {
      evolved = true;
      mark('overflight.evolved');
    }
    if (!cleared && clearWindowKills >= 18) {
      cleared = true;
      mark(run.hunt ? 'overflight.hunt-cleared' : 'overflight.cleared');
    }
    if (!rushReady && has('rush-ready')) {
      rushReady = true;
      mark('overflight.hunt-rush');
    }
    if (!replaced && has('handoff')) {
      replaced = true;
      mark('overflight.replaced');
    }
    if (danger || observed.length) shared.events(observed, { ...context(), danger });
  }
  return {
    preferences: shared.preferences,
    options: shared.options,
    diagnostics: shared.diagnostics,
    prepare: () => {
      if (!closed) shared.prepare();
    },
    reset,
    update,
    suspend() {
      if (closed) return;
      suspended = true;
      clearWindowKills = 0;
      shared.suspend();
    },
    resume() {
      if (closed) return;
      suspended = false;
      shared.resume();
    },
    dispose() {
      if (closed) return;
      closed = true;
      releaseEnabled();
      if (owns) shared.dispose();
      else shared.suspend();
    },
  };
}
