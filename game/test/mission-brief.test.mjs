import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { missionBriefing } from '../mission-brief.mjs';

const json = (path) => JSON.parse(fs.readFileSync(new URL(path, import.meta.url)));
const classes = json('../content/classes.json');
const campaign = json('../content/campaign.json');
const homeward = json('../content/packs/homeward-skies.json');
const classicLab = json('../content/packs/classic-lab.json');

test('classic ready cards name contact pickups, material hazards and claimed-ground threats', () => {
  const levels = classicLab.campaigns[0].levels;
  assert.match(missionBriefing(levels[0]).copy, /Touch pickups/);
  assert.match(
    missionBriefing(levels[2]).copy,
    /Contour crawlers follow the changing frontier after captures; check your next return\./,
  );
  assert.match(missionBriefing(levels[3]).copy, /Rovers wake/);
  assert.match(missionBriefing(levels[4]).copy, /reopening captured ground/);
  assert.match(missionBriefing(levels[5]).copy, /Red crosshatched fields damage/);
  for (const level of levels)
    assert.equal(missionBriefing(level).fullBrief, level.metadata.description);
});

test('Homeward ready cards retain factual requirements without copying route paragraphs', () => {
  const levels = homeward.campaigns[0].levels;
  for (const level of levels) {
    const before = structuredClone(level);
    const card = missionBriefing(level, { classes, objectiveLabel: 'Relay' });
    assert.equal(card.title, level.name);
    assert.equal(card.fullBrief, level.metadata.description);
    assert.ok(card.copy.split(/\s+/).length <= 40, card.copy);
    assert.ok(card.copy.length < 240, card.copy);
    assert.match(card.copy, new RegExp(`Reveal ${level.goal.coverage * 100}%`));
    assert.match(card.copy, /required relay/);
    assert.match(card.copy, /Recommended:/);
    assert.ok(!card.copy.includes('ordinary radio-linked'));
    assert.ok(!card.copy.includes('fields suppress'));
    assert.deepEqual(level, before);
  }
  const final = missionBriefing(levels[2], { classes });
  assert.match(final.copy, /Deadline 35s/);
  const bridge = missionBriefing(levels[1], { classes });
  assert.match(bridge.copy, /Cut ≤ 6.5s/);
  assert.match(bridge.copy, /Recommended: Light carrier \/ Heavy carrier/);
});

test('required objectives and deadlines come from rules, not optional medals or stale prose', () => {
  const level = {
    name: 'Rule check',
    goal: { coverage: 0.725 },
    objectives: [{ required: true }, { required: false }, { hidden: true, required: true }],
    rules: {
      timeLimitSeconds: 90,
      cutTimeLimitSeconds: 4.5,
      maxTrailCells: 36,
      timeMedals: [10, 20],
    },
    metadata: { description: 'Reveal 99% within 2 seconds. This authored prose may be stale.' },
  };
  const result = missionBriefing(level, { objectiveLabel: 'Memory' });
  assert.equal(result.goal, 'Reveal 72.5% · 2 required memories.');
  assert.match(result.copy, /Deadline 90s · Cut ≤ 4.5s · Cable ≤ 36 cells/);
  assert.doesNotMatch(result.copy, /99%|2 seconds|10|20/);
  assert.equal(result.fullBrief, level.metadata.description);
});

test('absent or zero hard limits never turn time medals into a mission deadline', () => {
  const result = missionBriefing(campaign.levels[0], { brief: campaign.briefs[0] });
  assert.equal(result.copy, 'Reveal 45%.');
  assert.equal(result.fullBrief, campaign.briefs[0]);
  const zero = structuredClone(campaign.levels[0]);
  zero.rules.timeLimitSeconds = 0;
  zero.rules.cutTimeLimitSeconds = 0;
  zero.rules.maxTrailCells = 0;
  assert.equal(missionBriefing(zero).copy, 'Reveal 45%.');
});

test('intro guidance is opt-in, so first expansion maps retain their own title and facts', () => {
  const intro = missionBriefing(campaign.levels[0], { intro: true, brief: campaign.briefs[0] });
  assert.equal(intro.copy.split('\n').length, 2);
  assert.match(intro.copy, /Leave safe ground/);
  assert.match(intro.copy, /Reveal 45%/);
  assert.match(intro.status, /fly down/);
  const expansion = missionBriefing(homeward.campaigns[0].levels[0], { classes });
  assert.equal(expansion.title, 'Copper Orchard');
  assert.doesNotMatch(expansion.copy, /Leave safe ground/);
});

test('long imported prose and titles stay complete in the brief, with a bounded ready title', () => {
  const level = {
    ...campaign.levels[0],
    name: '<Long title> '.repeat(8),
    metadata: { description: 'Full authored route. '.repeat(100) },
  };
  const result = missionBriefing(level);
  assert.ok(result.title.length <= 44);
  assert.ok(result.title.endsWith('…'));
  assert.equal(result.fullTitle, level.name);
  assert.equal(result.fullBrief, level.metadata.description);
  assert.equal(result.copy, 'Reveal 45%.');
  assert.ok(result.status.length < 100);
});

test('a recommendation is not inferred from casual class mentions or unknown equipment', () => {
  const level = campaign.levels[0];
  for (const brief of ['A Fiber relay can help.', 'Recommended: Unregistered fictional tool.'])
    assert.doesNotMatch(missionBriefing(level, { brief, classes }).copy, /Recommended:/);
});

test('all bundled pack ready cards remain compact while retaining the complete authored brief', () => {
  const directory = new URL('../content/packs/', import.meta.url);
  for (const name of fs.readdirSync(directory).filter((file) => file.endsWith('.json'))) {
    const pack = json(`../content/packs/${name}`);
    for (const item of pack.campaigns || []) {
      for (const [index, level] of item.levels.entries()) {
        const result = missionBriefing(level, { classes, brief: item.briefs?.[index] });
        assert.ok(result.copy.length <= 240, `${name}/${level.id}: ${result.copy}`);
        assert.ok(result.title.length <= 44);
        if (level.metadata?.description && !item.briefs?.[index])
          assert.equal(result.fullBrief, level.metadata.description);
      }
    }
  }
});

test('pressure brief explains locked commitment while preserving the full authored routing lesson', () => {
  const level = structuredClone(classicLab.campaigns[0].levels[0]);
  level.classic.enemyPressure = { version: 'enemy-pressure.v1', actors: [{ id: 'demo' }] };
  const result = missionBriefing(level);
  assert.match(result.copy, /AIM locks. Evade HEAD/);
  assert.match(result.copy, /close before TRAIL catches up/);
  assert.match(result.status, /turn away from a heading lock/);
  assert.equal(result.fullBrief, level.metadata.description);
});
