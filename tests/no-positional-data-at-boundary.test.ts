import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../src/rules/no-positional-data-at-boundary.js";
import "./setup.js";

const tsParserImport = await import("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParserImport,
  },
});

ruleTester.run("no-positional-data-at-boundary", rule, {
  valid: [
    // 1. Named element type in a boundary file.
    {
      filename: "/repo/src/data/users.ts",
      code: `function getUsers(): User[] { return []; }`,
    },
    // 2. Named tuple of any length in a boundary file.
    {
      filename: "/repo/src/data/orders.ts",
      code: `function getOrder(): [a: string, b: number, c: string, d: number, e: string] { return ["", 0, "", 0, ""]; }`,
    },
    // 3. string[] with non-domain name in a boundary file.
    {
      filename: "/repo/src/data/users.ts",
      code: `function listNames(): string[] { return []; }`,
    },
    // 4. any[] in a non-boundary file (rule should skip).
    {
      filename: "/repo/src/util/foo.ts",
      code: `function getUsers(): any[] { return []; }`,
    },
    // 5. Unnamed tuple under maxTupleLength.
    {
      filename: "/repo/src/data/users.ts",
      code: `function pair(): [string, string] { return ["", ""]; }`,
    },
  ],
  invalid: [
    // 1. any[] in /data/.
    {
      filename: "/repo/src/data/users.ts",
      code: `function getUsers(): any[] { return []; }`,
      errors: [
        {
          messageId: "anyArray",
          data: { name: "getUsers", shape: "any[]" },
        },
      ],
    },
    // 2. unknown[] in /api/.
    {
      filename: "/repo/src/api/events.ts",
      code: `function getEvents(): unknown[] { return []; }`,
      errors: [
        {
          messageId: "unknownArray",
          data: { name: "getEvents", shape: "unknown[]" },
        },
      ],
    },
    // 3. 4-element unnamed tuple.
    {
      filename: "/repo/src/data/orders.ts",
      code: `function getRow(): [string, string, string, string] { return ["", "", "", ""]; }`,
      errors: [
        {
          messageId: "unnamedTuple",
          data: { name: "getRow", count: "4" },
        },
      ],
    },
    // 4. Domain string[] (Row suffix).
    {
      filename: "/repo/src/data/orders.ts",
      code: `function getOrderRow(): string[] { return []; }`,
      errors: [
        {
          messageId: "domainStringArray",
          data: { name: "getOrderRow" },
        },
      ],
    },
    // 5. Arrow returning any[] in /agents/*/tools/.
    {
      filename: "/repo/src/agents/foo/tools/bar.ts",
      code: `const fetchTools = (): any[] => [];`,
      errors: [
        {
          messageId: "anyArray",
          data: { name: "fetchTools", shape: "any[]" },
        },
      ],
    },
    // 6. Configured maxTupleLength: 2, 3-element unnamed tuple fires.
    {
      filename: "/repo/src/data/orders.ts",
      code: `function triple(): [string, string, string] { return ["", "", ""]; }`,
      options: [{ maxTupleLength: 2 }],
      errors: [
        {
          messageId: "unnamedTuple",
          data: { name: "triple", count: "3" },
        },
      ],
    },
  ],
});
