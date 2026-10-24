import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { soloPage } from './helpers/solo-dom.mjs';
import { waitFor } from './helpers/wait-for.mjs';
import { classicLibrarySources } from '../mission-library/classic-source.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { emptyPackLibrary, installPack, exportPackLibrary } from '../packs.mjs';

class Picture {
  width = 1774;
  height = 887;
  naturalWidth = 1774;
  naturalHeight = 887;
  set src(value) {
    this.source = value;
    queueMicrotask(() => this.onload?.());
  }
  async decode() {}
  removeAttribute() {
    this.source = '';
  }
}
async function journeyPage(t, search = '') {
  return soloPage(t, {
    search,
    titleScreen: true,
    journeyIndexedDB: managedIndexedDB().indexedDB,
    pictures: { Image: Picture },
    fetchResponse: async (path) => {
      if (String(path).includes('/content-design/assets/'))
        return new Response(await readFile(path));
    },
  });
}

const index = JSON.parse(
  await readFile(new URL('../content/mission-library-index.json', import.meta.url), 'utf8'),
);
const model = createMissionLibrary(
  classicLibrarySources(index, {
    availability: () => ({ state: 'ready' }),
    launch: () => true,
  }),
);
const lateBase = model.missions[11];
const currentPressure = model.missions.find(
  (mission) =>
    mission.name === 'Orchard Crossing' &&
    mission.ownerId.includes('fpv-arcade-r5') &&
    mission.ownerId.includes('current-line-impact.v1'),
);

function assertReadyCard(card, name = card.querySelector('.journey-card-title').textContent) {
  assert.equal(card.tagName, 'BUTTON');
  assert.equal(card.type, 'button');
  assert.equal(card.disabled, false);
  assert.equal(card.dataset.availabilityState, 'ready');
  assert.ok(name.length > 0, 'The ready mission has a readable name.');
  assert.ok(
    card.getAttribute('aria-label').includes(name),
    'Its accessible name identifies the mission.',
  );
}

async function installedAssets(pack) {
  const assets = managedIndexedDB();
  const db = await new Promise((resolve, reject) => {
    const request = assets.indexedDB.open('revealline-assets-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(
        exportPackLibrary(installPack(emptyPackLibrary(), pack)),
        'revealline.packs.dev.v1',
      );
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
  return assets;
}

const settle = (predicate) => waitFor(predicate, { timeoutMs: 15000 });
function appendLibraryWaitEvidence(error, p, initialPictureRequested, opening) {
  try {
    const doc = p?.doc ?? globalThis.document;
    const rendered = p?.rendered;
    const text = (value) => (typeof value === 'string' ? value.slice(0, 512) : null);
    const errors = Array.isArray(p?.errors) ? p.errors : null;
    const evidence = JSON.stringify({
      format: 'mission-library-wait.v1',
      fixtureReady: !!p,
      flightState: text(doc?.body?.dataset.flightState),
      pictureState: text(doc?.body?.dataset.pictureState),
      renderedRun: rendered
        ? {
            levelId: text(rendered.run?.levelId),
            tick: Number.isSafeInteger(rendered.run?.tick) ? rendered.run.tick : null,
            paused: typeof rendered.paused === 'boolean' ? rendered.paused : null,
          }
        : null,
      chooserOpen: doc?.getElementById('journey-chooser')?.open ?? null,
      collectionExists: !!doc?.getElementById('journey-collection'),
      hidden: doc?.hidden ?? null,
      hasFocus: doc?.hasFocus?.() ?? null,
      runMessage: text(doc?.getElementById('run-message')?.textContent),
      errors: errors?.slice(0, 4).map((item) => String(item).slice(0, 512)) ?? null,
      errorsOmitted: errors ? Math.max(0, errors.length - 4) : null,
      initialPictureRequested,
      opening: opening
        ? {
            handlerType: opening.handlerType,
            handlerCalls: opening.handlerCalls,
            returnedPromise: opening.returnedPromise,
            promiseState: opening.promiseState,
            rejectionName: text(opening.rejection?.name),
            rejectionMessage: text(opening.rejection?.message),
            handlerRestored: opening.handlerRestored,
            beforeClick: opening.beforeClick,
            afterClick: opening.afterClick,
            atFailure: opening.snapshot(),
          }
        : undefined,
    });
    if (typeof error?.message === 'string' && Buffer.byteLength(evidence, 'utf8') <= 8192) {
      void error.stack;
      error.message += `\n${evidence}`;
    }
  } catch {
    // Observation must never replace the original assertion failure.
  }
}
async function open(p) {
  const button = p.$('shell-play'),
    original = button.onclick;
  const snapshot = () => {
    try {
      const feedback = p.$('mission-library-opening-status');
      return {
        activeElement: p.doc.activeElement?.id || p.doc.activeElement?.tagName || null,
        homeOpen: p.$('shell-home')?.open ?? null,
        openDialogs: [...p.doc.querySelectorAll('dialog[open]')]
          .slice(0, 16)
          .map((node) => node.id),
        feedback: feedback
          ? { present: true, text: feedback.textContent.slice(0, 512), hidden: !!feedback.hidden }
          : { present: false },
        flightState: p.doc.body.dataset.flightState ?? null,
        pictureState: p.doc.body.dataset.pictureState ?? null,
        hidden: !!p.doc.hidden,
        hasFocus: p.doc.hasFocus?.() ?? null,
      };
    } catch {
      return { observationFailed: true };
    }
  };
  const opening = {
    handlerType: typeof original,
    handlerCalls: 0,
    returnedPromise: false,
    promiseState: 'not-observed',
    rejection: null,
    handlerRestored: false,
    beforeClick: snapshot(),
    afterClick: null,
    snapshot,
  };
  const observed = function (...args) {
    opening.handlerCalls++;
    const returned = original.apply(this, args);
    opening.returnedPromise = returned instanceof Promise;
    if (opening.returnedPromise) {
      opening.promiseState = 'pending';
      void returned.then(
        () => {
          opening.promiseState = 'fulfilled';
        },
        (reason) => {
          opening.promiseState = 'rejected';
          opening.rejection = reason;
        },
      );
    }
    return returned;
  };
  try {
    if (typeof original === 'function') button.onclick = observed;
    p.$('shell-play').click();
  } finally {
    if (button.onclick === observed) button.onclick = original;
    opening.handlerRestored = button.onclick === original;
    opening.afterClick = snapshot();
  }
  try {
    await settle(() => p.$('journey-chooser')?.open && p.$('journey-collection'));
  } catch (error) {
    error.message += ` ${p.$('run-message').textContent} ${p.errors.map(String).join(';')}`;
    appendLibraryWaitEvidence(error, p, undefined, opening);
    throw error;
  }
}
function showAllLifecycles(p) {
  p.$('journey-lifecycle').value = '';
  p.$('journey-lifecycle').emit('change');
}
async function startPrepared(p, id) {
  let activated = false,
    acceptedRun;
  await running(p, id, () => {
    if (activated) return;
    const start = p.$('start-button');
    if (
      p.rendered.run.levelId !== id ||
      p.doc.body.dataset.flightState !== 'briefing' ||
      p.doc.body.dataset.pictureState !== 'ready' ||
      !p.rendered.paused ||
      p.rendered.run.tick !== 0 ||
      p.$('shell-home').open ||
      p.$('journey-chooser')?.open ||
      start.hidden ||
      start.disabled ||
      start.closest('[hidden],[inert]')
    )
      return;
    acceptedRun = p.rendered.run;
    activated = true;
    start.click();
  });
  assert.equal(activated, true, 'The exact prepared briefing needs one explicit Start.');
  assert.equal(p.rendered.run === acceptedRun, true, 'Start retains the accepted mission run.');
  assert.equal(p.rendered.paused, false);
  assert.equal(p.$('game-overlay').hidden, true);
}
async function running(p, id, beforeRead) {
  try {
    await settle(() => {
      p.frame(0);
      beforeRead?.();
      return p.rendered.run.levelId === id && p.doc.body.dataset.flightState === 'running';
    });
  } catch (error) {
    error.message += `\n${JSON.stringify({
      expectedLevel: id,
      url: globalThis.location.href,
      level: p.rendered.run.levelId,
      boot: p.doc.documentElement.dataset.bootState,
      bootStatus: p.$('boot-status')?.textContent,
      flight: p.doc.body.dataset.flightState,
      picture: p.doc.body.dataset.pictureState,
      paused: p.rendered.paused,
      focus: p.doc.activeElement?.id,
      loading: p.$('mission-library-opening-status')?.textContent,
      message: p.$('run-message').textContent,
      home: p.$('shell-home').open,
      chooser: p.$('journey-chooser')?.open,
      errors: p.errors.map(String),
    })}`;
    throw error;
  }
}

export {
  journeyPage,
  model,
  lateBase,
  currentPressure,
  assertReadyCard,
  installedAssets,
  settle,
  appendLibraryWaitEvidence,
  open,
  showAllLifecycles,
  startPrepared,
  running,
};
