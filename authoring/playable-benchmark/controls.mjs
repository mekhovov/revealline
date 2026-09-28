import { attachInput } from '../../game/ui/input.mjs';

export function attachBenchmarkInput({ arena, active, onPause, onGamepad, touchMode }) {
  return attachInput({
    arena,
    active,
    onPause,
    onGamepad,
    continuousSteering: () => true,
    getTouchSettings: () => ({ mode: touchMode() }),
  });
}
