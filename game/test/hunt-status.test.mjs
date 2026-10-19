import test from 'node:test';
import assert from 'node:assert/strict';
import { Document } from './helpers/couch-dom.mjs';
import { attachHuntStatus } from '../ui/hunt-status.mjs';
import { createHuntRecords } from '../hunt/records.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Component/model coverage: terminal states here are deliberate record fixtures,
// not claims that these attempts were played through a native host.
function run(fields = {}) {
  return {
    status: 'won',
    time: 7,
    huntRecordIdentity: 'aaaaaaaaaaaaaaaa',
    huntDowns: 0,
    level: {
      hunt: {
        mode: 'bonus',
        quota: 0,
        targets: [
          { id: 'a', kind: 'runner' },
          { id: 'b', kind: 'runner' },
        ],
      },
    },
    hunt: { kills: 2, touchKills: 2, captureKills: 0, score: 200 },
    ...fields,
  };
}
function fixture(t, { record = true, raw = null, unavailable = false, mode = 'solo' } = {}) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  let value = raw,
    writes = 0;
  const storage = {
    getItem: () => value,
    setItem: (_key, next) => {
      writes++;
      value = next;
    },
  };
  const records = createHuntRecords({ getStorage: () => (unavailable ? null : storage) });
  const doc = new Document(),
    container = doc.createElement('section'),
    button = doc.createElement('button');
  doc.body.append(container);
  container.append(button);
  const view = attachHuntStatus({ document: doc, container, records, record, mode });
  const node = container.querySelector('.hunt-status');
  t.after(() => {
    view.dispose();
    records.dispose();
    setLocale(locale, { persist: false });
  });
  return { records, doc, view, node, button, writes: () => writes, raw: () => value };
}

test('a damaged lower-scoring attempt is separate from accumulated exact-setup achievements', (t) => {
  const f = fixture(t);
  f.records.complete(run());
  const current = run({
    huntDowns: 1,
    hunt: { kills: 1, touchKills: 0, captureKills: 1, score: 50 },
  });
  f.view.render(current);
  const [attempt, personal, next] = f.node.textContent.split('\n');
  assert.match(attempt, /^This attempt:.*Hunt targets: 1\/2.*Hunt score: 50/);
  assert.match(attempt, /Style goals met this attempt: None/);
  assert.doesNotMatch(attempt, /All by contact|No damage/);
  assert.match(
    personal,
    /^Personal progress for this exact setup:.*Best hunt: 200.*All targets.*All by contact.*No damage/,
  );
  assert.equal(next, 'All three style goals earned for this setup.');
  const before = f.raw(),
    writes = f.writes();
  f.button.focus();
  setLocale('uk', { persist: false });
  assert.equal(f.doc.activeElement, f.button);
  assert.equal(f.node, f.node.parentNode.querySelector('.hunt-status'));
  assert.match(f.node.textContent, /^Ця спроба:.*Бали полювання: 50/);
  assert.match(f.node.textContent, /Особистий прогрес для цього точного набору умов:.*200/);
  setLocale('en', { persist: false });
  f.view.render(current);
  assert.equal(f.writes(), writes);
  assert.equal(f.raw(), before);
  assert.equal(current.huntDowns, 1);
  assert.equal(current.hunt.score, 50);
});

for (const [flags, next] of [
  [{ all: false, contact: false, clean: true }, 'All targets'],
  [{ all: true, contact: false, clean: false }, 'All by contact'],
  [{ all: true, contact: true, clean: false }, 'No damage'],
])
  test(`one next optional goal is ordered from existing record facts: ${next}`, (t) => {
    const f = fixture(t, { record: false });
    f.records.import({
      format: 'HuntRecordsV1',
      records: [{ key: 'solo/aaaaaaaaaaaaaaaa', score: 50, time: 8, ...flags }],
    });
    f.view.render(run({ status: 'lost' }));
    const lines = f.node.textContent.split('\n');
    assert.match(
      lines[2],
      /Optional style goals, in order: All targets → All by contact → No damage/,
    );
    assert.ok(lines[2].endsWith(`Next: ${next}.`));
    assert.doesNotMatch(lines[0], /Style goals met this attempt/);
  });

test('no record and practice views do not turn current won facts into saved achievements', (t) => {
  const f = fixture(t, { record: false });
  f.view.render(run());
  assert.match(
    f.node.textContent,
    /This attempt:.*Style goals met this attempt: All targets · All by contact · No damage/,
  );
  assert.match(
    f.node.textContent,
    /Personal progress for this exact setup: No completed attempt recorded/,
  );
  assert.ok(f.node.textContent.endsWith('Next: All targets.'));
  assert.equal(f.writes(), 0);
  assert.equal(f.records.snapshot().records.length, 0);
});

for (const options of [
  { unavailable: true },
  { raw: 'not json' },
  { raw: '{"format":"HuntRecordsV2"}' },
])
  test(`session fallback is explicit and corrupt/future data stays intact: ${JSON.stringify(options)}`, (t) => {
    const f = fixture(t, options);
    f.view.render(run());
    assert.match(
      f.node.textContent,
      /Progress is available for this session; saving is unavailable/,
    );
    assert.match(f.node.textContent, /All three style goals earned/);
    if (options.raw) assert.equal(f.raw(), options.raw);
    assert.equal(f.writes(), 0);
  });

test('ready/running/respawning/paused HUD stays compact; quota and bonus keep real win requirements', (t) => {
  const f = fixture(t);
  for (const status of ['ready', 'running', 'respawning', 'paused']) {
    f.view.render(run({ status }));
    assert.equal(f.node.textContent, 'Bonus hunt · 2/2 · Hunt score: 200');
    assert.equal(f.node.dataset.huntDetail, 'live');
    assert.equal(f.writes(), 0);
  }
  f.view.render(run({ status: 'lost' }));
  assert.match(f.node.textContent, /Capture the picture to win. Hunting humanoids is optional/);
  const quota = run({ status: 'lost' });
  quota.level.hunt.mode = 'capture-quota';
  quota.level.hunt.quota = 1;
  f.view.render(quota);
  assert.match(f.node.textContent, /Complete the capture goal and the hunt quota/);
  assert.match(f.node.textContent, /Hunt targets: 2\/2 · Required hunt quota: 2\/1/);
  f.view.render({ level: {}, status: 'running' });
  assert.equal(f.node.hidden, true);
  setLocale('uk', { persist: false });
  assert.equal(f.node.hidden, true);
});

for (const mode of ['solo', 'versus', 'team'])
  test(`${mode} live/result pair shares one exact record write without changing ownership`, (t) => {
    const f = fixture(t, { mode });
    const result = attachHuntStatus({
      document: f.doc,
      container: f.node.parentNode,
      mode,
      records: f.records,
      record: false,
    });
    t.after(() => result.dispose());
    const current = run();
    f.view.render(current);
    result.render(current);
    f.view.render(current);
    assert.equal(f.writes(), 1);
    assert.equal(f.records.snapshot().records[0].key, `${mode}/aaaaaaaaaaaaaaaa`);
    assert.equal(f.records.best(current, mode === 'solo' ? 'team' : 'solo'), null);
    setLocale('uk', { persist: false });
    setLocale('en', { persist: false });
    assert.equal(f.writes(), 1);
    assert.equal(current.status, 'won');
  });

test('Snake tail/chain/bonus context remains beside terminal and compact live Hunt facts', (t) => {
  const f = fixture(t),
    current = run({
      tick: 5,
      snake: {
        bodies: [{ length: 3.4, capacity: 10 }],
        catches: 2,
        lastCatchTick: 4,
        chain: 2,
        bestChain: 2,
        bonusScore: 30,
      },
    });
  current.level.snake = { bonus: 'chain', chainWindowTicks: 60 };
  f.view.render(current);
  assert.match(f.node.textContent.split('\n')[0], /3\/10.*2.*30/);
  current.status = 'running';
  f.view.render(current);
  assert.match(f.node.textContent, /3\/10.*2.*30/);
  assert.doesNotMatch(f.node.textContent, /Personal progress|Optional style/);
});

for (const mode of ['hunt', 'capture-quota'])
  test(`${mode} all-target victory is never presented as optional`, (t) => {
    const f = fixture(t, { record: false }),
      current = run({ status: 'lost' });
    current.level.hunt.mode = mode;
    current.level.hunt.quota = 2;
    f.view.render(current);
    const next = f.node.textContent.split('\n')[2];
    assert.match(next, /^Style goals, in order:/);
    assert.match(
      next,
      /All targets is already required to win here; the other style goals are optional/,
    );
    assert.doesNotMatch(next, /Optional style goals/);
    setLocale('uk', { persist: false });
    assert.match(f.node.textContent, /Усі цілі вже обов’язкові для перемоги тут/);
  });

test('optional bonus and partial-quota explanations remain accurate in Ukrainian', (t) => {
  const f = fixture(t, { record: false }),
    current = run({ status: 'lost' });
  setLocale('uk', { persist: false });
  f.view.render(current);
  assert.match(f.node.textContent, /Полювання на гуманоїдів необов’язкове/);
  assert.match(f.node.textContent, /Необов’язкові стильові цілі за порядком/);
  current.level.hunt.mode = 'capture-quota';
  current.level.hunt.quota = 1;
  f.view.render(current);
  assert.match(f.node.textContent, /Досягніть мети захоплення та квоти полювання/);
  assert.match(f.node.textContent, /Цілі полювання: 2\/2 · Обов’язкова квота полювання: 2\/1/);
  assert.match(f.node.textContent, /Необов’язкові стильові цілі за порядком/);
  assert.equal(f.writes(), 0);
});
