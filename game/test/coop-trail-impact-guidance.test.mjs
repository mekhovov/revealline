import test from 'node:test';
import assert from 'node:assert/strict';
import { coopArenaGuidance } from '../couch/coop-briefing.mjs';
import { createCoop, validateCoopLevel } from '../coop/core.mjs';
import { COOP_STARTER_PACK } from '../coop/library.mjs';
import { journeyTeamPackEdition } from '../coop/foundations.mjs';
import { validateCoopPack } from '../coop/recipes.mjs';
import { getLocale, setLocale, t as text } from '../i18n/index.mjs';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

function impactLevel({ specialist = false, enemies = true } = {}) {
  const level = structuredClone(COOP_STARTER_PACK.levels[0]);
  delete level.strongholds;
  delete level.encounter;
  Object.assign(level, {
    version: `revealline-coop-level.v${specialist ? 7 : 6}`,
    id: 'trail-help-arena',
    name: 'Trail help arena',
    journeyDifficulty: 'standard',
    terrain: [],
    lineImpact: { version: 'team-line-impact.v2', speed: 24 },
  });
  // Current travelling-impact missions use keepers/roamers; retain an actual
  // drifter from the authored starter rather than combine unqualified hunter tuning.
  level.enemies = level.enemies.filter((enemy) => enemy.type === 'drifter');
  assert.ok(level.enemies.length > 0);
  if (specialist) level.supportRoles = ['disruptor', 'interceptor'];
  if (!enemies) level.enemies = [];
  assert.deepEqual(validateCoopLevel(level), { valid: true, errors: [] });
  return level;
}
function impactPack(options) {
  const level = impactLevel(options);
  return {
    ...structuredClone(COOP_STARTER_PACK),
    ...journeyTeamPackEdition(level),
    id: 'trail-help-pack',
    revision: 'trail-help-1',
    name: 'Trail help pack',
    levels: [level],
  };
}
function useLocale(t, locale) {
  const original = getLocale();
  t.after(() => setLocale(original, { persist: false }));
  setLocale(locale, { persist: false });
}
const impactCopy = () =>
  `${text('interface:team.trailImpactContact')} ${text('interface:team.trailImpactDirections')}`;

for (const locale of ['en', 'uk']) {
  test(`${locale}: impact advice uses the admitted edition and preserves Legacy/relay-only/empty guidance`, (t) => {
    useLocale(t, locale);
    const current = impactLevel(),
      before = structuredClone(current),
      run = createCoop(current),
      checkpoint = structuredClone(run),
      advice = coopArenaGuidance(run.level);
    assert.ok(advice.threatText.includes(impactCopy()));
    assert.doesNotMatch(advice.threatText, /team\.trailImpact|\{\{/);
    assert.deepEqual(run, checkpoint, 'Reading guidance cannot change the actual run.');
    assert.deepEqual(current, before);
    assert.equal(advice.supportCapabilities.intercept, true);
    assert.ok(advice.supportText.includes(text('gameplay:team.supportSlowAndIntercept')));
    if (locale === 'en') {
      assert.match(advice.threatText, /two sparks/);
      assert.match(advice.threatText, /other returns to its starting point and expires/);
      assert.match(advice.threatText, /Direct contact with a craft can still knock it down/);
      assert.match(advice.threatText, /Support that can intercept removes nearby sparks/);
    } else assert.match(impactCopy(), /дві іскри.*повертається до її початку й згасає/);
    const legacy = structuredClone(COOP_STARTER_PACK.levels[0]);
    legacy.enemies = legacy.enemies.filter((enemy) => enemy.type === 'hunter');
    legacy.strongholds = [];
    assert.deepEqual(validateCoopLevel(legacy), { valid: true, errors: [] });
    assert.equal(
      coopArenaGuidance(legacy).threatText,
      text('interface:huntersMarkARouteBeforeChargingCrossDuringRecoveryOr'),
      'Legacy hunter advice stays exact, without Solo pressure-recovery rules.',
    );
    const relay = structuredClone(COOP_STARTER_PACK.levels[1]);
    relay.enemies = [];
    assert.deepEqual(validateCoopLevel(relay), { valid: true, errors: [] });
    assert.equal(
      coopArenaGuidance(relay).threatText,
      text('interface:relayCoresWarnBeforeSendingASparkAlongAnUnfinished'),
      'Legacy relay-only emissions keep their single-spark guidance.',
    );
    assert.equal(coopArenaGuidance(relay).supportCapabilities.intercept, true);
    for (const specialist of [false, true]) {
      const empty = coopArenaGuidance(impactLevel({ specialist, enemies: false }));
      assert.equal(empty.supportCapabilities.intercept, false);
      assert.equal(empty.threatTitle, text('interface:practiceYourRoutes'));
      assert.equal(empty.threatText, text('gameplay:team.noThreats', { context: 'reclaimed' }));
      assert.ok(!empty.threatText.includes(impactCopy()));
    }
  });

  for (const specialist of [false, true])
    test(`${locale}/${specialist ? 'specialist' : 'hybrid'}: imported Team Help retains exact impact and seat advice through pause/read/Back`, async (t) => {
      const f = await page(t),
        pack = impactPack({ specialist });
      assert.deepEqual(validateCoopPack(pack), { valid: true, errors: [] });
      await f.selectFile(JSON.stringify(pack));
      assert.equal(f.$('coop-level').value, pack.levels[0].id);
      await waitFor(
        () => !f.$('coop-start').disabled && f.$('coop-picture-status').dataset.state === 'ready',
        () => f.$('coop-picture-status').textContent,
      );
      useLocale(t, locale);
      const check = () => {
        assert.ok(f.$('coop-threat-help').textContent.includes(impactCopy()));
        assert.doesNotMatch(f.$('coop-help-reading').textContent, /team\.trailImpact|\{\{/);
        const support = f.$('coop-help-support').textContent;
        if (specialist)
          assert.ok(
            support.includes(
              text('interface:team.specialistSupportSlowAndIntercept', {
                interceptor: 2,
                disruptor: 1,
              }),
            ),
          );
        else assert.ok(support.includes(text('gameplay:team.supportSlowAndIntercept')));
      };
      check();
      f.$('coop-start').click();
      await waitFor(
        () => f.$('coop-overlay').hidden,
        () => f.$('coop-boot').textContent,
      );
      f.tick(30);
      assert.equal(
        f.doc.body.classList.contains('playing'),
        true,
        JSON.stringify({
          picture: f.$('coop-picture-status').textContent,
          boot: f.$('coop-boot').textContent,
          disabled: f.$('coop-start').disabled,
          menu: f.$('coop-menu').hidden,
          pack: f.$('coop-pack-status').textContent,
        }),
      );
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
      assert.equal(f.$('coop-overlay-kicker').textContent, text('interface:paused3'));
      assert.equal(f.$('coop-clock').textContent, clock);
    });
}
