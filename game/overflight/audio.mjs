/** Events enter the existing mixer once per accepted simulation step. It owns
 * mute, priorities, sample fallback and voice limits; replay/prepare stay silent. */
export function createOverflightAudio(
  sound,
  { presentation = null, getDestruction = () => ({}) } = {},
) {
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
    arrival: 'warning',
    boost: 'burst',
    start: 'notice',
    pickup: 'supply',
    'pickup.collected': 'supply',
    damage: 'impact',
    hit: 'impact',
    defeat: 'catch',
    salvage: 'supply',
    system: 'pulse',
    shield: 'recover',
    handoff: 'recover',
    upgrade: 'objective',
    elite: 'objective',
    final: 'objective',
    level: 'objective',
    evolution: 'objective',
    'hunt-kill': 'catch',
    'hunt-blocked': 'blocked',
    'armor-break': 'reel',
    'rush-ready': 'notice',
    rush: 'pulse',
    objective: 'objective',
    courier: 'supply',
  };
  return {
    prepare() {
      return sound.publishedAudio?.prepare(['pickup', 'confirm', 'victory', 'failure']);
    },
    update(run) {
      if (!run || eventCursor(run) === lastTick) return;
      lastTick = eventCursor(run);
      const heard = new Set();
      const events = Array.isArray(run.events) ? run.events : [];
      const terminal = events.find((event) => ['won', 'lost'].includes(event.type ?? event));
      if (terminal) {
        // The result belongs to the native menu bus: pausing the finished
        // simulation must not cut its motif off with the remaining combat SFX.
        sound.event({
          type: 'run.completed',
          ui: true,
          board: 'overflight',
          levelId: run.compiled?.id ?? 'overflight',
          tick: run.tick,
          won: (terminal.type ?? terminal) === 'won',
          status: terminal.type ?? terminal,
        });
        return;
      }
      const brutal = getDestruction()?.brutal === true;
      for (const event of events) {
        const type = typeof event === 'string' ? event : event.type;
        if (type === 'reroll' || type === 'upgrade-ready') {
          // A paused draft uses the shared menu bus and its saved preferences.
          if (!heard.has('confirm')) sound.publishedCue('confirm');
          heard.add('confirm');
          continue;
        }
        const cue = mapping[type];
        if (!cue || heard.has(cue)) continue;
        heard.add(cue);
        const pan = Number.isFinite(event.x)
          ? Math.max(-1, Math.min(1, (event.x - run.player.x) / 480))
          : 0;
        sound.encounter(cue, {
          board: 'overflight',
          pan,
          gainScale: cue === 'impact' ? 0.6 : cue === 'catch' ? 0.45 : 0.8,
          brutal,
          material: cue === 'catch' ? 'soft' : 'metal',
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
