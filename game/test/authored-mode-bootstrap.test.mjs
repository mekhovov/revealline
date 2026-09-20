import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Document } from './helpers/couch-dom.mjs';
import { authoredModeDestinations, authoredTeamReturn } from '../ui/authored-mode-routes.mjs';
const source = await readFile(new URL('../couch/mode-entry.js', import.meta.url), 'utf8');
function boot(mode, search) {
  const document = new Document();
  document.baseURI = `https://game.invalid/releases/v0.1/site/game/couch/${mode === 'team' ? 'relay-rescue.html' : ''}${search}`;
  document.currentScript = { dataset: { mode } };
  for (const id of ['boot-return', 'coop-home', 'coop-solo', 'coop-versus', 'coop-race']) {
    const link = document.createElement('a');
    link.id = id;
    link.setAttribute('href', 'unchanged');
    document.body.append(link);
  }
  runInNewContext(source, { document, URL });
  return (id, text = false) =>
    text
      ? document.getElementById(id).textContent
      : document.getElementById(id).getAttribute('href');
}
for (const route of ['opening', 'authored'])
  test(`${route}: native boot escape matches ready destinations before any host modules load`, () => {
    const links = boot('versus', `?journey=${route}`);
    assert.equal(links('boot-return'), authoredModeDestinations('versus', route).solo);
    for (const origin of ['solo', 'versus']) {
      const search = `?return=${origin}&journey-return=${route}`,
        ready = authoredTeamReturn(`https://game.invalid/game/couch/relay-rescue.html${search}`),
        team = boot('team', search);
      assert.equal(team('coop-home'), ready.solo);
      assert.equal(team('coop-solo'), ready.solo);
      assert.equal(team('coop-versus'), ready.versus);
      assert.equal(team('coop-race'), ready[origin]);
      assert.equal(team('coop-race', true), origin === 'solo' ? 'Back to Solo' : 'Race mode ↗');
    }
  });
test('bootstrap never accepts duplicate, unknown or competing Team origins', () => {
  for (const search of [
    '?journey=x',
    '?journey=opening&journey=authored',
    '?journey=https://other.invalid',
  ])
    assert.equal(boot('versus', search)('boot-return'), 'unchanged');
  const base = '?return=solo&journey-return=opening';
  for (const suffix of [
    '&return=versus',
    '&journey-return=authored',
    '&return-token=x',
    '&return-token-v2=x',
    '&mode-return=x',
    '&mode-return-v2=x',
    '&practice=1',
    '&journey=opening',
  ])
    assert.equal(boot('team', base + suffix)('coop-race'), 'unchanged');
  assert.equal(boot('other', '?journey=opening')('boot-return'), 'unchanged');
});
