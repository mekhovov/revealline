import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';
import {
  teamArenaLibrarySource,
  teamJourneyLibrarySource,
  TEAM_LIBRARY_JOURNEY_EDITION,
} from '../mission-library/team-source.mjs';
import { COOP_STARTER_PACK, coopPackDestination } from '../coop/library.mjs';
import { createCoop, startCoop } from '../coop/core.mjs';
import { COOP_PLAYTEST_CONFIGURATIONS } from '../coop/relay-yard.mjs';
import { createCandidateTeamHost } from '../content-design/team-host.mjs';
import { createTeamSpatialOriginalCandidates } from '../content-design/team-spatial-originals.mjs';

// Execute the production navigation and adoption functions unchanged, with a
// controlled completed-result/picture-lease boundary. This is transaction
// evidence, not a simulated human clear or a native browser/input claim.
const host = await readFile(new URL('../couch/relay-rescue.mjs', import.meta.url), 'utf8');
const functions = [
  ['function journeyNavigation()', 'function nextStatus('],
  ['function nextStatus(', 'async function nextArena('],
  ['async function nextArena(', "$('coop-next').onclick ="],
].map(([start, end]) => host.slice(host.indexOf(start), host.indexOf(end, host.indexOf(start))));
const design = createTeamSpatialOriginalCandidates();
const journey = createCandidateTeamHost(design, {
  corePackIds: design.packs.map((pack) => pack.id),
});

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

function fixture({
  journeyMission = null,
  custom = true,
  currentIndex = 1,
  unavailable = false,
} = {}) {
  const library = createMissionLibrary(),
    runtimeRows = new WeakMap(),
    rows = [];
  const register = (source, resolve) => {
    library
      .register(source)
      .forEach((row, index) => runtimeRows.set(row, () => resolve(source.entries[index])));
  };
  const packRows = (pack) =>
    pack.levels.map((level) => ({
      pack,
      level,
      levelId: level.id,
      title: level.name,
      packName: pack.name,
      artworkSource:
        pack === COOP_STARTER_PACK ? null : { receipt: { theme: { id: 'custom-art' } } },
      goal: 'Test exact owner',
    }));
  const classic = packRows(COOP_STARTER_PACK),
    customRows = packRows(structuredClone(COOP_STARTER_PACK));
  let candidateRows = [];
  if (journeyMission) {
    candidateRows = journey.catalog.missions.map((mission) => {
      const row = journey.row(mission, 'standard');
      return { ...row, journeyRow: row, levelId: row.level.id, artworkSource: null };
    });
    rows.push(...candidateRows);
    register(teamJourneyLibrarySource({ journey, launch: () => true }), (mission) =>
      candidateRows.find((row) => row.journeyRow.mission === mission),
    );
  }
  rows.push(...classic);
  register(teamArenaLibrarySource({ rows: classic, launch: () => true }), (row) => row);
  if (custom) {
    rows.push(...customRows);
    register(
      teamArenaLibrarySource({
        rows: customRows,
        collection: 'Custom',
        sourceId: 'custom-owner',
        editionId: 'custom-edition',
        launch: () => true,
        isCurrent: () => !unavailable,
      }),
      (row) => row,
    );
  }
  const current = journeyMission
    ? candidateRows.find((row) => row.levelId === journeyMission)
    : classic[currentIndex];
  const elements = new Map(),
    calls = [],
    leases = [],
    gate = deferred();
  const document = { activeElement: null, addEventListener() {}, removeEventListener() {} };
  const $ = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        id,
        hidden: false,
        textContent: '',
        value: '',
        setAttribute() {},
        focus() {
          document.activeElement = this;
        },
      });
    return elements.get(id);
  };
  const acceptedPicture = {
    state: 'ready',
    sourcePack: current.pack,
    pack: structuredClone(current.pack),
    levelId: current.levelId,
    journeyRow: current.journeyRow,
    artworkSource: current.artworkSource,
    binding: { image: 'earned original' },
    lease: {
      dispose() {
        calls.push('old-release');
      },
    },
  };
  const ctx = {
    $,
    document,
    structuredClone,
    AbortController,
    DOMException,
    JSON,
    console: { error() {} },
    COOP_STARTER_PACK,
    COOP_PLAYTEST_CONFIGURATIONS,
    librarySuccessor,
    coopPackDestination,
    TEAM_LIBRARY_JOURNEY_EDITION,
    libraryEdition: TEAM_LIBRARY_JOURNEY_EDITION,
    entryParams: new URLSearchParams(),
    candidateJourney: journeyMission ? journey : null,
    libraryRuntimeRows: runtimeRows,
    getTeamLibrary: () => library,
    currentDiscoveryRows: () => rows,
    run: { status: 'won' },
    generation: 1,
    acceptedPicture,
    pictureSelection: acceptedPicture,
    attemptPack: acceptedPicture.pack,
    attemptLevel: structuredClone(current.level),
    pack: current.pack,
    packArtworkSource: current.artworkSource,
    disposed: false,
    inactive: false,
    loopStopped: false,
    nextOperation: null,
    foreground: () => true,
    discovery: { isOpen: () => false },
    settingsDialog: { open: false },
    earnedDialog: { open: false },
    departure: null,
    settingsVisit: 1,
    knockdowns: [null, null],
    last: null,
    accumulator: 0,
    lastBuiltInArena: 'relay-yard',
    presentationPage: { ready: Promise.resolve() },
    displayPreferences: { snapshot: () => ({ effectiveReducedEffects: true, textFace: 'sans' }) },
    currentRecipe: () => ({ options: { difficulty: 'standard', seed: 17 } }),
    freshRecipe: (level, options) => ({ level, options }),
    newPictureSelection(recipe, sourcePack, pinnedPack, artworkSource) {
      const selection = {
        sourcePack,
        pack: structuredClone(pinnedPack),
        artworkSource,
        levelId: recipe.level.id,
        request: { levelId: recipe.level.id },
        state: 'new',
        lease: {
          async select({ signal }) {
            calls.push(['select', sourcePack, recipe.level.id, artworkSource, signal]);
            await gate.promise;
            return { image: 'next original' };
          },
          confirm() {
            return { image: 'next original' };
          },
          dispose() {
            calls.push('next-release');
          },
        },
      };
      leases.push(selection);
      return selection;
    },
    createTunedCoop: (recipe) => createCoop(recipe.level, recipe.options),
    startCoop,
    attemptTuning: { get: (candidate) => ({ pictureLevel: candidate.level }) },
    painter: {
      paint() {
        calls.push('paint');
      },
    },
    clear() {
      calls.push('clear-input');
    },
    running: () => ctx.run?.status === 'running',
    showPack(pack) {
      ctx.pack = pack;
      calls.push(['show-pack', pack]);
    },
    overlay() {},
    render() {},
    setupNote() {},
    arenaPreference: {
      choose(id) {
        calls.push(['preference', id]);
      },
    },
    candidateProgress: {
      started() {
        calls.push('started');
      },
    },
    message(text) {
      calls.push(text);
    },
    input: {
      focus() {
        calls.push('input-focus');
      },
    },
  };
  $('coop-level').value = current.levelId;
  $('coop-difficulty').value = 'standard';
  $('coop-experiment').value = 'full';
  $('coop-next').focus();
  const api = runInNewContext(
    `${functions.join('\n')}\n({ teamDestination, nextArena, cancelNext });`,
    ctx,
  );
  return {
    ctx,
    api,
    library,
    runtimeRows,
    classic,
    customRows,
    candidateRows,
    calls,
    leases,
    gate,
    $,
  };
}

test('Team preserves authored successors and crosses Journey → Classic by exact runtime identity', () => {
  const first = fixture({ journeyMission: journey.catalog.missions[0].levelId });
  assert.equal(first.api.teamDestination().next.id, journey.catalog.missions[1].levelId);
  const last = fixture({ journeyMission: journey.catalog.missions.at(-1).levelId });
  const destination = last.api.teamDestination();
  assert.equal(destination.nextDiscoveryRow, last.classic[0]);
  assert.equal(destination.next, COOP_STARTER_PACK.levels[0]);
  last.ctx.libraryEdition = 'team-greybox';
  assert.equal(
    last.api.teamDestination().next,
    null,
    'Explicit test editions keep their separate route',
  );
});

test('Classic → same-name Custom ignores search and final Custom never wraps', () => {
  const f = fixture();
  f.library.search('Relay Yard', { mode: 'team', collection: 'Classic' });
  assert.equal(f.api.teamDestination().nextDiscoveryRow, f.customRows[0]);
  const last = f.customRows.at(-1);
  f.ctx.acceptedPicture.sourcePack = last.pack;
  f.ctx.acceptedPicture.levelId = last.levelId;
  f.ctx.attemptLevel = structuredClone(last.level);
  const destination = f.api.teamDestination();
  assert.equal(destination.next, null);
  assert.equal(destination.libraryEnd, true);
});

test('missing or ambiguous exact current identity is recoverable, never library completion', async () => {
  for (const kind of ['missing', 'ambiguous']) {
    const f = fixture();
    if (kind === 'missing') f.ctx.acceptedPicture.sourcePack = structuredClone(COOP_STARTER_PACK);
    else {
      const customLast = f.library.forMode('team').at(-1);
      f.runtimeRows.set(customLast, () => f.classic.at(-1));
    }
    const result = f.api.teamDestination();
    assert(result.error);
    assert.equal(result.final, false);
    await f.api.nextArena();
    assert.match(f.$('coop-next-status').textContent, /unavailable.*result and picture are kept/);
    assert.equal(f.leases.length, 0);
  }
});

test('an unavailable exact successor is not skipped or reported as the library end', async () => {
  const f = fixture({ unavailable: true });
  const result = f.api.teamDestination();
  assert(result.error);
  assert.equal(result.final, false);
  await f.api.nextArena();
  assert.equal(f.leases.length, 0);
  assert.match(f.$('coop-next-status').textContent, /unavailable/);
});

test('boundary Next stages exact Custom artwork behind earned result, then adopts with fresh input', async () => {
  const f = fixture(),
    oldRun = f.ctx.run,
    oldPicture = f.ctx.acceptedPicture;
  const pending = f.api.nextArena();
  await Promise.resolve();
  assert.equal(f.ctx.run, oldRun);
  assert.equal(f.ctx.acceptedPicture, oldPicture);
  assert.equal(f.$('coop-next-cancel').hidden, false);
  assert.equal(f.leases[0].sourcePack, f.customRows[0].pack);
  assert.equal(f.leases[0].artworkSource, f.customRows[0].artworkSource);
  f.gate.resolve();
  await pending;
  assert.equal(f.ctx.run.status, 'running');
  assert.equal(f.ctx.run.level.id, 'first-connection');
  assert.equal(f.ctx.run.difficulty, 'standard');
  assert.equal(f.ctx.acceptedPicture, f.leases[0]);
  assert.equal(f.ctx.packArtworkSource, f.customRows[0].artworkSource);
  assert.equal(f.ctx.pack, f.customRows[0].pack);
  assert.equal(f.ctx.run.coverage, 0);
  assert(f.ctx.run.players.every((player) => player.direction === null));
  assert(f.calls.indexOf('clear-input') < f.calls.indexOf('input-focus'));
  assert.equal(f.calls.filter((call) => call === 'started').length, 1);
});

for (const outcome of ['cancel', 'failure', 'paint-failure', 'adoption-failure'])
  test(`boundary Next ${outcome} retains the result and picture without target progress`, async () => {
    const f = fixture({ journeyMission: journey.catalog.missions.at(-1).levelId });
    const oldRun = f.ctx.run,
      oldPicture = f.ctx.acceptedPicture;
    const pending = f.api.nextArena();
    await Promise.resolve();
    if (outcome === 'cancel') f.api.cancelNext({ restore: true });
    if (outcome === 'paint-failure')
      f.ctx.painter.paint = () => {
        throw new Error('Paint unavailable');
      };
    if (outcome === 'adoption-failure') {
      let first = true;
      f.ctx.render = () => {
        if (first) {
          first = false;
          throw new Error('UI unavailable');
        }
      };
    }
    if (outcome === 'failure') f.gate.reject(new Error('Picture unavailable'));
    else f.gate.resolve();
    await pending;
    assert.equal(f.ctx.run, oldRun);
    assert.equal(f.ctx.acceptedPicture, oldPicture);
    assert.equal(f.ctx.pack, oldPicture.sourcePack);
    assert.equal(f.ctx.nextOperation, null);
    assert(!f.calls.includes('old-release'));
    assert(!f.calls.includes('started'));
    assert.match(
      f.$('coop-next-status').textContent,
      outcome === 'cancel' ? /cancelled/ : /Try Next again/,
    );
  });
