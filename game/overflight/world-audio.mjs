const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const spatial = (run, point) => ({
  board: 'overflight',
  pan: clamp(((point.x ?? run.player.x) - run.player.x) / 480, -1, 1),
  audible:
    Math.hypot(
      (point.x ?? run.player.x) - run.player.x,
      (point.y ?? run.player.y ?? 0) - (run.player.y ?? 0),
    ) <= 560,
});

/** Observe accepted simulation states. No future warning sound is scheduled:
 * pause, slow resume, cancelled attacks and pooled records stay authoritative. */
export function createOverflightWorldAudio(sound) {
  let owner = null,
    warnings = new Map(),
    shots = new Map(),
    nextAmbience = 0,
    nextEscort = 0,
    quietUntil = 0;
  const stopAmbience = () => {
    for (const voice of sound.voices ?? [])
      if (voice.ambience && voice.board === 'overflight') voice.stop();
  };
  function reset() {
    stopAmbience();
    owner = null;
    warnings.clear();
    shots.clear();
    nextAmbience = nextEscort = quietUntil = 0;
  }
  return {
    reset,
    suspend: stopAmbience,
    update(run, { foreground = false } = {}) {
      if (owner !== run) {
        reset();
        owner = run;
        for (const escort of run.riy?.escorts ?? []) shots.set(escort, escort.shots ?? 0);
      }
      if (run.phase !== 'playing' || run.fixture) {
        stopAmbience();
        return;
      }
      const now = Number.isFinite(run.time) ? run.time : (run.tick ?? 0) / 60;
      const activeWarnings = new Set();
      let charge = null;
      for (const attack of run.priorityAttacks ?? []) {
        if (!attack.active || attack.stage === 'active' || !(attack.remaining > 0)) continue;
        activeWarnings.add(attack);
        let previous = warnings.get(attack);
        if (
          !previous ||
          previous.owner !== attack.owner ||
          attack.remaining > previous.remaining + 1e-6
        ) {
          previous = {
            owner: attack.owner,
            initial: attack.remaining,
            rung: 0,
          };
          warnings.set(attack, previous);
        }
        const progress = clamp(1 - attack.remaining / previous.initial, 0, 1);
        const rung = progress >= 0.8 ? 2 : progress >= 0.5 ? 1 : 0;
        if (rung > previous.rung && (!charge || progress > charge.progress))
          charge = { attack, progress };
        previous.rung = rung;
        previous.remaining = attack.remaining;
      }
      for (const attack of warnings.keys())
        if (!activeWarnings.has(attack)) warnings.delete(attack);
      if (foreground || activeWarnings.size) {
        quietUntil = now + 0.75;
        stopAmbience();
      }
      if (charge && !foreground)
        sound.encounter('warning-charge', {
          ...spatial(run, charge.attack),
          progress: charge.progress,
        });
      for (const escort of run.riy?.escorts ?? []) {
        const previous = shots.get(escort) ?? escort.shots;
        shots.set(escort, escort.shots);
        if (escort.shots > previous && !foreground && !activeWarnings.size && now >= nextEscort) {
          sound.encounter('escort-shot', {
            ...spatial(run, escort),
            role: escort.role,
          });
          nextEscort = now + 0.65;
        }
      }
      const world = run.compiled?.presentation?.world;
      if (
        world &&
        !foreground &&
        !activeWarnings.size &&
        now >= quietUntil &&
        now >= nextAmbience
      ) {
        sound.encounter('ambience', { board: 'overflight', world });
        nextAmbience = now + 1.25;
      }
    },
  };
}
