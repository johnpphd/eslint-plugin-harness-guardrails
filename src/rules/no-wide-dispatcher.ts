import type { Rule } from "eslint";

type Node = { type: string; [key: string]: unknown };

const DEFAULT_MAX = 30;

const NAME_HEURISTIC = /(?:Map|Handlers|Shapers|Dispatch)$/i;
const TABLE_TYPE_NAMES = new Set(["Record", "Map", "WeakMap", "ReadonlyMap"]);

function isTableTypeAnnotation(declaratorId: Node | null | undefined): boolean {
  if (!declaratorId || declaratorId.type !== "Identifier") return false;
  const typeAnnotation = (
    declaratorId as unknown as { typeAnnotation?: Node | null }
  ).typeAnnotation;
  if (!typeAnnotation || typeAnnotation.type !== "TSTypeAnnotation") {
    return false;
  }
  const inner = (typeAnnotation as unknown as { typeAnnotation?: Node | null })
    .typeAnnotation;
  if (!inner || inner.type !== "TSTypeReference") return false;
  const typeName = (inner as unknown as { typeName?: Node | null }).typeName;
  if (!typeName || typeName.type !== "Identifier") return false;
  const name = (typeName as unknown as { name: string }).name;
  return TABLE_TYPE_NAMES.has(name);
}

function declaratorName(declaratorId: Node | null | undefined): string | null {
  if (!declaratorId || declaratorId.type !== "Identifier") return null;
  return (declaratorId as unknown as { name: string }).name;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Cap the number of branches in a switch statement or dispatch-table object literal",
    },
    messages: {
      tooWide:
        "Dispatcher has {{count}} branches; cap is {{max}}. Split per-case into separate modules.",
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
    const max = typeof options.max === "number" ? options.max : DEFAULT_MAX;

    return {
      SwitchStatement(node) {
        const cases = (node as unknown as { cases: Node[] }).cases;
        if (cases.length > max) {
          context.report({
            node,
            messageId: "tooWide",
            data: { count: String(cases.length), max: String(max) },
          });
        }
      },
      VariableDeclarator(node) {
        const init = (node as unknown as { init?: Node | null }).init;
        if (!init || init.type !== "ObjectExpression") return;
        const properties = (init as unknown as { properties: Node[] })
          .properties;
        if (properties.length <= max) return;

        const id = (node as unknown as { id: Node }).id;

        if (isTableTypeAnnotation(id)) {
          context.report({
            node: init as unknown as Rule.Node,
            messageId: "tooWide",
            data: { count: String(properties.length), max: String(max) },
          });
          return;
        }

        const name = declaratorName(id);
        if (name && NAME_HEURISTIC.test(name)) {
          context.report({
            node: init as unknown as Rule.Node,
            messageId: "tooWide",
            data: { count: String(properties.length), max: String(max) },
          });
        }
      },
    };
  },
};

export default rule;
