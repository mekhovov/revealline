import { createProfileChannelReader } from './profile-channel-reader.mjs';
import { attachProfileRecoveryView } from './ui/profile-recovery.mjs';
import { attachControllerNavigation } from './ui/controller-navigation.mjs';
import { createControllerRouter } from './ui/controller-router.mjs';

let cleanup = null,
  epoch = 0;
document.getElementById('profile-recovery-back').onclick = () => location.assign('./index.html');
async function start() {
  const generation = ++epoch;
  await cleanup?.();
  if (generation !== epoch) return;
  const controller = new AbortController();
  cleanup = async () => controller.abort();
  const timer = setTimeout(() => {
    if (generation === epoch)
      document.getElementById('profile-recovery-status').textContent =
        'Release information timed out. Use Back and try recovery again.';
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
    const reader = createProfileChannelReader({ currentVersion: info.version });
    const root = document.getElementById('profile-recovery-root');
    const view = attachProfileRecoveryView({
      reader,
      onBack: () => location.assign('./index.html'),
    });
    const navigation = attachControllerNavigation({
      getScope: () => 'menu',
      getRoot: () => root,
      getDefaultFocus: () => document.getElementById('profile-recovery-find'),
      onBack: () => document.getElementById('profile-recovery-back').click(),
      keyboard: true,
    });
    const router = createControllerRouter();
    let frame,
      stopped = false;
    function sample(timeMs) {
      if (stopped) return;
      navigation.handle(router.sample({ scope: 'menu', timeMs }).ui);
      frame = requestAnimationFrame(sample);
    }
    const inactive = () => {
      view.cancel();
      router.clear();
    };
    window.addEventListener('blur', inactive);
    frame = requestAnimationFrame(sample);
    cleanup = async () => {
      stopped = true;
      controller.abort();
      cancelAnimationFrame(frame);
      window.removeEventListener('blur', inactive);
      router.destroy();
      navigation.destroy();
      await view.close();
    };
  } catch (error) {
    if (generation === epoch && !controller.signal.aborted)
      document.getElementById('profile-recovery-status').textContent = error.message;
  } finally {
    clearTimeout(timer);
  }
}
window.addEventListener('pagehide', () => {
  epoch++;
  void cleanup?.();
});
window.addEventListener('pageshow', (event) => {
  if (event.persisted) void start();
});
void start();
