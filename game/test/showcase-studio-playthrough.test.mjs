import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  createCompanyWorkspaceFiles,
  companyDraftFiles,
  companySourceDraft,
} from '../../scripts/company-studio.mjs';
import {
  compileEdition,
  collectEditionSelectedFiles,
  selectEditionClosure,
} from '../../scripts/compile-edition.mjs';
import {
  createStudioLessonSidecar,
  createStudioLessonDraft,
} from '../../authoring/company-studio/lesson-authoring.mjs';
import { createLessonEditor } from '../../authoring/company-studio/lesson-editor.mjs';
import { createStudioReward } from '../../authoring/company-studio/reward-editor.mjs';
import { createExplorationGuidedEditor } from '../studio/exploration-guided-editor.mjs';
import { createExplorationExample } from '../studio/exploration-example.mjs';
import { compileContentProject, resolveMission } from '../content-design/project.mjs';
import { applyGameplayTuning, resolveGameplayTuning } from '../gameplay-tuning.mjs';
import { createRun, stepRun, FIXED_DT } from '../core/index.mjs';
import { authoritativeCheckpoint } from '../replay.mjs';
import { BoardPainter } from '../ui/render.mjs';
import { createRewardBackend } from '../rewards/store.mjs';
import { Document } from './helpers/couch-dom.mjs';
import { soloPage, settle, memoryStorage } from './helpers/solo-dom.mjs';
import { managedIndexedDB } from './helpers/managed-idb.mjs';
import { PNGImage } from './helpers/png-image.mjs';
import { RasterImage } from './helpers/raster-image.mjs';
import { pngBytes } from './helpers/media-fixtures.mjs';
import { getLocale, setLocale, t as translate } from '../i18n/index.mjs';

const encode = (value) => Buffer.from(JSON.stringify(value));
async function waitForSaved(check) {
  for (let attempts = 0; attempts < 200; attempts++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  assert.fail('The real durable reward update did not settle.');
}
function authorSurface() {
  const document = new Document(),
    container = document.createElement('section');
  document.body.append(container);
  return container;
}

async function authoredEdition() {
  const workspace = createCompanyWorkspaceFiles({ brandId: 'guided-chain', name: 'Guided chain' });
  const added = createStudioLessonSidecar(workspace.catalog, workspace.catalog.campaigns[0].id);
  const catalog = structuredClone(added.catalog),
    campaign = catalog.campaigns[0],
    edition = catalog.editions[0];
  const source = JSON.parse(workspace.files.get(campaign.sourcePath));
  source.maps[0].foundations = [];
  source.missions[0].coverage = 0.4;
  const missionId = source.missions[0].id;
  const bytes = pngBytes(),
    sha256 = createHash('sha256').update(bytes).digest('hex');
  const art = {
    format: 'AssetRevisionV1',
    id: 'guided-exact-picture',
    revision: '1',
    kind: 'reveal-background',
    path: 'editions/assets/guided-exact-picture.png',
    sha256,
    bytes: bytes.length,
    width: 1,
    height: 1,
    alt: 'Exact synthetic test original; not a historical or production image.',
    review: 'candidate',
  };
  source.assets = [art];
  source.missions[0].presentation.backgroundAssetId = art.id;
  catalog.assets.push({
    id: art.id,
    path: `game/${art.path}`,
    sha256,
    bytes: bytes.length,
    publication: 'public',
    approved: true,
    dependencies: [],
  });
  campaign.assetIds = [art.id];
  campaign.rewardPath = campaign.sourcePath.replace('.json', '.rewards.json');

  // Exercise the real guided form from its blank draft, including bilingual
  // evidence and attribution; previews never see a player storage authority.
  const lesson = createStudioLessonDraft(campaign.id, missionId);
  const en = {
    title: 'Apply two roles',
    role: 'Classroom observer',
    brief: 'Compare the example, then label the different diagram.',
    notice: 'A fictional civilian classroom model.',
    success: 'The two information roles remain distinct.',
  };
  const uk = {
    title: 'Застосуйте дві ролі',
    role: 'Спостерігач у класі',
    brief: 'Порівняйте приклад і підпишіть іншу схему.',
    notice: 'Вигадана цивільна навчальна модель.',
    success: 'Дві ролі інформації залишаються відмінними.',
  };
  Object.assign(lesson, en, {
    sourceReviewedAt: '2026-09-28',
    sources: [
      {
        title: 'Betaflight — Video transmitters',
        url: 'https://betaflight.com/docs/wiki/getting-started/hardware/vtx',
      },
    ],
  });
  Object.assign(lesson.locales.uk, uk);
  for (const [record, localized] of [
    [lesson, false],
    [lesson.locales.uk, true],
  ]) {
    record.records[0].title = localized ? 'Пояснений приклад' : 'Worked example';
    record.records[0].lines = [
      localized
        ? 'Камера створює зображення, а VTX передає відеосигнал.'
        : 'A camera creates the image; a VTX transmits the video signal.',
    ];
    record.records[1].title = localized ? 'Інша схема' : 'Different diagram';
    record.records[1].lines = [
      localized
        ? 'Зображення вже є. Порожній блок має передати його до каналу перегляду.'
        : 'The image already exists. The empty box must carry it to the viewing link.',
    ];
    record.fields[0].label = localized ? 'Якої ролі бракує?' : 'Which role is missing?';
    record.fields[0].explanation = localized
      ? 'Потрібне передавання вже створеного зображення.'
      : 'The existing image needs transmission, not another observation.';
    record.fields[0].options[0].label = localized ? 'Передати зображення' : 'Transmit the image';
    record.fields[0].options[1].label = localized
      ? 'Створити ще одне зображення'
      : 'Create another image';
  }
  let lessons = [];
  const container = authorSurface();
  const editor = createLessonEditor({
    container,
    getCampaign: () => campaign,
    getProject: () => source,
    getLessons: () => lessons,
    setLessons: (value) => {
      lessons = value;
    },
  });
  editor.sync();
  function populate(value, prefix = '') {
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      const input = container.querySelector(`[data-lesson-field="${path}"]`);
      if (input) input.value = Array.isArray(entry) ? entry.join('\n') : String(entry);
      else if (entry && typeof entry === 'object') populate(entry, path);
    }
  }
  populate(lesson);
  container.querySelector('[data-lesson-action="stage"]').click();
  assert.equal(lessons.length, 1, container.textContent);
  container.querySelector('[data-lesson-action="wrong"]').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, false);
  container.querySelector('[data-lesson-action="correct"]').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, true);
  editor.dispose();

  let atlas = structuredClone(createExplorationExample());
  atlas.recipe.id = 'inspect-image-atlas';
  atlas.recipe.diagram = {
    asset: { assetId: art.id, sha256 },
    locales: {
      en: { alt: art.alt, caption: 'Synthetic fixture for exact-media admission.' },
      uk: {
        alt: 'Точний синтетичний тестовий оригінал.',
        caption: 'Тестовий матеріал для перевірки точних медіа.',
      },
    },
    hotspots: [{ cardId: 'camera', x: 0.25, y: 0.5 }],
  };
  const atlasEditor = createExplorationGuidedEditor({
    container,
    getDraft: () => atlas,
    setDraft: (value) => {
      atlas = value;
    },
    getLocale: () => 'en',
  });
  atlasEditor.sync();
  container.querySelector('[data-exploration-guided-field="locales.en.intro"]').value =
    'Compare the roles after the worked example, then try a different diagram.';
  container.querySelector('[data-exploration-guided-action="stage"]').click();
  assert.match(atlas.locales.en.intro, /worked example/);
  atlasEditor.dispose();
  const locales = {
    en: {
      title: 'Role atlas',
      teaser: 'Discover the two roles.',
      paragraph: 'An original conceptual comparison.',
    },
    uk: {
      title: 'Атлас ролей',
      teaser: 'Відкрийте дві ролі.',
      paragraph: 'Оригінальне порівняння понять.',
    },
  };
  const reward = structuredClone(
    createStudioReward({
      campaign,
      source,
      rule: 'mission-win',
      missionId,
      id: 'guided-role-atlas',
      locales,
    }),
  );
  reward.payloads.push(atlas);
  const bonus = createStudioReward({
    campaign,
    source,
    rule: 'mission-win',
    missionId,
    id: 'guided-role-application',
    locales,
    lessons,
    learningIds: [lessons[0].id],
  });
  const files = new Map(workspace.files),
    compiled = compileContentProject(source);
  files.set(campaign.sourcePath, encode(source));
  files.set(campaign.lessonPath, encode(lessons));
  files.set(campaign.rewardPath, encode([reward, bonus]));
  files.set(`game/${art.path}`, bytes);
  const boot = JSON.parse(files.get(edition.boot.campaign));
  boot.levels = [resolveMission(compiled, missionId, { difficulty: 'standard' }).level];
  files.set(edition.boot.campaign, encode(boot));
  files.set('game/editions/catalog.json', encode(catalog));
  const imported = companyDraftFiles(companySourceDraft({ catalog, files }));
  // Source drafts carry exact asset declarations; the existing media-root
  // handoff supplies their original bytes separately and compilation rechecks them.
  imported.files.set(`game/${art.path}`, bytes);
  const built = await compileEdition({
    catalog: imported.catalog,
    editionIds: [edition.id],
    files: imported.files,
  });
  assert.deepEqual(JSON.parse(built.files.get(campaign.lessonPath)), lessons);
  assert.deepEqual(JSON.parse(built.files.get(campaign.rewardPath)), [reward, bonus]);
  assert.deepEqual(built.files.get(`game/${art.path}`), bytes);
  const requests = [];
  const fetcher = async (url) => {
    const target = new URL(url, 'http://localhost/game/');
    const path =
      target.protocol === 'file:'
        ? target.pathname.slice(new URL('../../', import.meta.url).pathname.length)
        : target.pathname.slice(1);
    if (!built.files.has(path))
      return path === `game/${art.path}` ? new Response('', { status: 404 }) : undefined;
    requests.push(path);
    return new Response(built.files.get(path));
  };
  return {
    edition,
    campaign,
    source,
    art,
    bytes,
    lessons,
    reward,
    bonus,
    atlas,
    built,
    fetcher,
    requests,
  };
}

test(
  'guided Studio source survives export/import and compiled ordinary win, corrective application and exact Collection revisit',
  // Both real host journeys also run alongside the company file-level suite.
  // Bound slow hosted runners without removing any gameplay or persistence checks.
  { timeout: 120000 },
  async (t) => {
    const priorLocale = getLocale();
    setLocale('en', { persist: false });
    t.after(() => setLocale(priorLocale, { persist: false }));
    // Browser raster drawing is the only picture boundary modeled here; exact
    // compiled bytes, decoding, pin validation and display admission stay real.
    t.mock.method(BoardPainter.prototype, 'drawGallery', (context, { image }) => {
      assert.equal(image.width, 1);
      assert.equal(image.height, 1);
      context.drawImage(image, 0, 0);
    });
    const f = await authoredEdition(),
      storage = memoryStorage(),
      disk = managedIndexedDB();
    const page = await soloPage(t, {
      search: `?edition=${f.edition.id}`,
      titleScreen: true,
      storage,
      journeyIndexedDB: disk.indexedDB,
      pictures: { Image: PNGImage },
      fetchResponse: f.fetcher,
      browserSetup({ document }) {
        // The compiled entry pins this audience on its html element.
        document.documentElement.dataset.editionId = f.edition.id;
      },
    });
    const backend = createRewardBackend({ editionId: f.edition.id, indexedDB: disk.indexedDB });
    t.after(() => backend.close());
    assert.equal(
      (await backend.read()).receipts.length,
      0,
      'Guided previews cannot create player receipts.',
    );
    page.$('shell-featured').click();
    await settle(() => {
      page.frame(0);
      return page.doc.body.dataset.flightState === 'running';
    });
    const level = resolveMission(compileContentProject(f.source), f.lessons[0].missionId, {
      difficulty: 'standard',
    }).level;
    const expected = createRun(applyGameplayTuning(level, resolveGameplayTuning('standard')), {
      seed: 1,
      classId: 'scout',
      turnPolicy: 'immediate',
    });
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    page.key('ArrowDown');
    let ticks = 0;
    while (expected.status === 'running' && ticks < 1200) {
      let count = 0;
      while (count < 2 && expected.status === 'running' && ticks < 1200) {
        stepRun(expected, { direction: 'down' }, FIXED_DT);
        count++;
        ticks++;
      }
      page.frame(count * FIXED_DT * 1000);
    }
    page.key('ArrowDown', false);
    page.frame(0);
    assert.equal(expected.status, 'won');
    assert.equal(ticks, 469);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), authoritativeCheckpoint(expected));
    const checkpoint = authoritativeCheckpoint(page.rendered.run);
    let saved;
    await waitForSaved(async () => {
      page.frame(0);
      saved = await backend.read();
      return saved.receipts.length === 1;
    });
    assert.deepEqual(saved.receipts[0].definition, f.reward);
    assert.ok(f.requests.includes(`game/${f.art.path}`));
    page.$('skip-celebration').onclick();
    assert.equal(page.$('game-overlay').hidden, true, 'The earned picture owns the win moment.');
    assert.equal(page.$('show-result').hidden, false);
    page.$('show-result').click();
    assert.equal(page.$('game-overlay').dataset.kind, 'won');
    assert.equal(page.$('result-picture').hidden, false);
    assert.equal(page.$('next-button').hidden, false);
    assert.equal(page.$('next-button').disabled, false);
    assert.equal(page.$('retry-button').disabled, false);
    const lessonOpen = page.$('edition-lesson-open');
    assert.equal(lessonOpen.hidden, false);
    lessonOpen.focus();
    lessonOpen.click();
    const control = (id) => page.doc.querySelector(`[data-control="${id}"]`);
    for (const record of f.lessons[0].records) control(`inspect-${record.id}`).click();
    const decision = control('field-decision');
    decision.value = 'alternative';
    decision.emit('change');
    control('commit').click();
    assert.equal(control('commit').disabled, false);
    assert.match(page.$('edition-lesson-dialog').textContent, /existing image needs transmission/);
    assert.equal(
      (await backend.read()).receipts.length,
      1,
      'Corrective feedback cannot grant the optional bonus.',
    );
    decision.value = 'supported';
    decision.emit('change');
    control('commit').click();
    await waitForSaved(async () => {
      page.frame(0);
      saved = await backend.read();
      return saved.receipts.length === 2;
    });
    assert.deepEqual(
      saved.receipts.find((entry) => entry.definition.id === f.bonus.id).definition,
      f.bonus,
    );
    const proofs = storage.getItem(`revealline.company-learning-proofs.${f.edition.id}.v1`);
    assert.equal(JSON.parse(proofs).proofs.length, 1);
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    control('close').click();
    assert.equal(page.$('edition-lesson-dialog').open, false);
    assert.equal(page.doc.activeElement, lessonOpen);
    page.$('collection-button').click();
    await settle(() => page.$('journey-picture-grid').querySelector('button'));
    const earnedPicture = page.$('journey-picture-grid').querySelector('button');
    await earnedPicture.onclick();
    assert.equal(
      page.$('journey-picture-retry').hidden,
      true,
      page.$('journey-picture-status').textContent,
    );
    const revisit = [...page.$('journey-picture-viewer').querySelectorAll('button')].find((entry) =>
      /revisit this connection/.test(entry.textContent),
    );
    assert.ok(revisit, 'An actual earned Journey picture exposes the authored lesson revisit.');
    revisit.click();
    assert.equal(page.$('edition-lesson-dialog').open, true);
    control('close').click();
    page.$('journey-picture-back').click();
    // A compiled original becoming unavailable must never be substituted. The
    // picture action, including lesson revisit, returns only after exact retry.
    f.built.files.delete(`game/${f.art.path}`);
    await earnedPicture.onclick();
    assert.equal(page.$('journey-picture-retry').hidden, false);
    assert.equal(
      page
        .$('journey-picture-viewer')
        .querySelectorAll('button')
        .some((entry) => /revisit this connection/.test(entry.textContent)),
      false,
    );
    assert.match(page.$('journey-picture-status').textContent, /unavailable/);
    f.built.files.set(`game/${f.art.path}`, f.bytes);
    await page.$('journey-picture-retry').onclick();
    assert.equal(page.$('journey-picture-retry').hidden, true);
    page.$('journey-picture-back').click();
    const openAtlas = page.doc
      .querySelectorAll('button')
      .find(
        (node) =>
          node.dataset.rewardId === f.reward.id && node.dataset.rewardSurface === 'collection',
      );
    openAtlas.focus();
    openAtlas.click();
    const dialog = page.$('completion-reward-dialog');
    assert.equal(dialog.open, true);
    const camera = dialog.querySelector('[data-card-id="camera"]');
    camera.focus();
    camera.emit('keydown', { key: 'ArrowRight' });
    assert.equal(page.doc.activeElement.dataset.cardId, 'video-transmitter');
    page.doc.activeElement.click();
    assert.match(dialog.textContent, /send the video signal/);
    dialog.querySelector('[data-choice-id="observation"]').click();
    assert.match(dialog.textContent, /repeats the observation role/);
    dialog.querySelector('[data-choice-id="transmission"]').click();
    assert.match(dialog.textContent, /VTX role fits this box/);
    assert.equal(dialog.querySelector('a').href, f.atlas.recipe.sources[0].url);
    dialog.close();
    assert.equal(page.doc.activeElement, openAtlas);
    assert.deepEqual(
      (await backend.read()).receipts,
      saved.receipts,
      'Revisiting exact discoveries cannot mint more receipts.',
    );
    assert.equal(
      storage.getItem(`revealline.company-learning-proofs.${f.edition.id}.v1`),
      proofs,
      'Collection learning remains practice, not fresh evidence.',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  },
);

async function realShowcaseEdition() {
  const read = (name) => readFile(new URL(`../../${name}`, import.meta.url));
  const editionId = 'ukraine-culture',
    campaignId = 'ukraine-threads',
    missionId = `${campaignId}-02`;
  const catalog = selectEditionClosure(JSON.parse(await read('game/editions/catalog.json')), [
    editionId,
  ]);
  const files = await collectEditionSelectedFiles({ catalog, editionIds: [editionId], read });
  const campaign = catalog.campaigns.find((item) => item.id === campaignId);
  const source = JSON.parse(files.get(campaign.sourcePath));
  const originalLessons = JSON.parse(files.get(campaign.lessonPath));
  let lessons = structuredClone(originalLessons);
  const lesson = lessons.find((item) => item.missionId === missionId);
  const container = authorSurface();
  const editor = createLessonEditor({
    container,
    getCampaign: () => campaign,
    getProject: () => source,
    getLessons: () => lessons,
    setLessons: (value) => {
      lessons = value;
    },
  });
  editor.sync();
  const choose = container.querySelector('[data-lesson-mission]');
  choose.value = missionId;
  choose.emit('change');
  for (const [field, text] of [
    ['title', lesson.title],
    ['locales.uk.title', lesson.locales.uk.title],
    ['sources.0.url', lesson.sources[0].url],
  ]) {
    const input = container.querySelector(`[data-lesson-field="${field}"]`);
    assert.equal(input.value, text);
    input.value = text;
  }
  // Stage the real reviewed lesson without rewriting its content or identity.
  // The separate synthetic chain tests authoring changed fields and new rewards.
  container.querySelector('[data-lesson-action="stage"]').click();
  assert.deepEqual(
    [...lessons].sort((a, b) => a.id.localeCompare(b.id)),
    [...originalLessons].sort((a, b) => a.id.localeCompare(b.id)),
  );
  container.querySelector('[data-lesson-action="wrong"]').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, false);
  assert.ok(container.textContent.includes(lesson.fields[0].explanation));
  container.querySelector('[data-lesson-action="correct"]').click();
  assert.equal(container.querySelector('[data-control="commit"]').disabled, true);
  assert.ok(container.textContent.includes(lesson.success));
  editor.dispose();
  files.set(campaign.lessonPath, encode(lessons));
  const imported = companyDraftFiles(companySourceDraft({ catalog, files }));
  // Source-draft JSON and separately handed-off original media are the public
  // authoring contract. Preserve every current and retained byte, not placeholders.
  for (const [name, bytes] of files) if (!imported.files.has(name)) imported.files.set(name, bytes);
  assert.deepEqual(imported.catalog, catalog);
  const built = await compileEdition({
    catalog: imported.catalog,
    editionIds: [editionId],
    files: imported.files,
  });
  for (const descriptor of catalog.campaigns)
    for (const key of ['sourcePath', 'lessonPath', 'rewardPath', 'localizationPath'])
      if (descriptor[key])
        assert.deepEqual(
          JSON.parse(built.files.get(descriptor[key])),
          JSON.parse(files.get(descriptor[key])),
        );
  for (const asset of catalog.assets) {
    const bytes = built.files.get(asset.path);
    assert.equal(bytes.length, asset.bytes, asset.id);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), asset.sha256, asset.id);
  }
  const rewards = JSON.parse(built.files.get(campaign.rewardPath));
  const reward = rewards.find(
    (entry) => entry.scope.kind === 'mission' && entry.scope.id === missionId,
  );
  const art = source.assets.find(
    (asset) =>
      asset.id ===
      source.missions.find((mission) => mission.id === missionId).presentation.backgroundAssetId,
  );
  const requests = [];
  const fetcher = async (url) => {
    const target = new URL(url, 'http://localhost/game/');
    const name =
      target.protocol === 'file:'
        ? target.pathname.slice(new URL('../../', import.meta.url).pathname.length)
        : target.pathname.slice(1);
    if (!built.files.has(name)) return undefined;
    requests.push(name);
    return new Response(built.files.get(name));
  };
  const routes = JSON.parse(await read('game/test/fixtures/curriculum-campaign-routes.json')).rows;
  return {
    catalog,
    editionId,
    campaignId,
    missionId,
    source,
    lesson,
    reward,
    rewards,
    art,
    built,
    requests,
    fetcher,
    routes,
  };
}

test(
  'real Threads showcase survives guided staging, source round trip, ordinary wins and bilingual corrective Collection revisit',
  // Two complete authored routes plus the Collection revisit can exceed the
  // old limit when this CPU-heavy host fixture shares a CI runner.
  { timeout: 180000 },
  async (t) => {
    const priorLocale = getLocale();
    setLocale('en', { persist: false });
    t.after(() => setLocale(priorLocale, { persist: false }));
    const f = await realShowcaseEdition(),
      storage = memoryStorage(),
      disk = managedIndexedDB();
    // Native raster pixels and DOM layout are modeled; real asset bytes, shared
    // inspection/hash admission, run/replay, lessons, stores and compiler are used.
    t.mock.method(BoardPainter.prototype, 'drawGallery', (context, { image }) => {
      assert.ok(image.width > 1 && image.height > 1);
      context.drawImage(image, 0, 0);
    });
    const page = await soloPage(t, {
      search: `?edition=${f.editionId}`,
      titleScreen: true,
      storage,
      journeyIndexedDB: disk.indexedDB,
      pictures: { Image: RasterImage },
      fetchResponse: f.fetcher,
      browserSetup({ document }) {
        document.documentElement.dataset.editionId = f.editionId;
      },
    });
    const backend = createRewardBackend({ editionId: f.editionId, indexedDB: disk.indexedDB });
    t.after(() => backend.close());
    assert.equal(
      (await backend.read()).receipts.length,
      0,
      'Guided previews do not create player receipts.',
    );
    const compiled = compileContentProject(f.source);
    async function win(missionId) {
      await settle(() => {
        page.frame(0);
        return (
          page.doc.body.dataset.flightState === 'running' && page.rendered.run.levelId === missionId
        );
      });
      const route = f.routes.find(
        (entry) =>
          entry.id === missionId &&
          entry.difficulty === 'standard' &&
          entry.turnPolicy === 'immediate',
      );
      const level = resolveMission(compiled, missionId, { difficulty: 'standard' }).level;
      const expected = createRun(applyGameplayTuning(level, resolveGameplayTuning('standard')), {
        seed: route.seed,
        classId: 'scout',
        turnPolicy: 'immediate',
      });
      assert.deepEqual(
        authoritativeCheckpoint(page.rendered.run),
        authoritativeCheckpoint(expected),
      );
      for (const segment of route.segments) {
        const key = `Arrow${segment.direction[0].toUpperCase()}${segment.direction.slice(1)}`;
        page.key(key);
        for (let tick = 0; tick < segment.ticks; ) {
          const count = Math.min(4, segment.ticks - tick);
          for (let i = 0; i < count; i++)
            stepRun(expected, { direction: segment.direction }, FIXED_DT);
          page.frame(count * FIXED_DT * 1000);
          tick += count;
        }
        page.key(key, false);
      }
      page.frame(0);
      assert.equal(expected.status, 'won');
      assert.equal(expected.tick, route.ticks);
      assert.deepEqual(
        authoritativeCheckpoint(page.rendered.run),
        authoritativeCheckpoint(expected),
      );
      page.$('skip-celebration').onclick();
      assert.equal(page.$('game-overlay').hidden, true, 'The earned picture appears before result actions.');
      assert.equal(page.$('show-result').hidden, false);
      page.$('show-result').click();
      assert.equal(page.$('next-button').disabled, false);
      assert.equal(page.$('retry-button').disabled, false);
      return authoritativeCheckpoint(page.rendered.run);
    }
    page.$('shell-featured').click();
    await win(`${f.campaignId}-01`);
    page.$('next-button').click();
    const checkpoint = await win(f.missionId);
    let saved;
    await waitForSaved(async () => {
      page.frame(0);
      saved = await backend.read();
      return saved.receipts.length === 2;
    });
    assert.deepEqual(
      saved.receipts.find((entry) => entry.definition.id === f.reward.id).definition,
      f.reward,
    );
    assert.ok(
      saved.receipts.every((entry) => entry.definition.scope.kind === 'mission'),
      'Two actual wins cannot grant a six-win finale or application bonus.',
    );
    assert.ok(f.requests.includes(`game/${f.art.path}`));
    // The win helper already returned from the earned-picture presentation.
    assert.equal(page.$('game-overlay').dataset.kind, 'won');
    assert.equal(page.$('result-picture').hidden, false);
    const lessonOpen = page.$('edition-lesson-open');
    assert.equal(
      lessonOpen.hidden,
      false,
      'The optional activity is reachable on the initial earned result.',
    );
    lessonOpen.focus();
    lessonOpen.click();
    const control = (id) => page.doc.querySelector(`[data-control="${id}"]`);
    const dialog = page.$('edition-lesson-dialog');
    assert.ok(dialog.textContent.includes(f.lesson.title));
    assert.equal(dialog.querySelector('a').href, f.lesson.sources[0].url);
    for (const record of f.lesson.records) control(`inspect-${record.id}`).click();
    for (const field of f.lesson.fields) {
      const select = control(`field-${field.id}`);
      select.value = field.options.find((option) => option.value !== field.expected).value;
      select.emit('change');
    }
    control('commit').click();
    assert.equal(control('commit').disabled, false);
    assert.ok(dialog.textContent.includes(f.lesson.fields[0].explanation));
    assert.equal(storage.getItem(`revealline.company-learning-proofs.${f.editionId}.v1`), null);
    const firstDecision = control(`field-${f.lesson.fields[0].id}`);
    firstDecision.focus();
    setLocale('uk', { persist: false });
    assert.ok(dialog.textContent.includes(f.lesson.locales.uk.title));
    assert.equal(page.doc.activeElement, control(`field-${f.lesson.fields[0].id}`));
    assert.ok(dialog.textContent.includes(f.lesson.locales.uk.fields[0].explanation));
    for (const field of f.lesson.fields) {
      const select = control(`field-${field.id}`);
      select.value = field.expected;
      select.emit('change');
    }
    control('commit').click();
    await waitForSaved(
      () => storage.getItem(`revealline.company-learning-proofs.${f.editionId}.v1`) !== null,
    );
    const proofs = storage.getItem(`revealline.company-learning-proofs.${f.editionId}.v1`);
    assert.equal(JSON.parse(proofs).proofs.length, 1);
    assert.equal(control('commit').disabled, true);
    assert.ok(dialog.textContent.includes(f.lesson.locales.uk.success));
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    control('close').click();
    assert.equal(page.doc.activeElement, lessonOpen);
    page.$('collection-button').click();
    await settle(() => page.$('journey-picture-grid').querySelectorAll('button').length === 2);
    const pictureCard = [...page.$('journey-picture-grid').children].find(
      (node) =>
        node.dataset.missionId ===
        `candidate/${f.source.packs[0].id}/${f.campaignId}/${f.missionId}`,
    );
    assert.ok(pictureCard, 'Collection retains the exact earned composite Journey identity.');
    const picture = pictureCard.querySelector('button');
    assert.equal(picture.textContent, translate('interface:journeyPictures.viewEarned'));
    assert.equal(
      pictureCard.querySelector('h3').textContent,
      f.source.missions.find((mission) => mission.id === f.missionId).name,
    );
    await picture.onclick();
    assert.equal(page.$('journey-picture-retry').hidden, true);
    const revisit = page
      .$('journey-picture-viewer')
      .querySelectorAll('button')
      .find((node) => node.textContent === translate('interface:editionLessons.revisitConnection'));
    assert.ok(
      revisit,
      'Collection offers the exact lesson for this earned composite Journey identity.',
    );
    revisit.click();
    assert.ok(dialog.textContent.includes(f.lesson.locales.uk.title));
    assert.equal(dialog.querySelector('a').href, f.lesson.sources[0].url);
    control('close').click();
    page.$('journey-picture-back').click();
    const discovery = page.doc
      .querySelectorAll('button')
      .find(
        (node) =>
          node.dataset.rewardId === f.reward.id && node.dataset.rewardSurface === 'collection',
      );
    assert.ok(discovery);
    discovery.focus();
    discovery.click();
    const earned = page.$('completion-reward-dialog');
    assert.equal(earned.open, true);
    assert.equal(page.$('completion-reward-title').textContent, f.reward.locales.uk.title);
    assert.ok(
      earned.textContent.includes(
        f.reward.payloads.find((payload) => payload.type === 'knowledge').locales.uk.paragraphs[0],
      ),
    );
    earned.close();
    assert.equal(page.doc.activeElement, discovery);
    assert.equal(
      storage.getItem(`revealline.company-learning-proofs.${f.editionId}.v1`),
      proofs,
      'Collection revisit cannot mint another learning proof.',
    );
    assert.deepEqual(
      (await backend.read()).receipts,
      saved.receipts,
      'Optional practice and revisit cannot grant an unearned finale.',
    );
    assert.deepEqual(authoritativeCheckpoint(page.rendered.run), checkpoint);
    assert.deepEqual(page.errors, []);
  },
);
