import { required } from '../data-json.mjs';
import { localizedText, t } from '../i18n/index.mjs';

const aborted = (error) => error?.name === 'AbortError';

/**
 * Opens an optional victory story from the exact receipt returned by the
 * installed Custom runtime. Story preparation deliberately has no progress or
 * navigation callback, so it cannot award again or take ownership of Next.
 */
export function createCreatorPlayerVictoryStory({ runtime, host, nodes } = {}) {
  required(
    runtime?.prepareVictoryStory && host?.show && host?.close,
    t('errors:creator.storyPlaybackRuntime'),
  );
  required(
    nodes?.surface && nodes?.stage && nodes?.status && nodes?.retry,
    t('errors:creator.storyPlaybackControls'),
  );
  let generation = 0,
    controller = null,
    current = null,
    disposed = false;

  const hideRetry = () => {
    nodes.retry.hidden = true;
    nodes.retry.disabled = false;
  };

  function cancel() {
    generation++;
    controller?.abort();
    controller = null;
  }

  function reset() {
    cancel();
    current = null;
    hideRetry();
    host.close();
  }

  async function show(request) {
    required(!disposed, t('errors:creator.storyPlaybackClosed'));
    required(
      request?.receipt && request?.posterElement && request?.posterAsset,
      t('errors:creator.storyPlaybackCompletion'),
    );
    cancel();
    const token = generation,
      active = new AbortController();
    controller = active;
    current = request;
    hideRetry();
    nodes.status.classList.remove('error');
    localizedText(nodes.status, () => t('interface:creator.checkingVictoryStory'));
    try {
      const result = await runtime.prepareVictoryStory(request.receipt, {
        signal: active.signal,
      });
      if (disposed || token !== generation || active.signal.aborted) return null;
      controller = null;
      if (!result) {
        localizedText(nodes.status, '');
        return null;
      }
      required(
        result.poster.id === request.posterAsset.id &&
          result.poster.sha256 === request.posterAsset.sha256,
        t('errors:creator.storyPosterMismatch'),
      );
      return host.show({
        posterElement: request.posterElement,
        picturePin: result.picturePin,
        prepared: result.prepared,
      });
    } catch (error) {
      if (disposed || token !== generation || active.signal.aborted || aborted(error)) return null;
      controller = null;
      request.posterElement.hidden = false;
      nodes.surface.hidden = false;
      nodes.retry.hidden = false;
      nodes.status.classList.add('error');
      const reason = error instanceof Error ? error.message : String(error);
      localizedText(nodes.status, () =>
        t('interface:creator.victoryVideoUnavailable', { error: reason }),
      );
      return null;
    }
  }

  nodes.retry.addEventListener('click', () => {
    if (!current || disposed) return;
    nodes.retry.disabled = true;
    void show(current);
  });

  return Object.freeze({
    show,
    reset,
    snapshot: () =>
      Object.freeze({
        preparing: !!controller,
        retryAvailable: !nodes.retry.hidden,
      }),
    dispose() {
      if (disposed) return;
      reset();
      disposed = true;
    },
  });
}
