import type { ESLint, Linter } from "eslint";
import maxHooksPerComponent from "./rules/max-hooks-per-component.js";
import noWideDispatcher from "./rules/no-wide-dispatcher.js";
import noPositionalDataAtBoundary from "./rules/no-positional-data-at-boundary.js";

const rules = {
  "max-hooks-per-component": maxHooksPerComponent,
  "no-wide-dispatcher": noWideDispatcher,
  "no-positional-data-at-boundary": noPositionalDataAtBoundary,
};

const recommendedRules: Linter.RulesRecord = {
  "harness-guardrails/max-hooks-per-component": "error",
  "harness-guardrails/no-wide-dispatcher": "error",
  "harness-guardrails/no-positional-data-at-boundary": "error",
};

const plugin: ESLint.Plugin & {
  configs: Record<string, Linter.Config>;
} = {
  rules,
  configs: {
    recommended: {
      plugins: {
        get "harness-guardrails"() {
          return plugin;
        },
      },
      rules: recommendedRules,
    },
    all: {
      plugins: {
        get "harness-guardrails"() {
          return plugin;
        },
      },
      rules: recommendedRules,
    },
  },
};

export { rules };
export default plugin;
