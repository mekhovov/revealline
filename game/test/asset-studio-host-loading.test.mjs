import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document, Element, Events } from './helpers/couch-dom.mjs';
import { memoryIndexedDB } from './helpers/soundtrack-fixtures.mjs';
import { createStudioStore, STUDIO_DATABASE } from '../presentation/studio-store.mjs';
import { iconForSlot } from '../presentation/icons.mjs';
import { encodeSpritePNG } from '../../scripts/produce-field-kit-sprites.mjs';
import { hashPresentationBytes } from '../presentation/bundle.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { DISPLAY_PREFERENCES_KEY } from '../display-preferences.mjs';
import { AUDIO_PREFERENCES_KEY } from '../audio-preferences.mjs';
import { audioHarness } from './helpers/soundtrack-audio.mjs';
import { createDefaultThemeBundle } from '../presentation/catalog.mjs';
import { reviseStudioTheme } from '../presentation/studio-session.mjs';
import { resolvePresentation } from '../presentation/model.mjs';
import { STUDIO_VIEW_KEY } from '../../authoring/asset-studio/view-memory.mjs';

const flush = () => new Promise((resolve) => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
};
const until = (predicate) =>
  waitFor(predicate, { message: 'Studio operation did not reach the expected state.' });
function mount(doc, html) {
  const stack = [doc.body];
  for (const [token] of html
    .split(/<body\b[^>]*>/)[1]
    .split('</body>')[0]
    .matchAll(/<!--[\s\S]*?-->|<\/?[^>]+>|[^<]+/g)) {
    if (token.startsWith('<!--')) continue;
    if (token.startsWith('</')) {
      stack.pop();
      continue;
    }
    if (!token.startsWith('<')) {
      // Native option.value defaults to its text when no value attribute exists.
      const current = stack.at(-1);
      if (current.tagName === 'OPTION') {
        current.textContent += token.trim();
        if (!current.hasAttribute('value')) current.value = current.textContent;
      }
      continue;
    }
    const tag = token.match(/^<([\w-]+)/)[1];
    const element = doc.createElement(tag);
    for (const [, name, quoted, bare] of token
      .slice(tag.length + 1, -1)
      .matchAll(/([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|([^\s]+)))?/g)) {
      const value = quoted ?? bare ?? '';
      element.setAttribute(name, value);
      if (name === 'class') element.className = value;
      if (name.startsWith('data-'))
        element.dataset[name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
      if (['type', 'value'].includes(name)) element[name] = value;
      if (['hidden', 'disabled', 'checked', 'inert'].includes(name)) element[name] = true;
    }
    stack.at(-1).append(element);
    if (!['meta', 'link', 'input', 'br', 'img', 'hr'].includes(tag)) stack.push(element);
  }
}

test('actual Studio handlers show startup/read/encode stages, cancel a late upload, and save exact source bytes in Studio storage only', async (t) => {
  const pixels = iconForSlot('icon.play');
  const bytes = encodeSpritePNG(pixels);
  // Load a real verified release document, not only the source-name defaults:
  // the approved field-kit identity must survive a later custom upload.
  const base = createDefaultThemeBundle(),
    publishedSlot = base.slots[0],
    publishedBytes = encodeSpritePNG(iconForSlot('icon.pause')),
    publishedHash = await hashPresentationBytes(publishedBytes);
  const produced = {
    ...structuredClone(base.assets[0]),
    id: `${publishedSlot.id}.field-kit`,
    kind: 'image',
    recipe: null,
    geometry: publishedSlot.geometry,
    file: {
      sha256: publishedHash,
      bytes: publishedBytes.length,
      mime: 'image/png',
      width: 24,
      height: 24,
    },
    quality: { stage: 'produced', evidence: [] },
  };
  const approved = {
    ...produced,
    revision: 2,
    quality: {
      stage: 'reviewed',
      evidence: ['Fixture slot geometry and exact PNG bytes checked.'],
    },
  };
  const published = reviseStudioTheme(
    reviseStudioTheme(base, {
      assets: [produced],
      bindings: { [publishedSlot.id]: { id: produced.id, revision: 1 } },
    }),
    { assets: [approved], bindings: { [publishedSlot.id]: { id: approved.id, revision: 2 } } },
  );
  const doc = new Document(),
    window = new Events();
  const historyWrites = [];
  window.history = {
    state: {
      unrelatedOwner: { retained: true },
      [STUDIO_VIEW_KEY]: {
        version: 1,
        selected: 'icon.play',
        filters: {
          query: 'icon.play',
          screen: 'flight',
          state: 'default',
          kind: 'recipe',
          quality: 'source',
        },
      },
    },
    replaceState(value, title, ...url) {
      this.state = structuredClone(value);
      historyWrites.push({ title, url });
    },
  };
  const readGate = deferred(),
    decodeGate = deferred(),
    startupGate = deferred();
  let encodeGate = deferred();
  let delayRead = false,
    delayDecode = false,
    delayEncode = false,
    cancelledReads = 0,
    lateClosed = 0,
    narrow = false;
  const opened = [];
  const db = memoryIndexedDB();
  const indexedDB = {
    open(name, version) {
      opened.push(name);
      const inner = db.indexedDB.open(name, version),
        request = {};
      inner.onupgradeneeded = (event) => {
        request.result = inner.result;
        request.transaction = inner.transaction;
        request.onupgradeneeded?.(event);
      };
      inner.onsuccess = () => {
        request.result = inner.result;
        startupGate.promise.then(() => request.onsuccess?.());
      };
      inner.onerror = () => {
        request.error = inner.error;
        request.onerror?.();
      };
      return request;
    },
  };
  class StudioElement extends Element {
    constructor(document, tag) {
      super(document, tag);
      this.style.getPropertyValue = (name) => this.style[name] || '';
      this.style.removeProperty = (name) => delete this.style[name];
    }
    remove() {
      // Real browsers return focus to the body when a focused subtree is removed.
      const lostFocus = this.isConnected && this.contains(this.ownerDocument.activeElement);
      super.remove();
      if (lostFocus) this.ownerDocument.activeElement = this.ownerDocument.body;
    }
    getContext() {
      return new Proxy(
        {
          putImageData: (value) => {
            this.paintedPixels = new Uint8ClampedArray(value.data);
          },
          drawImage: (bitmap) => {
            this.drawnBlob = bitmap.blob;
          },
          getImageData: () => ({
            width: this.width,
            height: this.height,
            data: new Uint8ClampedArray(pixels.rgba),
          }),
        },
        {
          get(target, name) {
            return target[name] ?? (() => {});
          },
        },
      );
    }
    toBlob(callback) {
      if (delayEncode)
        encodeGate.promise.then(() => callback(new Blob([bytes], { type: 'image/png' })));
      else callback(new Blob([bytes], { type: 'image/png' }));
    }
    toDataURL() {
      return `data:image/png;base64,${Buffer.from(bytes).toString('base64')}`;
    }
  }
  doc.createElement = (tag) => new StudioElement(doc, tag);
  doc.createDocumentFragment = () => new StudioElement(doc, 'fragment');
  class Reader {
    readAsDataURL(blob) {
      this.pending = (async () => {
        const read = Buffer.from(await blob.arrayBuffer());
        if (delayRead) await readGate.promise;
        if (this.aborted) return;
        this.result = `data:image/png;base64,${read.toString('base64')}`;
        this.onload();
      })();
    }
    abort() {
      this.aborted = true;
      cancelledReads++;
    }
  }
  const preferenceWrites = [];
  const sharedPreferences = new Map([
    [AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: true, volume: 0.13 })],
  ]);
  const systemMotion = new Events();
  systemMotion.matches = false;
  const matchMedia = (query) =>
    query === '(prefers-reduced-motion: reduce)'
      ? systemMotion
      : { matches: query === '(max-width: 700px)' && narrow };
  window.matchMedia = matchMedia;
  let denyPreferenceSave = false;
  const localStorage = {
    getItem: (key) => sharedPreferences.get(key) ?? null,
    setItem(key, value) {
      preferenceWrites.push([key, value]);
      assert.ok(
        [DISPLAY_PREFERENCES_KEY, AUDIO_PREFERENCES_KEY].includes(key),
        'Interface choices never write Solo progress.',
      );
      if (denyPreferenceSave) throw new Error('Preference storage is unavailable.');
      sharedPreferences.set(key, value);
    },
  };
  const auditionContexts = [];
  let delayAudition = false;
  const globals = {
    AudioContext: function () {
      const harness = audioHarness(),
        gate = deferred();
      if (delayAudition)
        harness.context.resume = () =>
          gate.promise.then(() => {
            if (harness.context.state !== 'closed') harness.context.state = 'running';
          });
      auditionContexts.push({ ...harness, gate });
      return harness.context;
    },
    localStorage,
    document: doc,
    window,
    indexedDB,
    FileReader: Reader,
    ImageData: class {
      constructor(data, width, height) {
        Object.assign(this, { data, width, height });
      }
    },
    matchMedia,
    fetch: async (url) =>
      String(url).endsWith('/compiled/studio.json')
        ? new Response(JSON.stringify(published))
        : String(url).endsWith(`/compiled/assets/${publishedHash}.png`)
          ? new Response(publishedBytes)
          : new Response('', { status: 404 }),
    createImageBitmap: async (blob) => {
      if (delayDecode) {
        await decodeGate.promise;
        return {
          width: 24,
          height: 24,
          blob,
          close() {
            lateClosed++;
          },
        };
      }
      return { width: 24, height: 24, blob, close() {} };
    },
    cancelAnimationFrame() {},
  };
  const previous = Object.fromEntries(Object.keys(globals).map((key) => [key, globalThis[key]]));
  Object.assign(globalThis, globals);
  t.after(() => {
    window.emit('pagehide', { persisted: false });
    Object.assign(globalThis, previous);
  });
  mount(
    doc,
    await readFile(new URL('../../authoring/asset-studio/index.html', import.meta.url), 'utf8'),
  );
  const $ = (id) => doc.getElementById(id);
  const message = () => $('studio-status').querySelector('.operation-status-label').textContent;
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
    'studio-interface-font',
    'studio-interface-size',
    'studio-interface-reduced',
  ])
    assert.equal($(id).disabled, true, `${id} is disabled before the Studio module owns it`);
  assert.equal($('studio-status').querySelector('.operation-status-signal').children.length, 3);
  assert.equal(
    $('studio-guide-close')?.hidden,
    true,
    'Close is unavailable before its helper mounts.',
  );
  await import(`../../authoring/asset-studio/studio.mjs?loading-host=${Date.now()}`);
  assert.match(message(), /Loading saved Studio/);
  const guide = $('studio-guide'),
    guideOpen = $('studio-guide-open'),
    guideClose = $('studio-guide-close');
  assert.ok(guide, 'Studio has an in-page guide instead of navigating away from edits.');
  assert.equal(guide.tagName, 'DETAILS');
  assert.equal(guideOpen.tagName, 'SUMMARY');
  assert.equal(
    guide.closest('header'),
    doc.querySelector('header'),
    'Guide stays in the stable header above asynchronously populated workspace content.',
  );
  const inDocumentOrder = (element) => [element, ...element.children.flatMap(inDocumentOrder)];
  const documentOrder = inDocumentOrder(doc.body);
  for (const selector of ['.workspace-state', 'main']) {
    const dynamicRegion = doc.querySelector(selector);
    assert.ok(dynamicRegion);
    assert.ok(documentOrder.indexOf(guide) < documentOrder.indexOf(dynamicRegion));
  }
  assert.equal(
    guide.closest(
      '.workspace-actions,.workspace-state,.inventory,#replacement-panel,#sprite-panel,#token-form,#asset-history,#review-panel',
    ),
    null,
    'Stable placement does not put help inside an operation-owned mutation region.',
  );
  const openGuide = () => {
    guideOpen.focus();
    // Model only the browser's native <details> toggle boundary. Native
    // Enter/Tab behavior and layout are qualified separately in the browser.
    guide.open = true;
    guide.emit('toggle');
    assert.equal(guideClose.hidden, false);
    assert.equal(guide.closest('[inert]'), null, 'Guide stays available during authoring work.');
  };
  const closeGuide = (escape = false) => {
    guideClose.focus();
    if (escape) {
      const event = guideClose.emit('keydown', { key: 'Escape' });
      // The minimal DOM omits the document-to-window edge. Only an
      // unconsumed key reaches the real host's window cancellation owner.
      if (!event.cancelBubble) window.dispatchEvent(event);
      assert.equal(event.cancelBubble, true);
      assert.equal(
        event.defaultPrevented,
        true,
        'Guide owns Escape before operation cancellation.',
      );
    } else guideClose.click();
    assert.equal(guide.open, false);
    // Native closed details hides descendants without changing Close.hidden.
    assert.equal(doc.activeElement, guideOpen, 'Close restores the actual disclosure opener.');
  };
  const escapeFrom = (target, repeat = false) => {
    target.focus();
    const event = target.emit('keydown', { key: 'Escape', repeat });
    // Preserve the actual Studio's window cancellation handler. This is the
    // same finite missing document-to-window edge as closeGuide above.
    if (!event.cancelBubble) window.dispatchEvent(event);
    return event;
  };
  const releaseEscape = () => doc.activeElement.emit('keyup', { key: 'Escape' });
  const startupMessage = message();
  openGuide();
  closeGuide(true);
  assert.equal(message(), startupMessage, 'Guide Escape does not cancel startup.');

  assert.equal($('cancel-studio-operation').hidden, false);
  assert.equal($('cancel-studio-operation').closest('[inert]'), null);
  assert.equal($('current-preview-cancel').closest('[inert]'), null);
  for (const id of ['studio-interface-font', 'studio-interface-size', 'studio-interface-reduced']) {
    assert.equal(
      $(id).closest('[inert]'),
      null,
      'Interface stays available during authoring work.',
    );
    assert.equal($(id).disabled, false);
  }
  assert.equal(preferenceWrites.length, 0, 'Mounting preferences does not write storage.');
  const busyStatus = message();
  $('studio-interface-size').value = 'large';
  $('studio-interface-size').emit('change');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(message(), busyStatus, 'Preference changes preserve the active operation message.');
  for (const id of [
    'save-workspace',
    'export-workspace',
    'import-workspace',
    'reload-workspace',
    'load-release',
    'studio-interface-font',
    'studio-interface-size',
    'studio-interface-reduced',
  ])
    assert.equal($(id).hasAttribute('data-studio-startup-disabled'), false);
  const startupReaderFocus = doc.activeElement;
  startupGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  await flush();
  assert.match(message(), /Current release assets loaded/);
  assert.equal(
    $('slot-id').textContent,
    'icon.play',
    'Loaded document restores the history selection.',
  );
  assert.equal($('filter-search').value, 'icon.play');
  assert.equal($('filter-kind').value, 'recipe');
  assert.equal($('filter-quality').value, 'source');
  assert.equal(
    doc.activeElement === startupReaderFocus,
    true,
    'Startup does not steal newer guide focus.',
  );
  assert.equal(historyWrites.length, 0, 'Restoration does not rewrite the history entry.');
  for (const id of [
    'filter-search',
    'filter-screen',
    'filter-state',
    'filter-kind',
    'filter-quality',
  ]) {
    $(id).value = '';
    $(id).emit(id === 'filter-search' ? 'input' : 'change');
  }
  $('asset-list')
    .querySelectorAll('button')
    .find((button) =>
      button.querySelector('small')?.textContent.startsWith(`${publishedSlot.id} ·`),
    )
    .click();
  assert.equal(window.history.state[STUDIO_VIEW_KEY].selected, publishedSlot.id);
  assert.deepEqual(window.history.state.unrelatedOwner, { retained: true });
  assert.equal(
    historyWrites.every(({ title, url }) => title === '' && url.length === 0),
    true,
  );

  // Model native form restoration separately from the authoritative audio record.
  // Pageshow can restore controls after listeners have run; neither phase is an edit.
  const masterField = $('studio-master-volume'),
    audioOpener = doc.activeElement,
    audioWritesBeforeReturn = preferenceWrites.length;
  for (const persisted of [false, true]) {
    masterField.value = '0.88';
    window.emit('pageshow', { persisted });
    assert.equal(
      Number(masterField.value),
      0.13,
      'Audio controls repaint current intent on return.',
    );
    masterField.value = '0.91';
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.equal(
      Number(masterField.value),
      0.13,
      'Deferred repaint repairs late native restoration.',
    );
    assert.equal($('studio-audio-mute').textContent, 'Unmute sound');
    assert.equal(
      doc.activeElement === audioOpener,
      true,
      'Audio restoration never moves editor focus.',
    );
  }
  assert.equal(preferenceWrites.length, audioWritesBeforeReturn, 'Audio restoration never saves.');
  denyPreferenceSave = true;
  masterField.value = '0.27';
  masterField.onchange();
  assert.match($('studio-audio-status').textContent, /could not be saved/);
  sharedPreferences.set(AUDIO_PREFERENCES_KEY, JSON.stringify({ muted: false, volume: 0.95 }));
  masterField.value = '0.95';
  window.emit('pageshow', { persisted: true });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(
    Number(masterField.value),
    0.27,
    'Unsaved session intent wins over restored controls.',
  );
  assert.equal($('studio-audio-mute').textContent, 'Unmute sound');
  denyPreferenceSave = false;
  masterField.value = '0.13';
  masterField.onchange();

  // The approved fixture remains available throughout all later inspection
  // journeys, including the separate cross-mode preview test composition.
  $('filter-quality').value = '';
  $('filter-quality').emit('change');
  // The actual click handler is the browser's keyboard/pointer activation path.
  // This models DOM focus ownership; native Enter/Tab behavior is checked separately.
  const inventoryButton = (slotId) =>
    $('asset-list')
      .querySelectorAll('button')
      .find((button) => button.querySelector('small')?.textContent.startsWith(`${slotId} ·`));
  const originalSlot = $('slot-id').textContent;
  // Actual host wiring: a visible focus change is not a hidden document.
  inventoryButton('audio.capture').click();
  await flush();
  const currentAudio = $('current-preview'),
    draftAudio = $('draft-preview');
  await currentAudio.querySelectorAll('button')[0].onclick();
  assert.match(currentAudio.textContent, /master sound is muted/);
  $('studio-audio-mute').click();
  assert.doesNotMatch(
    currentAudio.textContent,
    /master sound is muted/,
    'Actual master Unmute repaints the active saved audition.',
  );
  assert.match(currentAudio.textContent, /Playing the registered/);
  assert.equal(auditionContexts[0].context.state, 'running');
  assert.ok(auditionContexts[0].sources.length > 0);
  const visibleMarker = currentAudio.previewMarker;
  window.emit('blur');
  assert.equal(
    currentAudio.previewMarker,
    visibleMarker,
    'A file-picker focus change keeps the visible preview.',
  );
  assert.equal(auditionContexts[0].context.state, 'running');
  delayAudition = true;
  const pendingAudition = draftAudio.querySelectorAll('button')[0].onclick();
  assert.equal(auditionContexts.length, 2);
  doc.hidden = true;
  doc.emit('visibilitychange');
  assert.equal(
    auditionContexts[0].context.state,
    'closed',
    'Hiding retires the active authoring audition.',
  );
  assert.equal(
    auditionContexts[1].context.state,
    'closed',
    'Hiding retires a pending authoring audition.',
  );
  auditionContexts[1].gate.resolve();
  await pendingAudition;
  assert.equal(
    auditionContexts[1].sources.length,
    0,
    'Late readiness cannot schedule a hidden cue.',
  );
  assert.equal(currentAudio.previewMarker, null);
  assert.equal(draftAudio.previewMarker, null);
  doc.hidden = false;
  doc.emit('visibilitychange');
  await flush();
  assert.equal(
    auditionContexts.length,
    2,
    'A visible return creates controls, not playback contexts.',
  );
  assert.ok(currentAudio.previewMarker);
  assert.ok(draftAudio.previewMarker);
  delayAudition = false;
  await currentAudio.querySelectorAll('button')[0].onclick();
  assert.equal(auditionContexts.length, 3, 'A fresh explicit audition starts after return.');
  $('studio-audio-mute').click();
  inventoryButton(originalSlot).click();
  await flush();

  const preferenceWritesBeforeInspection = preferenceWrites.length;
  $('preview-mode').value = 'context';
  $('preview-mode').emit('change');
  $('preview-field-mode').value = 'team';
  $('preview-field-mode').emit('change');
  assert.equal($('preview-team-arena').disabled, false);
  $('preview-team-arena').value = 'relay-yard';
  $('preview-team-arena').emit('change');
  $('preview-team-scenario').value = 'rescue-p2';
  $('preview-team-scenario').emit('change');
  $('preview-team-arena').focus();
  $('preview-team-arena').value = 'first-connection';
  $('preview-team-arena').emit('change');
  await flush();
  assert.equal($('preview-team-scenario').value, 'initial');
  assert.equal(
    $('preview-team-scenario').options.find((option) => option.value === 'rescue-p2').disabled,
    true,
  );
  assert.equal(doc.activeElement, $('preview-team-arena'));
  const originalScreenFilter = $('filter-screen').value;
  $('filter-screen').value = 'flight';
  $('filter-screen').emit('change');
  $('filter-search').value = 'scene.reveal.wide';
  $('filter-search').emit('input');
  const recipeScene = inventoryButton('scene.reveal.wide');
  assert.ok(recipeScene);
  const previousFetch = globalThis.fetch,
    inspectionFetches = [];
  globalThis.fetch = async (...args) => {
    inspectionFetches.push(args[0]);
    return previousFetch(...args);
  };
  recipeScene.click();
  await flush();
  assert.match(
    $('current-preview-status').querySelector('.operation-status-label').textContent,
    /picture recipe has no Team field preview/,
    'A Team picture recipe fails visibly before looking up an unrelated Solo owner.',
  );
  assert.equal(inspectionFetches.length, 0);
  globalThis.fetch = previousFetch;
  assert.equal(preferenceWrites.length, preferenceWritesBeforeInspection);
  $('preview-mode').value = 'pixel';
  $('preview-mode').emit('change');
  $('preview-field-mode').value = 'solo';
  $('preview-field-mode').emit('change');
  assert.equal($('preview-team-arena').disabled, true);
  $('filter-search').value = '';
  $('filter-search').emit('input');
  $('filter-screen').value = originalScreenFilter;
  $('filter-screen').emit('change');
  inventoryButton(originalSlot).click();
  // The bounded release fixture keeps its font slots as recipes. Filter those
  // same three slots without inventing installed font files.
  $('filter-kind').value = 'recipe';
  $('filter-kind').emit('change');
  $('filter-search').value = 'font.';
  $('filter-search').emit('input');
  assert.equal($('asset-list').querySelectorAll('button').length, 3);
  const exo = inventoryButton('font.ui');
  assert.ok(exo, 'The filtered inventory includes the second UI font.');
  exo.focus();
  exo.click();
  const selectedExo = inventoryButton('font.ui');
  assert.equal($('slot-id').textContent, 'font.ui');
  assert.equal(exo.isConnected, false);
  assert.notEqual(selectedExo, exo);
  assert.equal(selectedExo.isConnected, true);
  assert.equal(selectedExo.getAttribute('aria-pressed'), 'true');
  assert.ok(doc.activeElement === selectedExo, 'Desktop activation retains the selected row.');
  $('filter-kind').focus();
  await flush();
  assert.equal(
    doc.activeElement,
    $('filter-kind'),
    'Late preview completion never restores focus.',
  );
  selectedExo.focus();
  selectedExo.click();
  assert.equal(
    doc.activeElement,
    inventoryButton('font.ui'),
    'Reselecting the same row also retains focus.',
  );
  assert.notEqual(doc.activeElement, selectedExo);
  await flush();
  $('filter-kind').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    $('filter-kind'),
    'An unfocused desktop trigger cannot steal focus.',
  );
  await flush();
  doc.focused = false;
  inventoryButton('font.ui').focus();
  inventoryButton('font.ui').click();
  assert.equal(doc.activeElement, doc.body, 'A background document cannot restore desktop focus.');
  await flush();
  doc.focused = true;
  narrow = true;
  inventoryButton('font.numeric').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    $('inspector'),
    'The existing narrow inspector handoff is retained.',
  );
  await flush();
  $('filter-kind').focus();
  inventoryButton('font.ui').click();
  assert.equal(
    doc.activeElement,
    $('inspector'),
    'Foreground narrow activation keeps its deliberate handoff even without button focus.',
  );
  await flush();
  doc.focused = false;
  inventoryButton('font.numeric').focus();
  inventoryButton('font.numeric').click();
  assert.equal(
    doc.activeElement,
    doc.body,
    'Background narrow activation cannot move focus to Inspector.',
  );
  await flush();
  doc.focused = true;
  narrow = false;
  $('filter-kind').value = '';
  $('filter-kind').emit('change');
  $('filter-search').value = '';
  $('filter-search').emit('input');
  assert.ok(inventoryButton(originalSlot), 'Every stage includes the approved release asset.');
  inventoryButton(originalSlot).focus();
  inventoryButton(originalSlot).click();
  await flush();
  const summary = $('workspace-summary').textContent;
  const original = new File([bytes], 'original.png', { type: 'image/png' });
  $('asset-upload').files = [original];
  delayRead = true;
  $('asset-upload').onchange();
  assert.match(message(), /Reading the image header/);
  const readingMessage = message();
  openGuide();
  closeGuide(true);
  for (const target of [guideOpen, $('studio-interface-size')]) {
    escapeFrom(target, true);
    assert.equal(
      message(),
      readingMessage,
      'Held guide Escape must not cancel the pending upload read.',
    );
    assert.equal($('cancel-studio-operation').hidden, false);
    assert.equal($('workspace-summary').textContent, summary);
  }
  releaseEscape();
  assert.equal(
    escapeFrom($('studio-interface-size')).defaultPrevented,
    true,
    'A fresh Escape deliberately reaches the Studio cancellation owner.',
  );
  readGate.resolve();
  await flush();
  assert.equal(cancelledReads, 1);
  assert.equal($('workspace-summary').textContent, summary);
  assert.equal($('stage-asset').disabled, true);
  delayRead = false;
  delayDecode = true;
  $('asset-upload').onchange();
  await until(() => /Decoding the original/.test(message()));
  $('cancel-studio-operation').onclick();
  delayDecode = false;
  delayEncode = true;
  $('asset-upload').onchange();
  await until(() => /Encoding the crop/.test(message()));
  assert.equal(
    $('stage-asset').disabled,
    true,
    'No partial prepared asset is published during encode.',
  );
  const encodingMessage = message();
  openGuide();
  closeGuide(true);
  assert.equal(message(), encodingMessage, 'Guide Escape cannot cancel a held image encode.');
  assert.equal($('cancel-studio-operation').hidden, false);
  assert.equal($('replacement-panel').inert, true);
  for (const target of [guideOpen, $('studio-interface-size')]) {
    escapeFrom(target, true);
    assert.equal(
      message(),
      encodingMessage,
      'Repeats from the closed guide or another control cannot cancel encoding.',
    );
    assert.equal($('cancel-studio-operation').hidden, false);
    assert.equal($('stage-asset').disabled, true);
  }
  releaseEscape();
  decodeGate.resolve();
  await flush();
  assert.equal(lateClosed, 1);
  assert.match(message(), /Encoding the crop/);
  assert.equal(
    $('replacement-panel').inert,
    true,
    'Old finally cannot release the newer upload lock.',
  );
  encodeGate.resolve();
  await until(() => $('cancel-studio-operation').hidden);
  assert.match(message(), /Replacement prepared/);
  assert.equal($('stage-asset').disabled, false);
  assert.equal($('workspace-summary').textContent, summary);
  const preparedSelection = $('slot-id').textContent,
    refusedPreparedButton = inventoryButton('font.ui'),
    preparedCurrentMarker = $('current-preview').previewMarker,
    preparedDraftMarker = $('draft-preview').previewMarker;
  refusedPreparedButton.focus();
  refusedPreparedButton.click();
  assert.match(message(), /Validate and stage the prepared slot/);
  assert.equal(doc.activeElement, refusedPreparedButton);
  assert.equal(refusedPreparedButton.isConnected, true);
  assert.equal(inventoryButton('font.ui'), refusedPreparedButton);
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal($('current-preview').previewMarker, preparedCurrentMarker);
  assert.equal($('draft-preview').previewMarker, preparedDraftMarker);
  $('asset-creator').value = 'Fixture author';
  $('asset-source').value = 'Owned original fixture';
  $('asset-license').value = 'Fixture rights';
  $('asset-creator').focus();
  const creator = $('asset-creator'),
    preparedImage = $('source-image'),
    savedSurface = $('current-preview'),
    draftSurface = $('draft-preview'),
    savedMarker = savedSurface.previewMarker,
    draftMarker = draftSurface.previewMarker,
    preparedSummary = $('upload-summary').textContent;
  $('studio-interface-font').value = 'plain';
  $('studio-interface-font').emit('change');
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.activeElement, creator);
  assert.equal($('asset-creator'), creator);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.equal($('source-image'), preparedImage);
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal(savedSurface.previewMarker, savedMarker);
  assert.equal(draftSurface.previewMarker, draftMarker);
  assert.equal($('stage-asset').disabled, false);
  const preparedGuideState = {
    crop: ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    motion: $('preview-motion').value,
    currentCleanup: savedSurface.previewCleanup,
    draftCleanup: draftSurface.previewCleanup,
    status: message(),
    preferenceWrites: preferenceWrites.length,
  };
  openGuide();
  closeGuide();
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal($('asset-upload').files[0], original);
  assert.equal($('source-image'), preparedImage);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.deepEqual(
    ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    preparedGuideState.crop,
  );
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal(message(), preparedGuideState.status);
  assert.equal($('stage-asset').disabled, false);
  assert.equal(savedSurface.previewMarker, savedMarker);
  assert.equal(draftSurface.previewMarker, draftMarker);
  assert.equal(savedSurface.previewCleanup, preparedGuideState.currentCleanup);
  assert.equal(draftSurface.previewCleanup, preparedGuideState.draftCleanup);
  assert.equal($('preview-motion').value, preparedGuideState.motion);
  assert.equal(preferenceWrites.length, preparedGuideState.preferenceWrites);
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.body.dataset.textSize, 'large');
  creator.focus();
  // Model a return after another page changed preferences while this document
  // was frozen. The real host may refresh preview leases, but its prepared
  // original, metadata, selected row and current editor focus must survive.
  const preparedRow = inventoryButton(preparedSelection),
    preparedDimensions = [preparedImage.width, preparedImage.height],
    preparedCrop = ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    writesBeforePreparedReturn = preferenceWrites.length;
  assert.equal(preparedRow.getAttribute('aria-pressed'), 'true');
  assert.ok(preparedDimensions.every((value) => value > 0));
  window.emit('pagehide', { persisted: true });
  sharedPreferences.set(
    DISPLAY_PREFERENCES_KEY,
    JSON.stringify({ textFace: 'pixel', textSize: 'large', reducedEffects: false }),
  );
  systemMotion.matches = true;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'pixel');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(doc.body.dataset.effects, 'reduced');
  assert.equal($('studio-interface-font').value, 'pixel');
  assert.equal($('studio-interface-size').value, 'large');
  assert.equal($('studio-interface-reduced').checked, false, 'System cap is not saved intent.');
  assert.equal($('studio-interface-cap').hidden, false);
  assert.equal(preferenceWrites.length, writesBeforePreparedReturn, 'Restoration never saves.');
  assert.equal($('slot-id').textContent, preparedSelection);
  assert.equal(inventoryButton(preparedSelection), preparedRow);
  assert.equal(preparedRow.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement, creator);
  assert.equal($('asset-creator'), creator);
  assert.equal(creator.value, 'Fixture author');
  assert.equal($('asset-source').value, 'Owned original fixture');
  assert.equal($('asset-license').value, 'Fixture rights');
  assert.equal($('source-image'), preparedImage);
  assert.deepEqual([preparedImage.width, preparedImage.height], preparedDimensions);
  assert.deepEqual(
    ['x', 'y', 'width', 'height'].map((key) => $(`crop-${key}`).value),
    preparedCrop,
  );
  assert.equal($('upload-summary').textContent, preparedSummary);
  assert.equal($('asset-upload').files[0], original);
  assert.equal($('stage-asset').disabled, false);
  // A failed or edited crop must never stage the last successful pixels.
  const unchangedWorkspace = $('workspace-summary').textContent;
  const unchangedBinding = $('slot-contract').textContent;
  $('crop-width').value = preparedDimensions[0] + 1;
  await $('prepare-crop').onclick();
  assert.match(message(), /fit completely inside the original/);
  await $('stage-asset').onclick();
  assert.match(message(), /fit completely inside the original/);
  assert.equal($('workspace-summary').textContent, unchangedWorkspace);
  assert.equal($('slot-contract').textContent, unchangedBinding);
  $('crop-width').value = Number(preparedCrop[2]) - 1;
  await $('stage-asset').onclick();
  assert.match(message(), /crop has changed.*Prepare derivative/);
  await $('apply-geometry').onclick();
  assert.match(message(), /crop has changed.*Prepare derivative/);
  assert.equal($('workspace-summary').textContent, unchangedWorkspace);
  assert.equal($('slot-contract').textContent, unchangedBinding);
  // Edits made during an outstanding encode also invalidate its result.
  encodeGate = deferred();
  const cropPreparation = $('prepare-crop').onclick();
  await until(() => /Encoding the crop/.test(message()));
  $('crop-width').value = preparedCrop[2];
  encodeGate.resolve();
  await cropPreparation;
  await $('stage-asset').onclick();
  assert.match(message(), /crop has changed.*Prepare derivative/);
  assert.equal($('workspace-summary').textContent, unchangedWorkspace);
  assert.equal($('slot-contract').textContent, unchangedBinding);
  await $('prepare-crop').onclick();
  assert.match(message(), /Derivative prepared/);
  // The following real stage/save/restore byte assertion also proves that the
  // prepared asset survived the return, rather than only its visible labels.
  const stageButton = $('stage-asset');
  let stageDisabled = stageButton.disabled;
  Object.defineProperty(stageButton, 'disabled', {
    configurable: true,
    get: () => stageDisabled,
    set(value) {
      stageDisabled = value;
      // Model the browser removing focus when its action becomes disabled.
      if (value && doc.activeElement === stageButton) stageButton.blur();
    },
  });
  stageButton.focus();
  await stageButton.onclick();
  assert.equal(doc.activeElement?.id, 'save-workspace', 'Staging hands keyboard focus to Save.');
  assert.match(message(), /validated and staged/);
  assert.match($('workspace-summary').textContent, /unsaved changes/);
  const historyRow = (id, revision) =>
    $('asset-history').children.find(
      (row) => row.querySelector('strong')?.textContent === `${id}@${revision}`,
    );
  const bindButton = (id, revision) =>
    historyRow(id, revision)
      ?.querySelectorAll('button')
      .find((button) => button.textContent === 'Bind this revision');
  const currentBinding = () => JSON.parse($('slot-contract').textContent).currentAsset;
  const customId = `${originalSlot}.custom`;
  assert.ok(
    historyRow(approved.id, 2),
    'The exact earlier approved field-kit revision stays reachable.',
  );
  assert.ok(bindButton(approved.id, 2));
  assert.equal(
    bindButton(customId, 1).disabled,
    true,
    'Only the current exact revision is disabled.',
  );
  const sourceRow = historyRow(`${customId}.source`, 1);
  assert.ok(
    sourceRow.querySelectorAll('button').some((button) => button.textContent === 'Download file'),
  );
  assert.equal(
    bindButton(`${customId}.source`, 1),
    undefined,
    'An unprepared original is download-only.',
  );
  assert.ok(
    sourceRow
      .querySelectorAll('p')
      .some((paragraph) => /Source original/.test(paragraph.textContent)),
  );
  const customPreviewBytes = async (surface) => {
    await until(() => $(surface).querySelector('canvas')?.drawnBlob);
    return Buffer.from(await $(surface).querySelector('canvas').drawnBlob.arrayBuffer());
  };
  assert.deepEqual(await customPreviewBytes('current-preview'), Buffer.from(publishedBytes));
  assert.deepEqual(await customPreviewBytes('draft-preview'), Buffer.from(bytes));
  assert.equal(
    await createStudioStore({ indexedDB: db.indexedDB }).load(),
    null,
    'Staging never saves.',
  );
  await bindButton(approved.id, 2).onclick();
  assert.equal(currentBinding(), `${approved.id}@2`);
  assert.deepEqual(await customPreviewBytes('draft-preview'), Buffer.from(publishedBytes));
  assert.equal(bindButton(approved.id, 2).disabled, true);
  assert.equal(bindButton(customId, 1).disabled, false);
  await $('undo-draft').onclick();
  assert.equal(currentBinding(), `${customId}@1`);
  await $('redo-draft').onclick();
  assert.equal(currentBinding(), `${approved.id}@2`);
  await $('undo-draft').onclick();
  assert.equal(currentBinding(), `${customId}@1`);
  assert.deepEqual(await customPreviewBytes('current-preview'), Buffer.from(publishedBytes));
  const stagedSummary = $('workspace-summary').textContent,
    stagedStatus = message(),
    stagedHistory = [$('undo-draft').disabled, $('redo-draft').disabled];
  openGuide();
  closeGuide(true);
  assert.equal($('workspace-summary').textContent, stagedSummary);
  assert.equal(message(), stagedStatus);
  assert.deepEqual([$('undo-draft').disabled, $('redo-draft').disabled], stagedHistory);
  await $('save-workspace').onclick();
  assert.match(message(), /saved atomically/);
  const saved = await createStudioStore({ indexedDB: db.indexedDB }).load();
  const hash = await hashPresentationBytes(bytes);
  assert.deepEqual(Buffer.from(await saved.assets.get(hash).arrayBuffer()), Buffer.from(bytes));
  assert.equal(saved.generation, 1);
  assert.ok(saved.document.assets.some((asset) => asset.id.endsWith('.source')));
  assert.deepEqual(saved.document.themes.slice(0, published.themes.length), published.themes);
  assert.deepEqual(saved.document.assets.slice(0, published.assets.length), published.assets);
  assert.deepEqual(resolvePresentation(saved.document).bindings[originalSlot], {
    id: customId,
    revision: 1,
  });
  assert.deepEqual(
    Buffer.from(await saved.assets.get(publishedHash).arrayBuffer()),
    Buffer.from(publishedBytes),
  );
  await bindButton(approved.id, 2).onclick();
  assert.equal(currentBinding(), `${approved.id}@2`);
  assert.equal((await createStudioStore({ indexedDB: db.indexedDB }).load()).generation, 1);
  await $('reset-draft').onclick();
  assert.equal(currentBinding(), `${customId}@1`, 'Reset keeps the last saved custom binding.');
  await $('reload-workspace').onclick();
  assert.equal(currentBinding(), `${customId}@1`);
  assert.ok(
    bindButton(approved.id, 2),
    'Reloaded history still reaches the exact approved original.',
  );
  assert.deepEqual(await customPreviewBytes('current-preview'), Buffer.from(bytes));
  assert.deepEqual(
    (await createStudioStore({ indexedDB: db.indexedDB }).load()).document,
    saved.document,
  );
  assert.deepEqual(new Set(opened), new Set([STUDIO_DATABASE]));
  // Reusing approved raster bytes does not approve changed placement metadata.
  await bindButton(approved.id, 2).onclick();
  await $('edit-geometry').onclick();
  assert.equal($('nine-slice').disabled, false);
  $('nine-slice').value = JSON.stringify({ ...approved.geometry.nineSlice, left: 7 });
  stageButton.focus();
  const stagedWithNewFocus = stageButton.onclick();
  $('studio-guide-open').focus();
  await stagedWithNewFocus;
  assert.equal(doc.activeElement?.id, 'studio-guide-open', 'Staging preserves newer reader focus.');
  assert.match(message(), /validated and staged/);
  await $('save-workspace').onclick();
  assert.match(message(), /saved atomically/);
  const metadataSaved = await createStudioStore({ indexedDB: db.indexedDB }).load();
  const metadataAsset = resolvePresentation(metadataSaved.document).assets[originalSlot];
  assert.equal(metadataAsset.geometry.nineSlice.left, 7);
  assert.equal(metadataAsset.file.sha256, approved.file.sha256);
  assert.deepEqual(metadataAsset.quality, { stage: 'produced', evidence: [] });
  assert.deepEqual(metadataAsset.provenance.parent, { id: approved.id, revision: 2 });
  assert.deepEqual(
    metadataSaved.document.assets.find((asset) => asset.id === approved.id && asset.revision === 2),
    approved,
    'The reviewed original and its evidence remain immutable.',
  );
  assert.deepEqual(
    Buffer.from(await metadataSaved.assets.get(publishedHash).arrayBuffer()),
    Buffer.from(publishedBytes),
    'A metadata edit preserves the original encoded image.',
  );
  assert.ok(bindButton(approved.id, 2), 'The approved original can still be rebound explicitly.');
  $('new-sprite').onclick();
  const originalSpritePixels = new Uint8ClampedArray($('sprite-canvas').paintedPixels);
  $('sprite-canvas').emit('keydown', { code: 'Space' });
  const editedSpritePixels = new Uint8ClampedArray($('sprite-canvas').paintedPixels),
    spriteCanvas = $('sprite-canvas'),
    spriteCursor = $('sprite-cursor').textContent;
  assert.notDeepEqual(editedSpritePixels, originalSpritePixels);
  openGuide();
  closeGuide();
  assert.equal($('sprite-canvas'), spriteCanvas);
  assert.equal($('sprite-cursor').textContent, spriteCursor);
  assert.deepEqual(spriteCanvas.paintedPixels, editedSpritePixels);
  assert.equal($('sprite-undo').disabled, false);
  $('sprite-undo').click();
  assert.deepEqual(
    spriteCanvas.paintedPixels,
    originalSpritePixels,
    'Guide preserves real pixel undo.',
  );
  assert.equal($('sprite-redo').disabled, false);
  $('sprite-redo').click();
  assert.deepEqual(
    spriteCanvas.paintedPixels,
    editedSpritePixels,
    'Guide preserves real pixel redo.',
  );
  encodeGate = deferred();
  const preparingSprite = $('use-sprite').onclick();
  assert.match(message(), /Encoding the edited sprite/);
  $('cancel-studio-operation').onclick();
  encodeGate.resolve();
  await preparingSprite;
  const refusedSpriteButton = inventoryButton('font.ui'),
    spriteSelection = $('slot-id').textContent,
    spriteCurrentMarker = $('current-preview').previewMarker,
    spriteDraftMarker = $('draft-preview').previewMarker;
  refusedSpriteButton.focus();
  refusedSpriteButton.click();
  assert.match(message(), /Prepare the edited sprite/);
  assert.equal(doc.activeElement, refusedSpriteButton);
  assert.equal(refusedSpriteButton.isConnected, true);
  assert.equal(inventoryButton('font.ui'), refusedSpriteButton);
  assert.equal($('slot-id').textContent, spriteSelection);
  assert.equal($('current-preview').previewMarker, spriteCurrentMarker);
  assert.equal($('draft-preview').previewMarker, spriteDraftMarker);
  $('studio-interface-size').value = 'standard';
  $('studio-interface-size').emit('change');
  assert.equal(doc.body.dataset.textSize, 'standard');
  assert.equal(
    preferenceWrites.filter(([key]) => key === DISPLAY_PREFERENCES_KEY).length,
    3,
    'Only the three explicit display choices persist.',
  );
  assert.equal(
    preferenceWrites.filter(([key]) => key === AUDIO_PREFERENCES_KEY).length,
    4,
    'Only the four explicit audio edits attempt a save.',
  );
  await $('save-workspace').onclick();
  assert.match(
    message(),
    /Prepare the edited sprite/,
    'Cancelled sprite encoding preserves the edited pixels and baseline.',
  );
  assert.equal($('sprite-workbench').hidden, false);
  // Failed explicit saves keep their local intent on return, even if another
  // page wrote newer shared values. The current system cap still takes effect.
  // These are modeled events, not proof of native BFCache admission.
  const dirtyRow = inventoryButton(spriteSelection),
    dirtyCanvas = $('sprite-canvas'),
    dirtyCursor = $('sprite-cursor').textContent;
  dirtyRow.focus();
  assert.equal(dirtyRow.getAttribute('aria-pressed'), 'true');
  assert.equal($('sprite-undo').disabled, false, 'The actual sprite editor has an edit.');
  denyPreferenceSave = true;
  $('studio-interface-font').value = 'plain';
  $('studio-interface-font').emit('change');
  assert.equal(doc.body.dataset.textFace, 'plain');
  assert.equal(doc.activeElement, dirtyRow);
  const saveWarning = $('studio-interface-status').textContent,
    writesAfterDenial = preferenceWrites.length;
  assert.match(saveWarning, /could not be saved/);
  assert.equal(
    preferenceWrites.filter(([key]) => key === DISPLAY_PREFERENCES_KEY).length,
    4,
    'The rejected display preference save is recorded as an attempt.',
  );
  window.emit('pagehide', { persisted: true });
  const remotePreferences = JSON.stringify({
    textFace: 'pixel',
    textSize: 'large',
    reducedEffects: false,
  });
  sharedPreferences.set(DISPLAY_PREFERENCES_KEY, remotePreferences);
  systemMotion.matches = false;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'plain', 'Unsaved local font intent wins.');
  assert.equal(doc.body.dataset.textSize, 'standard', 'Unsaved local size intent wins.');
  assert.equal(doc.body.dataset.effects, 'full', 'The missed system cap change is adopted.');
  assert.equal($('studio-interface-font').value, 'plain');
  assert.equal($('studio-interface-size').value, 'standard');
  assert.equal($('studio-interface-reduced').checked, false);
  assert.equal($('studio-interface-cap').hidden, true);
  assert.equal($('studio-interface-status').textContent, saveWarning);
  assert.equal($('studio-interface-status').hidden, false);
  assert.equal(preferenceWrites.length, writesAfterDenial, 'Returning cannot retry a failed save.');
  assert.equal(sharedPreferences.get(DISPLAY_PREFERENCES_KEY), remotePreferences);
  assert.equal($('slot-id').textContent, spriteSelection);
  assert.equal(inventoryButton(spriteSelection), dirtyRow);
  assert.equal(dirtyRow.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement, dirtyRow);
  assert.equal($('sprite-canvas'), dirtyCanvas);
  assert.equal($('sprite-cursor').textContent, dirtyCursor);
  assert.equal($('sprite-undo').disabled, false);
  assert.equal($('sprite-workbench').hidden, false);
  await $('save-workspace').onclick();
  assert.match(message(), /Prepare the edited sprite/, 'Return cannot discard the edited sprite.');
  // Only a later explicit successful save releases the unsaved-intent guard.
  denyPreferenceSave = false;
  $('studio-interface-font').emit('change');
  assert.equal(preferenceWrites.length, writesAfterDenial + 1);
  assert.equal($('studio-interface-status').hidden, true);
  assert.deepEqual(JSON.parse(sharedPreferences.get(DISPLAY_PREFERENCES_KEY)), {
    textFace: 'plain',
    textSize: 'standard',
    reducedEffects: false,
  });
  dirtyRow.focus();
  window.emit('pagehide', { persisted: true });
  sharedPreferences.set(DISPLAY_PREFERENCES_KEY, remotePreferences);
  systemMotion.matches = true;
  window.emit('pageshow', { persisted: true });
  await flush();
  assert.equal(doc.body.dataset.textFace, 'pixel', 'Successfully saved intent shares again.');
  assert.equal(doc.body.dataset.textSize, 'large');
  assert.equal(doc.body.dataset.effects, 'reduced');
  assert.equal(preferenceWrites.length, writesAfterDenial + 1);
  assert.equal(doc.activeElement, dirtyRow);
  assert.equal(inventoryButton(spriteSelection), dirtyRow);
  assert.equal($('sprite-canvas'), dirtyCanvas);
  assert.equal($('sprite-undo').disabled, false);
  await $('save-workspace').onclick();
  assert.match(message(), /Prepare the edited sprite/);
  assert.ok(
    preferenceWrites.every(([key]) =>
      [DISPLAY_PREFERENCES_KEY, AUDIO_PREFERENCES_KEY].includes(key),
    ),
    'All attempted preference writes target only the separate shared display and audio records.',
  );
  window.emit('pagehide', { persisted: false });
  assert.equal(guideClose.hidden, true, 'Terminal disposal removes the enhanced Close control.');
  assert.equal(guideClose.onclick, null);
});
