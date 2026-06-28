/**
 * ESLint rule: no-direct-asset-require
 *
 * Forbids importing assets directly via `require('./assets/...')` or
 * `import x from '../assets/...'`. All asset imports must go through
 * `src/assets/manifest.ts`.
 */
'use strict';

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow direct require/import of asset files; use src/assets/manifest.ts instead.',
    },
    schema: [],
    messages: {
      noDirectAsset: 'Direct asset {{type}} is forbidden. Import via src/assets/manifest.ts instead.',
    },
  },
  create(context) {
    function checkString(node, value) {
      if (typeof value !== 'string') return;
      // Match require('../assets/...') or import from '../assets/...'
      if (/(^|\/)(assets)\//.test(value) && /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(value)) {
        context.report({ node, messageId: 'noDirectAsset', data: { type: node.type } });
      }
    }

    return {
      ImportDeclaration(node) {
        if (node.source && node.source.type === 'Literal') {
          checkString(node, node.source.value);
        }
        if (node.source && node.source.type === 'TemplateLiteral') {
          // Concatenated strings are harder to detect — skip for now
        }
      },
      CallExpression(node) {
        if (node.callee.name === 'require' && node.arguments.length > 0) {
          const arg = node.arguments[0];
          if (arg.type === 'Literal') {
            checkString(node, arg.value);
          }
        }
      },
    };
  },
};