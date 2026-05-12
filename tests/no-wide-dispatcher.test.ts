import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../src/rules/no-wide-dispatcher.js";
import "./setup.js";

const tsParserImport = await import("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParserImport,
  },
});

function switchCases(n: number): string {
  return Array.from(
    { length: n },
    (_, i) => `    case ${i}: { result = ${i}; break; }`
  ).join("\n");
}

function objectEntries(n: number): string {
  return Array.from({ length: n }, (_, i) => `  key${i}: () => ${i},`).join(
    "\n"
  );
}

ruleTester.run("no-wide-dispatcher", rule, {
  valid: [
    // 1. SwitchStatement with exactly 30 cases (boundary).
    {
      filename: "boundary.ts",
      code: `function pick(x: number) {
  let result = 0;
  switch (x) {
${switchCases(30)}
  }
  return result;
}`,
    },
    // 2. Small Record<string, Handler> literal with 10 properties.
    {
      filename: "small-record.ts",
      code: `type Handler = () => number;
const handlers: Record<string, Handler> = {
${objectEntries(10)}
};`,
    },
    // 3. ObjectExpression of 50 properties on a name not matching the heuristic.
    {
      filename: "config.ts",
      code: `const config = {
${objectEntries(50)}
};`,
    },
    // 4. SwitchStatement with a single default case.
    {
      filename: "default-only.ts",
      code: `function pick(x: number) {
  let result = 0;
  switch (x) {
    default: { result = -1; break; }
  }
  return result;
}`,
    },
  ],
  invalid: [
    // 1. SwitchStatement with 31 cases.
    {
      filename: "wide-switch.ts",
      code: `function pick(x: number) {
  let result = 0;
  switch (x) {
${switchCases(31)}
  }
  return result;
}`,
      errors: [
        {
          messageId: "tooWide",
          data: { count: "31", max: "30" },
        },
      ],
    },
    // 2. Record<string, Handler> literal with 50 entries.
    {
      filename: "wide-record.ts",
      code: `type Handler = () => number;
const handlers: Record<string, Handler> = {
${objectEntries(50)}
};`,
      errors: [
        {
          messageId: "tooWide",
          data: { count: "50", max: "30" },
        },
      ],
    },
    // 3. Heuristic name match (Shapers suffix) without type annotation, 35 entries.
    {
      filename: "widget-shapers.ts",
      code: `const widgetShapers = {
${objectEntries(35)}
};`,
      errors: [
        {
          messageId: "tooWide",
          data: { count: "35", max: "30" },
        },
      ],
    },
    // 4. Heuristic name match (Map suffix) without type annotation, 40 entries.
    {
      filename: "my-map.ts",
      code: `const myMap = {
${objectEntries(40)}
};`,
      errors: [
        {
          messageId: "tooWide",
          data: { count: "40", max: "30" },
        },
      ],
    },
    // 5. Record annotation with 31 entries and configured max: 30 (explicit option).
    {
      filename: "configured.ts",
      code: `type Handler = () => number;
const handlers: Record<string, Handler> = {
${objectEntries(31)}
};`,
      options: [{ max: 30 }],
      errors: [
        {
          messageId: "tooWide",
          data: { count: "31", max: "30" },
        },
      ],
    },
  ],
});
