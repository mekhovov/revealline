import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { soloPage } from './helpers/solo-dom.mjs';

const campaign = JSON.parse(readFileSync(new URL('../content/campaign.json', import.meta.url)));

// Actual authored capacity/supply data and app prompts; no gameplay rule replacement.
for (const withSupply of [false, true])
  test(`manual equipment prompts follow selected craft and actual supply availability: pads ${withSupply}`, async (t) => {
    const source = structuredClone(campaign);
    source.id = `equipment-help-${withSupply}`;
    if (!withSupply) source.levels[0].supplies = [];
    const page = await soloPage(t, { campaign: source });
    assert.equal(page.rendered.run.ability.capacity, 0);
    assert.equal(page.$('manual-equipment-help').hidden, false);
    assert.equal(page.$('pickup-button').hidden, true);
    assert.doesNotMatch(page.$('keyboard-help').textContent, /supply/i);
    assert.doesNotMatch(page.$('controller-help').textContent, /: supply/i);
    page.change('class-select', 'bomber');
    page.frame(0);
    assert.equal(page.rendered.run.ability.capacity, 1);
    assert.equal(page.$('pickup-button').hidden, !withSupply);
    assert.equal(/supply/i.test(page.$('keyboard-help').textContent), withSupply);
    assert.equal(/: supply/i.test(page.$('controller-help').textContent), withSupply);
    assert.equal(page.rendered.run.tick, 0, 'Reading help does not start flight');
    assert.deepEqual(page.errors, []);
  });
