import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompanyWorkspaceFiles,
  compileCompanyWorkspace,
  companyStudioReport,
} from '../../scripts/company-studio.mjs';
import { compileEdition } from '../../scripts/compile-edition.mjs';
import { verifyStudioPreview } from '../../authoring/company-studio/preview.mjs';
import { validateStudioReport, declaredJSONPaths } from '../../authoring/company-studio/model.mjs';
import { loadRuntimeContentProvider } from '../runtime-content-provider.mjs';
import { createCandidateSoloHost } from '../content-design/solo-host.mjs';
import { projectEditionGuideScenario } from '../editions/selected-presentation.mjs';
import { createLessonScenario } from '../first-flight.mjs';
import { readFile } from 'node:fs/promises';

const previewPath = '/preview/game/company.html';
const baseURL = 'http://localhost/authoring/company-studio/';
const jsonFiles = (catalog, files) =>
  new Map(declaredJSONPaths(catalog).map((path) => [path, JSON.parse(files.get(path))]));
function fetchFiles(files, requests = []) {
  return async (url, options) => {
    requests.push({ url, options });
    const path = new URL(url).pathname.replace(/^\/preview\//, '');
    return files.has(path)
      ? new Response(files.get(path))
      : new Response('Missing', { status: 404 });
  };
}
async function neutral() {
  const source = createCompanyWorkspaceFiles({ brandId: 'acme', name: 'Acme' });
  source.files.set(
    'game/company.html',
    Buffer.from('<!doctype html><html><head><title>Company</title></head><body></body></html>'),
  );
  source.files.set(
    'game/index.html',
    Buffer.from('<!doctype html><html><head><title>Solo</title></head><body></body></html>'),
  );
  source.files.set('game/preview-test.mjs', Buffer.from('export const version = 1;'));
  const result = await compileEdition({
    catalog: source.catalog,
    editionIds: ['acme-public'],
    files: source.files,
    enginePaths: ['game/company.html', 'game/index.html', 'game/preview-test.mjs'],
    // Small byte-integrity fixture; the real compiler graph is covered below.
    validateCode: false,
  });
  const report = companyStudioReport(source.catalog, result, { previewURL: previewPath });
  const input = {
    catalog: source.catalog,
    editionId: 'acme-public',
    files: jsonFiles(source.catalog, source.files),
    report,
    baseURL,
    fetcher: fetchFiles(result.files),
  };
  return { source, result, report, input };
}

test('whole-game preview verifies the report, every artifact byte and exact selected draft', async () => {
  const f = await neutral(),
    requests = [];
  const verified = await verifyStudioPreview({
    ...f.input,
    fetcher: fetchFiles(f.result.files, requests),
  });
  assert.equal(verified.url.href, 'http://localhost/preview/game/company.html');
  assert.equal(verified.verifiedFiles, f.result.files.size);
  assert.equal(requests.length, f.result.files.size);
  assert(
    requests.every(
      (request) => request.options.cache === 'no-store' && request.options.redirect === 'error',
    ),
  );
  assert.equal(
    f.report.checks.find((check) => check.id === 'playability').status,
    'review-required',
  );
});

test('changed executable bytes, report totals/exclusions and invented approval cannot pass preview verification', async () => {
  const f = await neutral();
  const tampered = new Map(f.result.files);
  tampered.set('game/preview-test.mjs', Buffer.from('export const version = 2;'));
  await assert.rejects(
    verifyStudioPreview({ ...f.input, fetcher: fetchFiles(tampered) }),
    /Artifact hash differs/,
  );
  const changedManifest = new Map(f.result.files);
  changedManifest.set('edition-build.json', Buffer.from('{}'));
  await assert.rejects(
    verifyStudioPreview({ ...f.input, fetcher: fetchFiles(changedManifest) }),
    /Artifact byte count differs/,
  );
  for (const change of [
    (report) => {
      report.summary.missions++;
    },
    (report) => {
      report.excluded.brandIds.push('hidden-company');
    },
    (report) => {
      report.admittedPaths = report.admittedPaths.slice(1);
    },
  ]) {
    const report = structuredClone(f.report);
    change(report);
    await assert.rejects(verifyStudioPreview({ ...f.input, report }), /differs|differ/);
  }
  const approved = structuredClone(f.report);
  approved.checks.find((check) => check.id === 'playability').status = 'passed';
  assert.throws(() => validateStudioReport(approved), /cannot approve human review/);
  assert.throws(() => validateStudioReport({ ...f.report, checks: [] }), /checks are missing/);
  assert.throws(
    () => validateStudioReport({ ...f.report, format: 'revealline-company-studio-report.v1' }),
    /current v2/,
  );
});

test('preview verification stops before activation on cancellation and oversized streamed bytes', async () => {
  const f = await neutral(),
    controller = new AbortController();
  controller.abort();
  await assert.rejects(
    verifyStudioPreview({ ...f.input, signal: controller.signal }),
    (error) => error.name === 'AbortError',
  );
  let cancelled = false;
  const fetcher = async () =>
    new Response(
      new ReadableStream({
        start(stream) {
          stream.enqueue(new Uint8Array(f.report.artifact.bytes + 1));
        },
        cancel() {
          cancelled = true;
        },
      }),
    );
  await assert.rejects(verifyStudioPreview({ ...f.input, fetcher }), /byte count differs/);
  assert.equal(cancelled, true);
});



test('new-company starter loads the current Solo host and First Flight with complete neutral classes', async () => {
  const f = await neutral();
  const provider = await loadRuntimeContentProvider({
    locationRef: { href: 'http://localhost/preview/game/index.html' },
    documentRef: { documentElement: { dataset: { editionId: 'acme-public' } } },
    fetcher: fetchFiles(f.result.files),
  });
  assert.equal(provider.route.source.policyId, 'journey-trail-impact-v3');
  assert.equal(provider.route.source.actorCatalogId, 'journey-actors-v9');
  assert.equal(provider.route.source.difficultyCatalogId, 'journey-difficulty-v2');
  const host = createCandidateSoloHost(provider.route.source, {
    themes: provider.themes,
    buildVersion: 'DEV',
    corePackIds: provider.route.corePackIds,
    optionalCampaignIds: provider.route.optionalCampaignIds,
  });
  assert.equal(host.entries.length, 3);
  assert.equal(provider.boot[3].length, 7);
  const original = createLessonScenario('close-line', { theme: provider.theme });
  const course = projectEditionGuideScenario(original, {
    theme: provider.theme,
    classes: provider.boot[3],
  });
  assert.equal(course.theme.id, 'acme-world');
  assert.deepEqual(course.level, original.level);
});

test('Studio CLI creates missing workspace parents while preserving new-only destinations', async () => {
  const { mkdtemp, readFile, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const directory = await mkdtemp(join(tmpdir(), 'revealline-studio-'));
  const workspace = join(directory, 'new-parent', 'nested', 'source');
  const command = [
    'scripts/company-studio.mjs',
    'init',
    '--brand',
    'nested-company',
    '--name',
    'Nested Company',
    '--workspace',
    workspace,
  ];
  const run = promisify(execFile);
  try {
    await run(process.execPath, command, { cwd: new URL('../../', import.meta.url) });
    const before = await readFile(join(workspace, 'source-draft.json'));
    const packet = JSON.parse(before);
    assert.equal(packet.catalog.defaultEditionId, 'nested-company-public');
    await assert.rejects(
      run(process.execPath, command, { cwd: new URL('../../', import.meta.url) }),
      /EEXIST/,
    );
    assert.deepEqual(await readFile(join(workspace, 'source-draft.json')), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
