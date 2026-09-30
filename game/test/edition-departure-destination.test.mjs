import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { editionDepartureDestinationAllowed } from '../editions/departure-destination.mjs';

const baseURL = 'https://example.test/revealline/game/index.html?edition=alpha';
const provider = {
  editionId: 'alpha',
  retainedPresentationId: null,
  currentCatalog: { editions: [{ id: 'alpha' }, { id: 'beta' }] },
  presentationHistory: [{ id: 'earlier' }],
  href(parameters = {}) {
    const url = new URL(baseURL);
    if (this.retainedPresentationId)
      url.searchParams.set('presentation', this.retainedPresentationId);
    for (const [key, value] of Object.entries(parameters))
      if (value == null) url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    return url.href;
  },
};
const editionTicket = { kind: 'catalogue', destinationEditionId: 'beta' };
const retainedTicket = { kind: 'catalogue', presentationId: 'earlier' };
const allowed = (ticket, destination, source = provider) =>
  editionDepartureDestinationAllowed(source, ticket, destination, baseURL);

test('an authenticated catalogue switch selects another edition without retaining old artwork', () => {
  assert.equal(
    allowed(editionTicket, provider.href({ edition: 'beta', presentation: null })),
    true,
  );
});
test('an authenticated artwork switch selects its retained presentation', () => {
  assert.equal(allowed(retainedTicket, provider.href({ presentation: 'earlier' })), true);
});
test('a retained presentation can return to the current presentation', () => {
  const retained = { ...provider, retainedPresentationId: 'earlier' };
  assert.equal(
    allowed(
      { kind: 'catalogue', presentationId: null },
      retained.href({ presentation: null }),
      retained,
    ),
    true,
  );
});
test('foreign, credentialed, altered and unregistered destinations fail closed', () => {
  for (const destination of [
    'https://foreign.test/game/index.html?edition=beta',
    'https://user@example.test/revealline/game/index.html?edition=beta',
    provider.href({ edition: 'beta', campaign: 'unexpected' }),
    provider.href({ edition: 'unknown' }),
    provider.href({ edition: 'beta', presentation: 'earlier' }),
  ])
    assert.equal(allowed(editionTicket, destination), false, destination);
  assert.equal(
    allowed(
      { ...editionTicket, destinationEditionId: 'unknown' },
      provider.href({ edition: 'unknown' }),
    ),
    false,
  );
  assert.equal(
    allowed(
      { ...retainedTicket, presentationId: 'unknown' },
      provider.href({ presentation: 'unknown' }),
    ),
    false,
  );
});
test('ambiguous mixed requests and wrong departure kinds fail closed', () => {
  assert.equal(
    allowed(
      { ...editionTicket, presentationId: 'earlier' },
      provider.href({ edition: 'beta', presentation: 'earlier' }),
    ),
    false,
  );
  assert.equal(
    allowed({ ...editionTicket, kind: 'versus' }, provider.href({ edition: 'beta' })),
    false,
  );
});

const hostSource = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const start = hostSource.indexOf('  async function prepareModeDestination(');
const end = hostSource.indexOf('\n  function syncAuthoredModeLinks()', start);
assert.ok(start >= 0 && end > start, 'the tested host preparation boundary must exist');
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
function prepare(ticket, current) {
  const factory = new AsyncFunction(
    'runtimeContent',
    'modeDepartureCurrent',
    'gameplayDownloads',
    'location',
    'editionDepartureDestinationAllowed',
    't',
    hostSource.slice(start, end) + '\nreturn prepareModeDestination;',
  );
  return factory(
    provider,
    current,
    {
      ensureDestination() {
        assert.fail('company requested default downloads');
      },
    },
    { href: baseURL },
    editionDepartureDestinationAllowed,
    (key) => key,
  ).then((fn) => fn(ticket, ticket.destinationHref));
}
test('the actual host boundary accepts edition and retained artwork changes without default downloads', async () => {
  for (const ticket of [
    { ...editionTicket, destinationHref: provider.href({ edition: 'beta', presentation: null }) },
    { ...retainedTicket, destinationHref: provider.href({ presentation: 'earlier' }) },
  ]) {
    let checks = 0;
    await prepare(ticket, () => checks++);
    assert.equal(checks, 2);
  }
});
test('the actual host boundary rejects cancelled and stale departures', async () => {
  for (const failure of [new DOMException('cancelled', 'AbortError'), new Error('stale owner')])
    await assert.rejects(
      prepare({ ...editionTicket, destinationHref: provider.href({ edition: 'beta' }) }, () => {
        throw failure;
      }),
      (error) => error === failure,
    );
});
test('the actual host boundary rejects invalid destinations before successful ownership completion', async () => {
  let checks = 0;
  await assert.rejects(
    prepare({ ...editionTicket, destinationHref: 'https://foreign.test/' }, () => checks++),
    /thisContentHasNoAcceptedActorAppearanceOwner/,
  );
  assert.equal(checks, 1);
});
