import { createEnemyCatalogInput } from '../../game/ui/enemy-catalog-input.mjs';
import { attachEnemyWorkshopReturnHost } from '../../game/ui/enemy-workshop-return.mjs';
import { attachEnemyCatalogPanel } from '../../game/ui/enemy-catalog-panel.mjs';
import { attachControllerNavigation } from '../../game/ui/controller-navigation.mjs';
import { createControllerRouter } from '../../game/ui/controller-router.mjs';
import { emptyEnemyCatalogDraft, validateEnemyCatalogDraft } from '../../game/enemy-catalog.mjs';
import { createEnemyCatalogScenario } from '../../game/enemy-catalog-scenarios.mjs';
import { prepareScenario } from '../../game/imports.mjs';

const key = 'revealline.authoring.enemy-catalog.v1',
  status = document.getElementById('catalog-host-status'),
  frame = document.getElementById('catalog-practice');
let panel = null,
  navigation = null,
  router = null,
  menuInput = null,
  raf = null,
  last = 0;
async function start() {
  const response = await fetch('../../game/content/themes.json');
  if (!response.ok) throw new Error('Registered themes could not be loaded.');
  const { themes } = await response.json();
  const practiceReturn = attachEnemyWorkshopReturnHost({
    frame,
    onReturn: () => {
      menuInput.clear();
      document.getElementById('open-catalog').focus();
      panel.open();
      navigation.sync();
      status.textContent = 'Returned to the same workshop draft. Practice has ended.';
    },
  });
  let initial = emptyEnemyCatalogDraft();
  try {
    const text = localStorage.getItem(key);
    if (text) initial = validateEnemyCatalogDraft(JSON.parse(text));
  } catch {
    status.textContent = 'Saved choices unavailable; using the default authoring catalog.';
  }
  panel = attachEnemyCatalogPanel({
    initialDraft: initial,
    onRead: (request) => navigation.beginReading(request),
    onError: (error) => {
      status.textContent = error.message;
    },
    onApplyDraft: (draft) => {
      localStorage.setItem(key, JSON.stringify(draft));
      status.textContent = 'Future authoring choices saved locally.';
    },
    onExport: (draft) => {
      const blob = new Blob([JSON.stringify(draft, null, 2)], { type: 'application/json' }),
        url = URL.createObjectURL(blob),
        link = document.createElement('a');
      link.href = url;
      link.download = 'RevealLine-enemy-catalog.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    },
    onPreview: async (type, draft) => {
      const prepared = await prepareScenario(createEnemyCatalogScenario(type, draft, themes));
      sessionStorage.setItem('revealline.playground.current', JSON.stringify(prepared.scenario));
      frame.src = practiceReturn.launchURL();
      frame.hidden = false;
      // Close after the panel's async operation has released its busy guard.
      setTimeout(() => {
        panel.close();
        frame.focus();
      }, 0);
      status.textContent =
        'Separate practice loaded. Pause and choose Return to workshop to keep editing this draft. Campaign progress is untouched.';
    },
  });
  router = createControllerRouter();
  navigation = attachControllerNavigation({
    getScope: () => (panel.dialog.open ? 'enemy-catalog' : 'catalog-page'),
    getRoot: () => (panel.dialog.open ? panel.dialog : document),
    getDefaultFocus: () =>
      document.getElementById(panel.dialog.open ? 'enemy-catalog-role' : 'open-catalog'),
    onBack: () => panel.close(),
    keyboard: true,
    onNativeInput: () => menuInput?.clear(),
    onHint: (text) => {
      status.textContent = text;
    },
  });
  menuInput = createEnemyCatalogInput({
    document,
    frame,
    router,
    navigation,
    getScope: () => (panel.dialog.open ? 'enemy-catalog' : 'catalog-page'),
  });
  document.getElementById('open-catalog').onclick = () => {
    panel.open();
    navigation.sync();
  };
  const blur = () => router.clear();
  window.addEventListener('blur', blur);
  function loop(now) {
    const elapsed = last ? (now - last) / 1000 : 0;
    last = now;
    const ownsInput = menuInput.poll(now);
    panel.update(elapsed, {
      paused: !ownsInput,
      reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
    });

    raf = requestAnimationFrame(loop);
  }
  window.addEventListener('pagehide', (event) => {
    cancelAnimationFrame(raf);
    router.clear();
    if (!event.persisted) {
      practiceReturn.dispose();
      panel.dispose();
      router.destroy();
      navigation.destroy();
      window.removeEventListener('blur', blur);
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      last = 0;
      raf = requestAnimationFrame(loop);
    }
  });
  status.textContent = 'Seven behavior roles and four original presentation families ready.';
  panel.open();
  raf = requestAnimationFrame(loop);
}
start().catch((error) => {
  status.textContent = `Workshop unavailable: ${error.message}`;
});
