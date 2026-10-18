import { BoardPainter } from '../ui/render.mjs';
import { resolveDemoPicture } from '../ui/demo-picture.mjs';
import { resolveDemoJourneyPicture } from '../ui/demo-journey-picture.mjs';
import { createDemoPractice } from './solo-practice.mjs';

export function resolveDemoTheme(entry, level, preferredThemeId) {
  return (
    entry.themes.find((item) => item.id === level.themeId) ||
    entry.themes.find((item) => item.id === entry.campaign.themeId) ||
    entry.themes.find((item) => item.id === preferredThemeId) ||
    entry.themes[0]
  );
}

/** Solo owns its artwork policy and native simulation; transport belongs to the host. */
export function createSoloDemoAdapter({
  presets,
  getContext,
  loadSources,
  readMedia,
  getJourneyPictureContext,
  prepareActors,
  preparePresentation,
  owners,
  onRetire = () => {},
  resourceOwners = new Set(),
  getEpoch = () => 0,
  onWorker = undefined,
  onContextLoss = () => {},
  onContextRestored = () => {},
}) {
  async function prepare(source, { signal }) {
    const player = await source.create({ signal, onWorker });
    const owner = {
      epoch: getEpoch(),
      released: false,
      losses: new Set(),
      retiredSurfaces: new WeakSet(),
    };
    resourceOwners.add(owner);
    let nextPicture = null,
      nextPainter = null,
      nextActors = null,
      nextPresentation = null,
      released = false,
      retirement = null;
    const retired = new Set();
    const release = () => {
      released = true;
      owner.released = true;
      resourceOwners.delete(owner);
      owner.losses.clear();
      const pending = [];
      for (const [owner, method] of [
        [player, 'dispose'],
        [nextPicture, 'dispose'],
        [nextPainter, 'dispose'],
        [nextActors, 'release'],
        [nextPresentation, 'release'],
      ]) {
        if (!owner || retired.has(owner)) continue;
        retired.add(owner);
        try {
          // Release current owners immediately on abort, even while another
          // owner's disposal or an abandoned image decode remains pending.
          pending.push(owner[method]?.());
        } catch (error) {
          pending.push(Promise.reject(error));
        }
      }
      if (!retirement || pending.length) {
        retirement = Promise.allSettled([retirement, ...pending]);
        // Preparation can time out before it returns a wrapper. Register that
        // cleanup with the same host barrier used by adopted scene disposal.
        onRetire(retirement);
      }
      return retirement;
    };
    const check = () => {
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
    };
    // A scene deadline must retire its live Worker and painter immediately,
    // even when image/media loading never settles or ignores cancellation.
    signal.addEventListener('abort', release, { once: true });
    try {
      check();
      const current = getContext(),
        entry = source.entry;
      const theme = resolveDemoTheme(entry, source.level, current.themeId);
      if (!theme)
        throw Object.assign(
          new Error('This Solo demonstration has no matching authored presentation theme.'),
          { code: 'demo-content-mismatch' },
        );
      nextActors = await prepareActors(entry, source.level, theme.id, { signal });
      owner.actors = nextActors;
      if (released) await release();
      check();
      nextPainter = new BoardPainter(presets, {
        onContextLoss: ({ owner: surface }) => {
          if (
            owner.released ||
            owner.epoch !== getEpoch() ||
            owner.retiredSurfaces.has(surface) ||
            owner.losses.has(surface)
          )
            return;
          owner.losses.add(surface);
          onContextLoss(owner);
        },
        onContextRestored: ({ owner: surface, retired }) => {
          if (owner.released || owner.epoch !== getEpoch()) return;
          if (retired) owner.retiredSurfaces.add(surface);
          if (owner.losses.delete(surface)) onContextRestored(owner);
        },
      });
      owner.painter = nextPainter;
      nextPresentation = await preparePresentation(nextPainter, entry, source.level, theme.id, {
        signal,
      });
      owner.presentation = nextPresentation;
      if (released) await release();
      check();
      nextPainter.setLevel(source.level, { seed: player.info.seed });
      const overrides = {
        ...entry.visualOverrides,
        ...(entry.levelVisuals?.find((item) => item.levelId === source.levelId)?.visualOverrides ??
          {}),
      };
      // Match the runtime's theme-specific map artwork binding.
      const visual = entry.levelVisuals?.find(
        (item) => item.levelId === source.levelId && item.themeId === theme.id,
      );
      if (visual?.background) overrides.background = visual.background;
      await nextPainter.setLook(
        theme,
        theme.classBodies?.[player.state.activeClassId] || theme.player,
        overrides,
      );
      check();
      const journey = getJourneyPictureContext(source) ?? source.journeyContext;
      nextPicture = journey
        ? await resolveDemoJourneyPicture({ entry, level: source.level, theme, journey, signal })
        : await resolveDemoPicture({
            entry,
            level: source.level,
            theme,
            library: current.library,
            entries: current.entries,
            readMedia,
            signal,
          });
      owner.picture = nextPicture;
      // A media decoder may have completed after the abort cleanup ran.
      if (released) await release();
      check();
      if (nextPicture.artSeed !== null)
        nextPainter.setLevel(source.level, { seed: nextPicture.artSeed });
      const wrapper = {
        get state() {
          return player.state;
        },
        get phase() {
          return player.phase;
        },
        get error() {
          return player.error;
        },
        get maxAdvanceSeconds() {
          return player.maxAdvanceSeconds;
        },
        info: player.info,
        play: () => player.play(),
        pause: () => player.pause(),
        advance: (dt) => player.advance(dt),
        exportRecording: () => player.exportRecording(),
        forkForPractice: (options) => player.forkForPractice(options),
        dispose: release,
      };
      Object.assign(owner, {
        painter: nextPainter,
        actors: nextActors,
        picture: nextPicture,
        theme,
        overrides,
        classId: player.state.activeClassId,
      });
      owners.set(wrapper, owner);
      return wrapper;
    } catch (failure) {
      await release();
      throw failure;
    } finally {
      signal.removeEventListener('abort', release);
    }
  }
  return {
    id: 'solo',
    enumerateSources: loadSources,
    prepare,
    createPractice: (fork) => createDemoPractice(fork.run),
  };
}
