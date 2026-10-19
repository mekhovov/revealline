import assert from 'node:assert/strict';
import test from 'node:test';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import {
  PAGES_BACKUP_LIMIT,
  inspectPagesBackupBytes,
  readPagesBackupDownload,
  readPagesBackupState,
  assertPagesBackupEvidence,
  executePagesBackupFlow,
} from './solo-pages-backup.mjs';
import { pagesBudget } from './solo-pages-smoke.mjs';

const filename = 'revealline-journey-whole-spatial-v25-progress.json';
const payload = () => ({
  format: 'revealline-journey-backup.v2',
  profileKey: 'journey-whole-spatial-v25',
  profile: {
    format: 'revealline-journey-profile.v1',
    generation: 0,
    cursors: { solo: 'candidate/journey-opening/prologue/choose-your-share' },
    skipped: { solo: [] },
    clears: { solo: {} },
  },
});
const bytes = (value = payload()) => Buffer.from(JSON.stringify(value));
const actions = [
  '#shell-featured',
  '#pause-button',
  '#shell-menu',
  '#shell-play',
  '#journey-backup-open',
  '#journey-backup-export',
  '#journey-backup-back',
  '#journey-back',
];
export function validBackupRecord() {
  const before = { phase: 'paused', time: '00:01', lives: '3', coverage: '0%' };
  return {
    format: 'PagesFreshBackupObservationV1',
    scope: 'fresh-profile-progress-backup',
    downloadCount: 1,
    downloadDiscarded: true,
    downloadCleanup: [{ status: 'discarded', cancel: 'complete', delete: 'complete' }],
    download: inspectPagesBackupBytes(bytes(), filename),
    before,
    after: { ...before },
    actions: [...actions],
  };
}
function downloadModel(options = {}) {
  const calls = [];
  const stream = options.stream ?? Readable.from(options.chunks ?? [bytes()]);
  return {
    calls,
    stream,
    download: {
      url: () => options.url ?? 'blob:https://mekhovov.github.io/modeled',
      suggestedFilename: () => options.filename ?? filename,
      createReadStream: async () => {
        calls.push('stream');
        return stream;
      },
      failure: async () => options.failure ?? null,
      cancel: async () => {
        calls.push('cancel');
      },
      delete: async () => {
        calls.push('delete');
        if (options.deleteFailure) throw new Error('delete failed');
      },
    },
  };
}
test('fresh backup inspection retains bounded metadata and no downloaded profile data', () => {
  const result = inspectPagesBackupBytes(bytes(), filename);
  assert.equal(result.bytes, bytes().length);
  assert.equal(result.modeCount, 1);
  assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.schemaScope, 'basic-backup-envelope-only');
  assert(!JSON.stringify(result).includes('candidate/'));
  assert.equal(result.profile, undefined);
});
test('fresh backup refuses malformed bytes, wrong or recovery filenames and earned progress', () => {
  for (const raw of [
    Buffer.from('no JSON'),
    Buffer.from([255]),
    Buffer.alloc(0),
    Buffer.alloc(PAGES_BACKUP_LIMIT + 1),
  ])
    assert.throws(() => inspectPagesBackupBytes(raw, filename));
  for (const name of ['arbitrary.json', filename.replace('.json', '-recovery.json')])
    assert.throws(() => inspectPagesBackupBytes(bytes(), name));
  for (const mutate of [
    (v) => {
      v.format = 'arbitrary';
    },
    (v) => {
      v.profile.generation = -1;
    },
    (v) => {
      v.profile.clears.solo = { earned: {} };
    },
    (v) => {
      v.profile.skipped.solo = ['skip'];
    },
    (v) => {
      v.profile.cursors.solo = 17;
    },
    (v) => {
      v.profileKey = '../secret';
    },
    (v) => {
      v.profile.cursors = {};
      v.profile.skipped = {};
      v.profile.clears = {};
    },
  ]) {
    const value = payload();
    mutate(value);
    assert.throws(() => inspectPagesBackupBytes(bytes(value), filename));
  }
});
test('ordinary download is read then owned temporary bytes are discarded', async () => {
  const model = downloadModel();
  const result = await readPagesBackupDownload(model.download, pagesBudget(5000));
  assert.equal(result.bytes, bytes().length);
  assert.deepEqual(model.calls, ['stream', 'cancel', 'delete']);
  assert.equal(model.stream.destroyed, true);
});
test('invalid origin, partial export, failed download and oversized chunks cannot escape cleanup', async () => {
  for (const options of [
    { url: 'https://mekhovov.github.io/file.json' },
    { url: 'blob:https://example.org/id' },
    { filename: filename.replace('.json', '-recovery.json') },
    { failure: 'cancelled' },
    { chunks: [Buffer.alloc(PAGES_BACKUP_LIMIT), Buffer.from('x')] },
  ]) {
    const model = downloadModel(options);
    await assert.rejects(readPagesBackupDownload(model.download, pagesBudget(5000)));
    assert.deepEqual(model.calls.slice(-2), ['cancel', 'delete']);
  }
});
test('stream failure destroys the reader and a failed discard cannot become download success', async () => {
  const broken = downloadModel({
    stream: Readable.from(
      (async function* () {
        yield Buffer.from('{');
        throw new Error('read failed');
      })(),
    ),
  });
  await assert.rejects(readPagesBackupDownload(broken.download, pagesBudget(5000)), /read failed/);
  assert.deepEqual(broken.calls.slice(-2), ['cancel', 'delete']);
  assert.equal(broken.stream.destroyed, true);
  const undeleted = downloadModel({ deleteFailure: true });
  await assert.rejects(
    readPagesBackupDownload(undeleted.download, pagesBudget(5000)),
    /Owned backup discard failed/,
  );
});
test('independent backup assessment refuses duplicate, undiscarded, partial or changed paused state', () => {
  assert.equal(assertPagesBackupEvidence(validBackupRecord()).performanceExcluded, true);
  for (const change of [
    (r) => {
      r.downloadCount = 2;
    },
    (r) => {
      r.downloadDiscarded = false;
    },
    (r) => {
      r.download.recoveryFilename = true;
    },
    (r) => {
      r.download.bytes = PAGES_BACKUP_LIMIT + 1;
    },
    (r) => {
      r.download.sha256 = 'invalid';
    },
    (r) => {
      r.before.phase = 'running';
    },
    (r) => {
      r.after.time = '00:02';
    },
    (r) => {
      r.actions.push('#start-button');
    },
  ]) {
    const record = validBackupRecord();
    change(record);
    assert.throws(() => assertPagesBackupEvidence(record));
  }
});
function flowModel(options = {}) {
  const page = new EventEmitter(),
    calls = [];
  const model = downloadModel(options);
  let at = 0,
    next = 0,
    clockReads = 0,
    stage = 'home',
    phase = 'briefing',
    waitDownload;
  const now = () => at;
  page.evaluate = async (callback) => {
    assert.equal(callback, readPagesBackupState);
    at += 1;
    if (phase === 'running') clockReads++;
    const visible = (id) =>
      (id === 'shell-home' && stage === 'home') ||
      (id === 'shell-featured' && stage === 'home') ||
      (id === 'start-button' && phase === 'paused') ||
      (id === 'journey-chooser' && stage === 'missions') ||
      (id.startsWith('journey-backup') && stage === 'backup');
    return {
      href: 'https://mekhovov.github.io/revealline/game/?journey=whole-spatial-v25',
      hidden: options.hidden === true,
      focused: true,
      bootState: 'ready',
      bootHidden: true,
      phase,
      time: clockReads > 1 ? '00:01' : '00:00',
      lives: '3',
      coverage: '0%',
      controls: Object.fromEntries(
        [
          'shell-home',
          'shell-featured',
          'start-button',
          'journey-chooser',
          'journey-backup',
          'journey-backup-open',
          'journey-backup-export',
          'mission-replace-dialog',
          'mode-leave-dialog',
        ].map((id) => [
          id,
          {
            visible: visible(id),
            enabled: true,
            open: visible(id) && ['shell-home', 'journey-chooser', 'journey-backup'].includes(id),
          },
        ]),
      ),
    };
  };
  page.waitForTimeout = async (ms) => {
    at += ms;
  };
  page.waitForEvent = (name) => {
    assert.equal(name, 'download');
    return new Promise((resolve) => {
      waitDownload = resolve;
    });
  };
  page.locator = (selector) => ({
    click: async () => {
      assert.equal(
        selector,
        actions[next++],
        'Only the declared ordinary UI sequence is available',
      );
      calls.push(selector);
      if (selector === '#shell-featured') {
        stage = 'board';
        phase = options.startPaused ? 'paused' : 'running';
      }
      if (selector === '#pause-button') phase = 'paused';
      if (selector === '#shell-menu' || selector === '#journey-back') stage = 'home';
      if (selector === '#shell-play' || selector === '#journey-backup-back') stage = 'missions';
      if (selector === '#journey-backup-open') stage = 'backup';
      if (selector === '#journey-backup-export') {
        assert(waitDownload, 'The ordinary download must be armed before activation');
        page.emit('download', model.download);
        if (options.duplicateDownload) page.emit('download', model.download);
        waitDownload(model.download);
        if (options.clickAfterDownloadFailure) throw new Error('activation failed');
      }
    },
  });
  return { page, now, calls, model };
}
test('fresh backup follows one ordinary paused Export and returns Home without replay or private browser API', async () => {
  const model = flowModel(),
    record = {};
  await executePagesBackupFlow(model.page, pagesBudget(570000, model.now), record);
  assertPagesBackupEvidence(record);
  assert.deepEqual(model.calls, actions);
  assert.equal(model.page.listenerCount('download'), 0);
  assert.deepEqual(model.model.calls.slice(-2), ['cancel', 'delete']);
});
test('duplicate ordinary download fails and always detaches its observer', async () => {
  const model = flowModel({ duplicateDownload: true }),
    record = {};
  await assert.rejects(
    executePagesBackupFlow(model.page, pagesBudget(570000, model.now), record),
    /Exactly one/,
  );
  assert.equal(record.downloadCount, 2);
  assert.equal(model.page.listenerCount('download'), 0);
  assert.deepEqual(model.model.calls.slice(-2), ['cancel', 'delete']);
});
test('hidden or automatically paused Direct Start is not silently resumed', async () => {
  for (const options of [{ hidden: true }, { startPaused: true }]) {
    const model = flowModel(options);
    await assert.rejects(executePagesBackupFlow(model.page, pagesBudget(570000, model.now), {}));
    assert(!model.calls.includes('#start-button'));
    assert(!model.calls.includes('#journey-backup-export'));
    assert.equal(model.page.listenerCount('download'), 0);
  }
});

test('wrong-edition and explicit recovery exports cannot pass ordinary download inspection', () => {
  const value = payload();
  value.profileKey = 'journey-other';
  assert.throws(
    () => inspectPagesBackupBytes(bytes(value), 'revealline-journey-other-progress.json'),
    /edition/,
  );
  const partial = payload();
  partial.partial = true;
  assert.throws(() => inspectPagesBackupBytes(bytes(partial), filename), /recovery/);
});
test('failed read keeps its primary cause and records successful independent cleanup', async () => {
  const model = downloadModel({ chunks: [Buffer.from('not JSON')] }),
    cleanup = {};
  await assert.rejects(
    readPagesBackupDownload(model.download, pagesBudget(5000), cleanup),
    /UTF-8 JSON/,
  );
  assert.deepEqual(model.calls.slice(-2), ['cancel', 'delete']);
  assert.equal(cleanup.status, 'discarded');
});
test('failed read and failed discard retain separate causes', async () => {
  const model = downloadModel({ chunks: [Buffer.from('not JSON')], deleteFailure: true }),
    cleanup = {};
  await assert.rejects(
    readPagesBackupDownload(model.download, pagesBudget(5000), cleanup),
    /UTF-8 JSON/,
  );
  assert.equal(cleanup.status, 'failed');
  assert.match(cleanup.deleteFailure, /delete failed/);
});
test('a stream arriving after the read deadline is destroyed without later retention', async () => {
  const model = downloadModel(),
    cleanup = {};
  let release;
  model.download.createReadStream = () =>
    new Promise((resolve) => {
      release = resolve;
    });
  const pending = readPagesBackupDownload(model.download, pagesBudget(20), cleanup);
  await assert.rejects(pending, /expired/);
  assert.deepEqual(model.calls.slice(-2), ['cancel', 'delete']);
  release(model.stream);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(model.stream.destroyed, true);
});
test('a download event followed by click rejection remains owned and is discarded', async () => {
  const model = flowModel({ clickAfterDownloadFailure: true }),
    record = {};
  await assert.rejects(
    executePagesBackupFlow(model.page, pagesBudget(570000, model.now), record),
    /activation failed/,
  );
  assert.equal(record.downloadCount, 1);
  assert.deepEqual(model.model.calls, ['cancel', 'delete']);
  assert.equal(record.downloadCleanup[0].status, 'discarded');
  assert.equal(model.page.listenerCount('download'), 0);
});
