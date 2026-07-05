// @vitest-environment jsdom
// (pageType -> BasesBody imports the inline script, whose top-level
// document.addEventListener runs on import; production loads it as text via tsup.)
import { describe, it, expect, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { slugifyFilePath } from "@quartz-community/utils";
import type { FilePath } from "@quartz-community/types";
import { BasesPage } from "../src/pageType";

// generate() reads each .base from disk, so tests use real temp files.

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length) fs.rmSync(dirs.pop()!, { recursive: true, force: true });
});

const BASE_YAML = "views:\n  - type: table\n    name: Table\n";

function tmpWithBases(relPaths: string[]): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basespage-"));
  dirs.push(dir);
  for (const rel of relPaths) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, BASE_YAML);
  }
  return dir;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function generate(dir: string, allFiles: string[], ignorePatterns: string[] = []): any[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plugin = BasesPage(undefined) as any;
  const ctx = { argv: { directory: dir }, allFiles, cfg: { configuration: { ignorePatterns } } };
  return plugin.generate({ content: [], ctx });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const slugs = (pages: any[]): string[] => pages.map((p) => p.slug).sort();
const slugOf = (fp: string): string => slugifyFilePath(fp as unknown as FilePath);

describe("BasesPage.generate — ignorePatterns apply to bases", () => {
  it("emits every base when nothing matches an ignore pattern", () => {
    const dir = tmpWithBases(["Inventory/Places.base", "Inventory/Servers.base"]);
    const pages = generate(dir, ["Inventory/Places.base", "Inventory/Servers.base"]);
    expect(pages).toHaveLength(2);
  });

  it("skips a base whose exact path matches an ignore pattern", () => {
    const dir = tmpWithBases(["Inventory/Places.base", "Inventory/Assets.base"]);
    const pages = generate(
      dir,
      ["Inventory/Places.base", "Inventory/Assets.base"],
      ["Inventory/Assets.base"],
    );
    expect(slugs(pages)).toEqual([slugOf("Inventory/Places.base")]);
  });

  it("skips bases under an ignored folder via a glob pattern", () => {
    const dir = tmpWithBases(["Public.base", "Private/Secret.base"]);
    const pages = generate(dir, ["Public.base", "Private/Secret.base"], ["Private", "Private/**"]);
    expect(slugs(pages)).toEqual([slugOf("Public.base")]);
  });

  it("tolerates an undefined ignorePatterns", () => {
    const dir = tmpWithBases(["A.base"]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const plugin = BasesPage(undefined) as any;
    const ctx = { argv: { directory: dir }, allFiles: ["A.base"], cfg: { configuration: {} } };
    expect(plugin.generate({ content: [], ctx })).toHaveLength(1);
  });
});

describe("BasesPage.generate — unlisted", () => {
  // write a base with an explicit `unlisted:` value alongside the views block
  function tmpUnlisted(rel: string, value: boolean | undefined): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "basespage-"));
    dirs.push(dir);
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const head = value === undefined ? "" : `unlisted: ${value}\n`;
    fs.writeFileSync(abs, `${head}views:\n  - type: table\n    name: Table\n`);
    return dir;
  }

  it("marks the page unlisted (frontmatter + data) when unlisted: true", () => {
    const dir = tmpUnlisted("Members.base", true);
    const [page] = generate(dir, ["Members.base"]);
    expect(page.data.unlisted).toBe(true);
    expect(page.data.frontmatter.unlisted).toBe(true);
  });

  it("leaves the page listed when unlisted is absent", () => {
    const dir = tmpUnlisted("Members.base", undefined);
    const [page] = generate(dir, ["Members.base"]);
    expect(page.data.unlisted).toBeUndefined();
    expect(page.data.frontmatter.unlisted).toBeUndefined();
  });

  it("leaves the page listed when unlisted: false", () => {
    const dir = tmpUnlisted("Members.base", false);
    const [page] = generate(dir, ["Members.base"]);
    expect(page.data.unlisted).toBeUndefined();
    expect(page.data.frontmatter.unlisted).toBeUndefined();
  });
});
