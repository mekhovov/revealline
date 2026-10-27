import { assertSharedOwnerDeclaredTool } from './solo-shared-owner-declared-source.mjs';
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Script, createContext } from 'node:vm';
import { parse } from 'acorn';
import { Document, Events } from '../game/test/helpers/couch-dom.mjs';
import { qualificationSharedModeOptions } from './solo-qualification-shared-mode.mjs';
import {
  auxiliaryMatrix,
  bindAuxiliaryJob,
  auxiliaryArguments,
  prepareAuxiliaryMode,
} from './solo-remote-auxiliary.mjs';
const read = (path) => readFile(new URL('../' + path, import.meta.url));
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const planPath = 'docs/performance/solo-shared-mode-public-return-797e03-boot-plan.json';
const priorPath = 'docs/performance/solo-shared-mode-public-return-797e03-tooling-plan.json';
const manifest = JSON.parse(await read(planPath)),
  prior = JSON.parse(await read(priorPath));
const bytes = await read(manifest.recipes.recovery.path),
  scenario = JSON.parse(bytes);
const oldBytes = await read(prior.recipes.recovery.path),
  original = JSON.parse(oldBytes);
const source = (await read('game/boot.mjs')).toString();
const bootTest = (await read('game/test/boot.test.mjs')).toString();
const bootAST = parse(bootTest, { ecmaVersion: 'latest', sourceType: 'module' });
const boundaryNode = bootAST.body.find(
  (n) => n.type === 'FunctionDeclaration' && n.id.name === 'boundary',
);
assert(boundaryNode);
// Execute the existing boot host boundary and the complete actual production boot.
// Finite DOM/wait boundaries below do not claim native layout or timing.
const boundary = new Function(
  'Document',
  'Events',
  'Script',
  'createContext',
  'source',
  'return (' + bootTest.slice(boundaryNode.start, boundaryNode.end) + ');',
)(Document, Events, Script, createContext, source);
const qualifier = (await read('scripts/qualify-solo-runtime.mjs')).toString();
const qualifierAST = parse(qualifier, { ecmaVersion: 'latest', sourceType: 'module' });
const walk = (node, predicate) => {
  if (!node || typeof node !== 'object') return null;
  if (predicate(node)) return node;
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const child of value) {
        const found = walk(child, predicate);
        if (found) return found;
      }
    } else {
      const found = walk(value, predicate);
      if (found) return found;
    }
  }
  return null;
};
const readyNode = walk(
  qualifierAST,
  (n) =>
    n.type === 'IfStatement' &&
    n.test.type === 'MemberExpression' &&
    n.test.object.name === 'scenario' &&
    n.test.property.name === 'readySelector',
);
assert(readyNode);
const ready = new (Object.getPrototypeOf(async function () {}).constructor)(
  'page',
  'scenario',
  'waitQualificationControl',
  qualifier.slice(readyNode.consequent.start, readyNode.consequent.end),
);
function boot() {
  const b = boundary();
  const home = b.make('dialog', 'shell-home', b.game);
  home.setAttribute('open', '');
  home.open = true;
  b.run();
  return { ...b, home };
}
async function actualReady(b, recipe, beforeHidden = null) {
  const calls = [];
  // The shared DOM boundary handles simple IDs; model the browser's compound
  // ID/open lookup here without changing the actual qualifier selector.
  const query = (selector) => {
    const compound = selector.match(/^#([a-z0-9-]+)\[open\]$/i);
    if (!compound) return b.document.querySelector(selector);
    const element = b.document.getElementById(compound[1]);
    return element?.open ? element : null;
  };
  const visible = (element) =>
    element && !element.closest('[hidden]') && element.getClientRects().length > 0;
  const page = {
    locator(selector) {
      return {
        async waitFor(options) {
          calls.push(['visible', selector, options]);
          assert.equal(options.state, 'visible');
          assert.equal(options.timeout, 120000);
          assert(visible(query(selector)), 'Exact ready selector remains unavailable');
        },
      };
    },
    async waitForFunction(callback, selector, options) {
      calls.push(['hidden', selector, options]);
      assert.equal(options.timeout, 120000);
      beforeHidden?.();
      assert.equal(
        new Function('document', 'selector', 'return (' + callback.toString() + ')(selector);')(
          b.document,
          selector,
        ),
        true,
        'Actual qualifier hidden predicate is false',
      );
    },
  };
  await ready(page, recipe, async (_page, selector, timeout) => {
    calls.push(['control', selector, timeout]);
    assert.equal(timeout, 120000);
    assert(visible(query(selector)));
    assert(!query(selector).closest('[inert]'));
  });
  return calls;
}
test('actual production ready admits the new fixture and reproduces the old child-hidden failure', async () => {
  const b = boot();
  await assert.rejects(actualReady(b, scenario));
  assert.equal(b.context.RevealLineBoot.ready(), true);
  assert.equal(b.document.documentElement.dataset.bootState, 'ready');
  assert.equal(b.screen.hidden, true);
  assert.equal(b.document.getElementById('boot-status').hidden, false);
  assert.equal(b.game.inert, false);
  await assert.rejects(actualReady(b, original), /hidden predicate/);
  assert.deepEqual(await actualReady(b, scenario), [
    ['visible', scenario.readySelector, { state: 'visible', timeout: 120000 }],
    ['hidden', scenario.readyHiddenSelector, { timeout: 120000 }],
    ['control', scenario.readySelector, 120000],
  ]);
});
test('existing Home wait remains sequential with production boot completion', async () => {
  const b = boot();
  assert.equal(b.document.documentElement.dataset.bootState, 'loading');
  assert.equal(b.home.open, true);
  const calls = await actualReady(b, scenario, () => {
    assert.equal(b.document.documentElement.dataset.bootState, 'loading');
    assert.equal(b.context.RevealLineBoot.ready(), true);
  });
  assert.equal(calls[0][1], '#shell-home[open]');
  assert.equal(calls[1][1], "html[data-boot-state='ready'] #boot-screen");
  assert.equal(calls[2][0], 'control');
});
test('loading, failed, hidden Home, missing Home and forged child state cannot satisfy the new wait', async () => {
  for (const alter of [
    (b) => {
      b.document.getElementById('boot-status').hidden = true;
    },
    (b) => {
      b.context.RevealLineBoot.fail(Error('retained boot failure'));
    },
    (b) => {
      b.context.RevealLineBoot.ready();
      b.home.hidden = true;
    },
    (b) => {
      b.context.RevealLineBoot.ready();
      b.home.remove();
    },
    (b) => {
      b.context.RevealLineBoot.ready();
      b.home.removeAttribute('open');
      b.home.open = false;
    },
    (b) => {
      b.context.RevealLineBoot.ready();
      b.screen.hidden = false;
    },
  ]) {
    const b = boot();
    alter(b);
    await assert.rejects(actualReady(b, scenario));
  }
});
test('the named fixture changes only production boot readiness, never public actions or deadlines', () => {
  assert.equal(bytes.length, 2720);
  assert.equal(sha(bytes), 'fd53760e86158e8da498eea0201c1b19fa1d34b0aed524bc34e1b6a0e7c91f67');
  const restore = structuredClone(scenario);
  for (const key of ['id', 'readySelector', 'readyHiddenSelector']) restore[key] = original[key];
  assert.deepEqual(restore, original);
  assert.equal(scenario.timeoutMs, 180000);
  assert.equal(scenario.actions[0].timeoutMs, 120000);
  assert.equal(scenario.actions[1].selector, '#shell-featured');
  assert.equal(scenario.actions.at(-1).type, 'exportReplay');
  assert.equal(scenario.replayRequirements.movingTicks, 120);
});
test('exact adapter arguments select only the new797 fixture and preserve old source admission', () => {
  for (const job of manifest.release.selectedJobs) {
    const plan = bindAuxiliaryJob(manifest, job),
      row = plan.rows[0];
    const args = auxiliaryArguments(
      { plan, here: '/tools/scripts', modeState: { recipePath: '/input/scenario.json' } },
      row,
      'http://127.0.0.1:1/game/',
      '/evidence',
    ).slice(4);
    assert.equal(
      qualificationSharedModeOptions(args, scenario, bytes).sourceRevision,
      manifest.candidate.revision,
    );
    assert(!args.includes('--work-probe'));
    assert(!args.some((a) => a.startsWith('--cadence=')));
    for (const revision of [
      'de3324607c82787c1a1fec9c13d4f8b5cb74cee4',
      '73a345cec696d7789198cf295ca5c37b17ca0e71',
    ]) {
      const changed = args.map((a) => a.replace(manifest.candidate.revision, revision));
      assert.throws(() => qualificationSharedModeOptions(changed, scenario, bytes));
      assert.equal(
        qualificationSharedModeOptions(changed, original, oldBytes).sourceRevision,
        revision,
      );
    }
    const corrupt = Buffer.from(bytes);
    corrupt[0] = 0;
    assert.throws(() => qualificationSharedModeOptions(args, scenario, corrupt));
    assert.throws(() =>
      qualificationSharedModeOptions(
        args,
        { ...scenario, readyHiddenSelector: '#boot-status' },
        bytes,
      ),
    );
  }
});
test('actual successor keeps scoped first-eight proof, exact package and original native bounds', () => {
  assert.deepEqual(auxiliaryMatrix(manifest), auxiliaryMatrix(prior));
  assert.deepEqual(manifest.candidate, prior.candidate);
  assert.deepEqual(manifest.release.firstEightEvidence, prior.release.firstEightEvidence);
  assert.equal(manifest.toolingSuccessor.priorRun, 39126307952);
  assert.equal(manifest.toolingSuccessor.priorObservation, 'failed-before-actions');
  assert.equal(manifest.toolingSuccessor.currentObservation, 'unobserved');
  assert.equal(
    manifest.toolingSuccessor.priorAudit.gitDataBlob,
    '69ea7bae583e3488cab9847b1aeeaba27ef9630c',
  );
  for (const job of manifest.release.selectedJobs) {
    const p = bindAuxiliaryJob(manifest, job);
    assert.equal(p.rows[0].timeoutMs, 420000);
    assert.equal(p.helperTimeoutMs, 3600000);
    assert.equal(p.setupTimeoutMs, 2400000);
    assert.equal(p.rowEvidenceBytes, 32 * 1024 ** 2);
    assert.equal(p.performanceExclusion, true);
  }
  for (const mutate of [
    (p) => (p.release.bootReadiness = 'unknown'),
    (p) => delete p.release.bootReadiness,
    (p) => (p.recipes.recovery = structuredClone(prior.recipes.recovery)),
    (p) => (p.release.firstEightEvidence = null),
    (p) => (p.release.firstEightEvidence.ownersClosed = false),
    (p) => (p.runtimeRevision = '0'.repeat(40)),
    (p) => (p.candidate.tree = '0'.repeat(40)),
    (p) => (p.cpu = 2),
    (p) => p.fixturePreparationTimeoutMs++,
  ]) {
    const p = structuredClone(manifest);
    mutate(p);
    assert.throws(() => auxiliaryMatrix(p));
  }
});
test('executed boot declaration retains exact helper history and original stale pins still reject before native effects', async () => {
  for (const ref of [
    ...manifest.adapterInputs,
    ...manifest.frozenTools,
    manifest.recipes.recovery,
  ]) {
    if (await assertSharedOwnerDeclaredTool(planPath, ref)) continue;
    const b = await read(ref.path);
    assert.equal(b.length, ref.bytes, ref.path);
    assert.equal(sha(b), ref.sha256, ref.path);
  }
  let effects = 0;
  await assert.rejects(
    () =>
      prepareAuxiliaryMode({
        plan: bindAuxiliaryJob(prior, 'recovery-chromium'),
        repository: new URL('../', import.meta.url).pathname.replace(/\/$/, ''),
        digest: async (path) => {
          const b = await readFile(path);
          return { bytes: b.length, sha256: sha(b) };
        },
        get admitted() {
          effects++;
          throw Error('must not read');
        },
        required: async () => effects++,
      }),
    { name: 'AssertionError' },
  );
  assert.equal(effects, 0);
});
