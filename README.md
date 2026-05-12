# eslint-plugin-harness-guardrails

ESLint rules that encode architecture invariants AI-assisted codebases tend to violate. Derived from the k10s.dev vibe-coding postmortem (2026-05-09) and observed failure modes in the Pegasus codebase.

The rules below are AST-accurate, ship with the repo, and run wherever ESLint runs (editor, verify, CI). They cover shapes that human review at human bandwidth used to absorb silently.

## Rules

| Rule                             | Catches                                                                                  |
| -------------------------------- | ---------------------------------------------------------------------------------------- |
| `max-hooks-per-component`        | React components past a configurable hook ceiling (default 10).                          |
| `no-wide-dispatcher`             | switch statements or `Record<string, X>` literals with too many branches (default > 30). |
| `no-positional-data-at-boundary` | `any[]`, `unknown[]`, unnamed tuples, or domain-positional `string[]` at boundary files. |

## Install

```bash
pnpm add -D eslint-plugin-harness-guardrails
```

### Local development

If you are hacking on the plugin itself and want a consumer project to pick up your changes without publishing, use a relative `file:` reference in the consumer's `package.json`:

```json
"devDependencies": {
  "eslint-plugin-harness-guardrails": "file:../eslint-plugin-harness-guardrails"
}
```

Run `pnpm install` in the consumer after each `pnpm build` in this repo.

## Usage (flat config)

Minimal setup using the bundled recommended config:

```js
// eslint.config.mjs
import harnessGuardrails from "eslint-plugin-harness-guardrails";

export default [harnessGuardrails.configs.recommended];
```

### Configure per rule

If you want to tune thresholds or broaden boundary globs, register the plugin and configure rules directly:

```js
// eslint.config.mjs
import harnessGuardrails from "eslint-plugin-harness-guardrails";

export default [
  {
    plugins: {
      "harness-guardrails": harnessGuardrails,
    },
    rules: {
      "harness-guardrails/max-hooks-per-component": ["error", { max: 8 }],
      "harness-guardrails/no-wide-dispatcher": ["error", { max: 30 }],
      "harness-guardrails/no-positional-data-at-boundary": [
        "error",
        {
          globs: [
            "**/data/**",
            "**/api/**",
            "**/agents/**/tools/**",
            "**/integrations/**",
          ],
          maxTupleLength: 3,
          domainNamePattern: "Row$|Record$|Fields$",
        },
      ],
    },
  },
];
```

## Rules detail

### `max-hooks-per-component`

Flags React function components that call more hooks than the configured cap. The rule resolves a component name from the function declaration or its enclosing `VariableDeclarator`, requires PascalCase naming, and confirms the function returns JSX before counting. Hook calls are identified by the `use[A-Z]*` naming convention and are counted only within the component's own scope (nested functions and custom hooks own their counts). A component that calls 27 hooks across `useState`, `useEffect`, `useMemo`, and `useCallback`, the shape that landed in Pegasus `chat.tsx`, is exactly what this catches.

**Options**

```ts
{ max: number, default 10 }
```

**Valid**

```tsx
function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const send = useCallback(() => {
    /* ... */
  }, []);
  return <div>{/* ... */}</div>;
}
```

**Invalid**

```tsx
function Chat() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);
  // ... 23 more useState / useEffect / useMemo / useCallback calls
  return <div>{/* ... */}</div>;
}
```

Error:

> Component Chat uses 27 hooks; cap is 10. Split state-heavy logic into a sub-component or a custom hook.

### `no-wide-dispatcher`

Flags wide branching tables. Three detection paths fire:

1. Any `SwitchStatement` whose `cases` length exceeds `max`.
2. A `VariableDeclarator` initialized with an object literal whose identifier is typed as `Record`, `Map`, `WeakMap`, or `ReadonlyMap` and whose property count exceeds `max`.
3. A `VariableDeclarator` initialized with an object literal whose identifier name matches `Map$|Handlers$|Shapers$|Dispatch$` (case-insensitive), even without a type annotation. This is the name-heuristic fallback that catches `widgetShapers` style modules.

The Pegasus `widget-shapers.ts` file with 63 entries in a single record literal is the canonical failure shape.

**Options**

```ts
{ max: number, default 30 }
```

**Valid**

```ts
const statusHandlers: Record<Status, Handler> = {
  pending: handlePending,
  active: handleActive,
  done: handleDone,
};
```

**Invalid**

```ts
const widgetShapers: Record<string, Shaper> = {
  chart: shapeChart,
  table: shapeTable,
  metric: shapeMetric,
  // ... 60 more entries
};
```

Error:

> Dispatcher has 63 branches; cap is 30. Split per-case into separate modules.

### `no-positional-data-at-boundary`

Activates only for files matching the configured `globs` (default `**/data/**`, `**/api/**`, `**/agents/**/tools/**`). Inspects the TypeScript return-type annotation on every function-shaped node (`FunctionDeclaration`, `FunctionExpression`, `ArrowFunctionExpression`, `TSDeclareFunction`, `TSMethodSignature`, `TSFunctionType`). Reports four shapes:

1. `any[]` return type.
2. `unknown[]` return type.
3. Unnamed tuple types longer than `maxTupleLength` (default 3). A tuple counts as named when at least one element is a `TSNamedTupleMember`.
4. `string[]` return type on a function whose name matches `domainNamePattern` (default `Row$|Record$|Fields$`, case-insensitive). This catches the `getUserRow(): string[]` shape where positional column order leaks across a module boundary.

**Options**

```ts
{
  globs: string[], default ["**/data/**", "**/api/**", "**/agents/**/tools/**"],
  maxTupleLength: number, default 3,
  domainNamePattern: string, default "Row$|Record$|Fields$"
}
```

**Valid**

```ts
// src/data/users.ts
type UserRow = { id: string; email: string; createdAt: Date };
export function getUserRow(id: string): UserRow {
  /* ... */
}
```

**Invalid**

```ts
// src/data/users.ts
export function getUserRow(id: string): string[] {
  /* ... */
}

export function loadRecords(): any[] {
  /* ... */
}

export function parsePoint(
  s: string
): [string, number, number, number, number] {
  /* ... */
}
```

Errors (one per offending signature):

> Function getUserRow returns string[] at a boundary; domain rows must use a typed struct.

> Function loadRecords in a boundary module returns any[]; use a typed struct or interface.

> Function parsePoint returns a 5-element unnamed tuple at a boundary; name the positions or use a typed struct.

## Recommended companion config

These guardrails pair well with ESLint's built-in `max-lines` and `max-lines-per-function`. The thresholds below are project-specific defaults from the k10s.dev postmortem and intentionally err on the generous side. Tighten them as your codebase tolerates.

```js
// eslint.config.mjs
import harnessGuardrails from "eslint-plugin-harness-guardrails";

export default [
  harnessGuardrails.configs.recommended,

  {
    files: ["**/*.tsx"],
    rules: {
      "max-lines": [
        "error",
        { max: 500, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  {
    files: ["**/handlers/**/*.ts", "**/routes/**/*.ts"],
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },

  {
    files: ["**/*.ts"],
    ignores: ["**/*.test.ts", "**/*.spec.ts", "**/__tests__/**"],
    rules: {
      "max-lines": [
        "error",
        { max: 800, skipBlankLines: true, skipComments: true },
      ],
      "max-lines-per-function": [
        "error",
        { max: 200, skipBlankLines: true, skipComments: true },
      ],
    },
  },
];
```

Both rules are bundled with ESLint core. No additional plugin install is required.

## License

MIT
