import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEnemyStats,
  createEnemyStatsHost,
  forkEnemyStatsSession,
  ENEMY_STATS_KEY,
  emptyEnemyStats,
  mergeEnemyStats,
  validateEnemyStatsSession,
} from '../enemy-stats.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { JOURNEY_PROFILE_DATABASE } from '../profile-database.mjs';
import { createProfileRecordBackend } from '../profile-storage.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { mountEnemyStats } from '../ui/enemy-stats.mjs';
import { emptyLibrary } from '../library.mjs';
import { emptyPackLibrary } from '../packs.mjs';
import {
  exportBackup,
  prepareBackup,
  BACKUP_FORMAT,
  ACHIEVEMENT_BACKUP_FORMAT,
} from '../backup.mjs';

const storage = () => {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
};
function make(t, options = {}) {
  const model = options.model ?? managedIndexedDB();
  const stats = createEnemyStats({ indexedDB: model.indexedDB, storage: storage(), ...options });
  t.after(() => stats.close());
  return { stats, model };
}
const catchAt = (stats, attempt, sequence, family = 'humanoid', board = '0') =>
  stats.observe(attempt, { sequence, board, defeats: [{ family }] });

test('live catch batches count once, include bonus enemies, and do not write on empty ticks', async (t) => {
  const { stats, model } = make(t),
    attempt = stats.beginAttempt({ gameType: 'snake' });
  await stats.observe(attempt, { sequence: 1, defeats: [] });
  assert.equal(model.allPuts.length, 0);
  await stats.observe(attempt, {
    sequence: 2,
    defeats: [
      { family: 'humanoid', playerId: 0 },
      { family: 'courier', playerId: 1 },
    ],
  });
  assert.equal(await catchAt(stats, attempt, 2), false);
  assert.deepEqual(stats.totals().byFamily, { lookout: 1, courier: 1 });
  assert.equal(stats.totals({ attempt }).run.total, 2);
  stats.finishAttempt(attempt);
  assert.equal(await catchAt(stats, attempt, 3), false);
  assert.equal(stats.totals().total, 2);
});

test('continue carries cursor and board attribution while replay, imported proof and preview never award', async (t) => {
  const { stats, model } = make(t),
    attempt = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, attempt, 4, 'patroller', '0');
  await catchAt(stats, attempt, 4, 'patroller', '1');
  const saved = stats.session(attempt);
  assert.deepEqual(validateEnemyStatsSession(saved), saved);
  const next = make(t, { model }).stats;
  await next.read();
  const continued = next.beginAttempt({ gameType: 'snake', provenance: 'continue', saved });
  assert.equal(await catchAt(next, continued, 4, 'patroller', '0'), false);
  await catchAt(next, continued, 5, 'patroller');
  assert.equal(next.totals({ attempt: continued }).run.total, 3);
  assert.equal(next.totals().total, 3);
  for (const provenance of ['replay', 'import', 'demo', 'preview']) {
    const recording = next.beginAttempt({ gameType: 'snake', provenance, saved });
    assert.equal(await catchAt(next, recording, 100), false);
  }
  assert.equal(next.totals().total, 3);
});

test('forked local Continue preserves run totals and tick boundaries without awarding historical catches', async (t) => {
  const { stats } = make(t);
  const original = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, original, 5, 'patroller');
  const saved = stats.session(original),
    fork = forkEnemyStatsSession(saved);
  assert.notEqual(fork.attemptId, saved.attemptId);
  assert.deepEqual(fork.counts, saved.counts);
  assert.deepEqual(fork.sequences, saved.sequences);
  const branch = stats.beginAttempt({ gameType: 'snake', provenance: 'continue', saved: fork });
  assert.equal(stats.totals({ attempt: branch }).run.total, 1);
  assert.equal(stats.totals().total, 1);
  assert.equal(await catchAt(stats, branch, 5, 'patroller'), false);
  await catchAt(stats, branch, 6, 'courier');
  assert.equal(stats.totals({ attempt: branch }).run.total, 2);
  assert.equal(stats.totals().total, 2);
  assert.deepEqual(stats.session(original), saved);
});

test('serialized independent tab attempts retain both contributions and duplicate continue callbacks do not add', async (t) => {
  const model = managedIndexedDB(),
    common = storage(),
    a = make(t, { model, storage: common }).stats,
    b = make(t, { model, storage: common }).stats;
  const first = a.beginAttempt({ gameType: 'solo' }),
    second = b.beginAttempt({ gameType: 'team' });
  await Promise.all([catchAt(a, first, 1, 'patroller'), catchAt(b, second, 1, 'patroller')]);
  await a.read();
  assert.equal(a.totals().total, 2);
  const continued = b.beginAttempt({
    gameType: 'solo',
    provenance: 'continue',
    saved: a.session(first),
  });
  await catchAt(b, continued, 1, 'patroller');
  await b.read();
  assert.equal(b.totals().total, 2);
});

test('repeated backup import and independently played descendants use component maxima', async (t) => {
  const a = make(t).stats,
    first = a.beginAttempt({ gameType: 'snake' });
  await catchAt(a, first, 1);
  const backup = a.exportBackup();
  assert.deepEqual(backup.statistics.cursors, {});
  const b = make(t).stats,
    c = make(t).stats;
  for (const branch of [b, c]) {
    await branch.importBackup(backup);
    await branch.importBackup(backup);
    await catchAt(branch, branch.beginAttempt({ gameType: 'snake' }), 1);
  }
  await a.importBackup(b.exportBackup());
  await a.importBackup(c.exportBackup());
  await a.importBackup(c.exportBackup());
  await a.importBackup(backup);
  assert.equal(a.totals().total, 3);
  assert.equal(Object.keys(a.snapshot().lineages).length, 3);
});

test('failed writes stay visible and retry exactly once; absent IndexedDB remains playable', async (t) => {
  const warnings = [],
    { stats, model } = make(t, { onWarning: (error) => warnings.push(error.message) });
  model.failAnyPutAt = 1;
  const attempt = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, attempt, 1);
  await catchAt(stats, attempt, 2);
  assert.equal(stats.totals().total, 2);
  assert.equal(stats.totals().durable, false);
  model.failAnyPutAt = null;
  await stats.flush();
  const reopened = make(t, { model }).stats;
  await reopened.read();
  assert.equal(reopened.totals().total, 2);
  assert.equal(stats.totals().durable, true);
  assert.ok(warnings.length);
  const unavailable = make(t, { indexedDB: null }).stats;
  await catchAt(unavailable, unavailable.beginAttempt({ gameType: 'snake' }), 1);
  assert.equal(unavailable.totals().total, 1);
  assert.equal(unavailable.totals().durable, false);
});

test('an already-open host adopts a backup importer’s new lineage before its next live catch', async (t) => {
  const model = managedIndexedDB(),
    common = storage();
  const host = make(t, { model, storage: common }).stats;
  const attempt = host.beginAttempt({ gameType: 'snake' });
  await catchAt(host, attempt, 1);
  const before = host.exportBackup();
  const importer = make(t, { model, storage: common }).stats;
  const separate = make(t).stats;
  await catchAt(separate, separate.beginAttempt({ gameType: 'worlds' }), 1, 'drone');
  let refreshed = 0;
  host.subscribe(() => refreshed++);
  await importer.importBackup(separate.exportBackup());
  assert.equal(host.totals().total, 2);
  assert.ok(refreshed > 0);
  await importer.importBackup(before);
  await catchAt(host, attempt, 2);
  const after = host.exportBackup();
  assert.equal(Object.keys(after.statistics.lineages).length, 3);
  const originalWriter = Object.keys(before.statistics.lineages)[0];
  assert.equal(after.statistics.lineages[originalWriter]['snake/lookout'], 1);
  const descendant = make(t).stats;
  await descendant.importBackup(before);
  await catchAt(descendant, descendant.beginAttempt({ gameType: 'snake' }), 1);
  await host.importBackup(descendant.exportBackup());
  assert.equal(host.totals().total, 4);
});

test('an aggregate importer drains another host’s failed optimistic contribution before merging its snapshot', async (t) => {
  const model = managedIndexedDB(),
    common = storage();
  const host = make(t, { model, storage: common }).stats;
  const attempt = host.beginAttempt({ gameType: 'snake' });
  model.failAnyPutAt = 1;
  await catchAt(host, attempt, 1);
  const optimistic = host.exportBackup();
  const importer = make(t, { model, storage: common }).stats;
  await assert.rejects(importer.importBackup(optimistic), /pending enemy statistics/);
  assert.equal(host.totals().total, 1);
  model.failAnyPutAt = null;
  await Promise.all([importer.importBackup(optimistic), host.importBackup(optimistic)]);
  await host.flush();
  await importer.read();
  assert.equal(importer.totals().total, 1);
  await catchAt(host, attempt, 2);
  await importer.read();
  assert.equal(importer.totals().total, 2);
});

test('session-only play uses an independent component and preserves it after gaining the saving lease', async (t) => {
  const model = managedIndexedDB(),
    common = storage();
  const owner = make(t, { model, storage: common }).stats;
  await catchAt(owner, owner.beginAttempt({ gameType: 'snake' }), 1);
  const sharedWriter = common.getItem(`${ENEMY_STATS_KEY}:writer`);
  let writable = false;
  const guest = make(t, { model, storage: common, canWrite: () => writable }).stats;
  await guest.read();
  const attempt = guest.beginAttempt({ gameType: 'snake' });
  await catchAt(guest, attempt, 1);
  const exported = guest.exportBackup();
  assert.equal(Object.keys(exported.statistics.lineages).length, 2);
  assert.equal(common.getItem(`${ENEMY_STATS_KEY}:writer`), sharedWriter);
  writable = true;
  await catchAt(guest, attempt, 2);
  await guest.importBackup(exported);
  assert.equal(guest.totals().total, 3);
  assert.equal(guest.totals({ attempt }).run.total, 2);
  assert.equal(guest.snapshot().lineages[sharedWriter]['snake/lookout'], 2);
});

test('unknown sidecars are preserved byte-for-byte and never replaced by optimistic totals', async (t) => {
  const model = managedIndexedDB(),
    unknown = { format: 'future-stats.v9', unknown: ['keep me'] };
  const seed = createProfileRecordBackend({
    key: ENEMY_STATS_KEY,
    empty: () => unknown,
    validate: (x) => x,
    indexedDB: model.indexedDB,
  });
  await seed.update(() => unknown);
  seed.close();
  model.allPuts.length = 0;
  const stats = make(t, { model }).stats;
  await stats.read();
  await catchAt(stats, stats.beginAttempt({ gameType: 'snake' }), 1);
  assert.deepEqual(model.contents().get('profiles').get(ENEMY_STATS_KEY), unknown);
  assert.equal(model.allPuts.length, 0);
  assert.equal(stats.totals().total, 1);
  assert.equal(stats.totals().durable, false);
  assert.equal(JOURNEY_PROFILE_DATABASE, 'revealline-journey-v1');
});

test('session-only writers cannot persist and malformed counts never merge', async (t) => {
  const { stats, model } = make(t, { canWrite: () => false });
  await catchAt(stats, stats.beginAttempt({ gameType: 'snake' }), 1);
  assert.equal(model.allPuts.length, 0);
  assert.equal(stats.totals().durable, false);
  assert.throws(() =>
    mergeEnemyStats(emptyEnemyStats(), {
      ...emptyEnemyStats(),
      lineages: { writer: { 'snake/lookout': -1 } },
    }),
  );
});

test('a protected browser storage getter cannot prevent game bootstrap', async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', {
    configurable: true,
    get() {
      throw new DOMException('Blocked browser storage', 'SecurityError');
    },
  });
  let stats;
  try {
    stats = createEnemyStats({ storage: storage() });
    await stats.read();
    await catchAt(stats, stats.beginAttempt({ gameType: 'team' }), 1);
    assert.equal(stats.totals().total, 1);
    assert.equal(stats.totals().durable, false);
  } finally {
    stats?.close();
    if (previous) Object.defineProperty(globalThis, 'indexedDB', previous);
    else delete globalThis.indexedDB;
  }
});

test('portable game backup v3 includes stats, while historical v1 remains byte-compatible in shape', async (t) => {
  const stats = make(t).stats;
  await catchAt(stats, stats.beginAttempt({ gameType: 'snake' }), 1);
  const contents = { library: emptyLibrary(), packs: emptyPackLibrary(), session: null };
  const old = await exportBackup(contents);
  assert.equal(JSON.parse(old).format, BACKUP_FORMAT);
  assert.equal('enemyStats' in JSON.parse(old), false);
  const combined = await exportBackup({ ...contents, enemyStats: stats.exportBackup() });
  assert.equal(JSON.parse(combined).format, ACHIEVEMENT_BACKUP_FORMAT);
  const prepared = await prepareBackup(combined);
  assert.deepEqual(prepared.enemyStats, stats.exportBackup());
  assert.equal(await exportBackup(prepared), combined);
  assert.equal('enemyStats' in (await prepareBackup(old)), false);
});

test('shared panel localizes, filters lifetime cards, and never changes the picture host', async (t) => {
  const stats = make(t).stats;
  await catchAt(stats, stats.beginAttempt({ gameType: 'snake' }), 1, 'humanoid');
  await catchAt(stats, stats.beginAttempt({ gameType: 'solo' }), 1, 'bouncer');
  const doc = new Document(),
    container = doc.createElement('div'),
    picture = doc.createElement('img');
  container.append(picture);
  doc.body.append(container);
  const panel = mountEnemyStats({
    container,
    stats,
    variant: 'collection',
    locale: 'uk',
    document: doc,
  });
  assert.match(panel.root.textContent, /Ваші перемоги/);
  assert.match(panel.root.textContent, /Спостерігач/);
  assert.equal(panel.root.querySelectorAll('.enemy-stats-card').length, 2);
  const filter = panel.root.querySelector('select');
  filter.value = 'snake';
  filter.emit('change');
  assert.equal(panel.root.querySelectorAll('.enemy-stats-card').length, 1);
  assert.equal(container.children[0], picture);
  panel.dispose();
  assert.equal(container.children.length, 1);
});

test('Worlds drone and vehicle victories use localized distinct canvas portraits without image requests', async (t) => {
  const stats = make(t).stats;
  const attempt = stats.beginAttempt({ gameType: 'worlds' });
  await catchAt(stats, attempt, 1, 'drone');
  await catchAt(stats, attempt, 2, 'vehicle');
  const doc = new Document(),
    container = doc.createElement('div');
  const panel = mountEnemyStats({
    container,
    stats,
    document: doc,
    locale: 'uk',
    variant: 'collection',
  });
  assert.match(panel.root.textContent, /Дрон/);
  assert.match(panel.root.textContent, /Бронемашина/);
  assert.equal(panel.root.querySelectorAll('canvas').length, 2);
  assert.equal(panel.root.querySelectorAll('img').length, 0);
  panel.dispose();
});

test('legacy host Continue uses a bounded adjacent cursor without rewriting the game session', async (t) => {
  const model = managedIndexedDB(),
    saved = storage();
  saved.setItem('old-game-session', 'historical bytes');
  const a = createEnemyStatsHost({ gameType: 'solo', indexedDB: model.indexedDB, storage: saved });
  t.after(() => a.close());
  a.begin('stable-game-run');
  await a.observe({ sequence: 8, defeats: [{ family: 'runner' }] });
  const b = createEnemyStatsHost({ gameType: 'solo', indexedDB: model.indexedDB, storage: saved });
  t.after(() => b.close());
  await b.stats.read();
  b.begin('stable-game-run', { provenance: 'continue' });
  assert.equal(await b.observe({ sequence: 8, defeats: [{ family: 'runner' }] }), false);
  await b.observe({ sequence: 9, defeats: [{ family: 'runner' }] });
  assert.equal(b.stats.totals().total, 2);
  assert.equal(saved.getItem('old-game-session'), 'historical bytes');
  b.begin('imported-round', { provenance: 'replay' });
  assert.equal(await b.observe({ sequence: 100, defeats: [{ family: 'runner' }] }), false);
});

test('milestones acknowledge live progress without replaying import history or taking focus', async (t) => {
  const stats = make(t).stats,
    doc = new Document(),
    container = doc.createElement('div');
  doc.body.append(container);
  const attempt = stats.beginAttempt({ gameType: 'snake' });
  const panel = mountEnemyStats({
    container,
    stats,
    getAttempt: () => attempt,
    variant: 'hud',
    document: doc,
  });
  t.after(() => panel.dispose());
  const focused = doc.activeElement;
  await stats.observe(attempt, {
    sequence: 1,
    defeats: Array.from({ length: 10 }, () => ({ family: 'runner' })),
  });
  const badge = panel.root.querySelector('.enemy-stats-milestone');
  assert.equal(badge.hidden, false);
  assert.match(badge.textContent, /10 victories/);
  assert.equal(doc.activeElement, focused);
});

test('compact menu stats keep enemy rows behind a native disclosure and retain focus/open state during updates', async (t) => {
  const stats = make(t).stats,
    attempt = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, attempt, 1, 'patroller');
  const doc = new Document(),
    card = doc.createElement('div'),
    action = doc.createElement('button');
  card.append(action);
  doc.body.append(card);
  action.focus();
  const panel = mountEnemyStats({
    container: card,
    stats,
    getAttempt: () => attempt,
    document: doc,
  });
  t.after(() => panel.dispose());
  const details = panel.root.querySelector('details'),
    summary = details.querySelector('summary');
  assert.ok(details);
  assert.equal(Boolean(details.open), false);
  assert.equal(panel.root.querySelectorAll('.enemy-stats-card').length, 0);
  assert.equal(panel.root.querySelectorAll('.enemy-stats-row').length, 0);
  assert.equal(panel.root.querySelectorAll('img,canvas').length, 0);
  assert.match(summary.textContent, /This run1Lifetime1Enemy details/);
  assert.equal(card.children[0], action);
  assert.equal(doc.activeElement, action);
  details.open = true;
  details.emit('toggle');
  summary.focus();
  assert.equal(panel.root.querySelectorAll('.enemy-stats-row').length, 1);
  await catchAt(stats, attempt, 2, 'courier');
  assert.equal(details.open, true);
  assert.equal(doc.activeElement, summary);
  assert.equal(panel.root.querySelectorAll('.enemy-stats-row').length, 2);
  assert.equal(panel.root.querySelectorAll('.enemy-stats-card').length, 0);
  details.open = false;
  details.emit('toggle');
  assert.equal(panel.root.querySelectorAll('.enemy-stats-row').length, 0);
});

test('compact HUD puts current-run defeats before lifetime and has no disclosure or family gallery', async (t) => {
  const stats = make(t).stats,
    previous = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, previous, 1, 'patroller');
  const attempt = stats.beginAttempt({ gameType: 'snake' });
  await catchAt(stats, attempt, 1, 'courier');
  const doc = new Document(),
    container = doc.createElement('div');
  const hud = mountEnemyStats({
    container,
    stats,
    getAttempt: () => attempt,
    document: doc,
    variant: 'hud',
    locale: 'uk',
  });
  t.after(() => hud.dispose());
  const summary = hud.root.querySelector('.enemy-stats-summary');
  assert.match(summary.textContent, /ВорогиЦя спроба1За весь час2/);
  assert.equal(hud.root.querySelectorAll('details,ul,img,canvas').length, 0);
  assert.equal(hud.root.getAttribute('aria-label'), 'Переможені вороги');
});
