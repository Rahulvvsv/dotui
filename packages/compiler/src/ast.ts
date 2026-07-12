/** Small, focused readers over Babel JSX nodes. No traversal logic lives here. */

import * as t from '@babel/types';
import type { ContentPart } from '@dotui/core';

export type ClassNameInfo = { value: string; dynamic: boolean };

/** Read a dot's direct children into content parts: static text or dynamic exprs. */
export function readContent(children: t.Node[], code: string, warnings: string[]): ContentPart[] {
  const parts: ContentPart[] = [];
  for (const child of children) {
    if (t.isJSXText(child)) {
      const value = child.value.trim();
      if (value) parts.push({ kind: 'static', value });
    } else if (t.isJSXExpressionContainer(child)) {
      if (t.isJSXEmptyExpression(child.expression)) continue;
      const { start, end } = child.expression;
      if (start == null || end == null) continue;
      parts.push({ kind: 'dynamic', expr: code.slice(start, end) });
    } else if (t.isJSXElement(child)) {
      warnings.push(`Nested <${elementName(child)}> inside a text dot is not captured as content.`);
    }
  }
  return parts;
}

/** The `dot.<kind>` member name of an opening element, or null if not a dot. */
export function dotKindOf(opening: t.JSXOpeningElement): string | null {
  const name = opening.name;
  if (!t.isJSXMemberExpression(name)) return null;
  if (!t.isJSXIdentifier(name.object) || name.object.name !== 'dot') return null;
  if (!t.isJSXIdentifier(name.property)) return null;
  return name.property.name;
}

export function isDotElement(node: t.JSXElement): boolean {
  return dotKindOf(node.openingElement) !== null;
}

/** Human-readable tag text for warnings (e.g. "div", "Foo", "dot.text"). */
export function elementName(node: t.JSXElement): string {
  const name = node.openingElement.name;
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXMemberExpression(name) && t.isJSXIdentifier(name.property)) {
    const obj = t.isJSXIdentifier(name.object) ? name.object.name : '?';
    return `${obj}.${name.property.name}`;
  }
  return '<expr>';
}

function findAttr(opening: t.JSXOpeningElement, attr: string): t.JSXAttribute | undefined {
  return opening.attributes.find(
    (a): a is t.JSXAttribute =>
      t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === attr,
  );
}

/** Read a static `className`. Non-static expressions yield { value:'', dynamic:true }. */
export function readClassName(opening: t.JSXOpeningElement): ClassNameInfo {
  const attr = findAttr(opening, 'className');
  if (!attr || !attr.value) return { value: '', dynamic: false };
  if (t.isStringLiteral(attr.value)) return { value: attr.value.value, dynamic: false };
  if (t.isJSXExpressionContainer(attr.value)) {
    const expr = attr.value.expression;
    if (t.isStringLiteral(expr)) return { value: expr.value, dynamic: false };
    if (t.isTemplateLiteral(expr) && expr.expressions.length === 0) {
      return { value: expr.quasis[0]?.value.cooked ?? '', dynamic: false };
    }
    return { value: '', dynamic: true };
  }
  return { value: '', dynamic: true };
}

/** Read a static string-valued prop (used for `type` and `description`). */
export function readStringProp(opening: t.JSXOpeningElement, name: string): string | undefined {
  const attr = findAttr(opening, name);
  if (!attr || !attr.value) return undefined;
  if (t.isStringLiteral(attr.value)) return attr.value.value;
  if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression)) {
    return attr.value.expression.value;
  }
  return undefined;
}

/** Read a boolean prop: bare `required` → true, `required={false}` → false, absent → false. */
export function readBooleanProp(opening: t.JSXOpeningElement, name: string): boolean {
  const attr = findAttr(opening, name);
  if (!attr) return false;
  if (!attr.value) return true; // bare attribute, e.g. <dot.button required>
  if (t.isJSXExpressionContainer(attr.value) && t.isBooleanLiteral(attr.value.expression)) {
    return attr.value.expression.value;
  }
  if (t.isStringLiteral(attr.value)) return attr.value.value !== 'false' && attr.value.value !== '';
  return true;
}
