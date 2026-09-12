import { PACKAGED_FUSES } from '../../package-security.mjs';

export function fakeFuseAPI() {
  let wire;
  return {
    calls: [],
    FuseVersion: { V1: '1' },
    FuseV1Options: Object.fromEntries(
      Object.keys(PACKAGED_FUSES).map((name, index) => [name, index]),
    ),
    FuseState: { DISABLE: 48, ENABLE: 49 },
    async flipFuses(target, config) {
      this.calls.push({ target, config });
      wire = {
        version: '1',
        ...Object.fromEntries(
          Object.entries(config)
            .filter(([key]) => /^\d+$/.test(key))
            .map(([key, value]) => [key, value ? 49 : 48]),
        ),
      };
    },
    async getCurrentFuseWire() {
      return { ...wire };
    },
  };
}
