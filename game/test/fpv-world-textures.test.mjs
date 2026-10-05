import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { parse } from 'acorn';
import * as THREE from '../../optional-practice/civilian-fpv/vendor/three.module.js';
import { GLTFLoader } from '../../optional-practice/civilian-fpv/vendor/addons/loaders/GLTFLoader.js';
import { configureWorldGLTFLoader } from '../../optional-practice/civilian-fpv/renderer.mjs';
import * as visuals from '../../optional-practice/civilian-fpv/world-visuals.mjs';
import * as themes from '../../optional-practice/civilian-fpv/world-themes.mjs';
import { FLIGHT_COURSES } from '../../optional-practice/civilian-fpv/catalogue.mjs';
import { runtimeActorArtRevision } from '../hunt/preferences.mjs';
import {
  inspectImport,
  encodeWorldGLB,
} from '../../optional-practice/civilian-fpv/world-content.mjs';

const source = await fs.readFile(
  new URL('../../authoring/fpv-worlds/industrial-markings/r1/markings.glb', import.meta.url),
);
const png = await fs.readFile(
  new URL('../../authoring/fpv-worlds/industrial-markings/r1/markings.png', import.meta.url),
);
const buffer = (bytes) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
function parts(bytes = source) {
  const jsonLength = bytes.readUInt32LE(12);
  return {
    json: JSON.parse(bytes.subarray(20, 20 + jsonLength)),
    bin: bytes.subarray(28 + jsonLength),
  };
}

/** The protocol is real TextureLoader -> ImageLoader -> image.src. Only browser
 * image decoding is modeled; fetch(blob:) is explicitly forbidden like the CSP. */
function imageProtocol(t) {
  const descriptors = new Map(
    ['document', 'self', 'fetch', 'createImageBitmap'].map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
  const create = URL.createObjectURL,
    revoke = URL.revokeObjectURL,
    originalError = console.error;
  const blobs = new Map(),
    images = [],
    pending = [],
    requests = [],
    errors = [];
  let held = false;
  t.after(() => {
    URL.createObjectURL = create;
    URL.revokeObjectURL = revoke;
    console.error = originalError;
    for (const [key, descriptor] of descriptors)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    for (const url of blobs.keys()) revoke(url);
  });
  URL.createObjectURL = (blob) => {
    const url = create(blob);
    blobs.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    blobs.delete(url);
    revoke(url);
  };
  globalThis.self = globalThis;
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    throw Error('connect-src forbids blob/network requests in this fixture');
  };
  globalThis.createImageBitmap = async () => {
    throw Error('ImageBitmap fetch path must not be selected');
  };
  console.error = (...args) => errors.push(args);
  globalThis.document = {
    createElementNS(_namespace, name) {
      assert.equal(name, 'img');
      const listeners = new Map();
      const image = {
        addEventListener: (type, listener) => listeners.set(type, listener),
        removeEventListener: (type) => listeners.delete(type),
        set src(url) {
          const decode = async () => {
            try {
              const blob = blobs.get(url);
              assert.ok(blob, 'Every image must come from owned local bytes');
              this.bytes = Buffer.from(await blob.arrayBuffer());
              if (this.bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a')
                throw Error('Invalid PNG');
              this.width = this.bytes.readUInt32BE(16);
              this.height = this.bytes.readUInt32BE(20);
              this.complete = true;
              listeners.get('load')?.call(this);
            } catch (error) {
              listeners.get('error')?.call(this, error);
            }
          };
          images.push(image);
          if (held) pending.push(decode);
          else queueMicrotask(decode);
        },
      };
      return image;
    },
  };
  return {
    blobs,
    images,
    requests,
    errors,
    hold: () => {
      held = true;
    },
    release: async () => {
      held = false;
      await Promise.all(pending.splice(0).map((decode) => decode()));
    },
    pending,
  };
}

function watchResources(result) {
  const resources = new Map();
  for (const scene of result.scenes)
    scene.traverse((node) => {
      const values = [node.geometry, ...[node.material].flat()].filter(Boolean);
      for (const value of [
        ...values,
        ...values.flatMap((value) => Object.values(value).filter((item) => item?.isTexture)),
      ])
        if (!resources.has(value)) {
          resources.set(value, 0);
          value.addEventListener('dispose', () => resources.set(value, resources.get(value) + 1));
        }
    });
  return resources;
}

async function rendererFixture() {
  let module = await fs.readFile(
    new URL('../../optional-practice/civilian-fpv/renderer.mjs', import.meta.url),
    'utf8',
  );
  const ast = parse(module, { ecmaVersion: 'latest', sourceType: 'module' });
  for (const item of ast.body.filter((item) => item.type === 'ImportDeclaration').reverse())
    module = module.slice(0, item.start) + module.slice(item.end);
  module = module.replaceAll('export function ', 'function ');
  const results = [];
  class CaptureLoader extends GLTFLoader {
    async parseAsync(...args) {
      const value = await super.parseAsync(...args);
      results.push({ value, released: watchResources(value) });
      return value;
    }
  }
  class Renderer {
    constructor() {
      this.shadowMap = {};
      this.capabilities = { getMaxAnisotropy: () => 4 };
      this.info = { programs: [], memory: {}, render: {} };
    }
    dispose() {}
    forceContextLoss() {}
    getContext() {
      return { isContextLost: () => false };
    }
    setPixelRatio() {}
    setSize() {}
  }
  const create = vm.runInNewContext(`${module}; createFlightRenderer`, {
    ...themes,
    ...visuals,
    runtimeActorArtRevision,
    Blob,
    URL,
    ArrayBuffer,
    Uint8Array,
    DataView,
    TextDecoder,
    TextEncoder,
    structuredClone,
    THREE: { ...THREE, WebGLRenderer: Renderer },
    buildWorldVisuals: ({ course, presentation }) => ({
      theme: themes.resolveSimThemeProfile(course, presentation).palette,
      profile: themes.resolveSimThemeProfile(course, presentation),
      indoor: true,
      center: [0, 0],
      width: 20,
      depth: 20,
    }),
    createEnvironmentLight: () => ({ texture: null, dispose() {} }),
    buildDroneVisual: ({ material }) => ({ tint: material(0xffffff), rotors: [] }),
  });
  const renderer = create({
    canvas: {
      addEventListener() {},
      removeEventListener() {},
      ownerDocument: { createElement: () => ({ getContext: () => null }) },
    },
    window: { devicePixelRatio: 1 },
    loadGLTF: async () => ({ GLTFLoader: CaptureLoader }),
  });
  renderer.setCourse(FLIGHT_COURSES[0]);
  return { renderer, results };
}

test('real GLTFLoader reproduces blocked bitmap fetch and the shared decoder preserves exact PNG/material semantics', async (t) => {
  const protocol = imageProtocol(t);
  const old = await new GLTFLoader().parseAsync(buffer(source), '');
  assert.equal(old.scene.getObjectByProperty('isMesh', true).material.map, null);
  assert.equal(protocol.requests.length, 1);
  for (const root of old.scenes)
    root.traverse((node) => {
      node.geometry?.dispose();
      node.material?.dispose();
    });
  for (const url of [...protocol.blobs.keys()]) URL.revokeObjectURL(url);
  protocol.requests.length = 0;
  const current = await configureWorldGLTFLoader(new GLTFLoader()).parseAsync(buffer(source), '');
  const paint = current.scene.getObjectByProperty('isMesh', true).material;
  assert.deepEqual(paint.map.image.bytes, png);
  assert.equal(paint.map.colorSpace, THREE.SRGBColorSpace);
  assert.equal(paint.map.flipY, false);
  assert.equal(paint.map.magFilter, THREE.LinearFilter);
  assert.equal(paint.map.minFilter, THREE.LinearMipmapLinearFilter);
  assert.equal(paint.map.wrapS, THREE.ClampToEdgeWrapping);
  assert.equal(paint.alphaTest, 0.5);
  assert.equal(paint.roughness, 0.86);
  assert.equal(paint.metalness, 0);
  assert.equal(protocol.requests.length, 0);
  assert.equal(protocol.blobs.size, 0);
  for (const resource of watchResources(current).keys()) resource.dispose();
});

test('actual import repacks local sidecars and renderer keeps valid imported texture, rejected scene ownership and bounds atomic', async (t) => {
  const protocol = imageProtocol(t),
    { renderer, results } = await rendererFixture();
  t.after(() => renderer.dispose());
  const { json, bin } = parts();
  json.buffers[0].uri = 'mesh.bin';
  delete json.images[0].bufferView;
  json.images[0].uri = 'markings.png';
  const inspected = await inspectImport({
    files: { 'world.gltf': JSON.stringify(json), 'mesh.bin': bin, 'markings.png': png },
    entry: 'world.gltf',
  });
  assert.equal(inspected.document.images[0].uri, undefined);
  assert.equal(inspected.metadata.colliders.length, 0);
  const before = JSON.stringify(FLIGHT_COURSES[0]);
  const good = await renderer.loadScene(inspected.modelBlob);
  assert.equal(good.materialBindings.applied, 0);
  const first = results[0],
    registration = renderer.resources().registered;
  assert.deepEqual(
    first.value.scene.getObjectByProperty('isMesh', true).material.map.image.bytes,
    png,
  );
  assert.ok(first.value.scene.parent);
  const corrupted = parts(),
    badBin = Buffer.from(corrupted.bin);
  badBin[corrupted.json.bufferViews[corrupted.json.images[0].bufferView].byteOffset] = 0;
  await assert.rejects(
    renderer.loadScene(encodeWorldGLB(corrupted.json, badBin)),
    /image could not be decoded/,
  );
  assert.equal(first.value.scene.parent !== null, true);
  assert.deepEqual(renderer.resources().registered, registration);
  assert.ok([...first.released.values()].every((count) => count === 0));
  assert.ok([...results[1].released.values()].every((count) => count === 1));
  assert.equal(protocol.blobs.size, 0);
  assert.equal(protocol.requests.length, 0);
  assert.equal(JSON.stringify(FLIGHT_COURSES[0]), before);
  renderer.dispose();
  assert.ok([...first.released.values()].every((count) => count === 1));
});

test('late image success after cancellation is released, and unprovided remote images never reach a decoder', async (t) => {
  const protocol = imageProtocol(t),
    { renderer, results } = await rendererFixture();
  t.after(() => renderer.dispose());
  await renderer.loadScene(source);
  const registration = renderer.resources().registered,
    controller = new AbortController();
  protocol.hold();
  const pending = renderer.loadScene({ data: source, signal: controller.signal });
  const deadline = Date.now() + 2000;
  while (!protocol.pending.length && Date.now() < deadline)
    await new Promise((resolve) => setImmediate(resolve));
  assert.ok(protocol.pending.length, 'Image request must start within the bounded wait');
  controller.abort();
  await protocol.release();
  await assert.rejects(pending, /aborted/);
  assert.deepEqual(renderer.resources().registered, registration);
  assert.ok([...results[1].released.values()].every((count) => count === 1));
  assert.equal(protocol.blobs.size, 0);
  const { json, bin } = parts();
  delete json.images[0].bufferView;
  json.images[0].uri = 'https://unprovided.invalid/texture.png';
  const count = protocol.images.length;
  await assert.rejects(
    renderer.loadScene(encodeWorldGLB(json, bin)),
    /unprovided external resource/,
  );
  assert.equal(protocol.images.length, count);
  assert.equal(protocol.requests.length, 0);
});

test('decoded imported art stays authored under themes and only exact explicit node bindings replace a material', async (t) => {
  imageProtocol(t);
  const { renderer, results } = await rendererFixture();
  t.after(() => renderer.dispose());
  renderer.setPresentation({ collectionId: 'industrial-workshop', revision: 'r1' });
  renderer.setCourse(FLIGHT_COURSES[0]);
  assert.equal((await renderer.loadScene(source)).materialBindings.applied, 0);
  const authored = results[0].value.scene.getObjectByProperty('isMesh', true);
  assert.deepEqual(authored.material.map.image.bytes, png);
  const { json, bin } = parts(),
    node = json.nodes.find((node) => node.mesh !== undefined);
  node.extras = {
    ...node.extras,
    reveallineTheme: {
      format: 'SimMaterialBinding.v1',
      collectionId: 'industrial-workshop',
      revision: 'r1',
      role: 'steel',
      allowTransparencyReplacement: true,
    },
  };
  assert.equal((await renderer.loadScene(encodeWorldGLB(json, bin))).materialBindings.applied, 1);
  const bound = results[1].value.scene.getObjectByName(node.name);
  assert.equal(bound.material.userData.materialRole, 'steel');
  assert.equal(bound.material.map.name, 'workshop-steel-r1');
  assert.ok([...results[0].released.values()].every((count) => count === 1));
  node.extras.reveallineTheme.revision = 'r999';
  const unavailable = await renderer.loadScene(encodeWorldGLB(json, bin));
  assert.equal(unavailable.materialBindings.applied, 0);
  assert.equal(unavailable.materialBindings.diagnostics[0].code, 'revision-unavailable');
  assert.deepEqual(results[2].value.scene.getObjectByName(node.name).material.map.image.bytes, png);
  assert.deepEqual(
    [...bound.geometry.attributes.position.array],
    [...results[2].value.scene.getObjectByName(node.name).geometry.attributes.position.array],
  );
});
