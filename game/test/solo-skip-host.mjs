import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { createHash } from 'node:crypto';
import { parse } from 'acorn';
import { t, localizedMessage, localizedText } from '../i18n/index.mjs';
import { createMissionLibrary } from '../mission-library/library.mjs';
import { librarySuccessor } from '../mission-library/continuous-next.mjs';

const source = await readFile(new URL('../app.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
const functions = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'FunctionDeclaration' && node.id) functions.set(node.id.name, node);
  for (const value of Object.values(node))
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
}
visit(ast);
const sha = (s) => createHash('sha256').update(s).digest('hex');
export function bind(ctx, names) {
  const pins = names.map((name) => {
    const node = functions.get(name);
    assert(node, name);
    const body = source.slice(node.start, node.end);
    return {
      name,
      start: node.loc.start.line,
      end: node.loc.end.line,
      bytes: Buffer.byteLength(body),
      sha256: sha(body),
      body,
    };
  });
  console.log('# PR771_EXTRACTED_FUNCTIONS ' + JSON.stringify(pins.map(({ body, ...p }) => p)));
  runInNewContext(pins.map((p) => p.body).join('\n'), ctx, { timeout: 5000 });
  return ctx;
}
export function deferred() {
  let resolve, reject;
  const promise = new Promise((a, b) => {
    resolve = a;
    reject = b;
  });
  return { promise, resolve, reject };
}
export async function turnsUntil(predicate) {
  for (let i = 0; i < 100 && !predicate(); i++) await Promise.resolve();
  assert(predicate(), 'Controlled async boundary must be entered within 100 microtasks');
}
export function owner(
  id,
  entries,
  { availability = () => ({ state: 'ready' }), prepare, launch = () => true } = {},
) {
  return {
    id,
    collection: 'Classic',
    editionId: 'fixture-edition',
    edition: 'Fixture edition',
    entries,
    describe: (row) => ({
      id: row.id,
      name: row.name ?? row.id,
      campaignKey: row.id,
      campaignTitle: row.id,
      levelIndex: 0,
      modes: ['solo'],
      tags: [],
      rules: 'Authored',
    }),
    availability,
    prepare,
    launch,
  };
}
export function context() {
  const elements = new Map(),
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
        textContent: '',
        isConnected: true,
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
          if (!this.disabled) document.activeElement = this;
        },
      });
    return elements.get(id);
  };
  const ctx = {
    t,
    localizedMessage,
    localizedText,
    $,
    document,
    window: { addEventListener() {}, removeEventListener() {} },
    AbortController,
    run: { status: 'running', levelId: 'current', tick: 9 },
    recorder: { fixture: 'retained' },
    runId: 'existing-flight',
    activeEntry: {},
    campaign: { levels: [{ id: 'current' }] },
    levelIndex: 0,
    theme: { id: 'theme' },
    classId: 'scout',
    seed: 7,
    turnPolicy: 'immediate',
    library: { preferences: { campaignDifficulty: 'standard' } },
    journeyPreferences: null,
    actorPreferences: { snapshot: () => ({ revision: 0 }) },
    libraryGeneration: 1,
    packs: { packs: [] },
    started: true,
    paused: true,
    practice: false,
    scenario: null,
    courseSession: null,
    campaignOverview: false,
    journeyEnabled: false,
    journeySkipArmed: null,
    journeySkipDestination: null,
    librarySkipResolution: null,
    librarySkipResolutionRevision: 0,
    libraryNextOperation: null,
    resultAttempt: null,
    preparationButtonOwners: new WeakMap(),
    pause() {
      ctx.paused = true;
    },
    clearInput() {},
    warning() {},
    show(id, shown) {
      $(id).hidden = !shown;
    },
    dialogOpen: () => false,
    journeySkipMission: () => null,
    librarySuccessor,
    beginPreparation(message, cancel) {
      const row = { message, cancel, finished: false, state: 'busy' };
      statuses.push(row);
      return {
        update() {},
        finish(message = '', state = 'ready') {
          row.finished = true;
          row.message = message;
          row.state = state;
        },
      };
    },
    libraryActivationContext: () => ({ isCurrent: () => true }),
    unifiedChooser: { select() {} },
    journeyProfile: null,
  };
  bind(ctx, [
    'preparationButtonBusy',
    'skipMissionMessage',
    'skipContentCurrent',
    'normalSoloSkipAvailable',
    'clearSkipConfirmation',
    'skipSnapshot',
    'skipSnapshotCurrent',
    'refreshJourneySkip',
    'armSkip',
    'cancelSkipResolution',
    'resolveLibrarySkip',
  ]);
  return { ctx, $, document, statuses };
}
export { createMissionLibrary };
