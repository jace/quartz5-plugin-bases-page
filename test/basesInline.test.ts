// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initTabs, viewIndexForHash } from "../src/components/scripts/bases.inline";

type View = { slug: string; type: string };

const TWO: View[] = [
  { slug: "table", type: "table" },
  { slug: "map", type: "map" },
];

// Builds the DOM the ViewSelector / BasesBody emit: a `.bases-page` with a tab
// button and a `.bases-view` per view, keyed by data-view-index / data-view-slug.
function buildPage(views: View[], initialView = 0): HTMLElement {
  const page = document.createElement("div");
  page.className = "bases-page";
  page.dataset.initialView = String(initialView);
  const tabBar = document.createElement("div");
  tabBar.className = "bases-view-tabs";
  const container = document.createElement("div");
  container.className = "bases-view-container";
  views.forEach((v, i) => {
    const btn = document.createElement("button");
    btn.dataset.viewIndex = String(i);
    btn.dataset.viewSlug = v.slug;
    tabBar.appendChild(btn);
    const view = document.createElement("div");
    view.className = "bases-view";
    view.dataset.viewIndex = String(i);
    view.dataset.viewType = v.type;
    container.appendChild(view);
  });
  page.append(tabBar, container);
  return page;
}

function activeType(page: HTMLElement): string | undefined {
  return page.querySelector<HTMLElement>(".bases-view.is-active")?.dataset.viewType;
}

function tabBySlug(page: HTMLElement, slug: string): HTMLButtonElement {
  const btn = page.querySelector<HTMLButtonElement>(
    `.bases-view-tabs button[data-view-slug="${slug}"]`,
  );
  if (!btn) throw new Error(`no tab for slug ${slug}`);
  return btn;
}

let cleanups: Array<() => void>;

beforeEach(() => {
  cleanups = [];
  window.location.hash = "";
});
afterEach(() => {
  cleanups.forEach((fn) => fn());
});

describe("initTabs", () => {
  it("opens the configured default view when there is no hash", () => {
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    expect(activeType(page)).toBe("table");
  });

  it("respects a non-zero default view", () => {
    const page = buildPage(TWO, 1);
    initTabs(page, cleanups);
    expect(activeType(page)).toBe("map");
  });

  it("a matching #slug opens that view, overriding the default", () => {
    window.location.hash = "#map";
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    expect(activeType(page)).toBe("map");
  });

  it("ignores a #hash that matches no view (keeps the default)", () => {
    window.location.hash = "#nope";
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    expect(activeType(page)).toBe("table");
  });

  it("a tab click reflects the slug in the URL and switches the view", () => {
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    tabBySlug(page, "map").click();
    expect(activeType(page)).toBe("map");
    expect(window.location.hash).toBe("#map");
  });

  it("switching tabs does not grow browser history (replaceState, not pushState)", () => {
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    const before = window.history.length;
    tabBySlug(page, "map").click();
    tabBySlug(page, "table").click();
    tabBySlug(page, "map").click();
    expect(window.history.length).toBe(before);
  });

  it("syncs the active view on hashchange (back/forward, manual edits)", () => {
    const page = buildPage(TWO, 0);
    initTabs(page, cleanups);
    window.location.hash = "#map";
    window.dispatchEvent(new Event("hashchange"));
    expect(activeType(page)).toBe("map");
  });

  it("does nothing and writes no hash when there are no tabs (single view)", () => {
    // A single-view base renders no tab bar (ViewSelector returns null).
    const page = buildPage([{ slug: "table", type: "table" }], 0);
    page.querySelector(".bases-view-tabs")?.remove();
    expect(() => initTabs(page, cleanups)).not.toThrow();
    expect(window.location.hash).toBe("");
  });
});

describe("viewIndexForHash", () => {
  it("returns the matching tab index, or -1 when none matches / no hash", () => {
    const tabs = buildPage(TWO, 0).querySelectorAll(".bases-view-tabs button");
    window.location.hash = "#map";
    expect(viewIndexForHash(tabs)).toBe(1);
    window.location.hash = "#table";
    expect(viewIndexForHash(tabs)).toBe(0);
    window.location.hash = "#unknown";
    expect(viewIndexForHash(tabs)).toBe(-1);
    window.location.hash = "";
    expect(viewIndexForHash(tabs)).toBe(-1);
  });
});
