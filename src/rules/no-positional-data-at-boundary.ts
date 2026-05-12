import type { Rule } from "eslint";
import { minimatch } from "minimatch";

type Node = { type: string; [key: string]: unknown };

const DEFAULT_GLOBS = ["**/data/**", "**/api/**", "**/agents/**/tools/**"];
const DEFAULT_MAX_TUPLE_LENGTH = 3;
const DEFAULT_DOMAIN_NAME_PATTERN = "Row$|Record$|Fields$";

type Options = {
  globs?: string[];
  maxTupleLength?: number;
  domainNamePattern?: string;
};

function matchesAnyGlob(filename: string, globs: string[]): boolean {
  return globs.some((g) => minimatch(filename, g));
}

function resolveFunctionName(node: Rule.Node): string | null {
  const generic = node as unknown as Node;
  if (
    (generic.type === "FunctionDeclaration" ||
      generic.type === "FunctionExpression" ||
      generic.type === "TSDeclareFunction") &&
    "id" in generic &&
    generic.id &&
    (generic.id as Node).type === "Identifier"
  ) {
    return (generic.id as unknown as { name: string }).name;
  }
  if (generic.type === "TSMethodSignature") {
    const key = (generic as unknown as { key?: Node | null }).key;
    if (key && key.type === "Identifier") {
      return (key as unknown as { name: string }).name;
    }
  }
  const parent = node.parent;
  if (
    parent &&
    parent.type === "VariableDeclarator" &&
    parent.id.type === "Identifier"
  ) {
    return parent.id.name;
  }
  if (
    parent &&
    parent.type === "Property" &&
    (parent as unknown as { key: Node }).key.type === "Identifier"
  ) {
    return (parent as unknown as { key: { name: string } }).key.name;
  }
  return null;
}

function getReturnTypeNode(node: Rule.Node): Node | null {
  const returnType = (node as unknown as { returnType?: Node | null })
    .returnType;
  if (!returnType || returnType.type !== "TSTypeAnnotation") return null;
  const inner = (returnType as unknown as { typeAnnotation?: Node | null })
    .typeAnnotation;
  return inner ?? null;
}

const rule: Rule.RuleModule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Forbid functions in boundary modules from returning positional arrays (any[], unknown[], unnamed tuples > max, domain-positional string[])",
    },
    messages: {
      anyArray:
        "Function {{name}} in a boundary module returns {{shape}}; use a typed struct or interface.",
      unknownArray:
        "Function {{name}} in a boundary module returns {{shape}}; use a typed struct or interface.",
      unnamedTuple:
        "Function {{name}} returns a {{count}}-element unnamed tuple at a boundary; name the positions or use a typed struct.",
      domainStringArray:
        "Function {{name}} returns string[] at a boundary; domain rows must use a typed struct.",
    },
    schema: [
      {
        type: "object",
        properties: {
          globs: { type: "array", items: { type: "string" } },
          maxTupleLength: { type: "number" },
          domainNamePattern: { type: "string" },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = (context.options[0] ?? {}) as Options;
    const globs = options.globs ?? DEFAULT_GLOBS;
    const maxTupleLength =
      typeof options.maxTupleLength === "number"
        ? options.maxTupleLength
        : DEFAULT_MAX_TUPLE_LENGTH;
    const domainPattern = new RegExp(
      options.domainNamePattern ?? DEFAULT_DOMAIN_NAME_PATTERN,
      "i"
    );

    const filename = context.filename;
    if (!filename || !matchesAnyGlob(filename, globs)) {
      return {};
    }

    function check(node: Rule.Node): void {
      const typeNode = getReturnTypeNode(node);
      if (!typeNode) return;
      const name = resolveFunctionName(node) ?? "<anonymous>";
      const reportNode = typeNode as unknown as Rule.Node;

      if (typeNode.type === "TSArrayType") {
        const element = (typeNode as unknown as { elementType: Node })
          .elementType;
        if (element.type === "TSAnyKeyword") {
          context.report({
            node: reportNode,
            messageId: "anyArray",
            data: { name, shape: "any[]" },
          });
          return;
        }
        if (element.type === "TSUnknownKeyword") {
          context.report({
            node: reportNode,
            messageId: "unknownArray",
            data: { name, shape: "unknown[]" },
          });
          return;
        }
        if (element.type === "TSStringKeyword" && domainPattern.test(name)) {
          context.report({
            node: reportNode,
            messageId: "domainStringArray",
            data: { name },
          });
          return;
        }
      }

      if (typeNode.type === "TSTupleType") {
        const elementTypes = (typeNode as unknown as { elementTypes: Node[] })
          .elementTypes;
        if (elementTypes.length > maxTupleLength) {
          const hasNamed = elementTypes.some(
            (el) => el.type === "TSNamedTupleMember"
          );
          if (!hasNamed) {
            context.report({
              node: reportNode,
              messageId: "unnamedTuple",
              data: { name, count: String(elementTypes.length) },
            });
          }
        }
      }
    }

    return {
      FunctionDeclaration: check,
      FunctionExpression: check,
      ArrowFunctionExpression: check,
      TSDeclareFunction: check,
      TSMethodSignature: check,
      TSFunctionType: check,
    };
  },
};

export default rule;
