/** Borrow the page's existing session. Never creates a second player or changes
 * listening intent when a demo pauses, changes engines, or returns to the menu. */
export function createDemoMusicTransport({ music, audioMaster, audioPreferences }) {
  if (!music) return null;
  const updateMusic = () => music.session.update(false, { family: 'fpv' }, { status: 'paused' });
  return {
    snapshot: () => ({
      ...music.player.snapshot(),
      ...audioMaster.snapshot(),
      playbackAvailable: true,
    }),
    subscribe: (listener) => audioMaster.subscribe(listener),
    setMuted: (value) => audioPreferences.setMuted(value),
    setVolume: (value) => audioPreferences.setVolume(value),
    wake: () => music.player.wake(),
    play: () => music.session.play(),
    pause: () => music.session.pause(),
    next: () => music.player.next(),
    update: updateMusic,
    updateMusic,
  };
}
