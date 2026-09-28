import { BoardPainter } from '../../game/ui/render.mjs';
import { loadPreviewTheme } from '../../game/content-design/preview-loader.mjs';
import { acquireCandidatePicture } from '../../game/content-design/picture.mjs';
import { prepareActorAppearanceLease } from '../../game/presentation/actor-appearance-lease.mjs';
import { createBenchmarkSession } from './session.mjs';
import { createAnimationState } from '../motion-lab/animation.mjs';
import { createSceneComparison } from './comparison.mjs';

function disposePainter(painter) {
  painter.loadToken++;
  painter.enemyBodies.clear();
  for (const image of Object.values(painter.images)) image.removeAttribute?.('src');
  painter.images = {};
  painter.image = null;
  painter.background = null;
}
function waitForLook(painters, theme, bodyId, signal) {
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      error ? reject(error) : resolve();
    };
    const abort = () => finish(new DOMException('Mission preparation cancelled.', 'AbortError'));
    const timer = setTimeout(
      () => finish(new Error('Craft artwork did not decode in time.')),
      15000,
    );
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) {
      abort();
      return;
    }
    Promise.all(painters.map((painter) => painter.setLook(theme, bodyId))).then(() => {
      const warning = painters.find((painter) => painter.lookWarning)?.lookWarning;
      finish(warning ? new Error(warning) : null);
    }, finish);
  });
}

/** Every accepted picture and approved actor lease belongs to one scene. The
 * previous scene remains live until the caller accepts this complete result. */
export async function prepareBenchmarkScene(
  entry,
  {
    catalog,
    presets,
    signal,
    onStep = () => {},
    onComparisonStatus = () => {},
    acquireComparison,
    loadTheme = loadPreviewTheme,
    acquirePicture = acquireCandidatePicture,
    acquireActors = prepareActorAppearanceLease,
    actorBaseURL = new URL('../../game/presentation/compiled/', import.meta.url),
    makePainter = () => new BoardPainter(presets),
  } = {},
) {
  let picture = null;
  let actors = null;
  let session = null;
  let comparison = null;
  const painters = [];
  let released = false;
  const dispose = () => {
    if (released) return;
    released = true;
    session?.dispose();
    comparison?.dispose();
    picture?.release();
    actors?.release();
    painters.forEach(disposePainter);
  };
  try {
    signal.throwIfAborted();
    const theme = await loadTheme({ themeId: entry.manifest.presentation.themeId, signal });
    signal.throwIfAborted();
    picture = await acquirePicture(entry.manifest.background, { signal });
    signal.throwIfAborted();
    const content = await catalog.actorContent(entry, { signal });
    signal.throwIfAborted();
    actors = await acquireActors(
      { scope: 'journey', content, style: 'fpv' },
      {
        baseURL: actorBaseURL,
        signal,
      },
    );
    signal.throwIfAborted();
    for (let index = 0; index < 2; index++) painters.push(makePainter());
    await waitForLook(painters, theme, theme.classBodies?.scout ?? theme.player, signal);
    signal.throwIfAborted();
    session = createBenchmarkSession(entry.manifest, {
      onStep(events, run) {
        for (const painter of painters) painter.effectsFor(events, run);
        onStep(events, run);
      },
    });
    comparison = createSceneComparison({
      actors,
      session,
      acquire: acquireComparison,
      onStatus: onComparisonStatus,
    });
    const resetPresentation = () => {
      for (const painter of painters) {
        painter.setLevel(session.run.level, { seed: 1 });
        painter.animation = createAnimationState();
      }
    };
    resetPresentation();
    return { entry, session, picture, actors, comparison, painters, resetPresentation, dispose };
  } catch (error) {
    dispose();
    throw error;
  }
}
