import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { Document } from './helpers/couch-dom.mjs';
import { authoredModeDestinations, authoredTeamReturn } from '../ui/authored-mode-routes.mjs';
import { AUTHORED_JOURNEY_ROUTE_IDS } from '../content-design/mode-href.mjs';
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
for (const route of AUTHORED_JOURNEY_ROUTE_IDS)
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
test('Legacy bootstrap escapes preserve the catalogue before mode modules prepare', () => {
  assert.equal(boot('versus', '?journey=legacy')('boot-return'), '../?journey=legacy');
  for (const origin of ['solo', 'versus']) {
    const links = boot('team', `?journey=legacy&return=${origin}`);
    assert.equal(links('coop-home'), '../?journey=legacy');
    assert.equal(links('coop-solo'), '../?journey=legacy');
    assert.equal(links('coop-versus'), './?journey=legacy');
    assert.equal(
      links('coop-race'),
      origin === 'solo' ? '../?journey=legacy' : './?journey=legacy',
    );
  }
});
test('bootstrap preserves resolved Legacy intent while rejecting untrusted destinations', () => {
  for (const search of [
    '?journey=x',
    '?journey=',
    '?journey=https://other.invalid',
    '?practice=1',
    '?pack=fieldcraft',
    '?return-token=invalid',
    '?workshop=playground',
  ]) {
    assert.equal(boot('versus', search)('boot-return'), '../?journey=legacy');
    assert.equal(boot('team', search)('coop-race'), './?journey=legacy');
  }
  assert.equal(
    boot('versus', '?journey=opening&journey=authored')('boot-return'),
    '../?journey=opening',
  );
  assert.equal(
    boot('team', '?journey=team-spatial-originals-1&journey=legacy')('coop-race'),
    './?journey=legacy',
  );
  const base = '?return=solo&journey-return=opening';
  for (const suffix of ['&return=versus', '&journey-return=authored'])
    assert.equal(boot('team', base + suffix)('coop-race'), 'unchanged');
  for (const suffix of [
    '&return-token=x',
    '&return-token-v2=x',
    '&mode-return=x',
    '&mode-return-v2=x',
    '&practice=1',
    '&journey=opening',
  ])
    assert.equal(boot('team', base + suffix)('coop-race'), '../?journey=legacy');
  assert.equal(boot('other', '?journey=opening')('boot-return'), 'unchanged');
});

test('Team bootstrap gives a validated authored return the same priority as the ready host', () => {
  for (const key of ['pack', 'campaign', 'level', 'play', 'course', 'lesson', 'workshop']) {
    const search = `?return=solo&journey-return=opening&${key}=legacy-value`;
    const ready = authoredTeamReturn(`https://game.invalid/game/couch/relay-rescue.html${search}`);
    const links = boot('team', search);
    assert.equal(links('coop-home'), ready.solo);
    assert.equal(links('coop-versus'), ready.versus);
    assert.equal(links('coop-race'), ready.solo);
  }
});
