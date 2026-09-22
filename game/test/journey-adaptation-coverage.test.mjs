import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import {
  loadJourneyAdaptationInputs,
  inspectJourneyAdaptations,
  auditJourneyAdaptations,
} from '../../scripts/audit-journey-adaptations.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { createAuthoredJourneyRoute } from '../content-design/route.mjs';

const inputs = await loadJourneyAdaptationInputs();
test('explicit teaching audit resolves the same editions as the playable shared route', async () => {
  const route = createAuthoredJourneyRoute('whole-originals-v2');
  const project = compileContentProject(route.source);
  const report = await auditJourneyAdaptations({ edition: 'teaching-originals' });
  assert.equal(report.contentEdition, 'teaching-originals');
  assert.equal(report.counts.coveredReferences, 48);
  assert.equal(report.counts.authoredSoloCandidates, 83);
  assert.equal(report.counts.finalDispositions, 0);
  const links = report.references.flatMap((r) => r.adaptations);
  assert(
    links.some(
      (link) => link.missionId === 'split-berths' && link.missionRevision === 'teaching-1',
    ),
  );
  assert(
    report.originalMissionsWithoutReference.some(
      (mission) =>
        mission.missionId === 'wake-the-yard' && mission.missionRevision === 'teaching-1',
    ),
  );
  for (const link of links)
    for (const { mode, difficulty, simulationIdentity } of link.editions) {
      assert.equal(
        resolveMission(project, link.missionId, { mode, difficulty }).simulationIdentity,
        simulationIdentity,
      );
      assert.equal(
        link.missionRevision,
        route.source.missions.find((m) => m.id === link.missionId).revision,
      );
    }
  const cli = spawnSync(
    process.execPath,
    [
      new URL('../../scripts/audit-journey-adaptations.mjs', import.meta.url).pathname,
      '--edition',
      'teaching-originals',
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), report);
  await assert.rejects(() => auditJourneyAdaptations({ edition: 'latest' }), /Unknown.*edition/);
});
test('all 48 numbered sources have explicit current adaptations without rewriting observations or pretending final disposition', () => {
  const before = JSON.stringify(inputs),
    report = inspectJourneyAdaptations(inputs);
  assert.deepEqual(report.counts, {
    sourceFiles: 64,
    numberedReferences: 48,
    coveredReferences: 48,
    adaptationLinks: 66,
    authoredSoloCandidates: 83,
    finalDispositions: 0,
  });
  assert.deepEqual(report.unlinkedReferences, []);
  assert.equal(new Set(report.references.map((row) => row.designKey)).size, 48);
  assert.equal(JSON.stringify(inputs), before);
  assert.equal(report.qualification, 'reference-to-current-candidate-coverage-only');
  assert(
    report.originalMissionsWithoutReference.some((row) => row.missionId === 'courtyard-return'),
  );
  assert(report.limitations.some((line) => line.includes('not actual play')));
  for (const reference of report.references) {
    assert.deepEqual(
      reference.source,
      inputs.ledger.references.find((row) => row.designKey === reference.designKey).source,
    );
    assert(reference.adaptations.length > 0);
    for (const row of reference.adaptations) {
      assert.equal(row.finalDisposition, false);
      assert.equal(row.humanValidation, 'pending');
      assert.equal(row.releaseValidation, 'not-qualified-by-this-audit');
      assert.equal(row.editions.length, 6);
      const chapter = inputs.chapters.find((chapter) => chapter.id === row.chapter);
      const project = compileContentProject(chapter.source);
      for (const edition of row.editions)
        assert.equal(
          edition.simulationIdentity,
          resolveMission(project, row.missionId, {
            mode: edition.mode,
            difficulty: edition.difficulty,
          }).simulationIdentity,
        );
    }
  }
});

test('missing reference coverage is explicit, while invalid pins, mission links and duplicate declarations fail', () => {
  const onlyFirst = { ledger: inputs.ledger, chapters: [inputs.chapters[0]] };
  const partial = inspectJourneyAdaptations(onlyFirst);
  assert.equal(partial.unlinkedReferences.length, 44);
  assert.equal(partial.counts.coveredReferences, 4);
  for (const [change, expected] of [
    [
      (row) => {
        row.reference = 'unknown-reference';
      },
      /Unknown numbered reference/,
    ],
    [
      (row) => {
        row.referenceSHA256 = 'f'.repeat(64);
      },
      /reference pin/,
    ],
    [
      (row) => {
        row.standardSimulationIdentity = 'f'.repeat(16);
      },
      /Stale declared simulation/,
    ],
    [
      (row) => {
        row.missionId = 'does-not-exist';
      },
      /mission/i,
    ],
    [
      (row) => {
        row.final = true;
      },
      /final disposition/,
    ],
    [
      (row) => {
        row.reason = '';
      },
      /design rationale/,
    ],
  ]) {
    const invalid = structuredClone(onlyFirst);
    change(invalid.chapters[0].declarations[0]);
    assert.throws(() => inspectJourneyAdaptations(invalid), expected);
  }
  const duplicate = structuredClone(onlyFirst);
  duplicate.chapters[0].declarations.push(duplicate.chapters[0].declarations[0]);
  assert.throws(() => inspectJourneyAdaptations(duplicate), /Duplicate adaptation/);
  const duplicateReference = structuredClone(onlyFirst);
  duplicateReference.ledger.references.push(
    duplicateReference.ledger.references.find((row) => row.kind === 'mission-layout-reference'),
  );
  assert.throws(
    () => inspectJourneyAdaptations(duplicateReference),
    /Duplicate numbered reference/,
  );
});

test('CLI derives the same coverage without touching the original observation ledger', async () => {
  const ledgerURL = new URL('../../docs/research/xposed-journey-ledger.json', import.meta.url);
  const before = await readFile(ledgerURL);
  const cli = spawnSync(
    process.execPath,
    [new URL('../../scripts/audit-journey-adaptations.mjs', import.meta.url).pathname],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 },
  );
  assert.equal(cli.status, 0, cli.stderr);
  assert.deepEqual(JSON.parse(cli.stdout), await auditJourneyAdaptations());
  assert.deepEqual(await readFile(ledgerURL), before);
  const invalid = spawnSync(
    process.execPath,
    [new URL('../../scripts/audit-journey-adaptations.mjs', import.meta.url).pathname, '--publish'],
    { encoding: 'utf8' },
  );
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Usage/);
});
