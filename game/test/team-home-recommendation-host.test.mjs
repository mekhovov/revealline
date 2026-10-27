import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash, webcrypto } from 'node:crypto';
import { page } from './helpers/coop-host.mjs';
import { deferred, waitFor } from './helpers/coop-presentation-fixture.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { replayTeamCommands } from './helpers/coop-win.mjs';
import { TEAM_ART_CANDIDATES } from '../content-design/team-art.mjs';
import { SIGNAL_TEAM_ART_CANDIDATES } from '../content-design/signal-art.mjs';
import {
  createTeamCulturalSpecialistV2OriginalCandidates,
  TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY,
} from '../content-design/team-cultural-specialist-v2-originals.mjs';
import { createTeamTestPack } from '../content-design/team-export.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { dataIdentity } from '../data-json.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createCoop, startCoop, stepCoop } from '../coop/core.mjs';
import { journeyMissionId } from '../journey/catalog.mjs';
import { libraryMissionId } from '../mission-library/library.mjs';
import { createJourneyBackend } from '../journey/profile.mjs';
import { getLocale, setLocale } from '../i18n/index.mjs';

// Metadata and authentic bytes only: no second compiled Journey at file scope.
// Image dimensions model decoding; this is not browser pixel qualification.
const assets = [...TEAM_ART_CANDIDATES, ...SIGNAL_TEAM_ART_CANDIDATES];
const originals = new Map(
  await Promise.all(
    assets.map(async (asset) => [
      asset.path,
      await readFile(new URL('../' + asset.path, import.meta.url)),
    ]),
  ),
);
const base = 'http://localhost/game/couch/relay-rescue.html';
let source;
const authored = () => (source ??= createTeamCulturalSpecialistV2OriginalCandidates());
function currentOpeningRoute() {
  const project = authored();
  assert.equal(project.id, 'team-cultural-specialist-originals-v2-review');
  assert.equal(project.revision, 'team-cultural-routes-2');
  const authoredLevel = resolveMission(compileContentProject(project), 'twin-landings', {
    mode: 'team',
    difficulty: 'standard',
  }).level;
  const level = applyGameplayTuning(authoredLevel, resolveGameplayTuning('standard'));
  assert.equal(dataIdentity(authoredLevel), 'd29da0f7a210d38c');
  assert.equal(dataIdentity(level), '211d3e21eea61447');
  assert.equal(level.version, 'revealline-coop-level.v7');
  // Historical pressure-route movement supplied this candidate plan only.
  // Its old recipe/outcome has no authority: independently prove the exact
  // current recipe, legal inputs and full terminal state on every execution.
  const plan = [
    [null, null, 61],
    ['left', 'right', 241],
    ['down', 'right', 24],
    ['down', null, 120],
    ['right', null, 853],
    ['up', null, 138],
    [null, null, 138],
    ['left', null, 579],
  ];
  const commands = plan.flatMap(([a, b, ticks]) =>
    Array.from({ length: ticks }, () =>
      [a, b].map((direction) => ({ direction, support: false, boost: false })),
    ),
  );
  assert.equal(commands.length, 2154);
  assert.equal(
    createHash('sha256').update(JSON.stringify(commands)).digest('hex'),
    'b0b003c7b1a17e5b1e10bc63109e4eff9c99d88e495e16f5fde922c6d91ed77e',
  );
  function replay() {
    const run = startCoop(createCoop(level, { difficulty: 'standard', seed: 17 }));
    assert.equal(run.ruleset, 'revealline-coop.v9');
    const events = [];
    let released = [];
    for (const input of commands) {
      assert.equal(run.status, 'running');
      for (const seat of [0, 1]) {
        assert(
          input[seat].direction !== null || run.players[seat].direction === null,
          'No artificial neutral brake.',
        );
        if (released.includes(seat))
          assert.equal(input[seat].direction, null, 'Banking requires its actual release tick.');
      }
      stepCoop(run, input);
      events.push(...structuredClone(run.events));
      released = run.events
        .filter((event) => event.type === 'cut.closed')
        .map((event) => event.player);
    }
    assert.equal(run.status, 'won');
    assert.equal(run.tick, 2154);
    assert.equal(
      events.some((event) => event.type === 'player.downed'),
      false,
    );
    assert.equal(
      createHash('sha256').update(JSON.stringify({ run, events })).digest('hex'),
      'ba24c2b8a75347e6cf966ad4464b5e1ed10c0d4b3d2a1b26fead1fce128f87b5',
    );
    return { run, events };
  }
  const reference = replay(),
    repeated = replay();
  assert.deepEqual(reference.run, repeated.run);
  assert.deepEqual(reference.events, repeated.events);
  return { ...reference, commands };
}
function identity(levelId) {
  const project = authored();
  const campaign = project.campaigns.find((row) => row.missionIds.includes(levelId));
  const pack = project.packs.find((row) => row.campaignIds.includes(campaign.id));
  return {
    mission: journeyMissionId({
      source: 'candidate',
      packId: pack.id,
      campaignId: campaign.id,
      levelId,
    }),
    campaign: JSON.stringify(['candidate', pack.id, campaign.id]),
  };
}
function english(t) {
  const locale = getLocale();
  setLocale('en', { persist: false });
  t.after(() => setLocale(locale, { persist: false }));
}
async function fresh(t, { onOriginal = async () => {}, beforeImport, ...options } = {}) {
  return page(t, {
    href: base,
    nativeFocus: true,
    nativeVisibility: true,
    retainInitialDifficulty: true,
    ...options,
    beforeImport(context) {
      const { install } = context;
      const BaseImage = globalThis.Image,
        upstream = globalThis.fetch;
      class OriginalImage extends BaseImage {
        async decode() {
          if (!this.source.startsWith('data:image/png;base64,')) return super.decode();
          const bytes = Buffer.from(this.source.split(',')[1], 'base64');
          this.width = this.naturalWidth = bytes.readUInt32BE(16);
          this.height = this.naturalHeight = bytes.readUInt32BE(20);
          this.sha256 = createHash('sha256').update(bytes).digest('hex');
        }
      }
      install('Image', { value: OriginalImage });
      install('crypto', { value: webcrypto });
      install('fetch', {
        value: async (url, request = {}) => {
          const asset = assets.find((row) => new URL(url).pathname.endsWith('/' + row.path));
          if (!asset) return upstream(url, request);
          await onOriginal(asset, request);
          return new Response(originals.get(asset.path));
        },
      });
      beforeImport?.(context);
    },
  });
}
const paragraph = (f) => f.$('coop-home-recommendation');
const ready = (f) =>
  waitFor(
    () => !f.$('coop-start').disabled && f.$('coop-picture-status').dataset.state === 'ready',
    () => f.$('coop-picture-status').textContent,
  );
function visibleDescription(f) {
  const node = paragraph(f);
  assert.equal(node.parentNode.className, 'landing-commands');
  assert.equal(Boolean(node.closest('[hidden],[inert]')), false);
  assert.equal(node.getClientRects().length > 0, true);
  const tokens = f.$('coop-start').getAttribute('aria-describedby').split(/\s+/);
  assert.equal(tokens.filter((id) => id === node.id).length, 1);
  return node;
}
function absent(f) {
  assert.equal(paragraph(f).hidden, true);
  assert.equal(
    (f.$('coop-start').getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .includes(paragraph(f).id),
    false,
  );
}

test(
  'default Team explains its actual prepared Start in EN/UK without writes or a new launch owner',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const memory = managedIndexedDB();
    const f = await fresh(t, {
      beforeImport({ install, $, doc }) {
        install('indexedDB', { value: memory.indexedDB });
        const retained = doc.createElement('p');
        retained.id = 'retained-start-context';
        retained.textContent = 'Existing Start context';
        doc.body.append(retained);
        $('coop-start').setAttribute('aria-describedby', retained.id);
      },
    });
    await ready(f);
    assert.equal(f.$('coop-level').value, 'twin-landings');
    assert.match(visibleDescription(f).textContent, /Twin landings.*first mission/);
    const start = f.$('coop-start'),
      handler = start.onclick;
    start.focus();
    const puts = memory.allPuts.length;
    setLocale('uk', { persist: false });
    assert.match(visibleDescription(f).textContent, /Пропонована командна місія:.*першої місії/);
    assert.equal(Object.is(f.doc.activeElement, start), true);
    assert.equal(Object.is(start.onclick, handler), true);
    assert.equal(memory.allPuts.length, puts);
    assert.equal(start.getAttribute('aria-describedby').includes('retained-start-context'), true);
    f.tap('Enter');
    assert.equal(f.$('coop-menu').hidden, true);
    absent(f);
    assert.equal(start.getAttribute('aria-describedby'), 'retained-start-context');
    f.tick(24);
    f.$('coop-pause').click();
    const clock = f.$('coop-clock').textContent;
    setLocale('en', { persist: false });
    f.tick(12);
    assert.equal(f.$('coop-clock').textContent, clock);
    absent(f);
    f.$('coop-resume').click();
    assert.equal(f.$('coop-overlay').hidden, true);
    assert.equal(f.$('coop-clock').textContent, clock);
    absent(f);
  },
);

test(
  'a deliberately prepared default Team preset has neutral selected wording',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const f = await fresh(t);
    await ready(f);
    const handler = f.$('coop-start').onclick;
    await f.choose('coop-difficulty', 'expert');
    await ready(f);
    assert.equal(f.$('coop-difficulty').value, 'expert');
    assert.match(visibleDescription(f).textContent, /^Selected Team mission: Twin landings\./);
    assert.doesNotMatch(paragraph(f).textContent, /first mission|completion/);
    assert.equal(Object.is(f.$('coop-start').onclick, handler), true);
    assert.equal(f.$('coop-menu').hidden, false);
  },
);

test(
  'command-earned Team completion explains only the existing next selection after re-entry',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const memory = managedIndexedDB();
    const backend = createJourneyBackend({
      ...memory,
      profileKey: TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY,
    });
    const first = identity('twin-landings').mission;
    let profile;
    await t.test(
      'earn the accepted opening mission with public Team commands',
      { timeout: 60000 },
      async (t) => {
        const f = await fresh(t, {
          beforeImport: ({ install }) => install('indexedDB', { value: memory.indexedDB }),
        });
        await ready(f);
        const reference = currentOpeningRoute();
        f.$('coop-start').click();
        const played = replayTeamCommands(f, reference.commands.slice(1));
        assert.equal(played + 1, reference.run.tick);
        assert.equal(f.$('coop-overlay-kicker').textContent, 'A WORLD YOU REVEALED TOGETHER');
        assert.equal(
          f.$('coop-coverage').textContent,
          `${(reference.run.coverage * 100).toFixed(1)}%`,
        );
        assert.equal(f.$('coop-reserves').textContent, `${reference.run.team.reserves} reserves`);
        absent(f);
        await new Promise((resolve) => setImmediate(resolve));
        profile = await backend.read();
        assert.equal(profile.cursors.team, first);
        assert.equal(Boolean(profile.clears.team[first]), true);
        assert.deepEqual(profile.clears.solo, {});
        assert.deepEqual(profile.clears.versus, {});
      },
    );
    await t.test(
      're-entry explains the accepted successor without another profile write',
      { timeout: 60000 },
      async (t) => {
        const puts = memory.allPuts.length;
        const f = await fresh(t, {
          beforeImport: ({ install }) => install('indexedDB', { value: memory.indexedDB }),
        });
        await ready(f);
        assert.equal(f.$('coop-level').value, 'stepping-exchange');
        assert.match(
          visibleDescription(f).textContent,
          /Stepping exchange.*follows Twin landings.*recorded/,
        );
        assert.doesNotMatch(paragraph(f).textContent, /mastery|perfect|won match/);
        assert.equal(memory.allPuts.length, puts);
        assert.deepEqual(await backend.read(), profile);
        setLocale('uk', { persist: false });
        assert.match(visibleDescription(f).textContent, /після місії «.*».*записано/);
        assert.equal(memory.allPuts.length, puts);
      },
    );
  },
);

test(
  'an unknown saved cursor keeps the real fallback but supplies no invented recommendation',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const memory = managedIndexedDB();
    const backend = createJourneyBackend({
      ...memory,
      profileKey: TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY,
    });
    await backend.commit([
      { type: 'select', mode: 'team', missionId: 'retained/unknown-team-mission' },
    ]);
    const profile = await backend.read(),
      puts = memory.allPuts.length;
    const f = await fresh(t, {
      beforeImport: ({ install }) => install('indexedDB', { value: memory.indexedDB }),
    });
    await ready(f);
    assert.equal(f.$('coop-level').value, 'twin-landings');
    absent(f);
    assert.equal(memory.allPuts.length, puts);
    assert.deepEqual(await backend.read(), profile);
  },
);

test(
  'a cancelled initial original cannot replace the newer prepared selection or its explanation',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const gate = deferred(),
      entered = deferred();
    t.after(() => gate.resolve());
    let held = false;
    const f = await fresh(t, {
      waitPicture: false,
      async onOriginal() {
        if (held) return;
        held = true;
        entered.resolve();
        await gate.promise;
      },
    });
    await entered.promise;
    absent(f);
    f.$('coop-picture-cancel').click();
    absent(f);
    await f.choose('coop-difficulty', 'expert');
    await ready(f);
    const text = visibleDescription(f).textContent;
    assert.match(text, /^Selected Team mission:/);
    gate.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    f.tick(2);
    assert.equal(f.$('coop-difficulty').value, 'expert');
    assert.equal(paragraph(f).textContent, text);
    assert.equal(f.$('coop-menu').hidden, false);
  },
);

test(
  'an exact incoming Team mission retains its existing direct launch and suppresses Home guidance',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const exact = identity('stepping-exchange');
    const id = libraryMissionId({
      owner: `journey:${TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY}`,
      edition: TEAM_CULTURAL_SPECIALIST_V2_PROFILE_KEY,
      ...exact,
    });
    const f = await fresh(t, { href: `${base}?library-mission=${encodeURIComponent(id)}` });
    await waitFor(() => f.$('coop-menu').hidden);
    assert.equal(f.$('coop-level').value, 'stepping-exchange');
    assert.equal(f.$('coop-overlay').hidden, true);
    absent(f);
  },
);

test(
  'same-ID imported Team recipes never borrow an authored Home recommendation',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const f = await fresh(t);
    await ready(f);
    await f.selectFile(JSON.stringify(createTeamTestPack(authored(), 'twin-landings', 'standard')));
    await ready(f);
    assert.equal(f.$('coop-level').value, 'twin-landings');
    absent(f);
    setLocale('uk', { persist: false });
    absent(f);
  },
);

for (const route of ['legacy', 'team-greybox', 'unknown'])
  test(
    `explicit ${route} retains its existing Home without the default explanation`,
    { timeout: 60000 },
    async (t) => {
      english(t);
      const f = await fresh(t, { href: `${base}?journey=${route}` });
      absent(f);
      assert.equal(f.$('coop-menu').hidden, false);
    },
  );

test(
  'Team page retirement removes only its description and restores the authored paragraph position',
  { timeout: 60000 },
  async (t) => {
    english(t);
    const f = await fresh(t, {
      beforeImport({ $ }) {
        $('coop-start').setAttribute('aria-describedby', 'coop-intro');
      },
    });
    await ready(f);
    visibleDescription(f);
    f.win.emit('pagehide', { persisted: false });
    absent(f);
    assert.equal(f.$('coop-start').getAttribute('aria-describedby'), 'coop-intro');
    assert.equal(
      Object.is(paragraph(f).parentNode, f.$('coop-navigation-context').parentNode),
      true,
    );
    assert.equal(Object.is(f.$('coop-navigation-context').nextSibling, paragraph(f)), true);
    assert.equal(Object.is(paragraph(f).nextSibling, f.$('coop-intro')), true);
    setLocale('uk', { persist: false });
    assert.equal(paragraph(f).textContent, '');
  },
);
