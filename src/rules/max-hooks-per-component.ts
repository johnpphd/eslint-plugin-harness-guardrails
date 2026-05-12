import type { Rule } from "eslint";

type Node = { type: string; [key: string]: unknown };

type FunctionLike = Rule.Node & {
  type:
    | "FunctionDeclaration"
    | "FunctionExpression"
    | "ArrowFunctionExpression";
  id?: { type: string; name: string } | null;
  body: Node;
  params: Node[];
  async?: boolean;
};

const HOOK_NAME = /^use[A-Z]/;
const COMPONENT_NAME = /^[A-Z]/;

function resolveComponentName(node: Rule.Node): string | null {
  if (
    (node.type === "FunctionDeclaration" ||
      node.type === "FunctionExpression") &&
    "id" in node &&
    node.id &&
    node.id.type === "Identifier"
  ) {
    return node.id.name;
  }
  const parent = node.parent;
  if (
    parent &&
    parent.type === "VariableDeclarator" &&
    parent.id.type === "Identifier"
  ) {
    return parent.id.name;
  }
  return null;
}

function isJSXNode(node: Node | null | undefined): boolean {
  if (!node) return false;
  // JSXElement / JSXFragment are not part of estree's union, but appear at runtime.
  return node.type === "JSXElement" || node.type === "JSXFragment";
}

function isFunctionLike(node: Node): boolean {
  return (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  );
}

/**
 * Walk children of `node` depth-first, invoking `visit` on each descendant.
 * Stops descending whenever `visit` returns false. Skips primitive props and
 * the `parent` back-reference.
 */
function walk(node: Node, visit: (n: Node) => boolean): void {
  const keys = Object.keys(node) as (keyof Node)[];
  for (const key of keys) {
    if (key === "parent" || key === "loc" || key === "range") continue;
    const value = (node as unknown as Record<string, unknown>)[key as string];
    if (!value) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === "object" && "type" in item) {
          const child = item as Node;
          if (visit(child)) {
            walk(child, visit);
          }
        }
      }
    } else if (typeof value === "object" && "type" in (value as object)) {
      const child = value as Node;
      if (visit(child)) {
        walk(child, visit);
      }
    }
  }
}

function returnsJSX(fn: FunctionLike): boolean {
  // Arrow with expression body: body is the expression itself.
  if (fn.type === "ArrowFunctionExpression" && isJSXNode(fn.body)) {
    return true;
  }
  let found = false;
  walk(fn.body, (child) => {
    if (found) return false;
    // Do not descend into nested function scopes.
    if (isFunctionLike(child)) return false;
    if (child.type === "ReturnStatement") {
      const arg = (child as { argument?: Node | null }).argument;
      if (isJSXNode(arg)) {
        found = true;
        return false;
      }
    }
    return true;
  });
  return found;
}

function isHookCall(node: Node): boolean {
  if (node.type !== "CallExpression") return false;
  const callee = (node as unknown as { callee: Node }).callee;
  if (callee.type === "Identifier") {
    return HOOK_NAME.test((callee as unknown as { name: string }).name);
  }
  if (callee.type === "MemberExpression") {
    const prop = (callee as unknown as { property: Node }).property;
    if (prop.type === "Identifier") {
      return HOOK_NAME.test((prop as unknown as { name: string }).name);
    }
  }
  return false;
}

function countHooks(fn: FunctionLike): number {
  let count = 0;
  walk(fn.body, (child) => {
    // Do not descend into nested function scopes; they own their own hook count.
    if (isFunctionLike(child)) return false;
    if (isHookCall(child)) {
      count += 1;
    }
    return true;
  });
  return count;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Cap the number of React hook calls in a component to keep state ownership manageable",
    },
    messages: {
      tooManyHooks:
        "Component {{name}} uses {{count}} hooks; cap is {{max}}. Split state-heavy logic into a sub-component or a custom hook.",
    },
    schema: [
      {
        type: "object",
        properties: {
          max: { type: "number", minimum: 1 },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as { max?: number };
    const max = typeof options.max === "number" ? options.max : 10;

    function check(node: Rule.Node): void {
      const fn = node as unknown as FunctionLike;
      const name = resolveComponentName(node);
      if (!name) return;
      const first = name.charCodeAt(0);
      // Heuristic: components are PascalCase (first char A-Z).
      if (!(first >= 65 && first <= 90)) return;
      if (!COMPONENT_NAME.test(name)) return;
      if (!returnsJSX(fn)) return;

      const count = countHooks(fn);
      if (count > max) {
        context.report({
          node,
          messageId: "tooManyHooks",
          data: {
            name,
            count: String(count),
            max: String(max),
          },
        });
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
    };
  },
};

export default rule;
