/** A renderer's animation clock must never capture an imported translator. */
export const noShadowedTranslator = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      shadowed: 'Translation call resolves to a local variable instead of the imported translator.',
    },
  },
  create(context) {
    return {
      'Program:exit'() {
        const source = context.sourceCode;
        const translator = source.scopeManager.scopes
          .flatMap((scope) => scope.variables)
          .find(
            (variable) =>
              variable.name === 't' &&
              variable.defs.some(
                (definition) =>
                  definition.type === 'ImportBinding' &&
                  /\/i18n\/index\.mjs$/.test(definition.parent.source.value),
              ),
          );
        if (!translator) return;
        for (const scope of source.scopeManager.scopes) {
          for (const reference of scope.references) {
            const node = reference.identifier;
            const parent = source.getAncestors(node).at(-1);
            if (
              node.name === 't' &&
              parent?.type === 'CallExpression' &&
              parent.callee === node &&
              reference.resolved !== translator
            ) {
              context.report({ node, messageId: 'shadowed' });
            }
          }
        }
      },
    };
  },
};
