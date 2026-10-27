const documents = Object.freeze({
  'authoring/library/route-worlds/build.mjs':
    'authoring/production/source-documents/4c58707b50a13b4b9a6086065d027143d106b234ff066ff5f98fcc4872e61664.txt',
  'authoring/library/sentinel-circuit-external/build.mjs':
    'authoring/production/source-documents/06bca8ebd9572d52671a336c02db986f5a50dae266ad5b5bff4097ca5f319cfb.txt',
});

/** Display-only aliases resolve the selected source body without distributing
 * its executable producer or importing its Node-only dependency graph. */
export function productionSourceDocumentPath(path) {
  return Object.hasOwn(documents, path) ? documents[path] : path;
}
