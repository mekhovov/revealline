import { t, localizedText } from '../../game/i18n/index.mjs';
import {
  presentationGeometryControls,
  validateAssetRevision,
} from '../../game/presentation/model.mjs';
import { imagePresentation } from '../../game/presentation/runtime.mjs';

const fail = (key) => {
  throw new Error(t(`tools:studio.rotors.${key}`));
};
const number = (value) => {
  if (String(value).trim() === '' || !Number.isFinite(Number(value))) fail('numberRequired');
  return Number(value);
};

/** Edit one existing normalized anchor, retaining blades and absent legacy fields.
 * The host still validates the complete slot binding before accepting a preview. */
export function editStudioRotorAnchor(asset, index, values) {
  if (asset?.kind !== 'image' || !Number.isInteger(index) || !asset.geometry?.rotorAnchors[index])
    fail('unavailable');
  const next = structuredClone(asset);
  const anchor = next.geometry.rotorAnchors[index];
  for (const key of ['x', 'y', 'radius']) anchor[key] = number(values[key]);
  if (values.direction === 'inherit') delete anchor.direction;
  else {
    if (!['1', '-1'].includes(String(values.direction))) fail('directionRequired');
    anchor.direction = Number(values.direction);
  }
  if (String(values.phaseDegrees).trim() === '') delete anchor.phaseDegrees;
  else anchor.phaseDegrees = number(values.phaseDegrees);
  // This is the production record validator, including complete envelopes,
  // duplicate centers and unknown/malformed anchor fields.
  return validateAssetRevision(next).geometry.rotorAnchors;
}

/** Controls belong to one prepared candidate and one accepted geometry view.
 * Advanced edits must pass their existing Apply action before replacing it. */
export function mountStudioRotorControls({ document, getContext, onApply, onError }) {
  const $ = (id) => document.getElementById(id);
  const ids = ['hub', 'x', 'y', 'radius', 'direction', 'phase', 'apply'];
  let snapshot = null;
  let index = 0;
  let disposed = false;
  const current = (expected = snapshot) => {
    const context = getContext();
    if (
      disposed ||
      !expected ||
      context.owner !== expected.owner ||
      context.asset !== expected.asset ||
      context.slot?.id !== expected.slot?.id ||
      JSON.stringify(context.asset?.geometry) !== expected.geometry
    )
      fail('stale');
    if (context.geometryText !== expected.geometryText) fail('applyAdvancedFirst');
    return context;
  };
  function showHub() {
    const asset = snapshot?.asset;
    const anchor = asset?.geometry?.rotorAnchors[index];
    if (!anchor) return;
    for (const key of ['x', 'y', 'radius']) $(`rotor-${key}`).value = anchor[key];
    $('rotor-direction').value = Object.hasOwn(anchor, 'direction')
      ? String(anchor.direction)
      : 'inherit';
    $('rotor-phase').value = Object.hasOwn(anchor, 'phaseDegrees') ? anchor.phaseDegrees : '';
    localizedText($('rotor-controls-status'), () => {
      const effective = imagePresentation(asset).rotors[index];
      return t('tools:studio.rotors.effective', {
        direction: t(
          effective.direction === 1 ? 'tools:studio.rotors.cw' : 'tools:studio.rotors.ccw',
        ),
        phase: effective.phaseDegrees,
        blades: anchor.blades,
      });
    });
  }
  function refresh() {
    if (disposed) return;
    const context = getContext();
    const supported =
      context.asset?.kind === 'image' &&
      !!context.slot &&
      presentationGeometryControls(context.slot).rotors;
    const anchors = supported ? context.asset.geometry.rotorAnchors : [];
    if (snapshot?.owner !== context.owner) index = 0;
    index = Math.min(index, Math.max(0, anchors.length - 1));
    snapshot = { ...context, geometry: JSON.stringify(context.asset?.geometry) };
    $('rotor-controls').hidden = !supported;
    for (const id of ids) $(`rotor-${id}`).disabled = !supported || !anchors.length;
    $('rotor-hub').replaceChildren(
      ...anchors.map((_, i) => {
        const option = document.createElement('option');
        option.value = String(i);
        localizedText(option, () => t('tools:studio.rotors.hubNumber', { number: i + 1 }));
        return option;
      }),
    );
    $('rotor-hub').value = String(index);
    if (anchors.length) showHub();
    else {
      for (const id of ['x', 'y', 'radius', 'phase']) $(`rotor-${id}`).value = '';
      $('rotor-direction').value = 'inherit';
      localizedText($('rotor-controls-status'), () => t('tools:studio.rotors.noHubs'));
    }
  }
  $('rotor-hub').onchange = () => {
    try {
      current();
      const selected = Number($('rotor-hub').value);
      if (!Number.isInteger(selected) || !snapshot.asset.geometry.rotorAnchors[selected])
        fail('unavailable');
      index = selected;
      showHub();
    } catch (error) {
      $('rotor-hub').value = String(index);
      onError(error);
    }
  };
  $('rotor-apply').onclick = async () => {
    try {
      const expected = snapshot;
      const context = current();
      const anchors = editStudioRotorAnchor(context.asset, index, {
        x: $('rotor-x').value,
        y: $('rotor-y').value,
        radius: $('rotor-radius').value,
        direction: $('rotor-direction').value,
        phaseDegrees: $('rotor-phase').value,
      });
      await onApply(anchors, () => current(expected));
    } catch (error) {
      onError(error);
    }
  };
  refresh();
  return {
    refresh,
    dispose() {
      disposed = true;
      snapshot = null;
      $('rotor-hub').onchange = null;
      $('rotor-apply').onclick = null;
    },
  };
}
