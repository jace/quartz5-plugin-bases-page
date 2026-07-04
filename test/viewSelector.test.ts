import { describe, it, expect } from "vitest";
import { viewSlug } from "../src/components/ViewSelector";
import type { BasesView } from "../src/types";

describe("viewSlug", () => {
  it("slugifies the display name", () => {
    expect(viewSlug({ type: "map", name: "Map" }, 0)).toBe("map");
    expect(viewSlug({ type: "table", name: "All places" }, 1)).toBe("all-places");
  });

  it("falls back to the view type when unnamed", () => {
    expect(viewSlug({ type: "table" }, 0)).toBe("table");
  });

  it("falls back to a positional slug when name and type are empty", () => {
    // `type` is required by the schema, but guard against empty strings anyway.
    expect(viewSlug({ type: "" } as BasesView, 2)).toBe("view-3");
  });

  it("prefers name over type", () => {
    expect(viewSlug({ type: "table", name: "Roster" }, 0)).toBe("roster");
  });
});
