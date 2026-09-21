import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createSignalCandidates } from '../content-design/signal-candidates.mjs';
import { inspectContentPacing } from '../content-design/pacing.mjs';
import { createPacingInspector } from '../studio/pacing-inspector.mjs';

function element() {
  return {
    children: [],
    value: '',
    textContent: '',
    selected: false,
    replaceChildren(...children) {
      this.children = children;
    },
    get selectedOptions() {
      return this.children.filter((child) => child.selected);
    },
  };
}
test('Studio and CLI share exact selected pacing report without adopting edits or stale reports', () => {
  let source = createSignalCandidates();
  const before = structuredClone(source);
  const nodes = Object.fromEntries(
    ['mode', 'exclude', 'summary', 'warnings', 'sequence', 'inspect'].map((id) => [
      `pacing-${id}`,
      element(),
    ]),
  );
  nodes['pacing-mode'].value = 'solo';
  const document = { getElementById: (id) => nodes[id], createElement: element };
  const inspector = createPacingInspector({ document, getSource: () => source });
  inspector.sync();
  const excluded = source.campaigns.at(-1).id;
  nodes['pacing-exclude'].children.find((option) => option.value === excluded).selected = true;
  const direct = inspectContentPacing(source, { mode: 'solo', excludedCampaignIds: [excluded] });
  assert.deepEqual(nodes['pacing-inspect'].onclick(), direct);
  assert.deepEqual(
    nodes['pacing-warnings'].children.map((item) => item.textContent),
    direct.diagnostics.map(
      (item) => `${item.packId} / ${item.campaignId} / ${item.missionId}: ${item.message}`,
    ),
  );
  assert(direct.diagnostics.some((item) => item.code === 'combination-before-selected-practice'));
  assert.equal(nodes['pacing-sequence'].children.length, 6);
  assert.match(nodes['pacing-summary'].textContent, /not measured difficulty/);
  const cli = (args) =>
    spawnSync(
      process.execPath,
      [
        new URL('../../scripts/compile-content-project.mjs', import.meta.url).pathname,
        '-',
        ...args,
      ],
      { input: JSON.stringify(source), encoding: 'utf8' },
    );
  const output = cli(['--pacing', '--mode', 'solo', '--exclude-campaigns', excluded]);
  assert.equal(output.status, 0, output.stderr);
  assert.deepEqual(JSON.parse(output.stdout), direct);
  for (const args of [
    ['--pacing', '--difficulty', 'expert'],
    ['--pacing', '--journey'],
    ['--pacing', '--check'],
    ['--journey', '--exclude-campaigns', excluded],
  ])
    assert.equal(cli(args).status, 1);
  assert.deepEqual(source, before);
  source = { ...source, name: 'Edited draft' };
  inspector.sync();
  assert.equal(nodes['pacing-sequence'].children.length, 0);
  assert.equal(nodes['pacing-warnings'].children.length, 0);
  assert.deepEqual(
    nodes['pacing-exclude'].selectedOptions.map((option) => option.value),
    [excluded],
  );
  nodes['pacing-mode'].value = 'team';
  nodes['pacing-mode'].onchange();
  assert.match(nodes['pacing-summary'].textContent, /previous report is no longer current/);
  assert.equal(nodes['pacing-inspect'].onclick(), null);
  assert.match(nodes['pacing-summary'].textContent, /no missions for this mode/);
  assert.equal(nodes['pacing-sequence'].children.length, 0);
});
