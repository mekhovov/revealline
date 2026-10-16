import { OVERFLIGHT_HUNT_MODE } from '../overflight/raid-mode.mjs';
import {
  createOverflightRaidVariant,
  OVERFLIGHT_RAID_VARIANTS,
} from '../overflight/raid-variants.mjs';

export const normalizeRaidPreviewOperation = (value) =>
  OVERFLIGHT_RAID_VARIANTS.includes(value) ? value : 'overflight-hunt';

export function raidStudioPreviewMode(operation) {
  const variant = normalizeRaidPreviewOperation(operation);
  return variant === 'overflight-hunt'
    ? OVERFLIGHT_HUNT_MODE
    : createOverflightRaidVariant(OVERFLIGHT_HUNT_MODE, { variant });
}

export function raidStudioRuntimePath(operation, { studio = false, community = null } = {}) {
  const params = new URLSearchParams();
  const selected = normalizeRaidPreviewOperation(operation);
  if (selected !== 'overflight-hunt') params.set('operation', selected);
  if (studio) params.set('studio', 'overflight-hunt');
  if (community) params.set('community', community);
  return `../overflight/raid.html${params.size ? `?${params}` : ''}`;
}
