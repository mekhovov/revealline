// Fixture-only observation. No GL queries, state changes or shader substitutions.
export function observeNativePrograms(context) {
  const proto = window.WebGL2RenderingContext?.prototype;
  if (!proto) throw Error("Native WebGL2 observation unavailable");
  const records = [],
    shaders = new WeakMap(),
    programs = new WeakMap(),
    restore = [];
  let sequence = 0,
    dropped = 0;
  const define = (source, name) =>
    source
      .match(
        new RegExp("^#define " + name + "(?:[ \\t]+([^\\n]*))?$", "m"),
      )?.[1]
      ?.trim() ?? null;
  const signature = (source) => ({
    sourceCharacters: source.length,
    shaderType: define(source, "SHADER_TYPE"),
    shaderName: define(source, "SHADER_NAME"),
    outputTransfer:
      source.match(
        /vec4 linearToOutputTexel\( vec4 value \)\s*\{\s*return (\w+)/,
      )?.[1] ?? null,
    toneMapping:
      source.match(
        /vec3 toneMapping\( vec3 color \)\s*\{\s*return (\w+)/,
      )?.[1] ?? null,
    defines: source
      .split("\n")
      .filter((line) =>
        /^#define (?:USE_MAP|USE_ALPHAMAP|USE_ALPHATEST|USE_INSTANCING|DOUBLE_SIDED|FLIP_SIDED|DEPTH_PACKING|USE_SHADOWMAP|SHADOWMAP_TYPE_\w+|TONE_MAPPING|USE_SKINNING|USE_MORPHTARGETS)(?:\s|$)/.test(
          line,
        ),
      )
      .slice(0, 24),
  });
  const wrap = (name, observe) => {
    const original = proto[name];
    const wrapped = function (...args) {
      const value = original.apply(this, args);
      observe.call(this, args, value);
      return value;
    };
    proto[name] = wrapped;
    restore.push(() => {
      if (proto[name] === wrapped) proto[name] = original;
    });
  };
  wrap("createShader", ([type], shader) => {
    if (shader)
      shaders.set(shader, {
        stage: type === 35633 ? "vertex" : type === 35632 ? "fragment" : type,
      });
  });
  wrap("shaderSource", ([shader, source]) => {
    const row = shaders.get(shader);
    if (row && typeof source === "string") row.signature = signature(source);
  });
  wrap("attachShader", ([program, shader]) => {
    const row = programs.get(program) ?? [];
    row.push(shader);
    programs.set(program, row);
  });
  wrap("linkProgram", function ([program]) {
    if (records.length >= 256) {
      dropped++;
      return;
    }
    records.push({
      sequence: ++sequence,
      at: performance.now(),
      canvas: this.canvas?.id ?? null,
      ...context(),
      shaders: (programs.get(program) ?? []).map((shader) => {
        const row = shaders.get(shader);
        return row ? structuredClone(row) : { unknown: true };
      }),
    });
  });
  return {
    records,
    get dropped() {
      return dropped;
    },
    restore() {
      restore.forEach((run) => run());
    },
  };
}
