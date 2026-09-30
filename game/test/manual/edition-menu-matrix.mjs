// Browser-only rendered source acceptance. This measures actual host DOM/CSS;
// it does not establish keyboard/controller journeys or offline packages.
const { document, localStorage } = globalThis;
const frame = document.getElementById('host');
const button = document.getElementById('run');
const status = document.getElementById('status');
const inventory = await fetch('/docs/native-menu-inventory.json').then((r) => r.json());
const keys = ['revealline.locale.v1', 'revealline.menu-style.v1', 'revealline.display.v1'];
const wait = async (read, message) => {
  const end = Date.now() + 20000;
  while (Date.now() < end) {
    if (read()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(message);
};
const visible = (node) =>
  node &&
  node.getClientRects().length &&
  node.ownerDocument.defaultView.getComputedStyle(node).visibility !== 'hidden';
const measure = (edition, locale, palette, width, height) => {
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  const root = doc.getElementById('shell-home');
  const title = doc.getElementById('shell-title');
  const actions = [...root.querySelectorAll('.native-menu-actions button')].filter(visible);
  const modes = [...root.querySelectorAll('.game-mode-choice a, .game-mode-choice button')].filter(
    visible,
  );
  const fullscreen = root.querySelector('.native-menu-fullscreen');
  const art = root.querySelector('.menu-scene-art');
  const essentials = [title, ...actions, ...modes, fullscreen].filter(visible);
  const rects = essentials.map((node) => {
    const rect = node.getBoundingClientRect();
    return {
      id: node.id,
      label: node.textContent.trim(),
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      right: rect.right,
      bottom: rect.bottom,
    };
  });
  const checks = {
    editionIdentity: title.textContent.replace(/\s+/g, ' ').trim() === edition.title,
    sceneIdentity: root.dataset.menuScene === edition.scene,
    locale: doc.documentElement.lang === locale,
    palette: doc.body.dataset.menuPalette === (palette === 'auto' ? 'neon' : 'field-kit'),
    fourActions: actions.length === 4,
    soloOnly: modes.length === 1 && modes[0].getAttribute('aria-current') === 'page',
    fullscreenReachable: visible(fullscreen) && !fullscreen.disabled,
    icons: [...actions, ...modes, fullscreen].every((node) => node.dataset.menuIcon),
    minimumTargets: [...actions, ...modes, fullscreen].every(
      (node) => node.getBoundingClientRect().height >= 44,
    ),
    essentialFit: rects.every(
      (rect) =>
        rect.x >= -1 && rect.y >= -1 && rect.right <= width + 1 && rect.bottom <= height + 1,
    ),
    noHorizontalOverflow:
      root.scrollWidth <= root.clientWidth + 1 && doc.documentElement.scrollWidth <= width + 1,
    artworkDecoded: art.complete && art.naturalWidth > 0,
    titleWrapping: win.getComputedStyle(title).wordBreak === 'normal',
  };
  return {
    edition: edition.id,
    locale,
    palette,
    width,
    height,
    passed: Object.values(checks).every(Boolean),
    checks,
    rects,
    artwork: {
      src: new URL(art.currentSrc).pathname,
      width: art.naturalWidth,
      height: art.naturalHeight,
    },
  };
};
button.addEventListener('click', async () => {
  button.disabled = true;
  const previous = new Map(keys.map((key) => [key, localStorage.getItem(key)]));
  const results = [];
  try {
    localStorage.setItem(
      keys[2],
      JSON.stringify({ textFace: 'pixel', textSize: 'standard', reducedEffects: true }),
    );
    for (const edition of inventory.editions) {
      for (const locale of ['en', 'uk']) {
        for (const palette of ['auto', 'ukrainian']) {
          localStorage.setItem(keys[0], locale);
          localStorage.setItem(keys[1], JSON.stringify({ palette, ornaments: 'subtle' }));
          for (const [width, height] of [
            [390, 844],
            [844, 390],
          ]) {
            status.textContent = `Running ${edition.id} / ${locale} / ${palette} / ${width}×${height}; ${results.length} complete`;
            frame.width = width;
            frame.height = height;
            frame.src = edition.routes[0];
            await new Promise((resolve, reject) => {
              const timer = setTimeout(() => reject(new Error('Frame load timed out')), 20000);
              frame.addEventListener(
                'load',
                () => {
                  clearTimeout(timer);
                  resolve();
                },
                { once: true },
              );
            });
            await wait(() => {
              const root = frame.contentDocument?.getElementById('shell-home');
              const art = root?.querySelector('.menu-scene-art');
              return (
                root?.open &&
                root.dataset.menuScene === edition.scene &&
                art?.complete &&
                art.naturalWidth > 0
              );
            }, `Edition not ready: ${edition.id}`);
            await frame.contentDocument.fonts.ready;
            await new Promise((resolve) =>
              frame.contentWindow.requestAnimationFrame(() =>
                frame.contentWindow.requestAnimationFrame(resolve),
              ),
            );
            results.push(measure(edition, locale, palette, width, height));
          }
        }
      }
    }
    status.textContent = JSON.stringify(
      {
        passed: results.every((r) => r.passed),
        count: results.length,
        failures: results.filter((r) => !r.passed),
        results,
      },
      null,
      2,
    );
  } catch (error) {
    status.textContent = JSON.stringify({ passed: false, error: error.message, results }, null, 2);
  } finally {
    frame.src = 'about:blank';
    for (const [key, value] of previous) {
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value);
    }
    button.disabled = false;
  }
});
