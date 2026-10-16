import test from 'node:test';
import assert from 'node:assert/strict';
import { getLocale, setLocale, t } from '../i18n/index.mjs';
import { createStarterProject } from '../content-design/starter.mjs';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import {
  MISSION_ACCEPTANCE_CHECKS,
  missionEvidenceTarget,
  readPlaytestLedger,
  appendPlaytestEvidence,
} from '../content-design/acceptance-evidence.mjs';
import { createPacingInspector } from '../studio/pacing-inspector.mjs';
import { createAcceptanceInspector } from '../studio/acceptance-inspector.mjs';
import {
  studioPacingWarnings,
  studioPacingWarning,
  studioAcceptanceCheck,
} from '../studio/inspection-copy.mjs';
import { Document } from './helpers/couch-dom.mjs';

function dom(prefix, fields) {
  const document = new Document();
  for (const id of fields.split(' ')) {
    const node = document.createElement(
      ['mode', 'exclude'].includes(id) ? 'select' : id === 'commit' ? 'input' : 'div',
    );
    node.id = `${prefix}-${id}`;
    document.body.append(node);
    if (id === 'exclude')
      Object.defineProperty(node, 'selectedOptions', {
        get: () => node.children.filter((child) => child.selected),
      });
  }
  return { document, node: (id) => document.getElementById(`${prefix}-${id}`) };
}
const sourceCommit = 'a'.repeat(40);

test('pacing report translates in place without rereading source, clearing findings or changing exclusions', () => {
  const previous = getLocale(),
    source = createSignalCandidates(),
    before = JSON.stringify(source);
  const { document, node } = dom('pacing', 'mode exclude summary warnings sequence inspect');
  let reads = 0;
  const inspector = createPacingInspector({
    document,
    getSource() {
      reads++;
      return source;
    },
  });
  node('mode').value = 'solo';
  inspector.sync();
  const excluded = source.campaigns.at(-1).id;
  node('exclude').children.find((option) => option.value === excluded).selected = true;
  const report = node('inspect').onclick(),
    reportJSON = JSON.stringify(report),
    options = [...node('exclude').children],
    rows = [...node('sequence').children],
    warnings = [...node('warnings').children],
    reportReads = reads;
  node('exclude').focus();
  node('sequence').scrollTop = 88;
  try {
    for (const locale of ['uk', 'en', 'uk']) {
      setLocale(locale, { persist: false });
      assert.equal(reads, reportReads);
      assert.equal(document.activeElement, node('exclude'));
      assert.equal(node('sequence').scrollTop, 88);
      assert.deepEqual([...node('exclude').children], options);
      assert.deepEqual(
        node('exclude').selectedOptions.map((n) => n.value),
        [excluded],
      );
      assert.deepEqual([...node('sequence').children], rows);
      assert.deepEqual([...node('warnings').children], warnings);
      assert.equal(JSON.stringify(source), before);
      assert.equal(JSON.stringify(report), reportJSON);
      assert.match(
        node('summary').textContent,
        locale === 'uk' ? /Вибрані входження місій/ : /selected mission occurrences/,
      );
      assert.doesNotMatch(
        [...rows, ...warnings].map((n) => n.textContent).join(' '),
        /tools:|interface:|NaN/,
      );
      if (locale === 'uk')
        for (const warning of warnings) assert.match(warning.textContent, /[А-ЯІЇЄҐа-яіїєґ]/);
    }
    node('mode').value = 'versus';
    node('mode').onchange();
    assert.equal(rows[0].isConnected, false);
    assert.equal(node('sequence').children.length, 0);
    setLocale('en', { persist: false });
    assert.match(node('summary').textContent, /previous report is no longer current/);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('all pacing diagnostic codes preserve canonical English and translate occurrence-specific facts', () => {
  const previous = getLocale();
  const codes = [
    'practice-before-selected-introduction',
    'combination-before-selected-introduction',
    'combination-before-selected-practice',
    'challenge-band-regression',
    'challenge-band-jump',
    'large-authored-facet-increase',
  ];
  const source = createSignalCandidates();
  // Force every diagnostic through the real inspector without changing lesson IDs.
  for (let i = 0; i < source.missions.length; i++) {
    const mission = source.missions[i];
    mission.design.introduces = i === source.missions.length - 1 ? ['custom-lesson'] : [];
    mission.design.practices = ['custom-lesson'];
    mission.design.combines = ['custom-lesson'];
    mission.design.difficulty.band = i % 2 ? 5 : 1;
    mission.timeLimitSeconds = 60;
    for (const facet of [
      'planning',
      'execution',
      'threatDensity',
      'timePressure',
      'mechanicLoad',
      'coordination',
    ])
      mission.design.difficulty[facet] = i % 2 ? 5 : 1;
  }
  source.campaigns = source.missions.map((mission, i) => ({
    ...source.campaigns[0],
    id: `test-campaign-${i}`,
    name: `Test campaign ${i}`,
    band: mission.design.difficulty.band,
    missionIds: [mission.id],
  }));
  source.packs = [
    { ...source.packs[0], campaignIds: source.campaigns.map((campaign) => campaign.id) },
  ];
  const report = inspectContentPacing(source),
    before = JSON.stringify(report);
  // A second arrangement supplies practice-after-introduction advice.
  const another = createSignalCandidates();
  for (const mission of another.missions) {
    mission.design.introduces = ['custom-lesson'];
    mission.design.practices = [];
    mission.design.combines = ['custom-lesson'];
  }
  const reports = [report, inspectContentPacing(another)];
  const observed = new Set();
  try {
    for (const current of reports) {
      const entries = studioPacingWarnings(current);
      assert.equal(entries.length, current.diagnostics.length);
      for (let i = 0; i < entries.length; i++) {
        const diagnostic = current.diagnostics[i],
          prefix = diagnostic.missionId
            ? `${diagnostic.packId} / ${diagnostic.campaignId} / ${diagnostic.missionId}: `
            : '';
        setLocale('en', { persist: false });
        assert.equal(studioPacingWarning(entries[i], current), prefix + diagnostic.message);
        setLocale('uk', { persist: false });
        const uk = studioPacingWarning(entries[i], current);
        assert.match(uk, /[А-ЯІЇЄҐа-яіїєґ]/);
        assert.notEqual(uk, prefix + diagnostic.message);
        observed.add(diagnostic.code);
      }
    }
    for (const code of codes) assert(observed.has(code), code);
    assert(observed.has('countdown-heavy-selection'));
    assert.equal(JSON.stringify(report), before);
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('acceptance locale changes preserve imported notes, report JSON, input, focus and a pending file read', async () => {
  const previous = getLocale(),
    source = createStarterProject(),
    before = JSON.stringify(source),
    { document, node } = dom(
      'acceptance',
      'mode commit file clear inspect summary checks report selection ledger-status',
    );
  let reads = 0;
  const inspector = createAcceptanceInspector({
    document,
    getSource() {
      reads++;
      return source;
    },
    getMission() {
      reads++;
      return source.missions[0];
    },
    getDifficulty() {
      reads++;
      return 'expert';
    },
  });
  node('commit').value = sourceCommit;
  inspector.sync();
  const detail = '<img src=x onerror=alert(1)> User-authored observation';
  const ledger = appendPlaytestEvidence(readPlaytestLedger(), {
    format: 'PlaytestEvidenceV1',
    id: 'locale-evidence',
    target: missionEvidenceTarget(source, 'nearby-shore', { sourceCommit, difficulty: 'expert' }),
    kind: 'automated',
    observedAt: '2026-09-21T10:00:00.000Z',
    method: 'Authored method',
    checks: [{ id: 'capture-contract', outcome: 'fail', detail }],
    artifacts: [],
    supersedes: null,
  });
  let resolve;
  node('file').files = [
    {
      size: JSON.stringify(ledger).length,
      text: () =>
        new Promise((yes) => {
          resolve = yes;
        }),
    },
  ];
  const pending = node('file').onchange(),
    pendingReads = reads;
  try {
    setLocale('uk', { persist: false });
    assert.equal(reads, pendingReads);
    assert.equal(node('inspect').disabled, true);
    assert.equal(node('ledger-status').textContent, t('tools:studio.acceptance.reading'));
    resolve(JSON.stringify(ledger));
    await pending;
    assert.equal(node('inspect').disabled, false);
    assert.equal(
      node('ledger-status').textContent,
      t('tools:studio.acceptance.ledger', { count: 1 }),
    );
    const report = node('inspect').onclick(),
      reportJSON = node('report').textContent,
      checks = [...node('checks').children],
      options = [...node('mode').children],
      reportReads = reads;
    node('commit').selectionStart = 3;
    node('commit').selectionEnd = 7;
    node('commit').focus();
    node('checks').scrollTop = 65;
    for (const locale of ['en', 'uk', 'en']) {
      setLocale(locale, { persist: false });
      assert.equal(reads, reportReads);
      assert.equal(node('report').textContent, reportJSON);
      assert.deepEqual(JSON.parse(reportJSON), report);
      assert.deepEqual([...node('checks').children], checks);
      assert.deepEqual([...node('mode').children], options);
      assert.equal(node('commit').value, sourceCommit);
      assert.equal(node('commit').selectionStart, 3);
      assert.equal(node('commit').selectionEnd, 7);
      assert.equal(document.activeElement, node('commit'));
      assert.equal(node('checks').scrollTop, 65);
      assert(checks[0].textContent.includes(detail));
      assert.equal(checks[0].children.length, 0);
      assert.equal(JSON.stringify(source), before);
      if (locale === 'uk')
        for (const check of checks) assert.match(check.textContent, /[А-ЯІЇЄҐа-яіїєґ]/);
    }
    node('commit').value = 'HEAD';
    node('commit').oninput();
    assert.equal(node('inspect').onclick(), null);
    const errorReads = reads;
    setLocale('uk', { persist: false });
    assert.equal(reads, errorReads);
    assert.equal(
      node('summary').textContent,
      t('tools:studio.inspection.failed', { message: t('errors:studio.acceptance.chooseCommit') }),
    );
  } finally {
    setLocale(previous, { persist: false });
  }
});

test('every registered acceptance check, evidence kind and status has Ukrainian presentation', () => {
  const previous = getLocale();
  try {
    for (const check of MISSION_ACCEPTANCE_CHECKS)
      for (const status of ['missing', 'not-run', 'reported-pass', 'reported-fail']) {
        const data = { ...check, status, permittedKinds: check.kinds, observations: [] },
          before = JSON.stringify(data);
        setLocale('en', { persist: false });
        assert.equal(
          studioAcceptanceCheck(data),
          `${check.label}: ${status}. Permitted evidence: ${check.kinds.join(', ')}.`,
        );
        setLocale('uk', { persist: false });
        const uk = studioAcceptanceCheck(data);
        assert(!uk.includes(check.label));
        assert.match(uk, /[А-ЯІЇЄҐа-яіїєґ]/);
        assert.doesNotMatch(uk, /tools:|interface:/);
        assert.equal(JSON.stringify(data), before);
      }
    for (const count of [0, 1, 2, 5, 11, 21, 22, 1.5])
      assert.doesNotMatch(t('tools:studio.acceptance.ledger', { count }), /tools:|\{\{/);
  } finally {
    setLocale(previous, { persist: false });
  }
});
