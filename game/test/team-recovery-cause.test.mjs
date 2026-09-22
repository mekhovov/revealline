import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { coopRecoveryCause } from '../couch/coop-feedback.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

test('recovery cause preserves distinct observed hazards without inventing or repeating one', () => {
  const run = { enemies: [{ id: 'r', type: 'claimed-rover' }], level: {} };
  const line = { cause: 'self-trail' },
    rover = { cause: 'enemy-player', enemy: 'r' };
  assert.equal(coopRecoveryCause(run, [null, null]), '');
  assert.equal(coopRecoveryCause(run, [line, line]), 'An unfinished line crossed itself.');
  assert.equal(
    coopRecoveryCause(run, [line, rover]),
    'An unfinished line crossed itself. An active reclaimed-ground roamer caught a craft.',
  );
  assert.equal(
    coopRecoveryCause(run, [{ cause: 'lethal-terrain' }]),
    'Unclaimed lethal field caught a craft.',
  );
  assert.equal(
    coopRecoveryCause(run, [{ cause: 'line-impact' }]),
    'A travelling spark reached an unfinished cut.',
  );
});

const evidence = JSON.parse(
  await readFile(new URL('./fixtures/team-inner-landing-routes.json', import.meta.url)),
);
const source = createTeamSpatialOriginalCandidates();
for (const difficulty of ['gentle', 'standard', 'expert'])
  test(`${difficulty}: actual trail hit remains explained after automatic individual reserve recovery`, async (t) => {
    const f = await page(t);
    await f.selectFile(JSON.stringify(createTeamTestPack(source, 'twin-depots', difficulty)));
    f.$('coop-start').click();
    f.tick(2);
    const before = { gentle: 4, standard: 2, expert: 1 }[difficulty];
    const keys = { down: 'ArrowDown', left: 'ArrowLeft', up: 'ArrowUp' };
    let hit = false;
    for (const segment of evidence.negative.log) {
      if (segment.b) f.tap(keys[segment.b]);
      for (let n = 0; n < segment.ticks; n++) {
        f.tick();
        if (/needs a rescue/.test(f.$('coop-message').textContent)) {
          hit = true;
          break;
        }
      }
      if (hit) break;
    }
    assert.equal(hit, true);
    assert.match(f.$('coop-message').textContent, /A roaming enemy caught an unfinished line/);
    for (let n = 0; n < 120 && !/is back/.test(f.$('coop-message').textContent); n++) f.tick();
    const message = f.$('coop-message').textContent;
    assert.match(
      message,
      /A roaming enemy caught an unfinished line\..*is back\. One team reserve used\. Choose a fresh direction\./,
    );
    assert.equal(
      f.$('coop-reserves').textContent,
      `${before - 1} reserve${before - 1 === 1 ? '' : 's'}`,
    );
    assert.equal(f.$('coop-overlay').hidden, true, 'No recovery dialog or mandatory confirmation.');
    assert.equal(f.$('coop-menu').hidden, true);
    // Deliberate Retry retains its normal confirmation. The new attempt must
    // not inherit this attempt's failure explanation.
    f.$('coop-pause').click();
    f.$('coop-retry').click();
    assert.equal(f.$('coop-discard-dialog').open, true);
    f.$('coop-discard-confirm').click();
    await waitFor(() => f.$('coop-overlay').hidden);
    assert.doesNotMatch(f.$('coop-message').textContent, /caught an unfinished line|reserve used/);
  });
