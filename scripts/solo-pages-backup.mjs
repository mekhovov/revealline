/* global document, location, getComputedStyle */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

export const PAGES_BACKUP_LIMIT = 1024 * 1024;
const scope = 'fresh-profile-progress-backup';
export function inspectPagesBackupBytes(bytes, filename) {
  assert(Buffer.isBuffer(bytes) && bytes.length > 0 && bytes.length <= PAGES_BACKUP_LIMIT);
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new Error('Downloaded backup is not bounded UTF-8 JSON');
  }
  assert(
    /^revealline-journey-backup\.v[1-5]$/.test(value?.format),
    'Journey backup envelope required',
  );
  assert.equal(value.profile?.format, 'revealline-journey-profile.v1');
  assert(Number.isSafeInteger(value.profile.generation) && value.profile.generation >= 0);
  const modes = Object.keys(value.profile.cursors ?? {});
  assert(modes.length > 0 && modes.length <= 16);
  assert.deepEqual(Object.keys(value.profile.skipped ?? {}).sort(), [...modes].sort());
  assert.deepEqual(Object.keys(value.profile.clears ?? {}).sort(), [...modes].sort());
  for (const mode of modes) {
    const cursor = value.profile.cursors[mode];
    assert(cursor === null || (typeof cursor === 'string' && cursor.length <= 1024));
    assert.deepEqual(value.profile.skipped[mode], [], 'Fresh observation must not skip a mission');
    assert.deepEqual(value.profile.clears[mode], {}, 'Fresh observation must not earn a result');
  }
  assert(!/-recovery\.json$/.test(filename), 'Partial recovery filename refused');
  assert(value.partial !== true && value.recovery !== true, 'Partial recovery marker refused');
  const profileKey = value.profileKey ?? 'journey';
  assert.equal(profileKey, 'journey-whole-spatial-v25', 'Fixed edition backup required');
  assert(typeof profileKey === 'string' && /^[a-z][a-z0-9-]{0,79}$/.test(profileKey));
  assert.equal(filename, 'revealline-' + profileKey + '-progress.json');
  return {
    format: 'PagesFreshBackupDownloadV1',
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    backupFormat: value.format,
    profileKey,
    modeCount: modes.length,
    schemaScope: 'basic-backup-envelope-only',
    recoveryFilename: false,
    completeness: 'ordinary-filename-basic-envelope-only',
  };
}
export async function discardPagesBackupDownload(download, budget, receipt = {}) {
  if (receipt.status) return receipt;
  receipt.status = 'discarding';
  receipt.cancel = 'attempted';
  receipt.delete = 'attempted';
  const cap = Math.max(0, Math.min(10000, budget.deadline - budget.now()));
  let timer,
    active = true;
  const invoke = (key, work) =>
    Promise.resolve()
      .then(work)
      .then(
        () => {
          if (active) receipt[key] = 'complete';
        },
        (error) => {
          if (active) {
            receipt[key] = 'failed';
            receipt[key + 'Failure'] = String(error?.message ?? error).slice(0, 512);
          }
        },
      );
  try {
    // Cleanup does not renew or consult the stopped operation budget. Both
    // owned requests are issued even when the reader failed or time ran out.
    await Promise.race([
      Promise.all([
        invoke('cancel', () => download.cancel()),
        invoke('delete', () => download.delete()),
      ]),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Owned backup discard deadline')), cap);
      }),
    ]);
    assert(cap > 0 && budget.now() < budget.deadline, 'Owned backup discard deadline');
    assert(
      receipt.cancel === 'complete' && receipt.delete === 'complete',
      'Owned backup discard failed',
    );
    receipt.status = 'discarded';
  } catch (error) {
    receipt.status = 'failed';
    receipt.failure = String(error?.message ?? error).slice(0, 512);
  } finally {
    active = false;
    clearTimeout(timer);
  }
  return receipt;
}
export async function readPagesBackupDownload(download, budget, cleanup = {}) {
  let stream,
    active = true,
    result,
    failure;
  try {
    result = await budget.step(
      'read ordinary progress download',
      async () => {
        const url = new URL(download.url());
        assert.equal(url.protocol, 'blob:');
        assert.equal(url.origin, 'https://mekhovov.github.io');
        const filename = download.suggestedFilename();
        assert(typeof filename === 'string' && filename.length <= 128);
        // Playwright exposes this stream after browser acquisition completes.
        // The limit below bounds retained/read/parsed bytes, not acquisition.
        stream = await download.createReadStream();
        assert(stream, 'Ordinary backup download stream required');
        if (!active) {
          stream.destroy();
          throw new Error('Late backup reader');
        }
        const chunks = [];
        let bytes = 0;
        for await (const chunk of stream) {
          assert(active, 'Late backup reader');
          bytes += chunk.length;
          assert(bytes <= PAGES_BACKUP_LIMIT, 'Fresh backup exceeds one MiB retained-reader bound');
          chunks.push(Buffer.from(chunk));
        }
        assert.equal(await download.failure(), null, 'Ordinary backup download failed');
        return inspectPagesBackupBytes(Buffer.concat(chunks), filename);
      },
      30000,
    );
  } catch (error) {
    failure = error;
  } finally {
    active = false;
    stream?.destroy();
    await discardPagesBackupDownload(download, budget, cleanup);
  }
  if (failure) throw failure;
  assert.equal(cleanup.status, 'discarded', cleanup.failure ?? 'Owned backup discard incomplete');
  return result;
}
export function readPagesBackupState() {
  const visible = (element) =>
    Boolean(
      element &&
        element.isConnected &&
        !element.hidden &&
        !element.closest('[hidden]') &&
        getComputedStyle(element).display !== 'none' &&
        getComputedStyle(element).visibility !== 'hidden' &&
        element.getClientRects().length,
    );
  const ids = [
    'shell-home',
    'shell-featured',
    'start-button',
    'journey-chooser',
    'journey-backup',
    'journey-backup-open',
    'journey-backup-export',
    'mission-replace-dialog',
    'mode-leave-dialog',
  ];
  const text = (id) => (document.getElementById(id)?.textContent ?? '').trim().slice(0, 256);
  return {
    href: location.href,
    hidden: document.hidden,
    focused: document.hasFocus(),
    bootState: document.documentElement.dataset.bootState,
    bootHidden: document.getElementById('boot-screen')?.hidden === true,
    phase: document.body.dataset.flightState,
    time: text('time'),
    lives: text('lives'),
    coverage: text('coverage'),
    controls: Object.fromEntries(
      ids.map((id) => {
        const node = document.getElementById(id);
        return [
          id,
          { visible: visible(node), open: Boolean(node?.open), enabled: !node?.disabled },
        ];
      }),
    ),
  };
}
const pausedIdentity = (state) => ({
  phase: state.phase,
  time: state.time,
  lives: state.lives,
  coverage: state.coverage,
});
export function assertPagesBackupEvidence(record) {
  assert.equal(record?.format, 'PagesFreshBackupObservationV1');
  assert.equal(record.scope, scope);
  assert.equal(record.downloadCount, 1);
  assert.equal(record.downloadDiscarded, true);
  const download = record.download;
  assert.equal(download?.format, 'PagesFreshBackupDownloadV1');
  assert(
    Number.isSafeInteger(download.bytes) &&
      download.bytes > 0 &&
      download.bytes <= PAGES_BACKUP_LIMIT,
  );
  assert.match(download.sha256, /^[a-f0-9]{64}$/);
  assert.match(download.backupFormat, /^revealline-journey-backup\.v[1-5]$/);
  assert.match(download.profileKey, /^[a-z][a-z0-9-]{0,79}$/);
  assert(
    Number.isSafeInteger(download.modeCount) && download.modeCount > 0 && download.modeCount <= 16,
  );
  assert.equal(download.schemaScope, 'basic-backup-envelope-only');
  assert.equal(download.profileKey, 'journey-whole-spatial-v25');
  assert.equal(download.recoveryFilename, false);
  assert.equal(download.completeness, 'ordinary-filename-basic-envelope-only');
  assert.equal(record.downloadCleanup?.length, 1);
  assert.equal(record.downloadCleanup[0].status, 'discarded');
  assert.equal(record.downloadCleanup[0].cancel, 'complete');
  assert.equal(record.downloadCleanup[0].delete, 'complete');
  assert.equal(record.before?.phase, 'paused');
  assert(record.before.time.length > 0 && record.before.lives.length > 0);
  assert.deepEqual(record.after, record.before, 'Backup export changed paused public state');
  assert.deepEqual(record.actions, [
    '#shell-featured',
    '#pause-button',
    '#shell-menu',
    '#shell-play',
    '#journey-backup-open',
    '#journey-backup-export',
    '#journey-backup-back',
    '#journey-back',
  ]);
  return {
    scope,
    downloaded: true,
    pausedPublicStateUnchanged: true,
    performanceExcluded: true,
    limitations:
      'Fresh-profile basic envelope and ordinary export filename only; no complete-evidence, restore, historical-save, durable-save or large-backup qualification.',
  };
}
export async function executePagesBackupFlow(page, budget, record) {
  Object.assign(record, {
    format: 'PagesFreshBackupObservationV1',
    scope,
    actions: [],
    downloadCount: 0,
    downloadDiscarded: false,
    downloadCleanup: [],
  });
  const read = async () => {
    const state = await budget.step('backup public state', () =>
      page.evaluate(readPagesBackupState),
    );
    assert.equal(
      state.href,
      'https://mekhovov.github.io/revealline/game/?journey=whole-spatial-v25',
    );
    assert(!state.hidden && state.focused, 'Backup document must remain foreground');
    assert(
      !state.controls['mission-replace-dialog'].open && !state.controls['mode-leave-dialog'].open,
    );
    return state;
  };
  const until = async (label, accept, cap = 60000) => {
    const end = Math.min(budget.deadline, budget.now() + cap);
    for (;;) {
      assert(budget.now() < end, 'Backup state deadline: ' + label);
      const state = await read();
      assert(budget.now() < end, 'Backup state deadline: ' + label);
      if (accept(state)) return state;
      const remaining = end - budget.now();
      await budget.step(
        'backup state wait',
        () => page.waitForTimeout(Math.min(100, remaining)),
        Math.min(1000, remaining),
      );
    }
  };
  const open = (s, id) => s.controls[id].visible && s.controls[id].open;
  const click = async (selector) => {
    await budget.step('backup public click ' + selector, (timeout) =>
      page.locator(selector).click({ timeout }),
    );
    record.actions.push(selector);
  };
  const home = await until(
    'Home',
    (s) => s.bootState === 'ready' && s.bootHidden && open(s, 'shell-home'),
    120000,
  );
  assert(home.controls['shell-featured'].visible && home.controls['shell-featured'].enabled);
  await click('#shell-featured');
  const running = await until('running', (s) => s.phase === 'running');
  await until(
    'clock advancement',
    (s) => s.phase === 'running' && s.time.length > 0 && s.time !== running.time,
  );
  await click('#pause-button');
  const paused = await until(
    'paused',
    (s) => s.phase === 'paused' && s.controls['start-button'].visible,
  );
  record.before = pausedIdentity(paused);
  await click('#shell-menu');
  await until('Home from pause', (s) => open(s, 'shell-home'));
  await click('#shell-play');
  await until('Missions', (s) => open(s, 'journey-chooser'));
  await click('#journey-backup-open');
  const backup = await until('Backup', (s) => open(s, 'journey-backup'));
  assert.deepEqual(pausedIdentity(backup), record.before);
  assert(
    backup.controls['journey-backup-export'].visible &&
      backup.controls['journey-backup-export'].enabled,
  );
  const ownedDownloads = new Map();
  const downloaded = (download) => {
    record.downloadCount++;
    if (ownedDownloads.has(download) || ownedDownloads.size >= 2) return;
    const cleanup = {};
    ownedDownloads.set(download, cleanup);
    record.downloadCleanup.push(cleanup);
  };
  page.on('download', downloaded);
  try {
    const [download] = await budget.step(
      'ordinary backup Export activation',
      (timeout) =>
        Promise.all([
          page.waitForEvent('download', { timeout }),
          page.locator('#journey-backup-export').click({ timeout }),
        ]),
      30000,
    );
    record.actions.push('#journey-backup-export');
    assert(ownedDownloads.has(download), 'Downloaded event ownership required');
    record.download = await readPagesBackupDownload(download, budget, ownedDownloads.get(download));
    assert.equal(record.downloadCount, 1, 'Exactly one ordinary download required');
    await click('#journey-backup-back');
    await until(
      'Back to Missions',
      (s) => !s.controls['journey-backup'].open && open(s, 'journey-chooser'),
    );
    await click('#journey-back');
    const returned = await until(
      'Back to Home',
      (s) => !s.controls['journey-chooser'].open && open(s, 'shell-home'),
    );
    record.after = pausedIdentity(returned);
  } finally {
    page.off('download', downloaded);
    for (const [download, cleanup] of ownedDownloads)
      await discardPagesBackupDownload(download, budget, cleanup);
    record.downloadDiscarded =
      record.downloadCleanup.length > 0 &&
      record.downloadCleanup.every((entry) => entry.status === 'discarded');
  }
  assertPagesBackupEvidence(record);
}
