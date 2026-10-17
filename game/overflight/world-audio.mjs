const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
export const overflightAudioSpatial = (run, point) => ({
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
export function createOverflightWorldAudio(sound, { acquireGain = () => null } = {}) {
  let owner = null,
    warnings = new Map(),
    shots = new Map(),
    nextAmbience = 0,
    nextEscort = 0,
    lastEscortRole = null,
    quietUntil = 0,
    musicLease = null,
    musicUntil = 0;
  const stopAmbience = () => {
    for (const voice of sound.voices ?? [])
      if (voice.ambience && voice.board === 'overflight') voice.stop();
  };
  const releaseMusic = () => {
    const owned = musicLease;
    musicLease = null;
    musicUntil = 0;
    owned?.release();
  };
  const suspend = () => {
    stopAmbience();
    releaseMusic();
  };
  function reset() {
    suspend();
    owner = null;
    warnings.clear();
    shots.clear();
    nextAmbience = nextEscort = quietUntil = 0;
    lastEscortRole = null;
  }
  return {
    reset,
    suspend,
    update(run, { foreground = false } = {}) {
      if (owner !== run) {
        reset();
        owner = run;
        for (const escort of run.riy?.escorts ?? []) shots.set(escort, escort.shots ?? 0);
      }
      if (run.phase !== 'playing' || run.fixture) {
        suspend();
        return;
      }
      const now = Number.isFinite(run.time) ? run.time : (run.tick ?? 0) / 60;
      if (musicLease && now >= musicUntil) releaseMusic();
      const activeWarnings = new Set();
      let charge = null,
        audibleWarning = false;
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
        const audible = overflightAudioSpatial(run, attack).audible;
        audibleWarning ||= audible;
        const progress = clamp(1 - attack.remaining / previous.initial, 0, 1);
        const rung = progress >= 0.8 ? 2 : progress >= 0.5 ? 1 : 0;
        if (audible && rung > previous.rung && (!charge || progress > charge.progress))
          charge = { attack, progress };
        // Observe every rung, including suppressed/out-of-range ones. Returning
        // to hearing range must not replay an obsolete charge.
        previous.rung = rung;
        previous.remaining = attack.remaining;
      }
      for (const attack of warnings.keys())
        if (!activeWarnings.has(attack)) warnings.delete(attack);
      if (foreground || audibleWarning) {
        quietUntil = now + 0.75;
        stopAmbience();
      }
      // Borrow the shared player's gain; never edit the saved volume or own a
      // second music bus. Rungs/damage briefly make room, not the entire warning.
      if (foreground || charge) {
        musicUntil = now + 0.35;
        musicLease ??= acquireGain({ factor: 0.55 });
      }
      if (charge && !foreground)
        sound.encounter('warning-charge', {
          ...overflightAudioSpatial(run, charge.attack),
          progress: charge.progress,
        });
      let escortCue = null;
      for (const escort of run.riy?.escorts ?? []) {
        const previous = shots.get(escort) ?? escort.shots;
        shots.set(escort, escort.shots);
        if (
          escort.shots > previous &&
          !foreground &&
          !audibleWarning &&
          now >= nextEscort &&
          overflightAudioSpatial(run, escort).audible &&
          (!escortCue || (escortCue.role === lastEscortRole && escort.role !== lastEscortRole))
        )
          escortCue = escort;
      }
      // Simultaneous shots share one slot. Rotate roles so array order cannot
      // permanently hide Breaker's sound; distant/suppressed shots never queue.
      if (escortCue) {
        sound.encounter('escort-shot', {
          ...overflightAudioSpatial(run, escortCue),
          role: escortCue.role,
        });
        nextEscort = now + 0.65;
        lastEscortRole = escortCue.role;
      }
      const world = run.compiled?.presentation?.world;
      if (world && !foreground && !audibleWarning && now >= quietUntil && now >= nextAmbience) {
        sound.encounter('ambience', { board: 'overflight', world });
        nextAmbience = now + 1.25;
      }
    },
  };
}
