import { createVictoryStoryPresentation } from '../ui/victory-story.mjs';
import { localizedText, t } from '../i18n/index.mjs';

/**
 * Mount an already authenticated creator story after a legal win. This host has
 * no progress, reward, or navigation callback: the earned poster and Next state
 * are owned by the campaign player before optional playback begins.
 */
export function createCreatorVictoryStoryHost({
  document,
  nodes,
  createPresentation = createVictoryStoryPresentation,
  presentationOptions = {},
} = {}) {
  if (!document?.createElement || !nodes?.surface || !nodes?.stage || !nodes?.status)
    throw new TypeError(t('errors:creator.victoryStoryNodes'));
  let presentation = null,
    poster = null,
    state = 'idle',
    reason = null;

  const report = (snapshot) => {
    state = snapshot.state;
    reason = snapshot.reason ?? null;
    localizedText(nodes.status, () =>
      snapshot.reason ||
      t(
        snapshot.state === 'playing'
          ? 'interface:creator.victoryStoryPlaying'
          : snapshot.state === 'paused'
            ? 'interface:creator.victoryStoryPaused'
            : 'interface:creator.victoryStoryOptional',
      ),
    );
    nodes.status.classList.toggle('error', ['error', 'blocked'].includes(snapshot.state));
    if (nodes.retry) nodes.retry.hidden = snapshot.state !== 'error';
  };

  function close() {
    presentation?.dispose();
    presentation = null;
    if (poster) {
      poster.hidden = false;
      nodes.stage.replaceChildren(poster);
    }
    nodes.surface.hidden = true;
    nodes.status.classList.remove('error');
    localizedText(nodes.status, '');
    if (nodes.retry) nodes.retry.hidden = true;
    state = 'idle';
    reason = null;
  }

  function show({ posterElement, picturePin, prepared, options = {} }) {
    close();
    poster = posterElement;
    nodes.surface.hidden = false;
    nodes.stage.replaceChildren(posterElement);
    nodes.status.classList.remove('error');
    if (nodes.retry) nodes.retry.hidden = true;
    localizedText(nodes.status, () => t('interface:creator.victoryStoryAvailable'));
    try {
      presentation = createPresentation({
        container: nodes.stage,
        posterElement,
        picturePin,
        prepared,
        document,
        ...presentationOptions,
        ...options,
        onChange: report,
      });
      report(presentation.snapshot());
    } catch (error) {
      posterElement.hidden = false;
      state = 'error';
      reason = error instanceof Error ? error.message : String(error);
      localizedText(nodes.status, () =>
        t('interface:creator.victoryVideoUnavailable', { error: reason }),
      );
      nodes.status.classList.add('error');
      if (nodes.retry) nodes.retry.hidden = false;
    }
    return presentation;
  }

  return Object.freeze({
    show,
    close,
    snapshot: () => Object.freeze({ state, reason, available: !!presentation }),
    dispose: close,
  });
}
