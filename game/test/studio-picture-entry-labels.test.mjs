import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('pictured Studio chapter actions label their existing explicit artwork source honestly', async () => {
  const html = await readFile(new URL('../studio/index.html', import.meta.url), 'utf8');
  const host = await readFile(new URL('../studio/studio.mjs', import.meta.url), 'utf8');
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
    assert(html.includes(`id="${id}">Inspect ${name} picture candidates</button>`));
    assert(host.includes(`${factory}({ artwork: true })`));
  }
  // These separate historical actions still inspect unillustrated theme drafts.
  assert(html.includes('Inspect Signal Gardens greyboxes'));
  assert(html.includes('Inspect Team Signal greybox'));
  assert(html.includes('Apply inspected source'));
});
