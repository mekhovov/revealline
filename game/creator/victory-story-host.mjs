import { createVictoryStoryPresentation } from '../ui/victory-story.mjs';

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
    throw new TypeError('Creator victory story needs its document and presentation nodes.');
  let presentation = null,
    state = 'idle',
    reason = null;

  const report = (snapshot) => {
    state = snapshot.state;
    reason = snapshot.reason ?? null;
    nodes.status.textContent =
      snapshot.reason ||
      (snapshot.state === 'playing'
        ? 'Victory story playing. Next remains available.'
        : snapshot.state === 'paused'
          ? 'Victory story paused. Resume, replay, skip, or continue to Next.'
          : 'Your earned picture is saved. The victory story is optional.');
    nodes.status.classList.toggle('error', ['error', 'blocked'].includes(snapshot.state));
    if (nodes.retry) nodes.retry.hidden = snapshot.state !== 'error';
  };

  function close() {
    presentation?.dispose();
    presentation = null;
    nodes.stage.replaceChildren();
    nodes.surface.hidden = true;
    nodes.status.classList.remove('error');
    nodes.status.textContent = '';
    if (nodes.retry) nodes.retry.hidden = true;
    state = 'idle';
    reason = null;
  }

  function show({ posterElement, picturePin, prepared, options = {} }) {
    close();
    nodes.surface.hidden = false;
    nodes.stage.append(posterElement);
    nodes.status.classList.remove('error');
    if (nodes.retry) nodes.retry.hidden = true;
    nodes.status.textContent =
      'Your earned picture is saved. Play the optional victory story, skip it, or continue to Next.';
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
      nodes.status.textContent = `Victory video is unavailable. Your earned picture and Next remain available. ${reason}`;
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
