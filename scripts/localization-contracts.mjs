/** Static message contracts. Unknown runtime values are reported, never guessed. */
import { parse as parseJS } from 'acorn';
import { parse as parseHTML } from 'parse5';

export function isTranslationKeyLiteral(value, namespaces) {
  if (typeof value !== 'string' || !/^[A-Za-z]\w*:\w+(?:\.\w+)*$/.test(value)) return false;
  return !namespaces || namespaces.includes(value.split(':')[0]);
}
export function parseCatalog(source, file = 'catalog.json') {
  const value = JSON.parse(source);
  const tree = parseJS(`(${source})`, { ecmaVersion: 'latest', locations: true });
  function visit(node) {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ObjectExpression') {
      const keys = new Set();
      for (const property of node.properties) {
        const key = property.key.value;
        if (keys.has(key))
          throw new Error(`Duplicate catalog key: ${file}:${property.loc.start.line}: ${key}`);
        keys.add(key);
      }
    }
    for (const item of Object.values(node)) {
      if (Array.isArray(item)) item.forEach(visit);
      else if (item && typeof item === 'object') visit(item);
    }
  }
  visit(tree);
  if (
    !value ||
    Array.isArray(value) ||
    typeof value !== 'object' ||
    Object.values(value).some((text) => typeof text !== 'string' || !text.trim())
  )
    throw new Error(`Invalid catalog: ${file}: expected a flat object of nonempty messages.`);
  return value;
}
const children = (node) =>
  Object.entries(node)
    .filter(([key]) => !['loc', 'start', 'end'].includes(key))
    .flatMap(([, value]) => (Array.isArray(value) ? value : [value]))
    .filter((value) => value?.type);
const translatorNames = new Set(['t', 'localizedMessage']);
const importedTranslatorNames = new Set([...translatorNames, 'message']);
const propertyName = (node) => (node?.computed ? node.property?.value : node?.property?.name);
const parameterName = (node) => (node?.type === 'AssignmentPattern' ? node.left?.name : node?.name);
const unique = (items) => [...new Set(items)];
export const interpolationArguments = (text) =>
  unique([...text.matchAll(/\{\{\s*-?\s*([^},\s]+)(?:[^}]*?)\}\}/g)].map((match) => match[1]));
function boundNames(pattern) {
  if (!pattern) return [];
  if (pattern.type === 'Identifier') return [pattern.name];
  if (pattern.type === 'RestElement') return boundNames(pattern.argument);
  if (pattern.type === 'AssignmentPattern') return boundNames(pattern.left);
  if (pattern.type === 'ArrayPattern') return pattern.elements.flatMap(boundNames);
  if (pattern.type === 'ObjectPattern')
    return pattern.properties.flatMap((property) =>
      boundNames(property.type === 'RestElement' ? property.argument : property.value),
    );
  return [];
}

export function inspectTranslationSource(source, file, resources) {
  const namespaces = Object.keys(resources.en);
  const references = [];
  const issues = [];
  const unverified = [];
  const add = (key, node) => {
    if (typeof key === 'string') references.push({ key, file, line: node.loc?.start.line || 1 });
  };
  if (file.endsWith('.html')) {
    function visit(node) {
      for (const attribute of node.attrs || [])
        if (
          /^data-i18n(?:$|-(?:rich|aria-label|title|placeholder|alt|content|data-menu-label)$)/.test(
            attribute.name,
          )
        )
          references.push({
            key: attribute.value,
            file,
            line: node.sourceCodeLocation?.startLine || 1,
          });
      node.childNodes?.forEach(visit);
      if (node.content) visit(node.content);
    }
    visit(parseHTML(source, { sourceCodeLocationInfo: true }));
    return { references, issues, unverified };
  }
  const tree = parseJS(source, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
  const scopes = new WeakMap();
  const functions = new Map();
  function index(node, scope = null) {
    if (['FunctionDeclaration', 'ClassDeclaration'].includes(node.type) && node.id)
      scope?.bindings.set(node.id.name, { node });
    if (
      [
        'Program',
        'BlockStatement',
        'CatchClause',
        'ForStatement',
        'ForInStatement',
        'ForOfStatement',
      ].includes(node.type) ||
      /Function/.test(node.type)
    )
      scope = { parent: scope, bindings: new Map(), type: node.type };
    scopes.set(node, scope);
    if (node.type === 'CatchClause')
      for (const name of boundNames(node.param)) scope.bindings.set(name, { parameter: true });
    if (/Function/.test(node.type)) {
      functions.set(node, scope);
      if (node.id) scope.bindings.set(node.id.name, { node });
      for (const name of node.params.flatMap(boundNames))
        scope.bindings.set(name, { parameter: true });
    }
    if (node.type === 'ImportDeclaration') {
      for (const specifier of node.specifiers)
        scope.bindings.set(specifier.local.name, {
          translator:
            /(?:^|\/)i18n\/index\.mjs$/.test(node.source.value) &&
            importedTranslatorNames.has(specifier.imported?.name),
        });
    }
    if (node.type === 'VariableDeclaration')
      for (const declaration of node.declarations) {
        let owner = scope;
        if (node.kind === 'var')
          while (owner.parent && owner.type !== 'Program' && !/Function/.test(owner.type))
            owner = owner.parent;
        if (declaration.id.type === 'Identifier')
          owner.bindings.set(declaration.id.name, {
            node: declaration.init,
            mutable: node.kind !== 'const',
          });
        else
          for (const name of boundNames(declaration.id))
            owner.bindings.set(name, { mutable: true });
      }
    for (const child of children(node)) index(child, scope);
  }
  index(tree);
  const binding = (node, name = node.name) => {
    for (let scope = scopes.get(node); scope; scope = scope.parent)
      if (scope.bindings.has(name)) return scope.bindings.get(name);
    return null;
  };
  function markWrites(node) {
    const target =
      node.type === 'AssignmentExpression'
        ? node.left
        : node.type === 'UpdateExpression'
          ? node.argument
          : null;
    let owner = target;
    while (owner?.type === 'MemberExpression') owner = owner.object;
    if (owner?.type === 'Identifier') {
      const value = binding(owner);
      if (value) value.mutable = true;
    }
    children(node).forEach(markWrites);
  }
  markWrites(tree);
  function translator(node, seen = new Set()) {
    if (node?.type === 'Identifier') {
      const definition = binding(node);
      if (!definition) return translatorNames.has(node.name); // Existing classic-script callers.
      if (definition.translator) return true;
      if (definition.mutable || !definition.node || seen.has(definition)) return false;
      seen.add(definition);
      return translator(definition.node, seen);
    }
    if (node?.type === 'MemberExpression')
      return (
        ['t', 'message'].includes(propertyName(node)) &&
        (node.object?.name === 'RevealLineI18n' || propertyName(node.object) === 'RevealLineI18n')
      );
    return false;
  }
  function resolve(node, seen = new Set()) {
    if (node?.type === 'Identifier') {
      const value = binding(node);
      if (!value?.node || value.mutable || seen.has(value)) return node;
      seen.add(value);
      return resolve(value.node, seen);
    }
    if (
      node?.type === 'CallExpression' &&
      node.callee?.object?.name === 'Object' &&
      propertyName(node.callee) === 'freeze'
    )
      return resolve(node.arguments[0], seen);
    return node;
  }
  function keys(node, seen = new Set()) {
    node = resolve(node);
    if (!node || seen.has(node)) return null;
    seen = new Set(seen).add(node);
    if (node.type === 'Literal' && typeof node.value === 'string') return [node.value];
    if (node.type === 'TemplateLiteral' && !node.expressions.length)
      return [node.quasis[0].value.cooked];
    if (node.type === 'ConditionalExpression') {
      const left = keys(node.consequent, seen),
        right = keys(node.alternate, seen);
      return left && right ? unique([...left, ...right]) : null;
    }
    if (node.type === 'MemberExpression') {
      const object = resolve(node.object),
        name = propertyName(node);
      if (
        object?.type === 'ObjectExpression' &&
        object.properties.every((p) => p.type === 'Property' && !p.computed && p.kind === 'init')
      ) {
        const entries =
          name === undefined
            ? object.properties
            : object.properties.filter((p) => (p.key.name ?? p.key.value) === name);
        const values = entries.map((p) => keys(p.value, seen));
        return entries.length && values.every(Boolean) ? unique(values.flat()) : null;
      }
    }
    return null;
  }
  const wrappers = new Map(),
    wrapperBodies = new Set();
  for (const fn of functions.keys()) {
    const body =
      fn.body.type === 'BlockStatement' &&
      fn.body.body.length === 1 &&
      fn.body.body[0].type === 'ReturnStatement'
        ? fn.body.body[0].argument
        : fn.body;
    if (body?.type !== 'CallExpression' || !translator(body.callee)) continue;
    const key = body.arguments[0],
      parameter = parameterName(fn.params[0]);
    let prefix;
    if (
      key?.type === 'TemplateLiteral' &&
      key.expressions.length === 1 &&
      key.expressions[0].name === parameter &&
      key.quasis[1].value.cooked === ''
    )
      prefix = key.quasis[0].value.cooked;
    if (
      key?.type === 'BinaryExpression' &&
      key.operator === '+' &&
      typeof key.left.value === 'string' &&
      key.right.name === parameter
    )
      prefix = key.left.value;
    if (
      prefix &&
      namespaces.includes(prefix.split(':')[0]) &&
      /^[A-Za-z]\w*:(?:\w+\.)*$/.test(prefix)
    ) {
      const values = body.arguments[1];
      if (values && (values.type !== 'Identifier' || parameterName(fn.params[1]) !== values.name))
        continue;
      wrappers.set(fn, { prefix, forwardsValues: !!values });
      wrapperBodies.add(body);
    }
  }
  const issue = (node, key, missing) =>
    issues.push({
      file,
      line: node.loc.start.line,
      kind: 'missing-arguments',
      key,
      missing,
      message: `Missing interpolation argument${missing.length === 1 ? '' : 's'} for ${key}: ${missing.join(', ')}`,
    });
  function hasArgument(node, parts) {
    node = resolve(node);
    if (!node) return false;
    if (node.type === 'Literal' || node.type === 'ArrayExpression') return false;
    if (node.type !== 'ObjectExpression') return null;
    let unknown = false,
      found;
    for (const property of node.properties) {
      if (property.type === 'SpreadElement') {
        const result = hasArgument(property.argument, parts);
        if (result === true) found = true;
        else if (result === null) unknown = true;
      } else if (property.computed && property.key.type !== 'Literal') unknown = true;
      else if ((property.key.name ?? property.key.value) === parts[0])
        found = parts.length === 1 ? true : hasArgument(property.value, parts.slice(1));
    }
    return found === true ? true : unknown || found === null ? null : false;
  }
  function visit(node) {
    if (node.type === 'Literal' && isTranslationKeyLiteral(node.value, namespaces))
      add(node.value, node);
    const markup =
      node.type === 'TemplateElement'
        ? node.value.cooked
        : typeof node.value === 'string'
          ? node.value
          : '';
    for (const match of (markup || '').matchAll(
      /data-i18n(?:-(?:rich|aria-label|title|placeholder|alt|content|data-menu-label))?=["']([^"']+)["']/g,
    ))
      add(match[1], node);
    if (node.type === 'CallExpression' && !wrapperBodies.has(node)) {
      const wrapper = wrappers.get(resolve(node.callee));
      if (translator(node.callee) || wrapper) {
        let selected = keys(node.arguments[0]);
        if (wrapper && selected) selected = selected.map((key) => wrapper.prefix + key);
        if (!selected)
          unverified.push({
            file,
            line: node.loc.start.line,
            kind: 'dynamic-key',
            message: 'Dynamic translation key needs a finite registry and runtime coverage.',
          });
        else
          for (const key of selected) {
            add(key, node);
            const [namespace, name] = key.split(':');
            const entries = resources.en[namespace];
            const variants = ['zero', 'one', 'two', 'few', 'many', 'other']
              .map((suffix) => entries?.[`${name}_${suffix}`])
              .filter((text) => typeof text === 'string');
            const texts = [entries?.[name], ...variants].filter((text) => typeof text === 'string');
            if (!texts.length) continue;
            const required = unique(texts.flatMap(interpolationArguments));
            if (!entries[name] && variants.length) required.push('count');
            const args = wrapper && !wrapper.forwardsValues ? undefined : node.arguments[1];
            const missing = unique(
              required.filter((arg) => hasArgument(args, arg.split('.')) === false),
            );
            if (missing.length) issue(node, key, missing);
            if (required.some((arg) => hasArgument(args, arg.split('.')) === null))
              unverified.push({
                file,
                line: node.loc.start.line,
                kind: 'dynamic-arguments',
                key,
                message: 'Dynamic interpolation values need runtime coverage.',
              });
          }
      }
    }
    children(node).forEach(visit);
  }
  visit(tree);
  return { references, issues, unverified };
}
