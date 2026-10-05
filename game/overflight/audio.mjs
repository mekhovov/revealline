/** Events enter the existing mixer once per accepted simulation step. It owns
 * mute, priorities, sample fallback and voice limits; replay/prepare stay silent. */
export function createOverflightAudio(sound, { presentation = null } = {}) {
  let lastTick = '';
  const eventCursor = (run) =>
    `${run.tick}:${run.phase ?? ''}:${run.progression?.choices ?? 0}:${run.progression?.rerolls ?? 0}`;
  if (presentation?.readAudio) sound.setPublishedAudio(presentation.readAudio);
  const mapping = {
    payload: 'fire',
    fire: 'fire',
    impact: 'impact',
    pulse: 'pulse',
    warning: 'warning',
    pickup: 'supply',
    'pickup.collected': 'supply',
    damage: 'impact',
    hit: 'impact',
    defeat: 'impact',
    salvage: 'supply',
    system: 'pulse',
    shield: 'recover',
    handoff: 'recover',
    'upgrade-ready': 'objective',
    upgrade: 'objective',
    elite: 'warning',
    final: 'warning',
    level: 'objective',
    evolution: 'objective',
    won: 'objective',
    lost: 'failure',
  };
  return {
    prepare() {
      return sound.publishedAudio?.prepare(['pickup']);
    },
    update(run) {
      if (!run || eventCursor(run) === lastTick) return;
      lastTick = eventCursor(run);
      const heard = new Set();
      for (const event of Array.isArray(run.events) ? run.events : []) {
        const type = typeof event === 'string' ? event : event.type;
        const cue = mapping[type];
        if (!cue || heard.has(cue)) continue;
        heard.add(cue);
        const pan = Number.isFinite(event.x)
          ? Math.max(-1, Math.min(1, (event.x - run.player.x) / 480))
          : 0;
        sound.encounter(cue, {
          board: 'overflight',
          pan,
          gainScale: cue === 'impact' ? 0.6 : 0.8,
          material: 'metal',
        });
      }
    },
    reset() {
      lastTick = '';
      sound.feedbackDirector.reset();
    },
    dispose() {
      lastTick = '';
      if (presentation?.readAudio) sound.setPublishedAudio(null);
    },
  };
}

export function overflightMusicContext(project, appearance) {
  return { mapKey: project.id, themeId: appearance.familyId, scene: 'menu' };
}
