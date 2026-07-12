/**
 * Parses one `*.panel.tsx` source into a SchemaFile fragment. Ids come solely from
 * the shared `assignDotIds` walk, so the schema's ids are identical to the ones the
 * Babel plugin stamps onto the live elements.
 */

import { parse } from '@babel/parser';
import * as t from '@babel/types';
import {
  ALLOWED_ELEMENTS,
  ALLOWED_FAMILIES,
  DEFAULT_ELEMENT,
  type DotNode,
  PANEL_KIND,
  type PanelNode,
  SCHEMA_VERSION,
  type SchemaFile,
} from '@dotui/core';
import {
  type ClassNameInfo,
  dotKindOf,
  elementName,
  isDotElement,
  readBooleanProp,
  readClassName,
  readContent,
  readStringProp,
} from './ast';
import { scopeFromFile } from './ids';
import { type DotIdAssignment, assignDotIds, findRootDots } from './walk';

export type ExtractResult = { schema: SchemaFile; warnings: string[] };

type Ctx = {
  code: string;
  assignment: DotIdAssignment;
  panels: Record<string, PanelNode>;
  dots: Record<string, DotNode>;
  authorClasses: Set<string>;
  warnings: string[];
};

export function extractFile(filePath: string, code: string): ExtractResult {
  const ast = parse(code, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const scope = scopeFromFile(filePath);
  const roots = findRootDots(ast.program.body);

  const ctx: Ctx = {
    code,
    assignment: assignDotIds(roots, scope),
    panels: {},
    dots: {},
    authorClasses: new Set(),
    warnings: [],
  };
  for (const root of roots) recordElement(root, ctx);

  for (const el of ctx.assignment.unsupported) {
    ctx.warnings.push(
      `<${elementName(el)}> is inside an unsupported expression and is not addressable — it renders, but overlays cannot target it. Supported: .map()/callback bodies, ternaries, &&/||/??. Author it statically to style it.`,
    );
  }

  const schema: SchemaFile = {
    version: SCHEMA_VERSION,
    panels: ctx.panels,
    dots: ctx.dots,
    palette: { seededFromAuthor: [...ctx.authorClasses].sort(), families: [...ALLOWED_FAMILIES] },
  };
  return { schema, warnings: ctx.warnings };
}

/** Record one dot element into the schema under its assigned id; returns the id (or null for unknown kinds, which get a warning at the call site). */
function recordElement(node: t.JSXElement, ctx: Ctx): string | null {
  const id = ctx.assignment.ids.get(node);
  if (!id) return null;
  const kind = dotKindOf(node.openingElement) as string;

  const cls = readClassName(node.openingElement);
  addClasses(ctx.authorClasses, cls);
  const typeAttr = readStringProp(node.openingElement, 'type');
  const description = readStringProp(node.openingElement, 'description');

  if (kind === PANEL_KIND) {
    ctx.panels[id] = {
      id,
      kind: 'panel',
      element: DEFAULT_ELEMENT.panel,
      className: cls.value,
      dynamicClassName: cls.dynamic,
      ...(description ? { description } : {}),
      ...(ctx.assignment.repeated.has(node) ? { repeated: true as const } : {}),
      children: recordPanelChildren(node.children, ctx),
    };
    return id;
  }

  ctx.dots[id] = {
    id,
    kind: kind as DotNode['kind'],
    element: resolveElement(kind, typeAttr, ctx),
    className: cls.value,
    dynamicClassName: cls.dynamic,
    required: readBooleanProp(node.openingElement, 'required'),
    ...(description ? { description } : {}),
    ...(ctx.assignment.repeated.has(node) ? { repeated: true as const } : {}),
    content: readContent(node.children, ctx.code, ctx.warnings),
  };
  return id;
}

/** Record a panel's direct children, in order. Non-dot elements still render at runtime but are not addressable, so they only produce a warning. */
function recordPanelChildren(children: t.Node[], ctx: Ctx): string[] {
  const ids: string[] = [];
  for (const child of children) {
    if (t.isJSXElement(child)) {
      if (!isDotElement(child)) {
        ctx.warnings.push(`<${elementName(child)}> inside a panel renders but is not addressable.`);
        continue;
      }
      const id = recordElement(child, ctx);
      if (id) ids.push(id);
      else ctx.warnings.push(`Unknown dot kind "${elementName(child)}" ignored.`);
    } else if (t.isJSXExpressionContainer(child)) {
      // Dots the walk reached inside this expression (templates/conditionals), in
      // source order. Unreached dots are already queued as unsupported warnings.
      for (const el of findRootDots([child])) {
        if (!ctx.assignment.ids.has(el)) {
          // Reached by the walk but given no id and not queued as an unsupported
          // shape ⇒ unknown dot kind. Warn exactly like the static path does.
          if (!ctx.assignment.unsupported.includes(el)) {
            ctx.warnings.push(`Unknown dot kind "${elementName(el)}" ignored.`);
          }
          continue;
        }
        const id = recordElement(el, ctx);
        if (id) ids.push(id);
      }
    }
  }
  return ids;
}

function resolveElement(kind: string, typeAttr: string | undefined, ctx: Ctx): string {
  const fallback = DEFAULT_ELEMENT[kind as keyof typeof DEFAULT_ELEMENT] ?? 'div';
  const allowed = ALLOWED_ELEMENTS[kind as keyof typeof ALLOWED_ELEMENTS];
  // Only kinds with tag variants interpret `type`; elsewhere it's a passthrough
  // DOM prop (e.g. <dot.input type="email">), so we ignore it for the element.
  if (!allowed || !typeAttr) return fallback;
  if (allowed.includes(typeAttr)) return typeAttr;
  ctx.warnings.push(`type="${typeAttr}" not allowed for dot.${kind}; using ${fallback}.`);
  return fallback;
}

function addClasses(set: Set<string>, cls: ClassNameInfo): void {
  for (const token of cls.value.split(/\s+/)) if (token) set.add(token);
}
