import test from 'node:test';
import assert from 'node:assert/strict';
import { page } from './helpers/coop-host.mjs';
import { waitFor } from './helpers/coop-presentation-fixture.mjs';

for (const journey of [false, true]) {
  async function fixture(t) {
    const f = await page(t, {
      href: `http://localhost/game/couch/relay-rescue.html?journey=${journey ? 'team-greybox' : 'legacy'}`,
      nativeFocus: true,
      nativeVisibility: true,
    });
    f.$('coop-start').click();
    f.tick(2);
    f.$('coop-pause').click();
    return f;
  }
  function wording(f) {
    assert.match(f.$('coop-discard-copy').textContent, /unfinished attempt is not saved/);
    assert.match(
      f.$('coop-discard-copy').textContent,
      /current territory, not previously recorded mission clears/,
    );
    assert.doesNotMatch(
      f.$('coop-discard-copy').textContent,
      /progress (?:stays|is only kept) on this page/,
    );
  }
  test(`Team departure warns about the attempt, not deletion of saved Journey receipts: ${journey}`, async (t) => {
    const f = await fixture(t),
      clock = f.$('coop-clock').textContent;
    f.$('coop-lobby').click();
    assert.equal(f.$('coop-discard-dialog').open, true);
    wording(f);
    f.$('coop-discard-stay').click();
    assert.equal(f.$('coop-clock').textContent, clock);
    assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  });
  test(`Team chooser replacement warns about unsaved territory and Stay preserves the attempt: ${journey}`, async (t) => {
    const f = await fixture(t),
      mission = f.$('coop-level').value;
    f.$('coop-discovery-paused').click();
    await waitFor(() => f.$('journey-chooser')?.open);
    const target = [...f.$('journey-cards').querySelectorAll('.journey-card')].find(
      (button) =>
        button.querySelector('strong').textContent === (journey ? 'Shared lookout' : 'Relay Yard'),
    );
    target.focus();
    f.tap('Enter');
    await waitFor(() => f.$('coop-discard-dialog').open);
    wording(f);
    f.$('coop-discard-stay').click();
    await waitFor(() => f.$('journey-chooser').open);
    assert.equal(f.$('coop-level').value, mission);
    assert.equal(f.$('journey-chooser').open, true);
    f.$('journey-back').click();
    assert.equal(f.$('coop-overlay-kicker').textContent, 'PAUSED');
  });
}
