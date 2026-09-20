import test from 'node:test';
import assert from 'node:assert/strict';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { page } from './helpers/coop-host.mjs';

for (const roles of [
  [],
  ['hunter'],
  ['drifter'],
  ['relay'],
  ['hunter', 'drifter'],
  ['hunter', 'relay'],
  ['drifter', 'relay'],
  ['hunter', 'drifter', 'relay'],
]) {
  test(`Team setup and paused Help describe only authored roles: ${roles.join(', ') || 'empty'}`, async (t) => {
    const f = await page(t);
    const pack = structuredClone(COOP_STARTER_PACK);
    pack.id = 'guidance-roles';
    pack.name = 'Guidance roles';
    const level = structuredClone(pack.levels[1]);
    level.id = 'guidance-arena';
    level.name = 'Guidance arena';
    level.goal = { coverage: 0.65 };
    level.enemies = pack.levels[0].enemies.filter((enemy) => roles.includes(enemy.type));
    if (!roles.includes('relay')) level.strongholds = [];
    pack.levels = [level];
    await f.selectFile(JSON.stringify(pack));
    assert.equal(f.$('coop-level').value, level.id, 'the test pack is accepted');
    const help = f.$('coop-help-support');
    assert.ok(help, 'Help must own arena-specific Support advice');
    const check = () => {
      const copy = help.textContent;
      assert.equal(
        /slow nearby enemies/.test(copy),
        roles.includes('hunter') || roles.includes('drifter'),
      );
      assert.equal(/spark/.test(copy), roles.includes('relay'));
      assert.match(copy, /one second to rescue/);
      assert.match(copy, /crawl along safe ground/);
    };
    check();
    f.$('coop-start').click();
    f.tick(30);
    f.$('coop-pause').click();
    const clock = f.$('coop-clock').textContent;
    f.disclose('coop-help');
    f.$('coop-help-read').click();
    assert.equal(f.doc.activeElement.id, 'coop-help-reading');
    check();
    f.tick(90);
    assert.equal(f.$('coop-clock').textContent, clock);
    f.press('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-help-read');
    f.press('Escape');
    assert.equal(f.doc.activeElement.id, 'coop-help-toggle');
    assert.equal(f.$('coop-help').open, false);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
    assert.equal(f.$('coop-clock').textContent, clock);
  });
}
