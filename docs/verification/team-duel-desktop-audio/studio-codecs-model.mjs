import { resolvePresentation } from '../../../game/presentation/model.mjs';

// Existing licensed fixtures only. These pins identify the three inputs, not
// universal codec support or a recommended production sound palette.
export const codecFixtures = Object.freeze([
  {
    cue: 'failure',
    mime: 'audio/wav',
    bytes: 38444,
    sha256: '574ed8153f407aff77e2ad5316ac1ca8d1b6aec95ddfc6b793e76bdc8f0e4a14',
    path: 'game/audio/effects/loss.wav',
    channels: 1,
    duration: [0.59, 0.61],
    event: 'player.failed',
  },
  {
    cue: 'pickup',
    mime: 'audio/ogg',
    bytes: 6941,
    sha256: 'c977fe249ff42d1c93a552b33abc13a8399df3879fa510475426e5c4bbac1da9',
    path: 'authoring/audio/revealline-v1/originals/interface/pluck_002.ogg',
    channels: 2,
    duration: [0.15, 0.18],
    event: 'pickup.collected',
  },
  {
    cue: 'victory',
    mime: 'audio/mpeg',
    bytes: 32600,
    sha256: 'cdee5b2980749d03f6c622c4438bbf068f7f24f2d7f4214835152929834ae891',
    path: 'docs/verification/cross-mode/p02-a/fixtures/rising-chime.mp3',
    channels: 1,
    duration: [1.99, 2.05],
    event: 'run.completed',
  },
]);

/** Input must already have passed production importThemeBundle. No storage,
 * synthetic bundle, revision rewrite or namespace assumption is involved. */
export function codecsFromVerifiedBundle(bundle) {
  const resolved = resolvePresentation(bundle.document);
  const selected = new Map();
  for (const fixture of codecFixtures) {
    const slot = `audio.${fixture.cue}`;
    const asset = resolved.assets[slot];
    const blob = asset?.file && bundle.assets.get(asset.file.sha256);
    if (asset?.kind !== 'audio' || !(blob instanceof Blob))
      throw new Error(`Choose a Studio export with the uploaded ${fixture.cue} fixture.`);
    if (
      asset.file.mime !== fixture.mime ||
      asset.file.sha256 !== fixture.sha256 ||
      asset.file.bytes !== fixture.bytes ||
      blob.size !== fixture.bytes
    )
      throw new Error(
        `The ${fixture.cue} slot does not contain the retained ${fixture.mime} fixture.`,
      );
    selected.set(slot, { asset, blob });
  }
  return {
    theme: resolved.theme,
    selected,
    readAudio: async (slot, { signal } = {}) => {
      if (signal?.aborted) throw new DOMException('Read cancelled.', 'AbortError');
      return selected.get(slot) ?? null;
    },
  };
}

export function inspectCueVoices(sound, cue, expectedBuffer) {
  const all = [...sound.voices];
  const exact = all.filter(
    (voice) => expectedBuffer && voice.name === cue && voice.source?.buffer === expectedBuffer,
  );
  return {
    exact: exact.length,
    owners: exact.map((voice) => voice.board),
    other: all.length - exact.length,
    total: all.length,
  };
}

/** Same event adapter and options shape as the production Team/Duel hosts.
 * A Duel result is emitted separately, without mode:'versus', by the host. */
export function dispatchCodecEvent(sound, { type, board = 'team', tick, lost = false }) {
  sound.events(
    [
      {
        type,
        player: 0,
        tick,
        time: sound.context.currentTime,
        kind: 'extra-life',
        ...(type === 'run.completed' ? { status: lost ? 'lost' : 'won' } : {}),
      },
    ],
    {
      width: 40,
      height: 30,
      cells: new Uint8Array(1200),
      totalClaimable: 1200,
      status: 'running',
      players: [
        { id: 0, x: 6, y: 5 },
        { id: 1, x: 34, y: 5 },
      ],
      enemies: [],
    },
    {},
    {
      board,
      ...(board === 'team'
        ? { mode: 'team' }
        : Number.isInteger(board)
          ? { mode: 'versus', placement: { left: board / 2, width: 0.5 } }
          : {}),
    },
  );
}

/** Deliberate read-adapter fault after a verified import. This is not a corrupt
 * exported bundle or a claim that import accepts these truncated bytes. */
export function truncatedCueReader(selected, cue) {
  return async (slot, options) => {
    const original = await selected.readAudio(slot, options);
    return slot === `audio.${cue}` && original
      ? { asset: original.asset, blob: original.blob.slice(0, 9, original.blob.type) }
      : original;
  };
}

/** Observe natural completion without stopping voices, clearing event identity,
 * changing a generation, or replacing the live published owner. */
export async function waitForFallbackEnd(
  sound,
  { wait, assertOwned = () => {}, now = () => performance.now(), timeoutMs = 5000 },
) {
  const began = now();
  for (;;) {
    assertOwned();
    if (sound.context.state !== 'running') throw new Error('Audio clock stopped during fallback.');
    if (sound.voices.size === 0) return { waitedMs: now() - began, remainingVoices: 0 };
    if (now() - began >= timeoutMs)
      throw new Error('Fallback did not finish within its bounded wait.');
    await wait(12);
  }
}
