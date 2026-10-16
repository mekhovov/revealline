import { localizedMessage, localizedText } from '../i18n/index.mjs';
import { createPrintableReward } from '../rewards/printable.mjs';

/** Shared, text-only author preview. It owns its download resources and never
 * receives player progress, storage or an earning capability. */
export function createRewardPrintPreview({
  document,
  window = globalThis.window,
  getReward,
  getLocale = () => 'en',
  onSaved = () => {},
  onError = () => {},
}) {
  const button = document.createElement('button');
  button.type = 'button';
  localizedText(button, localizedMessage('tools:studio.discovery.printPreview'));
  let disposed = false,
    request = null;
  const downloads = new Map();
  function release(url) {
    if (!downloads.has(url)) return;
    const timer = downloads.get(url);
    if (timer !== undefined) window.clearTimeout?.(timer);
    downloads.delete(url);
    window.URL.revokeObjectURL(url);
  }
  button.onclick = async () => {
    if (disposed || request) return;
    const controller = new AbortController();
    request = controller;
    button.disabled = true;
    try {
      const reward = getReward();
      const result = await createPrintableReward(reward, {
        locale: getLocale(),
        preview: true,
        signal: controller.signal,
      });
      controller.signal.throwIfAborted();
      if (disposed) return;
      const url = window.URL.createObjectURL(
        new Blob([result.html], { type: 'text/html;charset=utf-8' }),
      );
      downloads.set(url, undefined);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${reward.id}-author-preview.html`;
      anchor.click();
      const timer = window.setTimeout(() => release(url), 1000);
      if (downloads.has(url)) downloads.set(url, timer);
      onSaved(result);
    } catch (error) {
      if (!disposed && error.name !== 'AbortError') onError(error);
    } finally {
      if (request === controller) request = null;
      if (!disposed) button.disabled = false;
    }
  };
  return {
    button,
    dispose() {
      if (disposed) return;
      disposed = true;
      request?.abort();
      request = null;
      for (const url of downloads.keys()) release(url);
      button.onclick = null;
      button.disabled = true;
    },
  };
}
