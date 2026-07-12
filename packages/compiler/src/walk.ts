/**
 * The single source of truth for id assignment. Both `dotui build` (schema
 * extraction) and the Babel plugin (runtime stamping) call `assignDotIds`, so an
 * element's id is identical at build time and at render time — the guarantee that
 * lets a generated overlay map back onto the right live element.
 *
 * Worked example — this source file:
 *
 *   // profile.panel.tsx
 *   export function Profile() {
 *     return (
 *       <dot.panel className="flex">
 *         <dot.text>Ada</dot.text>
 *         <dot.text>Lovelace</dot.text>
 *         {friends.map((f) => (
 *           <dot.panel key={f.id}>
 *             <dot.badge>{f.name}</dot.badge>
 *           </dot.panel>
 *         ))}
 *       </dot.panel>
 *     );
 *   }
 *
 * produces these ids (scope "profile" comes from the file name; `#n` is the index
 * among same-kind static siblings; `~n` marks an expression-nested element):
 *
 *   profile/panel#0                    ← the root panel
 *   profile/panel#0/text#0             ← "Ada"
 *   profile/panel#0/text#1             ← "Lovelace"
 *   profile/panel#0/panel~0            ← the friend-card TEMPLATE (repeated)
 *   profile/panel#0/panel~0/badge#0    ← the badge inside each card
 *
 * A template is ONE source element rendered N times: the plugin's single stamp
 * lands on every instance, and an overlay patch on its id styles all of them.
 * Static `#` counters never see expression-nested dots, so adding or removing a
 * `.map()` cannot shift any existing static id.
 */

import * as t from '@babel/types';
import { PANEL_KIND, isDotKind } from '@dotui/core';
import { dotKindOf, isDotElement } from './ast';
import { makeId, makeSegment } from './ids';

/**
 * Find the top-level `dot.*` elements: dot elements with no dot ancestor.
 *
 * JSX can appear anywhere an expression can — a return statement, a ternary, an
 * array literal, a callback argument — so there is no fixed list of statement
 * shapes to check. Instead we walk every AST child (Babel's VISITOR_KEYS table
 * tells us, per node type, exactly which properties hold child nodes) and stop
 * descending at the first dot element we meet: everything beneath it belongs to
 * `assignDotIds`, not to this search.
 */
export function findRootDots(nodes: t.Node[]): t.JSXElement[] {
  const roots: t.JSXElement[] = [];
  const visit = (node: t.Node): void => {
    if (t.isJSXElement(node) && isDotElement(node)) {
      roots.push(node);
      return; // its subtree is walked by assignDotIds
    }
    for (const child of childrenOf(node)) visit(child);
  };
  for (const node of nodes) visit(node);
  return roots;
}

/** The AST child nodes of `node`, read via Babel's own per-type child-key table. */
function childrenOf(node: t.Node): t.Node[] {
  const children: t.Node[] = [];
  for (const key of t.VISITOR_KEYS[node.type] ?? []) {
    const value = (node as unknown as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      for (const item of value) if (isAstNode(item)) children.push(item);
    } else if (isAstNode(value)) {
      children.push(value);
    }
  }
  return children;
}

function isAstNode(value: unknown): value is t.Node {
  return typeof value === 'object' && value !== null && 'type' in value;
}

export type DotIdAssignment = {
  /** Every known dot element mapped to its structural id. */
  ids: Map<t.JSXElement, string>;
  /** Elements beneath a function boundary — one source element, N rendered instances. */
  repeated: Set<t.JSXElement>;
  /** Dots inside expression shapes we do not descend; extract.ts warns about these. */
  unsupported: t.JSXElement[];
};

/**
 * Map every known dot element in these trees to its structural id.
 *
 * Rules:
 * - Only panels recurse; a non-panel dot's children are content.
 * - Static children count per parent AND per kind in the `#` namespace.
 * - Expression children (JSXExpressionContainer) are descended through a fixed
 *   set of shapes (see `descendExpression`); dots found there count in the
 *   separate `~` namespace, so static ids can never shift. Crossing a function
 *   boundary (a `.map()` callback) marks the dot — and its subtree — `repeated`.
 * - A dot reachable only through an unsupported shape gets NO id and is
 *   reported in `unsupported` so the build can warn instead of silently
 *   producing an unstyleable element.
 * - Unknown kinds (e.g. a typo like `dot.txt`) get no id; extract.ts warns.
 */
export function assignDotIds(roots: t.JSXElement[], scope: string): DotIdAssignment {
  const out: DotIdAssignment = { ids: new Map(), repeated: new Set(), unsupported: [] };

  const assign = (
    node: t.JSXElement,
    parents: string[],
    counters: Map<string, number>,
    marker: '#' | '~',
    repeated: boolean,
  ): void => {
    const kind = dotKindOf(node.openingElement);
    if (!kind || (kind !== PANEL_KIND && !isDotKind(kind))) return;

    const counterKey = kind + marker; // '#' and '~' count independently per parent
    const index = counters.get(counterKey) ?? 0;
    counters.set(counterKey, index + 1);
    const segment = makeSegment(kind, index, marker);
    out.ids.set(node, makeId(scope, parents, segment));
    if (repeated) out.repeated.add(node);

    if (kind !== PANEL_KIND) return;
    const childCounters = new Map<string, number>();
    for (const child of node.children) {
      if (t.isJSXElement(child) && isDotElement(child)) {
        assign(child, [...parents, segment], childCounters, '#', repeated);
      } else if (t.isJSXExpressionContainer(child)) {
        descendExpression(child, [...parents, segment], childCounters, repeated);
      }
    }
  };

  /**
   * Bounded descent through a panel's expression child. Supported shapes:
   * function bodies (crossing one ⇒ repeated), ternary branches, the right side
   * of `&&`/`||`/`??`, inline-function call arguments, JSX fragments, and nested
   * expression containers. Afterwards, any dot inside the expression that the
   * bounded descent did NOT reach is recorded as unsupported.
   */
  const descendExpression = (
    container: t.JSXExpressionContainer,
    parents: string[],
    counters: Map<string, number>,
    repeated: boolean,
  ): void => {
    const reached = new Set<t.JSXElement>();

    const descend = (node: t.Node, crossedFn: boolean): void => {
      if (t.isJSXElement(node)) {
        if (isDotElement(node)) {
          reached.add(node);
          assign(node, parents, counters, '~', repeated || crossedFn);
        }
        return; // non-dot JSX is not descended (same rule as static children)
      }
      if (t.isJSXFragment(node)) {
        for (const child of node.children) descend(child, crossedFn);
        return;
      }
      if (t.isJSXExpressionContainer(node)) {
        descend(node.expression, crossedFn);
        return;
      }
      if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
        if (t.isBlockStatement(node.body)) {
          for (const stmt of node.body.body) {
            if (t.isReturnStatement(stmt) && stmt.argument) descend(stmt.argument, true);
          }
        } else {
          descend(node.body, true);
        }
        return;
      }
      if (t.isConditionalExpression(node)) {
        descend(node.consequent, crossedFn);
        descend(node.alternate, crossedFn);
        return;
      }
      if (t.isLogicalExpression(node)) {
        descend(node.right, crossedFn);
        return;
      }
      if (t.isCallExpression(node)) {
        for (const arg of node.arguments) {
          if (t.isArrowFunctionExpression(arg) || t.isFunctionExpression(arg)) {
            descend(arg, crossedFn);
          }
        }
        return;
      }
      // Any other shape: not descended; the completeness check below reports its dots.
    };

    descend(container.expression, false);

    for (const dotEl of findRootDots([container])) {
      if (!reached.has(dotEl)) out.unsupported.push(dotEl);
    }
  };

  const rootCounters = new Map<string, number>();
  for (const root of roots) assign(root, [], rootCounters, '#', false);
  return out;
}
