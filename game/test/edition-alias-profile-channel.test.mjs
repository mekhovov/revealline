import test from 'node:test';
import assert from 'node:assert/strict';
import {
  editionIdFromLocation,
  editionAppIdentity,
  editionPublicSlug,
  installedStateKey,
  resolveEditionContext,
  validateCompanyInstallationReference,
} from '../edition-context.mjs';
import { recoveryChannel, channelFromStorageKey } from '../profile-channel.mjs';

const canonical = 'droneaid-nl-community';
const origin = 'https://mekhovov.github.io/revealline/';
const context = (version = '0.150.0') => resolveEditionContext({ editionId: canonical, version });

test('old and public edition addresses retain the same canonical save identity', () => {
  const identities = ['droneaid-nl-community', 'droneaid'].map((slug) =>
    editionIdFromLocation({ href: origin + 'editions/' + slug + '/game/company.html' }),
  );
  assert.deepEqual(identities, [canonical, canonical]);
  const profiles = identities.map((editionId) =>
    resolveEditionContext({ editionId, version: '0.150.0' }),
  );
  assert.deepEqual(profiles[0], profiles[1]);
  assert.equal(profiles[0].channel, 'edition-droneaid-nl-community.release-0.150.0');
  assert.equal(
    installedStateKey(identities[1]),
    'revealline.installed-app.edition-droneaid-nl-community.v1',
  );
});

test('public slug changes navigation, not installed application identity', () => {
  assert.equal(editionPublicSlug(canonical), 'droneaid');
  assert.deepEqual(editionAppIdentity({ editionId: canonical, basePath: '/revealline/' }), {
    id: '/revealline/editions/droneaid-nl-community/',
    start_url: '/revealline/editions/droneaid/app/',
    scope: '/revealline/editions/droneaid/',
  });
});

for (const version of ['0.150.0', 'v0.150.0']) {
  test(
    'main launch fix accepts default profile version ' + version + ' without rewriting keys',
    () => {
      const profile = resolveEditionContext({ version });
      const source = recoveryChannel(profile.channel, version);
      assert.equal(source.support, 'current');
      assert.equal(source.profileKey, profile.profileKey);
      assert.equal(source.buildLabel, version);
      assert.equal(channelFromStorageKey(profile.profileKey, version).support, 'current');
    },
  );
}

test('canonical edition accepts both version spellings while preserving each stored key', () => {
  const currentKeys = [];
  for (const version of ['0.150.0', 'v0.150.0']) {
    const profile = context(version);
    const source = recoveryChannel(profile.channel, version, { editionId: canonical });
    assert.equal(source.support, 'current');
    assert.equal(source.editionId, canonical);
    assert.equal(source.profileKey, profile.profileKey);
    currentKeys.push(source.profileKey);
  }
  assert.notEqual(currentKeys[0], currentKeys[1]);
});

test('alias routing keeps historical saves discoverable without admitting another edition', () => {
  const editionId = editionIdFromLocation({ href: origin + 'editions/droneaid/app/' });
  for (const version of ['0.142.4', 'v0.142.4']) {
    const prior = context(version);
    const source = recoveryChannel(prior.channel, '0.150.0', { editionId });
    assert.equal(source.support, 'historical');
    assert.equal(source.profileKey, prior.profileKey);
  }
  const wrong = recoveryChannel('edition-another-company.release-0.142.4', '0.150.0', {
    editionId,
  });
  assert.equal(wrong.support, 'protected-unknown');
});

test('installation references accept retained and public addresses for the same canonical edition', () => {
  for (const slug of [canonical, 'droneaid']) {
    const value = {
      editionId: canonical,
      version: '0.150.0',
      scope: origin + 'editions/' + slug + '/releases/v0.150.0/site/',
      entry: 'game/company.html',
    };
    const actual = validateCompanyInstallationReference(value, {
      editionId: canonical,
      baseURL: origin + 'editions/droneaid/app/',
      editionRoot: '/revealline/editions/droneaid/',
    });
    assert.equal(actual.editionId, canonical);
    assert.equal(actual.scope, value.scope);
    assert.throws(
      () =>
        validateCompanyInstallationReference(
          { ...value, editionId: 'droneaid' },
          {
            editionId: canonical,
            baseURL: origin + 'editions/droneaid/app/',
            editionRoot: '/revealline/editions/droneaid/',
          },
        ),
      /identity differs/,
    );
  }
});

test('malformed versions remain rejected by the composed identity and recovery modules', () => {
  for (const version of ['00.150.0', '0.150', '0.150.0-beta', 'v0.150.0.1', '../0.150.0']) {
    assert.throws(() => context(version), /stable release version/);
    assert.throws(() => recoveryChannel('release-0.150.0', version), /stable current release/);
  }
});
