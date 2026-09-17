import { createOperationStatus } from './ui/operation-status.mjs';
import { createProfileChannelReader } from './profile-channel-reader.mjs';
import { attachProfileRecoveryView } from './ui/profile-recovery.mjs';
import { attachControllerNavigation } from './ui/controller-navigation.mjs';
import { createControllerRouter } from './ui/controller-router.mjs';
import { loadProfileRecoveryCatalogs } from './profile-recovery-catalogs.mjs';

const presenter = createOperationStatus(document.getElementById('profile-recovery-status'));
const root = document.getElementById('profile-recovery-root');
const back = document.getElementById('profile-recovery-back');
const reload = document.getElementById('profile-recovery-reload');
let cleanup = null,
  view = null,
  epoch = 0,
  closed = false,
  leaving = false,
  suspended = false,
  focused = document.hasFocus?.() !== false,
  frame = null;
const foreground = () =>
  !closed &&
  !leaving &&
  !suspended &&
  focused &&
  !document.hidden &&
  document.hasFocus?.() !== false;
// Startup and ready controls share one navigation owner. A retry only replaces
// its read operation, never the controller's assignment or its physical edges.
const navigation = attachControllerNavigation({
  getScope: () => 'menu',
  getRoot: () => root,
  getDefaultFocus: () => {
    const find = document.getElementById('profile-recovery-find');
    return find.disabled ? back : find;
  },
  onBack: () => {
    if (foreground()) back.click();
  },
  ownsKeyboardEvent: () => !foreground(),
  keyboard: true,
});
const router = createControllerRouter();
function sample(timeMs) {
  frame = null;
  if (closed || leaving || suspended) return;
  if (foreground()) navigation.handle(router.sample({ scope: 'menu', timeMs }).ui);
  else router.clear();
  if (!closed && !leaving && !suspended) frame = requestAnimationFrame(sample);
}
function stopFrames() {
  cancelAnimationFrame(frame);
  frame = null;
  router.clear();
  navigation.clear();
}
function disposeNavigation() {
  stopFrames();
  router.destroy();
  navigation.destroy();
  window.removeEventListener('blur', inactive);
  window.removeEventListener('focus', active);
  document.removeEventListener('visibilitychange', visibility);
}
const inactive = () => {
  focused = false;
  view?.cancel();
  router.clear();
  navigation.clear();
};
const active = () => {
  focused = document.hasFocus?.() !== false;
};
const visibility = () => {
  if (document.hidden) inactive();
  else active();
};
window.addEventListener('blur', inactive);
window.addEventListener('focus', active);
document.addEventListener('visibilitychange', visibility);

async function leave() {
  if (closed || leaving || suspended) return;
  leaving = true;
  const leavingGeneration = ++epoch;
  // Navigation may enter the browser cache. Only terminal pagehide disposes
  // this owner; a persisted return starts a fresh read with neutral input.
  stopFrames();
  await cleanup?.();
  if (leavingGeneration === epoch && !closed && !suspended && leaving)
    location.assign('./index.html');
}
back.onclick = () => leave();
reload.onclick = () => {
  if (!closed && !leaving && !suspended) void start();
};

async function start() {
  if (closed || leaving || suspended) return;
  const generation = ++epoch;
  reload.hidden = false;
  await cleanup?.();
  if (generation !== epoch || closed || leaving || suspended) return;
  view = null;
  back.onclick = () => leave();
  const lease = presenter.begin({
    message: 'Loading release information…',
    isCurrent: () => generation === epoch && !closed && !leaving && !suspended,
  });
  const controller = new AbortController();
  let timer;
  cleanup = async () => {
    clearTimeout(timer);
    controller.abort();
  };
  timer = setTimeout(() => {
    if (generation === epoch)
      lease.finish({
        message: 'Release information timed out. Choose Reload recovery or Back to game.',
        state: 'error',
      });
    controller.abort();
  }, 10000);
  try {
    const response = await fetch(new URL('./build-info.json', import.meta.url), {
      signal: controller.signal,
    });
    if (response.status !== 200)
      throw new Error('Open recovery from a built release with its version information.');
    const info = await response.json();
    if (generation !== epoch || controller.signal.aborted) return;
    clearTimeout(timer);
    let recoveryCatalogs = [],
      catalogIssue = '';
    const catalogController = new AbortController();
    const cancelCatalog = () => catalogController.abort();
    controller.signal.addEventListener('abort', cancelCatalog, { once: true });
    const catalogTimer = setTimeout(
      () =>
        catalogController.abort(
          new DOMException('Packaged catalog loading timed out.', 'TimeoutError'),
        ),
      10000,
    );
    try {
      lease.update({ message: 'Loading trusted historical catalogs…', stage: 'verifying' });
      recoveryCatalogs = await loadProfileRecoveryCatalogs(info.version, {
        signal: catalogController.signal,
      });
    } catch (error) {
      catalogIssue = error.message;
    } finally {
      clearTimeout(catalogTimer);
      controller.signal.removeEventListener('abort', cancelCatalog);
    }
    if (generation !== epoch || controller.signal.aborted) return;
    const reader = createProfileChannelReader({ currentVersion: info.version, recoveryCatalogs });
    view = attachProfileRecoveryView({
      reader,
      presenter,
      supportedChannels: recoveryCatalogs.map((entry) => entry.channelId),
      catalogIssue,
      onBack: () => {
        // The ready view closes its reader before calling back. That completion
        // may belong to an earlier history visit or foreground interaction.
        if (generation !== epoch || view !== ownedView || !foreground()) return;
        return leave();
      },
    });
    const ownedView = view;
    cleanup = async () => {
      controller.abort();
      await ownedView.close();
    };
    const retiringFocus = document.activeElement === reload;
    reload.hidden = true;
    navigation.clear();
    if (
      retiringFocus &&
      generation === epoch &&
      foreground() &&
      (document.activeElement === reload || document.activeElement === document.body)
    )
      document.getElementById('profile-recovery-find').focus();
  } catch (error) {
    if (generation === epoch && !controller.signal.aborted)
      lease.finish({ message: error.message, state: 'error' });
  } finally {
    clearTimeout(timer);
  }
}
window.addEventListener('pagehide', (event) => {
  epoch++;
  suspended = true;
  stopFrames();
  void cleanup?.();
  if (!event.persisted) {
    closed = true;
    disposeNavigation();
  }
});
window.addEventListener('pageshow', (event) => {
  if (!event.persisted || closed) return;
  leaving = false;
  suspended = false;
  active();
  if (frame === null) frame = requestAnimationFrame(sample);
  void start();
});
frame = requestAnimationFrame(sample);
void start();
