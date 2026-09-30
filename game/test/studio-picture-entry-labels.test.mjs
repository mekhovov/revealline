import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Document } from './helpers/couch-dom.mjs';
import { mountCouch } from './helpers/mount-html.mjs';

test('pictured Studio chapter actions label their existing explicit artwork source honestly', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
  const document = new Document();
  mountCouch(document, html);
  for (const [id, name, factory] of [
    ['fracture', 'Fractured Grid', 'createFractureCandidates'],
    ['phase', 'Phaseworks', 'createPhaseCandidates'],
    ['livewire', 'Livewire Foundry', 'createLivewireCandidates'],
    ['relay', 'Relay Labyrinth', 'createRelayCandidates'],
    ['crosswind', 'Crosswind Array', 'createCrosswindCandidates'],
    ['sentinel', 'Sentinel Crown', 'createSentinelCandidates'],
    ['apex', 'Apex Aurora', 'createApexCandidates'],
    ['team-journey', 'Team Journey', 'createTeamJourneyCandidates'],
  ]) {
    const button = document.getElementById(id);
    assert.equal(button.tagName, 'BUTTON');
    assert.equal(button.textContent.trim(), `Inspect ${name} picture candidates`);
    assert(host.includes(`${factory}({ artwork: true })`));
  }
  // These separate historical actions still inspect unillustrated theme drafts.
  assert(html.includes('Inspect Signal Gardens greyboxes'));
  assert(html.includes('Inspect Team Signal greybox'));
  assert(html.includes('Apply inspected source'));
});
