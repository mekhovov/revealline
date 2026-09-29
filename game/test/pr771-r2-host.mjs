import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compileFunction } from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { t, localizedMessage, localizedText, render } from '../i18n/index.mjs';
import { boundedJSON, canonicalJSON } from '../data-json.mjs';
import { createRun } from '../core/index.mjs';
import {
  createRecorder,
  authoritativeCheckpoint,
  MAX_REPLAY_BYTES,
  MAX_REPLAY_TICKS,
} from '../replay.mjs';
import { createInstalledMissionLibrary } from '../mission-library/installed-library.mjs';
import {
  CLASSIC_RULES_ORIGINAL,
  classicRulesCampaignIdentity,
} from '../mission-library/classic-current-rules.mjs';
import { verifyIndexedInstalledPack } from '../mission-library/pack-identity.mjs';
import {
  preparePack,
  prepareOfficialPack,
  emptyPackLibrary,
  installPack,
  resolvePackCampaign,
  importPackLibrary,
  exportPackLibrary,
  packLibrarySnapshot,
  isOfficialPack,
} from '../packs.mjs';
import { createExecutionCatalog } from '../campaign-contexts.mjs';
import { createMasteryCatalog } from '../mastery-catalog.mjs';
import { createPackLaunchGuard, createPackCommitCoordinator } from '../content-launch.mjs';
import { readAssetStore, writeAssetStore } from '../storage.mjs';
import { createExternalChapterHost } from '../external-chapter-host.mjs';
import { claimProfileWriter } from '../profile-writer.mjs';
import {
  loadOptionalCatalog,
  prepareOptionalDownload,
  verifyOptionalInstalled,
  OPTIONAL_CATALOG_FORMAT,
} from '../optional-chapters.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const functions = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id) functions.set(node.id.name, node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
}
visit(parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true }));
export const corrected = functions.has('issueSkipPreparation');
assert(corrected, 'The integrated source must contain the owned Skip correction.');
export const hash = (value) => createHash('sha256').update(value).digest('hex');
export function bind(ctx, names) {
  const pins = names
    .filter((name) => functions.has(name))
    .map((name) => {
      const node = functions.get(name),
        body = source.slice(node.start, node.end);
      return {
        name,
        body,
        start: node.loc.start.line,
        end: node.loc.end.line,
        bytes: Buffer.byteLength(body),
        sha256: hash(body),
      };
    });
  console.log('# R2_FUNCTIONS ' + JSON.stringify(pins.map(({ body, ...row }) => row)));
  // Same realm as the actual validators. Only host globals/I/O are supplied;
  // the extracted function bodies, coordinator and validators are unchanged.
  Object.assign(
    ctx,
    compileFunction(
      pins.map((p) => p.body).join('\n') + '\nreturn {' + pins.map((p) => p.name).join(',') + '};',
      [],
      { contextExtensions: [ctx] },
    )(),
  );
}
export function closeRestart(ctx) {
  let callback;
  function find(node) {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'CallExpression' &&
      node.callee?.object?.name === 'restartDialog' &&
      node.callee.property?.name === 'addEventListener' &&
      node.arguments[0]?.value === 'close'
    )
      callback = node.arguments[1];
    for (const v of Object.values(node))
      if (Array.isArray(v)) v.forEach(find);
      else if (v && typeof v === 'object') find(v);
  }
  find(parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
  assert(callback);
  ctx.restartDialog.open = false;
  compileFunction('return (' + source.slice(callback.start, callback.end) + ');', [], {
    contextExtensions: [ctx],
  })()();
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
export async function until(predicate) {
  for (let i = 0; i < 300 && !predicate(); i++)
    await new Promise((resolve) => setImmediate(resolve));
  assert(predicate(), 'controlled boundary entered');
}
class Locks {
  held = new Set();
  async request(key, options, action) {
    if (typeof options === 'function') {
      action = options;
      options = {};
    }
    if (this.held.has(key)) return action(null);
    this.held.add(key);
    try {
      return await action({ name: key });
    } finally {
      this.held.delete(key);
    }
  }
}
const db = managedIndexedDB();
globalThis.indexedDB = db.indexedDB;
let sequence = 0;
const json = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
const packText = await readFile(
  new URL('../content/packs/night-shift.json', import.meta.url),
  'utf8',
);
const packSource = JSON.parse(packText);
const sourceIndex = await json('../content/mission-library-index.json');
export async function fixture({
  host = false,
  optional = false,
  ready = false,
  official = false,
  external = false,
} = {}) {
  const values = new Map(),
    elements = new Map(),
    statuses = [];
  const document = {
    hidden: false,
    hasFocus: () => true,
    body: {},
    documentElement: {},
    addEventListener() {},
    removeEventListener() {},
  };
  const $ = (id) => {
    if (!elements.has(id))
      elements.set(id, {
        id,
        disabled: false,
        hidden: false,
        open: false,
        textContent: '',
        dataset: {},
        attributes: new Map(),
        setAttribute(name, value) {
          this.attributes.set(name, value);
        },
        getAttribute(name) {
          return this.attributes.get(name) ?? null;
        },
        removeAttribute(name) {
          this.attributes.delete(name);
        },
        focus() {
          document.activeElement = this;
        },
        replaceChildren() {},
      });
    return elements.get(id);
  };
  const classRecipes = await json('../content/classes.json'),
    campaign = await json('../content/campaign.json');
  campaign.classRecipes = classRecipes;
  const themes = (await json('../content/themes.json')).themes,
    baseEntry = {
      campaign,
      classRecipes,
      themes,
      visualOverrides: {},
      levelVisuals: [],
      music: [],
      sourcePackId: null,
    };
  const options = { seed: 7, turnPolicy: 'immediate', classId: classRecipes[0].id, classRecipes };
  const run = createRun(campaign.levels[0], options),
    recorder = createRecorder(campaign.levels[0], options, 'r2-fixture');
  const locks = new Locks(),
    libraryKey = 'revealline.library.release-v0.0.' + ++sequence + '.v1',
    packsKey = libraryKey.replace('revealline.library.', 'revealline.packs.');
  const writer = await claimProfileWriter(locks, libraryKey + '.writer');
  const f = {
    ctx: null,
    $,
    document,
    statuses,
    prepares: 0,
    launches: 0,
    transfers: 0,
    adoptions: 0,
    writes: 0,
    attemptInvalidations: 0,
    db,
    values,
    host,
    hook: null,
    transferHook: null,
    onInvalidate: null,
  };
  const ctx = {
    t,
    localizedMessage,
    localizedText,
    $,
    document,
    window: { addEventListener() {}, removeEventListener() {} },
    AbortController,
    DOMException,
    URL,
    location: { href: 'https://fixture.invalid/game/' },
    run,
    recorder,
    runId: 'existing-flight',
    baseEntry,
    activeEntry: baseEntry,
    campaign,
    levelIndex: 0,
    theme: themes[0],
    classId: options.classId,
    seed: options.seed,
    turnPolicy: options.turnPolicy,
    bodyId: 'scout',
    themeOverride: false,
    musicOverride: false,
    recordingStopped: false,
    library: { preferences: { campaignDifficulty: 'standard' }, campaigns: {}, achievements: [] },
    journeyPreferences: null,
    actorPreferences: { snapshot: () => ({ revision: 0 }) },
    flightPictures: { pins: () => null },
    flightVisualLease: null,
    flightActorLease: null,
    pictureThemePending: false,
    libraryGeneration: 1,
    packs: emptyPackLibrary(),
    chapterSnapshot: null,
    installedEntries: [baseEntry],
    executionCatalog: null,
    masteryCatalog: null,
    started: true,
    paused: true,
    practice: false,
    practiceSession: false,
    scenario: null,
    courseSession: null,
    courseEntry: null,
    campaignOverview: false,
    journeyEnabled: false,
    journeySkipArmed: null,
    journeySkipDestination: null,
    libraryNextOperation: null,
    librarySkipResolution: null,
    librarySkipResolutionRevision: 0,
    preparationButtonOwners: new WeakMap(),
    resultAttempt: null,
    skipPreparations: new WeakMap(),
    activeSkipPreparation: null,
    skipLifecycleEpoch: 0,
    skipAttemptPreparer: null,
    resultAttemptEpoch: 0,
    worldPlayEpoch: 0,
    unifiedOpenRevision: 0,
    unifiedLaunchRevision: 0,
    unifiedDisposed: false,
    modeDeparture: null,
    missionReplacement: null,
    restartRequest: null,
    titleFlight: null,
    backupBusy: false,
    sessionBusy: false,
    contentSwitchBusy: false,
    writer,
    persistenceReady: true,
    libraryKey,
    packsKey,
    sessionKey: libraryKey + '.flight',
    localStorage: { getItem: (key) => values.get(key) ?? null },
    externalChapters: null,
    runtimeContent: null,
    attemptFiles: null,
    boundedJSON,
    canonicalJSON,
    authoritativeCheckpoint,
    MAX_REPLAY_BYTES,
    MAX_REPLAY_TICKS,
    classicRulesCampaignIdentity,
    CLASSIC_RULES_ORIGINAL,
    verifyIndexedInstalledPack,
    preparePack,
    emptyPackLibrary,
    installPack,
    resolvePackCampaign,
    importPackLibrary,
    exportPackLibrary,
    packLibrarySnapshot,
    isOfficialPack,
    createExecutionCatalog,
    createMasteryCatalog,
    packLaunchGuard: createPackLaunchGuard(),
    pause() {
      ctx.paused = true;
    },
    clearInput() {},
    warning() {},
    show(id, shown) {
      $(id).hidden = !shown;
    },
    dialogOpen: () => false,
    cancelRestore() {},
    masteryAwards: { cancelAll() {} },
    refreshContentSelectors() {
      ctx.refreshJourneySkip();
    },
    refreshCampaigns() {
      ctx.refreshJourneySkip();
    },
    contentStatus() {},
    preparationStatus(_cb) {},
    journeyProfile: null,
    unifiedChooser: {
      select() {
        f.adoptions++;
      },
    },
    beginPreparation(message, cancel) {
      const row = { message: render(message), cancel, finished: false };
      statuses.push(row);
      return {
        update() {},
        finish(message = '', state = 'ready') {
          row.finished = true;
          row.message = render(message);
          row.state = state;
          f.finishHook?.(state);
        },
      };
    },
    gameplayDownloads: { async ensureClassic() {} },
    packCatalog: { packs: [{ id: packSource.id, name: packSource.name }] },
    async fetchBundledChapter() {
      f.prepares++;
      await f.prepareHook?.();
      return JSON.parse(packText);
    },
    localOfficialChapter: async () =>
      official
        ? (
            await prepareOfficialPack(
              {
                id: packSource.id,
                version: packSource.version,
                bytes: Buffer.byteLength(packText),
                sha256: hash(packText),
              },
              { readOfficial: async () => new Blob([packText]) },
            )
          ).pack
        : null,
    readAssetStore,
    writeAssetStore: (key, value, opts = {}) =>
      writeAssetStore(key, value, {
        ...opts,
        beforeWrite: opts.beforeWrite
          ? (stored) => {
              f.hook?.();
              opts.beforeWrite(stored);
            }
          : undefined,
      }),
  };
  f.ctx = ctx;
  bind(ctx, [
    'prepareContentCatalog',
    'preparationButtonBusy',
    'skipMissionMessage',
    'adoptContentCatalog',
    'inspectChapters',
    'checkedChapters',
    'contentFromChapters',
    'writeCheckedPacks',
    'assertWriter',
    'normalSoloSkipAvailable',
    'skipSnapshot',
    'skipSnapshotCurrent',
    'clearSkipConfirmation',
    'refreshJourneySkip',
    'armSkip',
    'launchLibrarySkip',
    'libraryActivationContext',
    'advanceSkipLifecycle',
    'observeSkipFlight',
    'skipMountedIdentity',
    'issueSkipPreparation',
    'retireSkipPreparation',
    'skipContentCurrent',
    'assertSkipPreparation',
    'bindSkipPreparation',
    'bindSkipWriter',
    'reviewSkipProposal',
    'assertSkipProposal',
    'invalidateSkipAttempt',
    'skipAttemptFacade',
    'replacePackLibrary',
    'ensureBundledPack',
    'installOptionalChapter',
    'prepareLibraryClassic',
    'requestRestart',
    'restartAvailable',
    'unfinishedFlight',
    'courseBlocked',
    'openUnifiedMissions',
  ]);
  const rawAttempt = {
    source: () => null,
    prepare: async () => null,
    invalidate() {
      f.attemptInvalidations++;
      f.onInvalidate?.();
    },
  };
  ctx.attemptFiles = corrected ? ctx.skipAttemptFacade(rawAttempt) : rawAttempt;
  ctx.invalidateContentSwitch = () => {
    ctx.attemptFiles.invalidate();
    ctx.packLaunchGuard.invalidate();
    ctx.contentSwitchBusy = false;
  };
  if (host) {
    const actual = createExternalChapterHost({
      indexedDB: db.indexedDB,
      profileKey: libraryKey,
      packsKey,
      storage: ctx.localStorage,
      writer,
      lockManager: locks,
      registeredEntries: [baseEntry],
      knownDescriptors: [],
      getManagedStore: async () => {
        throw Error('No media store should be used.');
      },
    });
    ctx.externalChapters = {
      ...actual,
      commitMutation(review, opts = {}) {
        return actual.commitMutation(review, {
          ...opts,
          beforeWrite: opts.beforeWrite
            ? () => {
                f.hook?.();
                opts.beforeWrite();
              }
            : undefined,
        });
      },
    };
    f.close = () => {
      actual.close();
      writer.release();
    };
  } else f.close = () => writer.release();
  ctx.packCommits = createPackCommitCoordinator({
    read: () => ctx.checkedChapters(),
    write: (value) => ctx.writeCheckedPacks(value),
    prepare: ctx.contentFromChapters,
    adopt: ctx.adoptContentCatalog,
    canAdopt: () => false,
    onReconciled() {},
  });
  const selected = sourceIndex.missions.find((row) => row.packId === 'night-shift');
  const index = {
    format: sourceIndex.format,
    missions: [
      sourceIndex.missions.find((row) => row.source === 'base'),
      {
        ...selected,
        ...(external ? { source: 'external' } : optional ? { source: 'optional' } : {}),
      },
    ],
  };
  const prepared = (await preparePack(JSON.parse(packText), { library: ctx.packs })).pack;
  if (optional) {
    const normalized = JSON.stringify(prepared);
    const summary = {
      id: prepared.id,
      version: prepared.version,
      name: prepared.name,
      description: prepared.description,
      themeId: prepared.themes[0].id,
      levels: prepared.campaigns[0].levels.length,
      path: 'authoring/library/four-worlds-chapters/packs/night-shift.json',
      bytes: Buffer.byteLength(packText),
      normalizedBytes: Buffer.byteLength(normalized),
      sha256: hash(packText),
      normalizedSha256: hash(normalized),
      campaignKey: selected.campaignKey,
    };
    const fetch = async (url) =>
      new Response(
        String(url).endsWith('optional-worlds.json')
          ? JSON.stringify({ format: OPTIONAL_CATALOG_FORMAT, packs: [summary] })
          : packText,
      );
    ctx.loadOptionalCatalog = (options) => loadOptionalCatalog({ ...options, fetch });
    ctx.prepareOptionalDownload = async (item, options) => {
      f.prepares++;
      await f.prepareHook?.();
      return prepareOptionalDownload(item, { ...options, fetch });
    };
    ctx.verifyOptionalInstalled = verifyOptionalInstalled;
  }
  if (ready) {
    ctx.packs = installPack(ctx.packs, prepared);
    await writeAssetStore(packsKey, exportPackLibrary(ctx.packs));
  }
  const hostLibrary = await createInstalledMissionLibrary({
    index,
    baseEntry,
    getPacks: () => ctx.packs,
    compatibility: () => ['solo'],
    describe: () => ({ rules: 'Authored' }),
    prepareClassic: (row, context) => {
      f.token = context.preparation;
      return f.bindHook ? f.bindHook(row, context) : ctx.prepareLibraryClassic(row, context);
    },
    availabilityExternal: () => ({ state: 'download', bytes: Buffer.byteLength(packText) }),
    launchClassic: async (_row, activation) => {
      f.launches++;
      assert(activation.isCurrent());
      f.activationHook?.(activation);
      f.transferHook?.();
      assert(activation.transferContinuation());
      f.transfers++;
      if (f.adoptCallbacks) {
        activation.onSkipAdopt();
        activation.onSkipAdopt();
      }
      if (f.duplicateTransfer) assert.equal(activation.transferContinuation(), false);
      return true;
    },
    launchCustom: () => {
      throw Error('Custom launch must not gain Skip authority.');
    },
  });
  ctx.unifiedLibrary = hostLibrary;
  const rows = hostLibrary.library.forMode('solo');
  const current = rows.find((row) => row.ownerId === JSON.stringify(['classic', 'base', null]));
  const next = rows.find(
    (row) =>
      row.ownerId ===
      JSON.stringify([
        'classic',
        external ? 'external' : optional ? 'optional' : 'bundled',
        'night-shift',
      ]),
  );
  assert(current);
  assert(next);
  f.destination = {
    type: 'library',
    host: hostLibrary,
    current,
    next,
    name: next.name,
    snapshot: ctx.skipSnapshot(),
    skipped: null,
  };
  f.before = ctx.packs;
  f.checkpoint = canonicalJSON(authoritativeCheckpoint(run));
  f.progress = canonicalJSON(ctx.library);
  f.start = () => {
    ctx.armSkip(f.destination);
    return ctx.launchLibrarySkip(f.destination);
  };
  f.stored = () => readAssetStore(packsKey);
  f.packSource = packSource;
  f.packText = packText;
  f.prepared = prepared;
  return f;
}
export {
  preparePack,
  prepareOfficialPack,
  emptyPackLibrary,
  installPack,
  exportPackLibrary,
  writeAssetStore,
  readAssetStore,
  db,
};
