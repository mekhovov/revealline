// Restored from preserved shared snapshot 517df7649; Demo case omitted until its owning input integrates.
// Browser-only verification fixture, excluded from player builds. Commands below
// are controller pulses; selectors identify expected targets, never focus them.
import { currentAuthoringCases } from './authoring-current-workflows.mjs';
const { document, location, Option } = globalThis;
const cases = {
  ...currentAuthoringCases,
  reference: [
    'Reference gallery reading',
    '/game/assets/field-kit/sprites/review.html',
    async (p) => {
      const win = p.doc.defaultView;
      await p.choose('.authoring-reference-read');
      const before = win.scrollY;
      await p.pulse('down');
      if (win.scrollY <= before) throw new Error('Reference page did not scroll');
      await p.pulse('back');
      p.record(
        'read/scroll completed and input returned to navigation',
        '.authoring-reference-read',
      );
      await p.pulse('back');
      await p.wait(() => win.location.pathname === '/authoring/asset-studio/');
      p.record('Back returned to Asset Studio', '.authoring-reference-read');
    },
  ],
  referenceMedia: [
    'Reference media audition',
    '/authoring/library/revealline-original-soundtrack/local-production/audition.html',
    async (p) => {
      const media = p.doc.querySelector('audio');
      if (!media.paused) throw new Error('Reference audio autoplayed');
      // The preserved audition page's candidate MP3s are not in this checkout.
      // Use an existing packaged track only for this test-owned browser case.
      media.src =
        '/game/audio/soundtracks/d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58.mp3';
      media.volume = 0;
      await p.choose('.authoring-reference-media button', 'Play');
      await p.wait(() => !media.paused);
      await p.choose('.authoring-reference-media button', 'Mute');
      if (!media.muted) throw new Error('Reference mute was not applied');
      await p.choose('.authoring-reference-media input');
      const before = media.currentTime;
      await p.pulse('right');
      if (media.currentTime <= before) throw new Error('Reference seek was not applied');
      await p.pulse('back');
      await p.choose('.authoring-reference-media button', 'Pause');
      if (!media.paused) throw new Error('Reference media did not pause');
      p.record(
        'explicit play, mute, seek and pause completed with silent test substitution of an existing packaged track',
        '.authoring-reference-media',
      );
    },
  ],
  referenceSelect: [
    'Reference gallery selectors',
    '/game/presentation/journey-actor-review.html',
    async (p) => {
      const select = p.doc.querySelector('#body-size'),
        before = select.value;
      await p.choose('#body-size');
      await p.pulse('down');
      await p.pulse('confirm');
      if (select.value === before) throw new Error('Gallery selector did not change');
      await p.choose('.authoring-input-rail button', 'Sections');
      await p.pulse('back');
      p.record('gallery body-size selector changed and section dialog canceled', '#body-size');
    },
  ],
  moderation: [
    'Moderation local navigation',
    '/game/community/moderation.html',
    async (p) => {
      await p.choose('.authoring-input-rail button', 'Sections');
      await p.pulse('back');
      p.record(
        'local navigation and cancel available; no sign-in or moderation request submitted',
        '.authoring-input-rail',
      );
    },
  ],
  company: [
    'Company Studio',
    '/authoring/company-studio/',
    async (p) => {
      await p.field('#brand-name', 'a');
      await p.choose('#identity-form button[type="submit"]');
      await p.choose('[data-step="6"]');
      await p.choose('#export-draft-bottom');
      await p.wait(() => p.doc.querySelector('#draft-state').textContent === 'Source exported');
      p.record('identity applied and source draft exported', '#status');
    },
  ],
  playtest: [
    'Company transfer practice',
    '/authoring/company-studio/playtest.html?task=playtest-culture-connection',
    async (p) => {
      await p.choose('#open-practice');
      await p.choose('[data-control="inspect-schedule"]');
      await p.choose('[data-control="inspect-routes"]');
      await p.choose('[data-control="field-connection"]');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.choose('[data-control="commit"]');
      await p.wait(() => p.doc.querySelector('#status').textContent.includes('complete'));
      p.record('reflection configured and committed in local practice', '#status');
      await p.choose('#export-task');
      p.record('task cards exported', '#status');
    },
  ],
  still: [
    'Still Picture Workshop',
    '/authoring/still-media/',
    async (p) => {
      await p.wait(() => !p.doc.querySelector('#still-host-open').disabled);
      if (!p.visible(p.doc.querySelector('#still-media-file'))) await p.choose('#still-host-open');
      await p.choose('#still-media-file');
      await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      await p.field('#still-media-credit', 'a');
      await p.field('#still-media-source', 'a');
      await p.field('#still-media-description', 'a');
      await p.choose('#still-media-preview');
      await p.wait(() => !p.doc.querySelector('#still-media-save').disabled);
      await p.choose('#still-media-save');
      await p.wait(() => !p.doc.querySelector('#still-media-reload').disabled);
      await p.choose('#still-media-reload');
      await p.choose('#still-media-prepare-originals');
      await p.wait(() => p.visible(p.doc.querySelector('#still-media-download-originals')));
      await p.choose('#still-media-download-originals');
      p.record('sample picture assigned, restored and originals exported', '#still-media-status');
    },
  ],
  motion: [
    'Motion Lab',
    '/authoring/motion-lab/',
    async (p) => {
      const previous = p.doc.querySelector('#cruise-speed').value;
      await p.choose('#cruise-speed');
      await p.pulse('right');
      await p.pulse('confirm');
      if (p.doc.querySelector('#cruise-speed').value === previous)
        throw new Error('Speed unchanged');
      await p.choose('#show-grid');
      await p.choose('#arena');
      await p.pulse('right');
      await p.pulse('confirm');
      await p.pulse('back');
      p.record('speed and grid changed, arena steered and paused', '#motion-event');
    },
  ],
  playground: [
    'Playground',
    '/game/playground/',
    async (p) => {
      await p.choose('#map-editor');
      await p.pulse('right');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.pulse('back');
      if (p.doc.querySelector('#undo-button').disabled)
        throw new Error('Map did not enter Undo history');
      await p.choose('#export-button');
      p.record('map cell edited and scenario exported', '#editor-feedback');
    },
  ],
  studio: [
    'Content Studio',
    '/game/studio/',
    async (p) => {
      const previous = p.doc.querySelector('#source').value;
      await p.choose('#board');
      await p.pulse('right');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.pulse('back');
      if (p.doc.querySelector('#source').value === previous)
        throw new Error('Geometry source unchanged');
      await p.choose('#export');
      p.record('geometry form submitted at controller cursor', '#status');
    },
  ],
  asset: [
    'Asset Studio',
    '/authoring/asset-studio/',
    async (p) => {
      await p.wait(() => !p.doc.querySelector('#save-workspace').disabled);
      await p.pulse('menu');
      await p.choose('.authoring-sections-dialog button', 'Panel frame');
      await p.choose('#sprite-panel > summary');
      await p.choose('#new-sprite');
      await p.choose('#sprite-canvas');
      await p.pulse('right');
      await p.pulse('confirm');
      await p.pulse('back');
      if (p.doc.querySelector('#sprite-undo').disabled)
        throw new Error('Sprite did not enter Undo history');
      await p.choose('#use-sprite');
      await p.wait(() => !p.doc.querySelector('#stage-asset').disabled);
      await p.pulse('menu');
      await p.choose('.authoring-sections-dialog button', 'Panel frame');
      await p.field('#asset-creator', 'a');
      await p.field('#asset-license', 'a');
      await p.choose('#stage-asset');
      await p.wait(() => p.doc.querySelector('#stage-asset').disabled);
      await p.pulse('menu');
      await p.choose('.authoring-sections-dialog button', 'Page actions');
      await p.choose('#export-workspace');
      await p.wait(() =>
        p.doc.querySelector('#studio-status').textContent.includes('Theme download requested'),
      );
      p.record('blank sprite painted, staged and theme exported', '#studio-status');
    },
  ],
  creator: [
    'Picture Creator',
    '/game/creator/',
    async (p) => {
      await p.choose('#image');
      await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      await p.wait(() => !p.doc.querySelector('#generate').disabled);
      await p.choose('#generate');
      await p.wait(() => p.visible(p.doc.querySelector('#approve')), 30000);
      await p.choose('#approve');
      await p.wait(() => !p.doc.querySelector('#download').disabled);
      await p.choose('#download');
      p.record('sample picture generated and approved', '#status');
    },
  ],
  team: [
    'Team Creator',
    '/game/creator/team.html',
    async (p) => {
      await p.field('#seed', '+1');
      await p.choose('#generate');
      await p.wait(() => p.visible(p.doc.querySelector('#media-panel')), 30000);
      const count = p.doc.querySelectorAll('#team-levels .team-level-card').length;
      for (let index = 1; index <= count; index++) {
        await p.choose(`#team-levels .team-level-card:nth-child(${index}) input[accept^="image"]`);
        await p.choose('.authoring-source-dialog button', 'Dawn Signal picture');
      }
      await p.choose('#review');
      await p.wait(() => p.visible(p.doc.querySelector('#approve')), 30000);
      await p.choose('#approve');
      await p.wait(() => !p.doc.querySelector('#download').disabled);
      await p.choose('#download');
      p.record('changed seed and sample pictures reviewed, approved and exported', '#status');
    },
  ],
  enemy: [
    'Enemy Workshop',
    '/authoring/enemy-catalog/',
    async (p) => {
      await p.wait(() => !p.doc.querySelector('#open-catalog').disabled);
      await p.choose('#enemy-catalog-style');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.choose('#enemy-catalog-apply');
      await p.wait(() => !p.doc.querySelector('#enemy-catalog-export').disabled);
      await p.choose('#enemy-catalog-undo');
      await p.choose('#enemy-catalog-export');
      await p.wait(() => !p.doc.querySelector('#enemy-catalog-export').disabled);
      p.record('catalog style edited, saved, restored and exported', '#enemy-catalog-status');
      await p.pulse('back');
      await p.choose('#open-catalog');
      p.record('catalog closed and reopened', 'dialog[open]');
    },
  ],
  video: [
    'Video Poster',
    '/authoring/video-poster/',
    async (p) => {
      await p.choose('#video-poster-file');
      await p.choose('.authoring-source-dialog button', 'Dawn Signal video');
      await p.wait(() => !p.doc.querySelector('#video-poster-capture').disabled);
      await p.choose('#video-poster-capture');
      await p.wait(() => p.visible(p.doc.querySelector('#video-poster-download')));
      await p.choose('#video-poster-download');
      p.record('video inspected, poster captured and download requested', '#video-poster-evidence');
    },
  ],
  atlas: [
    'Design Atlas',
    '/authoring/design-atlas/',
    async (p) => {
      await p.choose('#screen-select');
      await p.pulse('down');
      await p.pulse('confirm');
      await p.choose('[data-language="uk"]');
      p.record('screen study changed and Ukrainian specimen selected', '#screen-preview');
    },
  ],
  production: [
    'Production Register',
    '/authoring/production/',
    async (p) => {
      await p.field('input[type="search"]', 'a');
      await p.choose('tbody button');
      p.record('filter edited and production provenance inspected', '#production-detail');
      await p.choose('#production-detail button', 'Back to slots');
      p.record('returned to filtered slots', '.pager');
    },
  ],
  viewport: [
    'Viewport Lab',
    '/authoring/viewport-lab/',
    async (p) => {
      const previous = p.doc.querySelector('#preset').value;
      await p.choose('#preset');
      await p.pulse('down');
      await p.pulse('confirm');
      if (p.doc.querySelector('#preset').value === previous)
        throw new Error('Viewport preset unchanged');
      await p.choose('#load-target');
      await p.wait(() => p.doc.querySelector('#game-frame').getAttribute('src') !== 'about:blank');
      p.record('viewport preset changed and selected game loaded', '#dimensions');
    },
  ],
};

const selector = document.getElementById('tool'),
  status = document.getElementById('status'),
  frame = document.getElementById('host');
for (const [id, [name]] of Object.entries(cases)) selector.add(new Option(name, id));
if (cases[new URL(location.href).searchParams.get('tool')])
  selector.value = new URL(location.href).searchParams.get('tool');
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let stopFocusTrace = () => {};
function traceKeyboardFocus(win) {
  const output = document.getElementById('focus-evidence'),
    records = [],
    removers = [],
    seen = new WeakSet();
  let tracing = true;
  const identify = (element) => element?.id || element?.tagName || null;
  const describe = (element) => ({
    id: element?.id || null,
    tag: element?.tagName || null,
    className: element?.className || null,
    text: element?.textContent?.trim().slice(0, 100) || null,
  });
  const state = (target, depth = 0) => {
    try {
      const doc = target.document;
      return {
        path: target.location.pathname,
        active: identify(doc.activeElement),
        activeControl: describe(doc.activeElement),
        hasFocus: doc.hasFocus(),
        hidden: doc.hidden,
        children:
          depth < 2
            ? [...doc.querySelectorAll('iframe')].map((frame) =>
                state(frame.contentWindow, depth + 1),
              )
            : [],
      };
    } catch {
      return { inaccessible: true };
    }
  };
  const record = (label, event) => {
    if (!tracing) return;
    records.push({
      label,
      type: event?.type,
      key: event?.key,
      target: identify(event?.target),
      phase: event?.eventPhase,
      prevented: event?.defaultPrevented,
      state: state(win),
    });
    if (records.length > 80) records.shift();
    output.textContent = JSON.stringify(records, null, 2);
  };
  const listen = (target, type, handler) => {
    target.addEventListener(type, handler, true);
    removers.push(() => target.removeEventListener(type, handler, true));
  };
  const attach = (target, depth = 0) => {
    try {
      if (seen.has(target.document)) return;
      seen.add(target.document);
      for (const type of ['focus', 'focusin', 'keydown'])
        listen(target, type, (event) => {
          record(`capture:${depth}`, event);
          // Native event listeners may checkpoint microtasks between callbacks.
          // A later task observes the settled propagation/default state.
          setTimeout(() => record(`after-dispatch:${depth}`, event), 0);
        });
      for (const child of target.document.querySelectorAll('iframe')) {
        listen(child, 'load', () => {
          attach(child.contentWindow, depth + 1);
          record(`load:${depth + 1}`);
        });
        attach(child.contentWindow, depth + 1);
      }
    } catch {
      /* The trace never crosses an origin boundary. */
    }
  };
  attach(win);
  record('initial');
  return () => {
    tracing = false;
    removers.forEach((remove) => remove());
  };
}
document.getElementById('run').onclick = async () => {
  stopFocusTrace();
  document.getElementById('focus-evidence').textContent = '';
  const [name, path, workflow] = cases[selector.value],
    rows = [];
  status.textContent = `Running ${name}…`;
  const loaded = new Promise((resolve) => frame.addEventListener('load', resolve, { once: true }));
  frame.src = path;
  await loaded;
  const win = frame.contentWindow,
    doc = frame.contentDocument;
  if (new URL(location.href).searchParams.has('keyboard') && selector.value !== 'referenceMedia') {
    stopFocusTrace = traceKeyboardFocus(win);
    status.textContent =
      'Native keyboard fixture ready; no virtual pad installed. Follow the current workflow checklist and retain its separate keyboard receipt.';
    return;
  }
  if (selector.value === 'referenceMedia' && new URL(location.href).searchParams.has('keyboard')) {
    const media = doc.querySelector('audio');
    media.src =
      '/game/audio/soundtracks/d4147214e221be28f19d6c6c38afc8d3cf0289a0dc6ac579b26574a0c571bc58.mp3';
    media.volume = 0;
    status.textContent =
      'Native keyboard media fixture ready; no virtual pad installed. Existing packaged track substituted silently for absent archival candidate audio.';
    return;
  }
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const pad = {
    id: 'Authoring verification virtual standard pad',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons,
    timestamp: performance.now(),
  };
  const installPad = (targetWindow) => {
    Object.defineProperty(targetWindow.navigator, 'getGamepads', {
      configurable: true,
      value: () => [pad],
    });
    for (const child of targetWindow.document.querySelectorAll('iframe')) {
      const install = () => {
        try {
          installPad(child.contentWindow);
        } catch {
          /* origin boundary */
        }
      };
      child.addEventListener('load', install);
      install();
    }
  };
  installPad(win);
  // Observe actual export bytes without replacing the download or editor path.
  const downloads = [],
    createObjectURL = win.URL.createObjectURL;
  win.URL.createObjectURL = function (blob) {
    const url = createObjectURL.call(this, blob);
    downloads.push({ blob, url });
    return url;
  };
  frame.focus();
  win.focus();
  const visible = (e) =>
    e && e.getClientRects().length && !e.closest('[hidden],[inert]') && !e.disabled;
  const pulse = async (command) => {
    const index = { confirm: 0, back: 1, menu: 9, up: 12, down: 13, left: 14, right: 15 }[command];
    buttons[index] = { pressed: true, touched: true, value: 1 };
    pad.timestamp = performance.now();
    await wait(60);
    buttons[index] = { pressed: false, touched: false, value: 0 };
    pad.timestamp = performance.now();
    await wait(60);
  };
  const until = async (predicate, timeout = 15000) => {
    const start = performance.now();
    while (!predicate()) {
      if (performance.now() - start > timeout) throw new Error('Expected page state timed out');
      await wait(50);
    }
  };
  const target = (css, label) =>
    [...doc.querySelectorAll(css)].find(
      (e) => visible(e) && (!label || e.textContent.trim() === label),
    );
  const navigate = async (css, label) => {
    await until(() => target(css, label));
    const element = target(css, label),
      started = performance.now();
    const seen = new Set();
    for (let step = 0; step < 1500 && doc.activeElement !== element; step++) {
      const active = doc.activeElement;
      if (performance.now() - started > 30000)
        throw new Error(
          `Controller traversal exceeded 30 seconds for ${css}; current ${active.id || active.textContent?.slice(0, 80)}`,
        );
      if (active.tagName === 'IFRAME') {
        const child = active.contentDocument;
        installPad(active.contentWindow);
        await pulse('menu');
        await until(() => child.querySelector('.authoring-preview-return'));
        const back = child.querySelector('.authoring-preview-return');
        for (let i = 0; i < 200 && child.activeElement !== back; i++) await pulse('down');
        if (child.activeElement !== back) throw new Error('Preview return action unreachable');
        await pulse('confirm');
        continue;
      }
      const panel = active.closest?.('.controller-field-editor');
      if (panel) {
        const rows = [
          [panel.querySelector('[data-editor-draft]')],
          ...[...panel.querySelectorAll('.controller-field-editor-row')].map((r) => [
            ...r.children,
          ]),
        ];
        const from = rows.findIndex((r) => r.includes(active)),
          to = rows.findIndex((r) => r.includes(element));
        if (from < 0 || to < 0) throw new Error('Field target outside active editor');
        await pulse(
          from === to
            ? rows[from].indexOf(active) < rows[to].indexOf(element)
              ? 'right'
              : 'left'
            : from < to
              ? 'down'
              : 'up',
        );
      } else {
        if (seen.has(active))
          throw new Error(
            `Controller cannot reach ${css} (${label || ''}) from ${active.id || active.textContent?.slice(0, 40)}`,
          );
        seen.add(active);
        await pulse(active.compareDocumentPosition(element) & 2 ? 'up' : 'down');
      }
    }
    if (doc.activeElement !== element)
      throw new Error(`Controller traversal exceeded budget for ${css}`);
  };
  const choose = async (css, label) => {
    status.textContent = `Running ${name}: ${css} ${label || ''}…`;
    await navigate(css, label);
    await pulse('confirm');
  };
  try {
    await wait(150);
    if (['enemy', 'video', 'still'].includes(selector.value)) await pulse('confirm'); // Existing workshop hosts consume their join edge.
    await wait(100);
    const p = {
      doc,
      visible,
      pulse,
      choose,
      downloads,
      wait: until,
      async expand(css) {
        if (!doc.querySelector(css).open) await choose(`${css} > summary`);
      },
      async section(heading) {
        await pulse('menu');
        await choose(
          '.authoring-sections-dialog button',
          doc.querySelector(heading).textContent.trim(),
        );
      },
      async pageActions() {
        await pulse('menu');
        await choose('.authoring-sections-dialog button:nth-of-type(2)');
      },
      async select(css, value) {
        const element = doc.querySelector(css),
          options = [...element.options].filter((option) => !option.disabled),
          current = options.findIndex((option) => option.value === element.value),
          next = options.findIndex((option) => option.value === value);
        if (next < 0) throw new Error(`Missing select choice ${css}: ${value}`);
        await choose(css);
        for (let n = 0; n < Math.abs(current - next); n++)
          await pulse(next > current ? 'down' : 'up');
        await pulse('confirm');
        if (element.value !== value) throw new Error(`Select did not commit ${css}: ${value}`);
      },
      async edit(css, keys, { cancel = false } = {}) {
        await choose(css);
        await choose('[data-editor-action="en"]');
        for (const key of keys) await choose(`[data-editor-action="${key}"]`);
        if (cancel) await pulse('back');
        else await choose('[data-editor-action="done"]');
      },
      async field(css, key) {
        await choose(css);
        await choose(`[data-editor-action="${key}"]`);
        await choose('[data-editor-action="done"]');
      },
      record(message, css, evidence = {}) {
        rows.push({
          message,
          focused: doc.activeElement?.id || doc.activeElement?.textContent?.slice(0, 80),
          state: doc.querySelector(css)?.textContent?.trim().slice(0, 1000),
          ...evidence,
        });
        status.textContent = JSON.stringify(rows, null, 2);
      },
    };
    await workflow(p);
    status.textContent = JSON.stringify({ result: 'PASS', tool: name, rows }, null, 2);
  } catch (error) {
    status.textContent = JSON.stringify(
      {
        result: 'FAIL',
        tool: name,
        error: error.message,
        focused: doc.activeElement?.outerHTML?.slice(0, 600),
        rows,
      },
      null,
      2,
    );
  } finally {
    win.URL.createObjectURL = createObjectURL;
    for (let i = 0; i < buttons.length; i++)
      buttons[i] = { pressed: false, touched: false, value: 0 };
  }
};
