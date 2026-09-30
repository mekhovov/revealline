/** Explicit opt-in package admission. New packages need a reviewed policy entry;
 * an uploaded archive cannot widen its own executable dependency allowance. */
const BASE_OPTIONAL_PACKAGE_POLICIES = Object.freeze({
  'civilian-flight': Object.freeze({
    root: 'optional-practice/civilian-flight/',
    entry: 'optional-practice/civilian-flight/index.html',
    limits: Object.freeze({ files: 64, bytes: 8 * 1024 * 1024 }),
    localFiles: Object.freeze([
      'index.html',
      'app.mjs',
      'model.mjs',
      'input.mjs',
      'catalogue.mjs',
      'copy.mjs',
      'offline.mjs',
      'style.css',
      'app.webmanifest',
      'README.md',
    ]),
    sharedFiles: Object.freeze([
      'optional-practice/install-context.mjs',
      'game/data-json.mjs',
      'game/key-bindings.mjs',
      'game/i18n/index.mjs',
      'game/i18n/bootstrap.mjs',
      'game/i18n/catalogs.mjs',
      'game/vendor/i18next-26.4.2.min.js',
      'game/vendor/I18NEXT-LICENSE.txt',
    ]),
    template: 'optional-practice/civilian-flight/worker-template.mjs',
    launcherTemplate: 'optional-practice/launcher-template.mjs',
    localeInputs: Object.freeze(['game/locales/en/errors.json', 'game/locales/uk/errors.json']),
    licenses: Object.freeze([
      {
        dependency: 'i18next',
        version: '26.4.2',
        license: 'MIT',
        path: 'game/vendor/I18NEXT-LICENSE.txt',
      },
    ]),
  }),
  'civilian-fpv': Object.freeze({
    root: 'optional-practice/civilian-fpv/',
    entry: 'optional-practice/civilian-fpv/index.html',
    limits: Object.freeze({ files: 64, bytes: 8 * 1024 * 1024 }),
    localFiles: Object.freeze([
      'index.html',
      'app.mjs',
      'renderer.mjs',
      'world-visuals.mjs',
      'world-themes.mjs',
      'vendor/addons/loaders/GLTFLoader.js',
      'vendor/addons/controls/TransformControls.js',
      'vendor/addons/utils/BufferGeometryUtils.js',
      'vendor/addons/utils/SkeletonUtils.js',
      'vendor/addons/provenance.json',
      'input.mjs',
      'copy.mjs',
      'style.css',
      'app.webmanifest',
      'README.md',
      'radio-controls.mjs',
      'radio-profile.mjs',
      'radio-runtime.mjs',
      'radio-setup.mjs',
      'math.mjs',
      'rotation-table.mjs',
      'model.mjs',
      'catalogue.mjs',
      'demonstrations.mjs',
      'attempts.mjs',
      'notebook.mjs',
      'studio.mjs',
      'offline.mjs',
      'vendor/three.core.js',
      'vendor/three.module.js',
      'vendor/LICENSE.txt',
    ]),
    sharedFiles: Object.freeze([
      'optional-practice/install-context.mjs',
      'game/data-json.mjs',
      'game/fpv-entry.mjs',
      'game/key-bindings.mjs',
      'game/i18n/index.mjs',
      'game/i18n/bootstrap.mjs',
      'game/i18n/catalogs.mjs',
      'game/vendor/i18next-26.4.2.min.js',
      'game/vendor/I18NEXT-LICENSE.txt',
      'game/profile-storage.mjs',
      'game/profile-database.mjs',
      'game/rewards/store.mjs',
      'game/rewards/model.mjs',
      'game/rewards/audio-groups.mjs',
      'game/rewards/exploration.mjs',
      'game/rewards/learning-profiles.mjs',
      'game/ui/reward-knowledge.mjs',
    ]),
    template: 'optional-practice/worker-template.mjs',
    launcherTemplate: 'optional-practice/launcher-template.mjs',
    localeInputs: Object.freeze([
      'game/locales/en/errors.json',
      'game/locales/uk/errors.json',
      'game/locales/en/interface.json',
      'game/locales/uk/interface.json',
    ]),
    localeKeys: Object.freeze({ interface: Object.freeze(['learningProfiles.choose']) }),
    // Official npm tarball integrity verified before selecting these exact files.
    // Only these reviewed bytes may include dormant native network-loader code.
    vendorPins: Object.freeze([
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js',
        bytes: 117586,
        sha256: '03952cb129d558f92b8e6c757fbf7c1f718b3126c4d34f264d574b40ea36054f',
      }),
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/addons/controls/TransformControls.js',
        bytes: 51722,
        sha256: '10f6d3e4c108dff62110f61a76749f9a1826c9781df9c3eb4ca0b5d9d2f5c4a8',
      }),
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/addons/utils/BufferGeometryUtils.js',
        bytes: 37728,
        sha256: '259085a7dac89e0840393a9347c77123fbc4206ec2146bf0c29ffc72e14a2800',
      }),
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/addons/utils/SkeletonUtils.js',
        bytes: 11551,
        sha256: '28017bf37d0ecb0c4be6048db759ff14df729a562464830b064d4cc239c5af17',
      }),

      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/three.core.js',
        bytes: 1458113,
        sha256: '9edde002b066a9a05676a6127f67735b62baf399bdea529f2f7e31657da769e6',
      }),
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/three.module.js',
        bytes: 662772,
        sha256: '9052042d676cb0fdc1ddfefe193053f34b7ac0513a616fdac4535d49987812ea',
      }),
      Object.freeze({
        path: 'optional-practice/civilian-fpv/vendor/LICENSE.txt',
        bytes: 1081,
        sha256: '8b378ebe60e2fe500158cb0ac71cb5e8b7d92953c2abcc63a0eb90499653b5bc',
      }),
    ]),
    licenses: Object.freeze([
      {
        dependency: 'i18next',
        version: '26.4.2',
        license: 'MIT',
        path: 'game/vendor/I18NEXT-LICENSE.txt',
      },
      {
        dependency: 'three',
        version: '0.186.1',
        license: 'MIT',
        path: 'optional-practice/civilian-fpv/vendor/LICENSE.txt',
        source: 'https://registry.npmjs.org/three/-/three-0.186.1.tgz',
        integrity:
          'sha512-blFeqb49wRCSGUGj7gtpfnSGHy2lwDk94RhUmS1c/hTby70kvChbWpkJ4Pm1390LqzzvTmzgXKHPEafJwCb8jA==',
      },
    ]),
  }),
});

// The legacy 8 MiB / 64-file package stays independent. The world runtime is a
// separately selected application with its own explicit executable closure.
const legacyFPV = BASE_OPTIONAL_PACKAGE_POLICIES['civilian-fpv'];
export const OPTIONAL_PACKAGE_POLICIES = Object.freeze({
  ...BASE_OPTIONAL_PACKAGE_POLICIES,
  'fpv-worlds': Object.freeze({
    ...legacyFPV,
    root: 'optional-practice/fpv-worlds/',
    entry: 'optional-practice/fpv-worlds/index.html',
    limits: Object.freeze({ files: 96, bytes: 16 * 1024 * 1024 }),
    localFiles: Object.freeze([
      'index.html',
      'app.webmanifest',
      'README.md',
      'SCENERY-LICENSES.txt',
      'scenery-provenance.json',
    ]),
    sharedFiles: Object.freeze([
      ...legacyFPV.localFiles
        .filter((name) => !['index.html', 'app.mjs', 'app.webmanifest', 'README.md'].includes(name))
        .map((name) => legacyFPV.root + name),
      ...legacyFPV.sharedFiles,
      ...[
        'world-app.mjs',
        'world-demonstrations.mjs',
        'world-assets.mjs',
        'world-hangar.mjs',
        'world-actor-editor.mjs',
        'world-editor.mjs',
        'world-audio.mjs',
        'world-progress.mjs',
        'content-definitions.mjs',
        'world-catalogue.mjs',
        'world-collision.mjs',
        'world-model.mjs',
        'world-content.mjs',
        'world-store.mjs',
        'world-records.mjs',
        'world-style.css',
        'world-zip.mjs',
        'playlists.mjs',
        'vendor/rapier/rapier.mjs',
        'vendor/rapier/LICENSE',
        'vendor/rapier/provenance.json',
      ].map((name) => legacyFPV.root + name),
    ]),
    vendorPins: Object.freeze([
      ...legacyFPV.vendorPins,
      {
        path: 'optional-practice/civilian-fpv/vendor/rapier/rapier.mjs',
        bytes: 4340292,
        sha256: '02dc6a4e2fffc013bab08fbb44fa68f501d8303615e9afe4c7d89ad4eedda0d0',
      },
      {
        path: 'optional-practice/civilian-fpv/vendor/rapier/LICENSE',
        bytes: 11343,
        sha256: '4c05555705e3efde601fb1252ae48f1d63992af8a8fb8947745b7fa834e8f519',
      },
    ]),
    licenses: Object.freeze([
      ...legacyFPV.licenses,
      {
        dependency: 'Kenney Retro Urban Kit',
        version: '2021-03-20',
        license: 'CC0-1.0',
        path: 'optional-practice/fpv-worlds/SCENERY-LICENSES.txt',
        source: 'https://opengameart.org/content/retro-urban-kit',
      },
      {
        dependency: 'Kenney City Kit Industrial',
        version: '2.0',
        license: 'CC0-1.0',
        path: 'optional-practice/fpv-worlds/SCENERY-LICENSES.txt',
        source: 'https://kenney.nl/assets/city-kit-industrial',
      },
      {
        dependency: '@dimforge/rapier3d-compat',
        version: '0.21.0',
        license: 'Apache-2.0',
        path: 'optional-practice/civilian-fpv/vendor/rapier/LICENSE',
        source: 'https://registry.npmjs.org/@dimforge/rapier3d-compat/-/rapier3d-compat-0.21.0.tgz',
        integrity:
          'sha512-tCl1HPGwOhn5aCQbgqWbOH+Nx/5fnr3IPAnzQuR7zIhC/raqi2yxC6LhvZqjdI2El5hQgY5RDAwDrAjAi2FdPA==',
      },
    ]),
  }),
});

export function optionalRuntimePaths(policy, { launcher = false } = {}) {
  return [
    ...(launcher
      ? [
          'index.html',
          'app.mjs',
          'context.mjs',
          'app.webmanifest',
          'worker.js',
          'icons/icon-192.png',
          'icons/icon-512.png',
        ].map((name) => 'launcher/' + name)
      : []),
    ...policy.localFiles.map((name) => policy.root + name),
    ...policy.sharedFiles,
    ...[192, 512].map((size) => `${policy.root}icons/icon-${size}.png`),
    `${policy.root}worker.js`,
  ].sort();
}
