import { createPresentationHost } from '../../../../game/presentation/host.mjs';
import { createStudioContextPresentation } from '../../../../authoring/asset-studio/scene-preview.mjs';
import { BoardPainter } from '../../../../game/ui/render.mjs';
import { createRun } from '../../../../game/core/index.mjs';
import { authoritativeCheckpoint } from '../../../../game/replay.mjs';
const $ = (id) => document.getElementById(id);
const baseURL = new URL('../../../../.cache/overflight/reuse-review/compiled/', import.meta.url)
  .href;
const host = createPresentationHost({ profile: 'board', baseURL, document });
const painters = [];
try {
  const runtime = await host.load();
  const supply = runtime.image('pickup.supply');
  if (supply.image !== runtime.image('pickup.supply-case-closed').image)
    throw Error('Bindings did not share one image');
  const decoded = new Map(
    ['pickup.supply', 'pickup.supply-case-closed'].map((slot) => [
      slot,
      { asset: supply.asset, image: supply.image },
    ]),
  );
  const preview = createStudioContextPresentation(runtime.resolved, decoded);
  const presets = await fetch(
    new URL('../../../../authoring/motion-lab/presets.json', import.meta.url),
  ).then((r) => r.json());
  const level = {
    version: 'xonix-level.v4',
    id: 'overflight-reuse-review',
    revision: '1',
    name: 'Shared supply case',
    width: 72,
    height: 36,
    spawn: { x: 36.5, y: 0.5 },
    goal: { coverage: 0.4 },
    enemies: [{ id: 'field-seed', type: 'bouncer', x: 60.5, y: 20.5, vx: 0, vy: 0 }],
    encounter: null,
    classic: { version: 'classic.v1', terrain: [], powerups: [] },
    rules: { stopOnCapture: true },
    supplies: [{ id: 'reuse-supply', x: 15.5, y: 8.5, radius: 1 }],
  };
  const run = createRun(level),
    before = JSON.stringify(authoritativeCheckpoint(run));
  for (const [id, snapshot] of [
    ['native', runtime],
    ['studio', preview],
  ]) {
    const painter = new BoardPainter(presets);
    painters.push(painter);
    painter.theme = { id: 'fpv', family: 'fpv', palette: runtime.canvas.palette };
    painter.bodyId = 'fpv-scout-v1';
    painter.body = presets.characters[painter.bodyId];
    painter.recipe = presets.animationRecipes[painter.body.animationRecipe];
    const background = document.createElement('canvas');
    background.width = 1152;
    background.height = 576;
    background.getContext('2d').fillRect(0, 0, 1152, 576);
    painter.background = background;
    painter.setPresentation(snapshot);
    painter.draw($(id).getContext('2d'), run, 0, { paused: true, reduced: true });
  }
  const unchanged = JSON.stringify(authoritativeCheckpoint(run)) === before;
  if (!unchanged) throw Error('Presentation changed gameplay state');
  $('source').src = new URL(`assets/${supply.asset.file.sha256}.png`, baseURL).href;
  $('identity').textContent =
    `${supply.asset.id}@${supply.asset.revision} · ${supply.asset.file.sha256}`;
  $('status').textContent = 'Ready · one decoded image shared by both compatible slots';
  $('result').textContent =
    'Verified: both native consumers rendered successfully; authoritative gameplay state is unchanged. This is a paused renderer demonstration, not a human playtest.';
} catch (error) {
  $('status').textContent = `Failed: ${error.message}`;
  throw error;
}
addEventListener(
  'pagehide',
  () => {
    for (const painter of painters) painter.dispose();
    host.close();
  },
  { once: true },
);
