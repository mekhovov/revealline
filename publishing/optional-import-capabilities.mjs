/** The generated iOS bridge is the one computed optional-package import capability.
 * Match its complete syntax and declared owner without resolving or executing it. */
export function isOptionalNativeBridgeImport(owner, node, policy) {
  const source = node.source,
    url = source?.object,
    base = url?.arguments?.[1];
  return (
    owner === 'game/platform.mjs' &&
    node.type === 'ImportExpression' &&
    node.options == null &&
    node.phase == null &&
    source?.type === 'MemberExpression' &&
    source.computed === false &&
    source.optional === false &&
    source.property?.type === 'Identifier' &&
    source.property.name === 'href' &&
    url?.type === 'NewExpression' &&
    url.callee?.type === 'Identifier' &&
    url.callee.name === 'URL' &&
    url.arguments.length === 2 &&
    url.arguments[0]?.type === 'Literal' &&
    url.arguments[0].value === '../native/bridge.mjs' &&
    base?.type === 'MemberExpression' &&
    base.computed === false &&
    base.optional === false &&
    base.property?.type === 'Identifier' &&
    base.property.name === 'url' &&
    base.object?.type === 'MetaProperty' &&
    base.object.meta?.type === 'Identifier' &&
    base.object.meta.name === 'import' &&
    base.object.property?.type === 'Identifier' &&
    base.object.property.name === 'meta' &&
    policy?.coreOnlyImports?.some(
      (entry) => entry.from === owner && entry.source === '../native/bridge.mjs',
    ) === true
  );
}
