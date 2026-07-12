/**
 * Babel plugin: stamps `__dotId="<structural id>"` onto every `dot.*` element using
 * the shared `assignDotIds` walk. Wired into the app's build, it makes each live
 * element carry the exact id the schema uses, so overlays map back unambiguously.
 */

import * as t from '@babel/types';
import { scopeFromFile } from './ids';
import { assignDotIds, findRootDots } from './walk';

const ID_ATTR = '__dotId';

type ProgramPath = { node: t.Program };
type PluginState = { file: { opts: { filename?: string | null } } };

export function dotuiBabelPlugin() {
  return {
    name: 'dotui-stamp-ids',
    visitor: {
      Program(path: ProgramPath, state: PluginState): void {
        const scope = scopeFromFile(state.file.opts.filename ?? 'panel');
        const roots = findRootDots(path.node.body);
        if (roots.length === 0) return;
        const { ids } = assignDotIds(roots, scope);
        for (const [node, id] of ids) stampId(node, id);
      },
    },
  };
}

function stampId(node: t.JSXElement, id: string): void {
  const { attributes } = node.openingElement;
  const present = attributes.some(
    (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name) && attr.name.name === ID_ATTR,
  );
  if (present) return;
  attributes.push(t.jsxAttribute(t.jsxIdentifier(ID_ATTR), t.stringLiteral(id)));
}
