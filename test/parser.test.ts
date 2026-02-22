import { describe, it, expect } from "vitest";
import { parseBasesData } from "../src/parser";

describe("parseBasesData", () => {
  it("parses basic base YAML", () => {
    const yaml = `
views:
  - type: table
    name: "All Notes"
    order:
      - file.name
      - status
`;
    const data = parseBasesData(yaml);
    expect(data).not.toBeNull();
    if (!data || !data.views) throw new Error("Expected views");
    expect(data.views).toHaveLength(1);
    expect(data.views[0]?.type).toBe("table");
  });

  it("parses filters", () => {
    const yaml = `
filters:
  and:
    - 'status == "done"'
    - 'priority > 3'
views:
  - type: table
`;
    const data = parseBasesData(yaml);
    expect(data).toBeDefined();
    expect(data!.filters).toBeDefined();
  });

  it("returns null for invalid YAML", () => {
    const data = parseBasesData("{{{{invalid");
    expect(data).toBeNull();
  });
});
