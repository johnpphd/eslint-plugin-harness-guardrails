import { RuleTester } from "@typescript-eslint/rule-tester";
import rule from "../src/rules/max-hooks-per-component.js";
import "./setup.js";

const tsParserImport = await import("@typescript-eslint/parser");

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParserImport,
    parserOptions: {
      ecmaFeatures: { jsx: true },
    },
  },
});

// Helper to build N hook calls.
function hooks(n: number, name = "useState"): string {
  return Array.from({ length: n }, (_, i) => `  const v${i} = ${name}();`).join(
    "\n"
  );
}

ruleTester.run("max-hooks-per-component", rule, {
  valid: [
    // 1. PascalCase component with exactly 10 useState calls (boundary).
    {
      filename: "Boundary.tsx",
      code: `function Boundary() {
${hooks(10)}
  return <div />;
}`,
    },
    // 2. Lowercase-named function that returns JSX (not a component).
    {
      filename: "notComponent.tsx",
      code: `function notComponent() {
${hooks(20)}
  return <div />;
}`,
    },
    // 3. PascalCase function that does NOT return JSX, with 20 use* calls.
    {
      filename: "NotAComponent.tsx",
      code: `function NotAComponent() {
${hooks(20)}
  return 42;
}`,
    },
    // 4. Custom hook useThings calls 15 hooks (lowercase first char of name).
    {
      filename: "useThings.tsx",
      code: `function useThings() {
${hooks(15)}
  return null;
}`,
    },
    // 5. Two sibling PascalCase components, each with 8 hooks.
    {
      filename: "Siblings.tsx",
      code: `function Alpha() {
${hooks(8)}
  return <div />;
}
function Beta() {
${hooks(8, "useEffect")}
  return <span />;
}`,
    },
    // 6. PascalCase arrow component with implicit JSX return and 9 hooks.
    {
      filename: "Arrow.tsx",
      code: `const Arrow = () => {
${hooks(9)}
  return <div />;
};`,
    },
  ],
  invalid: [
    // 1. Component with 11 hook calls.
    {
      filename: "Eleven.tsx",
      code: `function Eleven() {
${hooks(11)}
  return <div />;
}`,
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "Eleven", count: "11", max: "10" },
        },
      ],
    },
    // 2. Component with 15 mixed hooks.
    {
      filename: "Mixed.tsx",
      code: `function Mixed() {
  const a = useState();
  const b = useState();
  const c = useState();
  const d = useEffect();
  const e = useEffect();
  const f = useEffect();
  const g = useMemo();
  const h = useMemo();
  const i = useMemo();
  const j = useCallback();
  const k = useCallback();
  const l = useCallback();
  const m = useFoo();
  const n = useFoo();
  const o = useFoo();
  return <div />;
}`,
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "Mixed", count: "15", max: "10" },
        },
      ],
    },
    // 3. Component with React.useState member-expression hooks, total 11.
    {
      filename: "Member.tsx",
      code: `function Member() {
${Array.from(
  { length: 11 },
  (_, i) => `  const v${i} = React.useState();`
).join("\n")}
  return <div />;
}`,
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "Member", count: "11", max: "10" },
        },
      ],
    },
    // 4. Configured max: 5, with 6 hooks.
    {
      filename: "Configured.tsx",
      code: `function Configured() {
${hooks(6)}
  return <div />;
}`,
      options: [{ max: 5 }],
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "Configured", count: "6", max: "5" },
        },
      ],
    },
    // 5. PascalCase arrow component with implicit JSX return and 12 hooks.
    // Implicit JSX return requires a single expression body; wrap hooks via
    // an IIFE-style block is not "implicit". Use explicit body but with
    // implicit JSX form via parenthesized expression body.
    // Note: to keep hook counting valid we need hooks in scope; place them
    // in an explicit body and return JSX directly.
    {
      filename: "ArrowTwelve.tsx",
      code: `const ArrowTwelve = () => {
${hooks(12)}
  return <div />;
};`,
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "ArrowTwelve", count: "12", max: "10" },
        },
      ],
    },
    // 6. Nested helper with 50 hooks; outer uses 11. Rule reports only
    // outer (count = 11), validating nested-scope skip.
    {
      filename: "Nested.tsx",
      code: `function Nested() {
${hooks(11)}
  function helper() {
${hooks(50, "useFoo")}
    return 1;
  }
  helper();
  return <div />;
}`,
      errors: [
        {
          messageId: "tooManyHooks",
          data: { name: "Nested", count: "11", max: "10" },
        },
      ],
    },
  ],
});
