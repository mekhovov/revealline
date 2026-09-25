import { t, localizedText } from '../../game/i18n/index.mjs';
import {
  TEAM_OUTCOME_SLOTS,
  drawTeamOutcomeBadge,
} from '../../game/couch/coop-outcome-presentation.mjs';
import { TEAM_ENEMY_SLOTS, teamEnemyInheritance } from '../../game/couch/coop-enemy-slots.mjs';
import {
  TEAM_EMITTER_SLOTS,
  drawTeamEmitterWarning,
  drawTeamEmitterSpark,
} from '../../game/couch/coop-emitter-presentation.mjs';
import {
  TEAM_SUPPORT_SLOTS,
  drawTeamSupportPulse,
  drawTeamSlowed,
} from '../../game/couch/coop-support-presentation.mjs';
import { TEAM_CORE_SLOTS, drawTeamCoreCue } from '../../game/couch/coop-core-presentation.mjs';
import { TEAM_ANCHOR_SLOTS, drawTeamAnchor } from '../../game/couch/coop-anchor-presentation.mjs';
import { createOperationStatus } from '../../game/ui/operation-status.mjs';
import { bindAudioMasterMedia } from '../../game/ui/audio-master.mjs';
import { createCurrentArtPreview } from '../../game/presentation/current-art.mjs';
import { pictureOwnerContext } from './picture-context.mjs';
import {
  playerRecipePreview,
  boardContextPreview,
  audioRecipePreview,
  effectRecipePreview,
  componentPreview,
  pickupKinds,
} from './scene-preview.mjs';
import {
  applyPresentation,
  canvasPresentation,
  presentationFontDescriptors,
} from '../../game/presentation/runtime.mjs';
import { createActorPresentation, drawPresentedActor } from '../../game/ui/actor-presentation.mjs';
import { drawClassicTerrain, drawPickupIcon } from '../../game/ui/classic-view.mjs';
const fonts = new Map();
const text = (tag, value, className = '', hostRole = null) => {
  const node = document.createElement(tag);
  localizedText(node, () => value);
  node.className = className;
  if (hostRole) node.dataset.studioHost = hostRole;
  return node;
};
export async function drawAssetPreview(surface, slot, asset, resolved, blobs, settings) {
  const {
    mode,
    fieldMode = 'solo',
    teamArena = 'first-connection',
    teamScenario = 'initial',
    background,
    geometry,
    motion = 'paused',
    state = 'default',
    statusTarget,
    cancelButton,
    label = t('tools:assetPreview'),
    isCurrent: hostCurrent = () => true,
    audioMaster = null,
    motionPreferences = null,
  } = settings;
  surface.previewCleanup?.();
  const marker = {};
  surface.previewMarker = marker;
  const isCurrent = () => surface.previewMarker === marker && hostCurrent();
  const presenter = statusTarget ? createOperationStatus(statusTarget, { isCurrent }) : null;
  const lease = presenter?.begin({ message: `${label}: preparing ${slot.label}…` });
  const phase = (message, stage = 'preparing') =>
    lease?.update({ message: `${label}: ${message}`, stage });
  let failed = false;
  surface.setAttribute('aria-busy', 'true');
  surface.replaceChildren();
  surface.dataset.background = background;
  const urls = [];
  const unapply = applyPresentation(surface, resolved);
  const cleanups = [];
  const own = (cleanup) => (isCurrent() ? cleanups.push(cleanup) : cleanup());
  const options = {
    mode,
    fieldMode,
    teamArena,
    teamScenario,
    motion,
    motionPreferences,
    state,
    isCurrent,
    onStatus: phase,
  };
  const fieldSlot = [
    'players',
    'motion',
    'enemies',
    'terrain',
    'pickups',
    'effects',
    'pictures',
    'objectives',
  ].includes(slot.group);
  let cleaned = false;
  surface.previewCleanup = (preserveStatus = false) => {
    if (cleaned) {
      if (!preserveStatus) presenter?.dispose();
      return;
    }
    cleaned = true;
    if (surface.previewMarker === marker) {
      surface.previewMarker = null;
      surface.setAttribute('aria-busy', 'false');
    }
    urls.forEach(URL.revokeObjectURL);
    cleanups.forEach((cleanup) => cleanup());
    unapply();
    if (!preserveStatus) presenter?.dispose();
  };
  if (cancelButton) {
    cancelButton.hidden = false;
    localizedText(cancelButton, () => t('common:actions.stopWaiting'));
    cancelButton.onclick = () => {
      if (!isCurrent()) return;
      lease?.finish({ message: `${label}: stopped waiting.`, state: 'detached' });
      // A decoder or shared fixture fetch may finish, but cannot draw after this fence.
      surface.previewCleanup(true);
      localizedText(cancelButton, () => t('common:preview.retry'));
      cancelButton.onclick = () =>
        drawAssetPreview(surface, slot, asset, resolved, blobs, settings);
    };
  }
  try {
    if (!asset) {
      surface.append(text('p', t('tools:noBindingUploadACandidateForThisSlot'), '', 'body'));
      return;
    }
    if (mode === 'context' && !fieldSlot)
      surface.append(
        text(
          'small',
          t('tools:gameModeAppliesToFieldPreviewsThisSlotUsesIts'),
          'bounded-label',
          'secondary',
        ),
      );
    for (const id of ['font.display', 'font.ui', 'font.numeric']) {
      const fontAsset = resolved.assets[id];
      if (fontAsset?.kind !== 'font') continue;
      const fontBlob = blobs.get(fontAsset.file.sha256);
      if (!fontBlob)
        throw new Error(`Missing bytes for ${id}. Re-import the complete theme bundle.`);
      phase(`reading and decoding ${id}…`, 'decoding');
      await prepareFont(fontAsset, fontBlob, resolved);
      if (!isCurrent()) return;
    }
    if (TEAM_OUTCOME_SLOTS.includes(slot.id)) {
      if (mode === 'context' && fieldMode !== 'team')
        throw new Error(t('tools:teamOutcomesUseCouchTeamContextChooseItsActualEvent'));
      if (asset.kind === 'recipe' && mode !== 'context') {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 32;
        canvas.setAttribute('role', 'img');
        canvas.setAttribute('aria-label', `${slot.label} recipe preview`);
        drawTeamOutcomeBadge(
          canvas.getContext('2d'),
          { kind: 'recipe' },
          { left: 4, y: 16 },
          1,
          [resolved.tokens.amber, resolved.tokens.cyan],
          true,
          0,
        );
        canvas.style.width = mode === 'native' ? '32px' : '192px';
        canvas.style.maxWidth = '100%';
        surface.append(
          canvas,
          text(
            'small',
            t('tools:isolatedTwoPlayerBadgeRecipeChooseTheActualJointCapture'),
            'bounded-label',
            'secondary',
          ),
        );
        return;
      }
    }
    if (TEAM_ENEMY_SLOTS.includes(slot.id)) {
      if (mode === 'context' && fieldMode !== 'team')
        throw new Error(t('tools:teamEnemyStateBodiesUseCouchTeamContextChooseCouch'));
      if (asset.kind === 'recipe' && mode !== 'context') {
        const inherited = teamEnemyInheritance(slot.id);
        asset = resolved.assets[inherited];
        if (asset?.kind !== 'image')
          throw new Error(
            `Shared body ${inherited} is not prepared. Choose a complete collection.`,
          );
        surface.append(
          text(
            'small',
            `Explicit shared-body inheritance: ${inherited}. Uploads replace only the selected Team enemy role/state.`,
            'bounded-label',
            'secondary',
          ),
        );
      }
    }
    if (slot.id.startsWith('team.pilot.')) {
      if (mode === 'context' && fieldMode !== 'team')
        throw new Error(t('tools:teamPlayerStateBodiesUseCouchTeamContextChooseCouch'));
      if (asset.kind === 'recipe' && mode !== 'context') {
        const inherited = `player.scout.${slot.id.split('.').at(-1)}`;
        asset = resolved.assets[inherited];
        if (asset?.kind !== 'image')
          throw new Error(
            `This Team recipe inherits ${inherited}, which has no prepared artwork. Load a reviewed collection or upload a body.`,
          );
        surface.append(
          text(
            'small',
            `Explicit shared-body inheritance: ${inherited}. Uploads replace only the selected Team seat/state/treatment.`,
            'bounded-label',
            'secondary',
          ),
        );
      }
    }
    const blob = asset.file && blobs.get(asset.file.sha256);
    if (asset.file && !blob) {
      throw new Error(t('tools:fileBytesAreUnavailableReImportTheCompleteBundle'));
    }
    if (asset.kind === 'audio') {
      phase('loading audio metadata…', 'decoding');
      const audio = document.createElement('audio');
      const audioBinding = audioMaster
        ? bindAudioMasterMedia({ audioMaster, element: audio })
        : null;
      own(() => audioBinding?.dispose());
      const url = URL.createObjectURL(blob);
      urls.push(url);
      audio.controls = true;
      audio.preload = 'metadata';
      if (audioBinding) {
        const label = text('label', t('tools:auditionVolume'), '', 'control'),
          fader = document.createElement('input');
        fader.type = 'range';
        fader.min = '0';
        fader.max = '1';
        fader.step = '0.05';
        fader.value = '1';
        fader.oninput = () => audioBinding.setLocal({ volume: Number(fader.value) });
        label.append(fader);
        surface.append(
          label,
          text('small', t('tools:useAuditionVolumeForThisPreviewMasterSoundAppliesTo'), '', 'body'),
        );
      }
      await new Promise((resolve, reject) => {
        const clear = () => {
          audio.removeEventListener('loadedmetadata', ready);
          audio.removeEventListener('error', error);
        };
        const ready = () => {
          clear();
          resolve();
        };
        const error = () => {
          clear();
          reject(new Error(t('tools:audioMetadataCouldNotBeDecoded')));
        };
        own(() => {
          clear();
          audio.pause();
          audio.removeAttribute('src');
          audio.load();
          reject(new DOMException(t('tools:audioPreviewClosed'), 'AbortError'));
        });
        audio.addEventListener('loadedmetadata', ready);
        audio.addEventListener('error', error);
        audio.src = url;
        surface.append(audio);
        if (audio.readyState >= 1) ready();
      });
      return;
    }
    if (asset.kind === 'font') {
      const family = `RLAsset-${asset.file.sha256}`;
      phase('reading and decoding the font…', 'decoding');
      await prepareFont(asset, blob, resolved);
      if (!isCurrent()) return;
      // The selected slot owns the specimen, even when several roles share a file.
      // Keep the exact file family rather than the surrounding Theme/Plain tokens.
      const weights =
          slot.id === 'font.ui' ? [400, 500, 600] : [slot.id === 'font.display' ? 600 : 500],
        size =
          slot.id === 'font.display'
            ? Math.max(40, resolved.tokens.displaySize)
            : slot.id === 'font.numeric'
              ? resolved.tokens.textSize + 8
              : Math.max(18, resolved.tokens.textSize);
      for (const weight of weights) {
        const sample = text(
          'div',
          `${slot.label} · ${weight}\nFlight ready · Політ готовий\nContinue mission · Продовжити місію\nҐґ Єє Іі Її Йй Щщ\n01:24 · 75% · 0123456789 ₴\nІ l 1 · О O 0 · ʼ ’`,
          'font-file-sample',
        );
        sample.style.fontFamily = family;
        sample.style.fontSize = `${size}px`;
        sample.style.fontWeight = String(weight);
        surface.append(sample);
      }
      return;
    }
    const palette = canvasPresentation(resolved).palette;
    if (
      [...TEAM_ANCHOR_SLOTS, ...TEAM_CORE_SLOTS].includes(slot.id) &&
      mode === 'context' &&
      fieldMode !== 'team'
    )
      throw new Error(t('tools:relayObjectivesBelongToTeamChooseTeamRelayYardOr'));
    if (TEAM_EMITTER_SLOTS.includes(slot.id) && mode === 'context' && fieldMode !== 'team')
      throw new Error(t('tools:emitterHazardsBelongToTeamChooseCouchTeamRelayYard'));
    if (TEAM_EMITTER_SLOTS.includes(slot.id) && asset.kind === 'recipe' && mode !== 'context') {
      const warning = slot.id.endsWith('warning'),
        size = warning ? 24 : 16,
        canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${slot.label} fixed recipe preview`);
      const ctx = canvas.getContext('2d'),
        frames = { [slot.id]: { kind: 'recipe' } };
      ctx.save();
      if (warning) {
        ctx.scale(size / 4, size / 4);
        drawTeamEmitterWarning(ctx, frames, { x: 0.4, y: 0.4 }, { x: 2.4, y: 2.4 }, palette);
      } else {
        ctx.scale(size / 2, size / 2);
        drawTeamEmitterSpark(ctx, frames, { x: 1, y: 1 }, palette);
      }
      ctx.restore();
      if (mode === 'alpha') {
        const pixels = ctx.getImageData(0, 0, size, size);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const a = pixels.data[i + 3];
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = a;
          pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      canvas.style.width = mode === 'native' ? `${size}px` : '192px';
      canvas.style.maxWidth = '100%';
      surface.append(
        canvas,
        text(
          'small',
          t('tools:nativeGlyphDemonstrationRelayYardEmitterWarningAndTravellingSpark'),
          'bounded-label',
          'secondary',
        ),
      );
      return;
    }
    if (TEAM_SUPPORT_SLOTS.includes(slot.id) && mode === 'context' && fieldMode !== 'team')
      throw new Error(t('tools:supportBelongsToTeamChooseCouchTeamSupportPulseOr'));
    if (TEAM_SUPPORT_SLOTS.includes(slot.id) && asset.kind === 'recipe' && mode !== 'context') {
      const pulse = slot.id === 'team.support.pulse',
        size = pulse ? 64 : 24;
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', `${slot.label} fixed recipe preview`);
      const ctx = canvas.getContext('2d'),
        frames = { [slot.id]: { kind: 'recipe' } };
      ctx.save();
      if (pulse) {
        ctx.scale(size / 13, size / 13);
        drawTeamSupportPulse(
          ctx,
          frames,
          { x: 6.5, y: 6.5, player: 0 },
          [palette.accent, palette.safe],
          true,
        );
      } else {
        ctx.scale(size / 2, size / 2);
        ctx.translate(1, 1);
        drawTeamSlowed(ctx, frames, palette);
      }
      ctx.restore();
      if (mode === 'alpha') {
        const pixels = ctx.getImageData(0, 0, size, size);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const alpha = pixels.data[i + 3];
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = alpha;
          pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      canvas.style.width = mode === 'native' ? `${size}px` : '192px';
      canvas.style.maxWidth = '100%';
      surface.append(
        canvas,
        text(
          'small',
          t('tools:fixedFunctionalRecipeUploadsAddBoundedDecorationTeamSupportPulse'),
          'bounded-label',
          'secondary',
        ),
      );
      return;
    }
    if (TEAM_ANCHOR_SLOTS.includes(slot.id) && asset.kind === 'recipe' && mode !== 'context') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 24;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        `${slot.label} decoration; live anchor labels are drawn separately`,
      );
      const ctx = canvas.getContext('2d');
      drawTeamAnchor(
        ctx,
        { [slot.id]: { kind: 'recipe' } },
        { x: 12, y: 12, captured: slot.id.endsWith('.captured') },
        palette,
        20,
      );
      if (mode === 'alpha') {
        const pixels = ctx.getImageData(0, 0, 24, 24);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const alpha = pixels.data[i + 3];
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = alpha;
          pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      canvas.style.width = mode === 'native' ? '24px' : '192px';
      canvas.style.maxWidth = '100%';
      surface.append(
        canvas,
        text(
          'small',
          t('tools:decorationOnlyAnchorIdentityAndCapturedCheckmarkStayVisibleIn'),
          'bounded-label',
          'secondary',
        ),
      );
      return;
    }

    if (TEAM_CORE_SLOTS.includes(slot.id) && asset.kind === 'recipe' && mode !== 'context') {
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 64;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute(
        'aria-label',
        `${slot.label} state-overlay recipe; shared core body is shown in Team context`,
      );
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.scale(64 / 3, 64 / 3);
      drawTeamCoreCue(
        ctx,
        { [slot.id]: { kind: 'recipe' } },
        {
          core: { x: 1.5, y: 1.5 },
          shielded: slot.id.endsWith('.shielded'),
          defeated: slot.id.endsWith('.secured'),
        },
        palette,
      );
      ctx.restore();
      if (mode === 'alpha') {
        const pixels = ctx.getImageData(0, 0, 64, 64);
        for (let i = 0; i < pixels.data.length; i += 4) {
          const alpha = pixels.data[i + 3];
          pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = alpha;
          pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      canvas.style.width = mode === 'native' ? '64px' : '192px';
      canvas.style.maxWidth = '100%';
      surface.append(
        canvas,
        text(
          'small',
          t('tools:stateOverlayRecipeTeamContextKeepsTheSharedRelayBody'),
          'bounded-label',
          'secondary',
        ),
      );
      return;
    }
    if (mode === 'context' && fieldMode === 'team' && fieldSlot) {
      if (asset.kind === 'recipe' && slot.group === 'pictures')
        throw new Error(t('tools:thisPictureRecipeHasNoTeamFieldPreviewChooseSolo'));
      // Team owns its arena/artwork applicability check. A bound Team picture
      // can also have a Solo owner, which must not redirect this inspection.
      await boardContextPreview(surface, slot, asset, resolved, blobs, options, own);
      return;
    }
    if (asset.kind === 'recipe' && slot.group === 'pictures') {
      const loader = createCurrentArtPreview();
      own(() => loader.close());
      phase('loading the exact current picture…', 'downloading');
      try {
        const source = await loader.load(slot.id);
        if (!isCurrent()) return;
        surface.replaceChildren();
        if (mode === 'context') {
          phase('preparing the exact picture scene…');
          await boardContextPreview(
            surface,
            slot,
            asset,
            resolved,
            blobs,
            { ...options, sourcePicture: source },
            own,
          );
        } else {
          const canvas = document.createElement('canvas');
          canvas.setAttribute('role', 'img');
          canvas.setAttribute(
            'aria-label',
            `${source.descriptor.label} — exact current source preview`,
          );
          canvas.width = source.image.width;
          canvas.height = source.image.height;
          const ctx = canvas.getContext('2d');
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(source.image, 0, 0);
          if (mode === 'alpha') {
            const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
            for (let at = 0; at < pixels.data.length; at += 4) {
              const alpha = pixels.data[at + 3];
              pixels.data[at] = alpha;
              pixels.data[at + 1] = alpha;
              pixels.data[at + 2] = alpha;
              pixels.data[at + 3] = 255;
            }
            ctx.putImageData(pixels, 0, 0);
          }
          if (mode === 'native') {
            canvas.style.width = `${canvas.width}px`;
            canvas.style.maxWidth = 'none';
          }
          surface.append(canvas);
        }
        if (isCurrent())
          surface.append(
            text(
              'small',
              `${source.descriptor.label} · ${source.origin.label} · ${source.fit} · source stage`,
              'bounded-label',
              'secondary',
            ),
          );
      } catch (error) {
        if (!isCurrent()) return;
        throw error;
      }
      return;
    }

    if (mode === 'context' && fieldSlot) {
      if (slot.group === 'pictures') {
        const controller = new AbortController();
        own(() => controller.abort());
        try {
          phase('loading exact picture owner metadata…', 'downloading');
          options.pictureOwner = await pictureOwnerContext(slot.id, { signal: controller.signal });
        } catch (error) {
          if (!isCurrent()) return;
          throw error;
        }
        if (!isCurrent()) return;
      }
      await boardContextPreview(surface, slot, asset, resolved, blobs, options, own);
      return;
    }
    if (asset.kind === 'recipe' && slot.id.startsWith('player.')) {
      await playerRecipePreview(surface, slot, resolved, blobs, options, own);
      return;
    }
    if (asset.kind === 'recipe' && slot.group === 'audio') {
      audioRecipePreview(surface, slot, own, { audioMaster });
      return;
    }
    if (asset.kind === 'recipe' && slot.group === 'effects') {
      effectRecipePreview(surface, slot, resolved, options, own);
      return;
    }
    if (asset.kind === 'recipe' && slot.id === 'terrain.wall') {
      await boardContextPreview(surface, slot, asset, resolved, blobs, options, own);
      return;
    }
    if (
      mode === 'context' &&
      (['screens', 'ui', 'icons'].includes(slot.group) || /^(hud|reward|control)\./.test(slot.id))
    ) {
      let url = null;
      if (blob) {
        phase('decoding the component artwork…', 'decoding');
        const bitmap = await createImageBitmap(blob),
          frame = asset.geometry.frame,
          canvas = document.createElement('canvas');
        canvas.width = frame.width;
        canvas.height = frame.height;
        canvas
          .getContext('2d')
          .drawImage(
            bitmap,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            0,
            0,
            frame.width,
            frame.height,
          );
        bitmap.close();
        url = canvas.toDataURL('image/png');
        if (!isCurrent()) return;
      }
      componentPreview(
        surface,
        slot,
        { ...options, assetGeometry: asset.geometry, tokens: resolved.tokens },
        url,
      );
      return;
    }
    if (asset.kind === 'image') {
      phase('decoding the asset image…', 'decoding');
      const bitmap = await createImageBitmap(blob);
      if (!isCurrent()) {
        bitmap.close();
        return;
      }
      const frame = asset.geometry.frame,
        canvas = document.createElement('canvas');
      const contextual = mode === 'context';
      canvas.width = contextual ? 320 : frame.width;
      canvas.height = contextual ? 200 : frame.height;
      canvas.setAttribute('aria-label', `${slot.label} ${mode} preview`);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = slot.sampling !== 'nearest';
      const scale = contextual ? Math.min(1, 140 / frame.width, 120 / frame.height) : 1;
      const x = contextual ? (320 - frame.width * scale) / 2 : 0,
        y = contextual ? (200 - frame.height * scale) / 2 : 0;
      if (contextual) field(ctx, palette);
      ctx.drawImage(
        bitmap,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        x,
        y,
        frame.width * scale,
        frame.height * scale,
      );
      bitmap.close();
      if (mode === 'alpha') {
        const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
        for (let at = 0; at < pixels.data.length; at += 4) {
          const a = pixels.data[at + 3];
          pixels.data[at] = a;
          pixels.data[at + 1] = a;
          pixels.data[at + 2] = a;
          pixels.data[at + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
      }
      if (geometry) drawGeometry(ctx, asset.geometry, x, y, scale);
      if (!contextual) {
        const displayScale =
          mode === 'native'
            ? 1
            : Math.max(1, Math.min(8, Math.floor(260 / Math.max(frame.width, frame.height))));
        canvas.style.width = `${frame.width * displayScale}px`;
        canvas.style.maxWidth = mode === 'native' ? 'none' : '100%';
      }
      surface.append(canvas);
      return;
    }
    if (slot.group === 'fonts') {
      const sample = text('div', '', 'recipe-sample');
      sample.append(
        text('p', t('tools:flightReady'), `font-${slot.id.split('.')[1]}`),
        text('p', 'Ґґ Єє Іі Її · 0123456789 ₴'),
        text('small', t('tools:bundledProductionFontSourceRecipe'), 'bounded-label', 'secondary'),
      );
      surface.append(sample);
      return;
    }
    if (
      slot.id.startsWith('enemy.') ||
      slot.id.startsWith('terrain.') ||
      slot.id.startsWith('pickup.')
    ) {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 200;
      const ctx = canvas.getContext('2d');
      field(ctx, palette);
      if (slot.id.startsWith('enemy.')) {
        const type = slot.id.slice(6),
          frames = createActorPresentation().sample(
            [{ id: 'preview', type, x: 10, y: 6, vx: 0, vy: 0 }],
            { paused: true, reduced: true, themeId: 'fpv' },
          );
        drawPresentedActor(ctx, frames.get('preview'), palette);
      }
      if (slot.id.startsWith('terrain.')) {
        const kind = slot.id.endsWith('slow') ? 'slow' : 'lethal';
        drawClassicTerrain(
          ctx,
          {
            terrain: Array.from({ length: 8 }, (_, i) => ({
              x: 7 + (i % 4),
              y: 5 + Math.floor(i / 4),
              kind,
            })),
          },
          palette,
        );
      }
      if (slot.id.startsWith('pickup.')) {
        ctx.translate(160, 100);
        ctx.scale(3, 3);
        ctx.fillStyle = palette.accent;
        const kind = pickupKinds[slot.id.slice(7)];
        if (kind) drawPickupIcon(ctx, kind);
        else {
          ctx.strokeStyle = palette.accent;
          ctx.lineWidth = 1;
          ctx.strokeRect(-6, -6, 12, 12);
          ctx.fillRect(-1, -4, 2, 8);
          ctx.fillRect(-4, -1, 8, 2);
        }
      }
      surface.append(
        canvas,
        text(
          'small',
          t('tools:boundedSampleActualGameDrawingHelper'),
          'bounded-label',
          'secondary',
        ),
      );
      return;
    }
    componentPreview(surface, slot, options);
  } catch (error) {
    if (!isCurrent()) return;
    failed = true;
    lease?.finish({ message: `${label}: ${error.message || error}`, state: 'error' });
    surface.replaceChildren(text('p', error.message || String(error), '', 'body'));
    if (cancelButton) {
      localizedText(cancelButton, () => t('common:preview.retry'));
      cancelButton.onclick = () =>
        drawAssetPreview(surface, slot, asset, resolved, blobs, settings);
    }
  } finally {
    if (isCurrent()) {
      surface.setAttribute('aria-busy', 'false');
      if (!failed) {
        lease?.finish({ message: `${label}: ${asset ? 'ready.' : t('tools:noAssetBound')}` });
        if (cancelButton) cancelButton.hidden = true;
      }
    }
  }
}
function prepareFont(asset, blob, resolved) {
  const family = `RLAsset-${asset.file.sha256}`,
    descriptors = presentationFontDescriptors(resolved, asset.file.sha256),
    [minimum, maximum = minimum] = descriptors.weight.split(' ').map(Number);
  const existing = fonts.get(family);
  if (existing) {
    const lower = Math.min(existing.minimum, minimum),
      upper = Math.max(existing.maximum, maximum);
    if (lower !== existing.minimum || upper !== existing.maximum) {
      // A failed descriptor update must leave the previous registration usable.
      if (existing.face) existing.face.weight = fontWeightRange(lower, upper);
      existing.minimum = lower;
      existing.maximum = upper;
    }
    return existing.pending;
  }
  const entry = { minimum, maximum, face: null, pending: null };
  // Publish one shared request before byte reading can invoke another consumer.
  entry.pending = Promise.resolve()
    .then(async () => {
      const bytes = await blob.arrayBuffer();
      entry.face = new FontFace(family, bytes, {
        ...descriptors,
        weight: fontWeightRange(entry.minimum, entry.maximum),
      });
      const font = await entry.face.load();
      document.fonts.add(font);
      return font;
    })
    .catch((error) => {
      if (fonts.get(family) === entry) fonts.delete(family);
      throw error;
    });
  fonts.set(family, entry);
  return entry.pending;
}
function fontWeightRange(minimum, maximum) {
  return minimum === maximum ? String(minimum) : `${minimum} ${maximum}`;
}
function field(ctx, palette) {
  ctx.fillStyle = palette.field;
  ctx.fillRect(0, 0, 320, 200);
  ctx.strokeStyle = palette.grid;
  ctx.lineWidth = 1;
  for (let x = 0; x <= 320; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 200);
    ctx.stroke();
  }
  for (let y = 0; y <= 200; y += 16) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(320, y);
    ctx.stroke();
  }
  ctx.strokeStyle = palette.safe;
  ctx.strokeRect(16, 16, 288, 168);
}
function drawGeometry(ctx, geometry, x, y, scale) {
  const w = geometry.frame.width * scale,
    h = geometry.frame.height * scale;
  ctx.save();
  ctx.lineWidth = Math.max(0.5, scale);
  ctx.strokeStyle = '#78dce8';
  const b = geometry.occupiedBounds;
  if (b) ctx.strokeRect(x + b.x * w, y + b.y * h, b.width * w, b.height * h);
  const p = geometry.pivot;
  ctx.fillStyle = '#f07879';
  ctx.fillRect(x + p.x * w - 1, y + p.y * h - 1, 2, 2);
  for (const rotor of geometry.rotorAnchors) {
    ctx.beginPath();
    ctx.arc(x + rotor.x * w, y + rotor.y * h, rotor.radius * Math.min(w, h), 0, Math.PI * 2);
    ctx.stroke();
  }
  const n = geometry.nineSlice;
  if (n) {
    ctx.strokeStyle = '#f4bf62';
    ctx.strokeRect(
      x + n.left * scale,
      y + n.top * scale,
      w - (n.left + n.right) * scale,
      h - (n.top + n.bottom) * scale,
    );
  }
  ctx.restore();
}
