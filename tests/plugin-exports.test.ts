import { describe, expect, it } from "vitest";
import plugin from "../src/index.js";

describe("plugin exports", () => {
  it("exposes a rules object", () => {
    expect(plugin.rules).toBeDefined();
    expect(typeof plugin.rules).toBe("object");
  });

  it("exposes a recommended config", () => {
    expect(plugin.configs).toBeDefined();
    const recommended = plugin.configs.recommended;
    expect(recommended).toBeDefined();
    expect(typeof recommended).toBe("object");
  });

  it("exposes an all config", () => {
    const all = plugin.configs.all;
    expect(all).toBeDefined();
    expect(typeof all).toBe("object");
  });

  it("recommended config registers the plugin under harness-guardrails", () => {
    const recommended = plugin.configs.recommended;
    expect(recommended.plugins).toBeDefined();
    expect(recommended.plugins?.["harness-guardrails"]).toBe(plugin);
  });

  it("all config registers the plugin under harness-guardrails", () => {
    const all = plugin.configs.all;
    expect(all.plugins).toBeDefined();
    expect(all.plugins?.["harness-guardrails"]).toBe(plugin);
  });

  it("recommended config exposes a rules object", () => {
    const recommended = plugin.configs.recommended;
    expect(recommended.rules).toBeDefined();
    expect(typeof recommended.rules).toBe("object");
  });

  it("all config exposes a rules object", () => {
    const all = plugin.configs.all;
    expect(all.rules).toBeDefined();
    expect(typeof all.rules).toBe("object");
  });

  it("registers all three rules in the rules map", () => {
    expect(plugin.rules?.["max-hooks-per-component"]).toBeDefined();
    expect(plugin.rules?.["no-wide-dispatcher"]).toBeDefined();
    expect(plugin.rules?.["no-positional-data-at-boundary"]).toBeDefined();
  });

  it("recommended config enables all three rules at error", () => {
    const rules = plugin.configs.recommended.rules ?? {};
    expect(rules["harness-guardrails/max-hooks-per-component"]).toBe("error");
    expect(rules["harness-guardrails/no-wide-dispatcher"]).toBe("error");
    expect(rules["harness-guardrails/no-positional-data-at-boundary"]).toBe(
      "error"
    );
  });
});
