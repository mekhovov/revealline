import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { soloPage, settle } from './helpers/solo-dom.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { register } from 'node:module';
import { MessageChannel } from 'node:worker_threads';
import { readFile } from 'node:fs/promises';
import { parse } from 'acorn';
import { selectOfflineCore } from '../../scripts/offline-core-closure.mjs';
import { t as translate } from '../i18n/index.mjs';
import { activateHostAction } from './helpers/host-action.mjs';

const { port1, port2 } = new MessageChannel();
const importGates = new Map();
let importGateSequence = 0;
port1.on('message', (message) => {
  const gate = importGates.get(message.id);
  if (!gate) return;
  if (message.type === 'entered') gate.entered++;
  if (message.type === 'released') gate.released += message.count;
  if (message.type === 'ack') gate.acknowledged.add(message.action);
});
register(new URL('./helpers/optional-worlds-loader.mjs', import.meta.url), {
  data: { channel: port2 },
  transferList: [port2],
});
after(() => {
  port1.postMessage({ action: 'dispose' });
  port1.close();
});
async function holdWorldsImport(t) {
  const id = ++importGateSequence;
  const state = { entered: 0, released: 0, acknowledged: new Set(), stage: 'hold' };
  let observedPage = null;
  const actions = new Set();
  const mark = (stage, page = observedPage) => {
    state.stage = stage;
    observedPage = page;
  };
  const diagnostic = () => ({
    stage: state.stage,
    entered: state.entered,
    released: state.released,
    acknowledged: [...state.acknowledged],
    page: observedPage
      ? {
          hidden: observedPage.doc.hidden,
          focused: observedPage.doc.hasFocus(),
          activeId: observedPage.doc.activeElement?.id ?? null,
          paused: observedPage.rendered?.paused ?? null,
          settingsOpen: observedPage.$('settings-dialog')?.open ?? false,
          loading:
            observedPage.$('optional-worlds-opening-status')?.textContent?.slice(0, 120) ?? null,
          worldsOpen: observedPage.$('optional-worlds-dialog')?.open ?? false,
          errors: observedPage.errors
            .slice(0, 3)
            .map((error) => String(error?.message ?? error).slice(0, 160)),
        }
      : null,
  });
  const wait = async (stage, predicate, page = observedPage) => {
    mark(stage, page);
    try {
      // Report the specific stalled boundary before the unchanged 20-second
      // test limit; the five-minute admission owner is unchanged too.
      await settle(predicate, `Worlds import stalled during ${stage}.`, { timeoutMs: 5000 });
    } catch (error) {
      t.diagnostic(JSON.stringify(diagnostic()));
      throw error;
    }
  };
  t.after(() => {
    if (t.signal.aborted) t.diagnostic(JSON.stringify(diagnostic()));
  });
  importGates.set(id, state);
  const send = async (action, fail = false) => {
    state.acknowledged.delete(action);
    port1.postMessage({ action, id, fail });
    await wait(`${action}-acknowledgement`, () => state.acknowledged.has(action));
  };
  let released = false;
  const release = async (fail = false) => {
    if (released) return;
    released = true;
    await send('release', fail);
  };
  t.after(async () => {
    const failures = [];
    try {
      try {
        await release();
      } catch (error) {
        failures.push(error);
      }
      for (const action of actions) {
        try {
          await wait('cleanup-action-completion', () => action.settled);
          if (action.failed) throw action.error;
        } catch (error) {
          failures.push(error);
        }
      }
    } finally {
      importGates.delete(id);
    }
    if (failures.length === 1) throw failures[0];
    if (failures.length > 1) throw new AggregateError(failures, 'Worlds import cleanup failed.');
  });
  await send('hold');
  return { state, release, wait, mark, observe: (action) => actions.add(action) };
}
async function worldsPage(t, options = {}) {
  return soloPage(t, {
    titleScreen: true,
    fetchResponse: async (url) =>
      String(url).includes('optional-worlds.json')
        ? new Response(await readFile(new URL('../content/optional-worlds.json', import.meta.url)))
        : undefined,
    ...options,
  });
}
function observeWorldsAction(gate, button) {
  const action = {
    settled: false,
    failed: false,
    error: null,
    pending: activateHostAction(button),
  };
  // Observe immediately so a rejected real click is not hidden behind an
  // unrelated loader wait. Every successful path still joins pending below.
  action.pending.then(
    () => {
      action.settled = true;
    },
    (error) => {
      action.settled = true;
      action.failed = true;
      action.error = error;
    },
  );
  gate.observe(action);
  return action;
}
async function joinWorldsAction(gate, page, action, stage = 'action-completion') {
  await gate.wait(
    stage,
    () => {
      if (action.failed) throw action.error;
      return action.settled;
    },
    page,
  );
  await action.pending;
}
async function waitForWorldsImport(gate, page, action) {
  await gate.wait(
    'accepted-action-and-import-entry',
    () => {
      if (action.failed) throw action.error;
      assert.equal(action.settled, false, 'The held import must keep its accepted action pending.');
      assert.equal(
        page.$('optional-worlds-opening-status')?.textContent,
        translate('interface:loading'),
        'The real Worlds action must publish loading feedback before requesting its module.',
      );
      return gate.state.entered === 1;
    },
    page,
  );
}
function worldsOpener(page) {
  page.$('settings-button').click();
  page.$('settings-tab-content').click();
  const button = page.$('shell-worlds');
  assert.equal(button.closest('#settings-panel-content'), page.$('settings-panel-content'));
  assert.equal(page.$('settings-dialog').open, true);
  button.focus();
  assert.equal(page.doc.activeElement, button, 'The actual Worlds opener must receive focus.');
  assert.equal(
    button.closest('[hidden],[inert]'),
    null,
    'Worlds must be reached through visible Settings.',
  );
  return button;
}
test('Main Solo leaves Library unconstructed through Start, then public Workshop opens the same paused run', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  assert.equal(
    page.$('prepare-backup-set') === null,
    true,
    'Unopened Library must not construct its backup presenter',
  );
  assert.equal(page.$('builtin-packs').children.length, 0);
  await page.$('shell-featured').onclick();
  await settle(() => {
    page.frame(0);
    return !page.rendered.paused;
  });
  for (let i = 0; i < 16; i++) page.frame(16);
  assert.equal(
    page.$('prepare-backup-set') === null,
    true,
    'Unopened Library must not construct its backup presenter',
  );
  page.key('Escape');
  page.key('Escape', false);
  page.frame(0);
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run);
  page.$('overlay-menu').click();
  page.$('shell-options').click();
  page.$('settings-tab-extras').click();
  page.$('shell-workshop').click();
  const button = page.$('shell-library');
  assert.equal(button.closest('[hidden]'), null);
  button.click();
  assert.equal(page.$('library-dialog').open, true);
  await settle(() => page.$('prepare-backup-set') && page.$('library-dialog-entry-status').hidden);
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.equal(page.$('library-scores').hidden, false);
  const originalBackup = page.$('prepare-backup-set');
  page.doc.querySelector('[data-library-panel="saves"]').click();
  await settle(() => !page.$('library-saves').hidden);
  assert.equal(
    page.$('prepare-backup-set'),
    originalBackup,
    'Repeated public opens reuse the original presenter',
  );
  page.$('library-dialog').close();
  page.frame(0);
  assert.deepEqual(page.errors, []);
});
test('public Collection owns its modal while lazy gallery preparation preserves run and storage', async (t) => {
  const page = await soloPage(t, { titleScreen: true });
  const run = page.rendered.run,
    checkpoint = authoritativeCheckpoint(run),
    storage = [...page.storage.map];
  page.$('shell-options').click();
  page.$('settings-tab-data').click();
  page.$('shell-gallery').click();
  assert.equal(page.$('collection-dialog').open, true);
  assert.equal(page.$('library-dialog').open, false);
  await settle(
    () =>
      page.$('prepare-backup-set') &&
      (!page.$('collection-dialog-entry-status') ||
        page.$('collection-dialog-entry-status').hidden),
  );
  assert.equal(page.rendered.run, run);
  assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
  assert.deepEqual([...page.storage.map], storage);
  assert.deepEqual(page.errors, []);
});

test('actual Solo static graph excludes Worlds while its literal import remains in offline code', async () => {
  const root = new URL('../../', import.meta.url);
  const sources = new Map();
  async function source(path) {
    if (!sources.has(path)) sources.set(path, await readFile(new URL(path, root)));
    return sources.get(path);
  }
  async function staticGraph(entry) {
    const seen = new Set();
    const pending = [entry];
    while (pending.length) {
      const path = pending.pop();
      if (seen.has(path)) continue;
      seen.add(path);
      const ast = parse((await source(path)).toString(), {
        ecmaVersion: 'latest',
        sourceType: 'module',
      });
      for (const node of ast.body) {
        if (
          !['ImportDeclaration', 'ExportNamedDeclaration', 'ExportAllDeclaration'].includes(
            node.type,
          ) ||
          !node.source
        )
          continue;
        assert.match(
          node.source.value,
          /^\.\.?\//,
          'The actual browser graph uses relative module imports.',
        );
        const target = new URL(node.source.value, new URL(path, root));
        assert.ok(
          target.href.startsWith(root.href),
          'Static imports stay in the actual source root.',
        );
        assert.equal(target.search, '');
        assert.equal(target.hash, '');
        pending.push(target.href.slice(root.href.length));
      }
    }
    return seen;
  }
  const eager = await staticGraph('game/app.mjs');
  for (const path of [
    'game/ui/optional-chapters-panel.mjs',
    'game/ui/optional-chapter-copy.mjs',
    'game/ui/worlds-browser.mjs',
  ])
    assert.equal(eager.has(path), false, `${path} must not be loaded by another eager route.`);
  const optional = await staticGraph('game/ui/optional-chapters-panel.mjs');
  await source('game/index.html');
  await source('game/boot.mjs');
  const core = selectOfflineCore(
    [...sources].map(([name, bytes]) => ({ name, bytes })),
    new Set(),
  );
  for (const path of optional)
    assert.ok(core.retained.has(path), `${path} stays available through the actual lazy import.`);
});

test(
  'public Worlds coalesces a delayed import, keeps its parent usable and reuses one owner',
  { timeout: 20000 },
  async (t) => {
    const gate = await holdWorldsImport(t);
    gate.mark('host-boot');
    const page = await worldsPage(t);
    gate.mark('host-ready', page);
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    assert.equal(gate.state.entered, 0, 'Boot must not request the optional module.');
    assert.equal(page.$('optional-worlds-dialog'), null);
    const opener = worldsOpener(page);
    const storage = [...page.storage.map];
    const firstOpening = observeWorldsAction(gate, opener);
    await waitForWorldsImport(gate, page, firstOpening);
    assert.equal(page.$('settings-dialog').open, true);
    assert.equal(page.doc.activeElement, opener);
    assert.equal(page.$('optional-worlds-dialog'), null);
    assert.equal(
      page.$('optional-worlds-opening-status').textContent,
      translate('interface:loading'),
    );
    const secondOpening = observeWorldsAction(gate, opener);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(gate.state.entered, 1, 'A second current opening shares the pending import.');
    await gate.release();
    await joinWorldsAction(gate, page, firstOpening, 'superseded-action-completion');
    await joinWorldsAction(gate, page, secondOpening, 'current-action-completion');
    await gate.wait('panel-mount', () => page.$('optional-worlds-dialog')?.open, page);
    assert.equal(gate.state.released, 1);
    const panel = page.$('optional-worlds-dialog');
    await gate.wait('panel-catalogue', () => !page.$('optional-worlds-reload').disabled, page);
    assert.equal(page.doc.activeElement, page.$('optional-worlds-top-back'));
    assert.equal(page.$('optional-worlds-opening-status'), null);
    assert.equal(page.doc.querySelectorAll('.optional-worlds-dialog').length, 1);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual([...page.storage.map], storage);
    page.$('optional-worlds-top-back').click();
    worldsOpener(page).click();
    assert.equal(page.$('optional-worlds-dialog'), panel);
    assert.equal(panel.open, true, 'An already-owned panel opens in the same input turn.');
    assert.equal(page.doc.querySelectorAll('.optional-worlds-dialog').length, 1);
    assert.deepEqual(page.errors, []);
  },
);

test(
  'a failed Worlds import keeps the actual parent and can be explicitly retried',
  { timeout: 20000 },
  async (t) => {
    const first = await holdWorldsImport(t);
    first.mark('host-boot');
    const page = await worldsPage(t);
    first.mark('host-ready', page);
    const opener = worldsOpener(page);
    const failedOpening = observeWorldsAction(first, opener);
    await waitForWorldsImport(first, page, failedOpening);
    await first.release(true);
    await joinWorldsAction(first, page, failedOpening, 'failed-import-action-completion');
    await first.wait(
      'retry-feedback',
      () =>
        page.$('optional-worlds-opening-status')?.textContent ===
        translate('interface:loadingInterruptedRetryWhenReady'),
      page,
    );
    assert.equal(first.state.released, 1);
    assert.equal(page.$('settings-dialog').open, true);
    assert.equal(page.$('optional-worlds-dialog'), null);
    const second = await holdWorldsImport(t);
    const retriedOpening = observeWorldsAction(second, opener);
    await waitForWorldsImport(second, page, retriedOpening);
    await second.release();
    await joinWorldsAction(second, page, retriedOpening, 'retry-action-completion');
    await second.wait('retry-panel-mount', () => page.$('optional-worlds-dialog')?.open, page);
    assert.equal(second.state.released, 1);
    assert.equal(page.$('optional-worlds-opening-status'), null);
    assert.deepEqual(page.errors, []);
  },
);

for (const [name, retire] of [
  [
    'new keyboard input',
    (page) =>
      page.doc.activeElement.emit('keydown', { key: 'Shift', code: 'ShiftLeft', repeat: false }),
  ],
  ['focus movement', (page) => page.$('settings-tab-audio').focus()],
  ['replacement modal', (page) => page.$('help-dialog').showModal()],
  [
    'hidden then visible page',
    (page) => {
      page.doc.hidden = true;
      page.doc.emit('visibilitychange');
      page.doc.hidden = false;
      page.doc.emit('visibilitychange');
    },
  ],
  [
    'blur then focus',
    (page) => {
      page.win.emit('blur');
      page.win.emit('focus');
    },
  ],
  ['history-cache departure', (page) => page.win.emit('pagehide', { persisted: true })],
  ['terminal page departure', (page) => page.win.emit('pagehide', { persisted: false })],
]) {
  test(
    `a delayed public Worlds import cannot mount after ${name}`,
    { timeout: 20000 },
    async (t) => {
      const gate = await holdWorldsImport(t);
      gate.mark('host-boot');
      const page = await worldsPage(t);
      gate.mark('host-ready', page);
      const opener = worldsOpener(page);
      const run = page.rendered.run;
      const checkpoint = authoritativeCheckpoint(run);
      const opening = observeWorldsAction(gate, opener);
      await waitForWorldsImport(gate, page, opening);
      const pending = page.$('optional-worlds-opening-status');
      assert.ok(pending);
      retire(page);
      const focused = page.doc.activeElement;
      await gate.release();
      await joinWorldsAction(gate, page, opening);
      await gate.wait('retired-feedback', () => !page.$('optional-worlds-opening-status'), page);
      assert.equal(gate.state.released, 1);
      assert.equal(page.$('optional-worlds-dialog'), null);
      assert.equal(page.doc.activeElement, focused, 'Retired work cannot reclaim focus.');
      assert.equal(page.rendered.run, run);
      assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
      assert.deepEqual(page.errors, []);
    },
  );
}

test(
  'Direct Start does not import Worlds and a retained opener cannot interrupt active play',
  { timeout: 20000 },
  async (t) => {
    const gate = await holdWorldsImport(t);
    gate.mark('host-boot');
    const page = await worldsPage(t);
    gate.mark('host-ready', page);
    const staleOpen = page.$('shell-worlds').onclick;
    await activateHostAction(page.$('shell-featured'));
    await settle(() => {
      page.frame(0);
      return !page.rendered.paused;
    });
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    await staleOpen();
    page.frame(0);
    assert.equal(page.rendered.paused, false);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.equal(gate.state.entered, 0);
    assert.equal(page.$('optional-worlds-dialog'), null);
    assert.deepEqual(page.errors, []);
  },
);

test(
  'a cancelled Worlds import finishing after Direct Start cannot mount over active play',
  { timeout: 20000 },
  async (t) => {
    const gate = await holdWorldsImport(t);
    gate.mark('host-boot');
    const page = await worldsPage(t);
    gate.mark('host-ready', page);
    const opening = observeWorldsAction(gate, worldsOpener(page));
    await waitForWorldsImport(gate, page, opening);
    page.$('settings-dialog').close();
    await activateHostAction(page.$('shell-featured'));
    await settle(() => {
      page.frame(0);
      return !page.rendered.paused;
    });
    const run = page.rendered.run;
    const checkpoint = authoritativeCheckpoint(run);
    await gate.release();
    await joinWorldsAction(gate, page, opening);
    await gate.wait('retired-feedback', () => !page.$('optional-worlds-opening-status'), page);
    assert.equal(gate.state.released, 1);
    page.frame(0);
    assert.equal(page.rendered.paused, false);
    assert.equal(page.$('optional-worlds-dialog'), null);
    assert.equal(page.rendered.run, run);
    assert.deepEqual(authoritativeCheckpoint(run), checkpoint);
    assert.deepEqual(page.errors, []);
  },
);
