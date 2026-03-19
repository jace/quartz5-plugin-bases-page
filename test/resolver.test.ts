import { describe, it, expect } from "vitest";
import { resolveBasesEntries } from "../src/resolver";
import type { BasesData, BasesView, QuartzPluginData } from "../src/types";

type FileInput = {
  slug: string;
  filePath?: string;
  frontmatter?: Record<string, unknown>;
  links?: string[];
  outgoingLinks?: string[];
  dates?: Record<string, unknown>;
};

function makeFile(input: FileInput): QuartzPluginData {
  return {
    slug: input.slug,
    filePath: input.filePath ?? `${input.slug}.md`,
    frontmatter: input.frontmatter ?? {},
    links: input.links,
    outgoingLinks: input.outgoingLinks,
    dates: input.dates,
  } as QuartzPluginData;
}

const baseFiles: QuartzPluginData[] = [
  makeFile({
    slug: "notes/alpha",
    filePath: "notes/alpha.md",
    frontmatter: {
      title: "Alpha",
      status: "done",
      priority: 5,
      tags: ["work", "important"],
    },
    links: ["beta"],
    dates: {
      created: "2024-01-01T00:00:00Z",
      modified: "2024-01-02T00:00:00Z",
    },
  }),
  makeFile({
    slug: "notes/bravo",
    filePath: "notes/bravo.md",
    frontmatter: {
      status: "todo",
      priority: 2,
    },
    outgoingLinks: ["gamma"],
  }),
];

describe("resolveBasesEntries", () => {
  it("returns all files when no filters are set", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    expect(result.entries).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it("excludes .base files", () => {
    const basesData: BasesData = {};
    const files = [
      ...baseFiles,
      makeFile({
        slug: "notes/excluded.base",
        filePath: "notes/excluded.base",
        frontmatter: { status: "done" },
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries).toHaveLength(2);
    expect(result.entries.find((entry) => entry.slug.endsWith(".base"))).toBeUndefined();
  });

  it("applies global filters", () => {
    const basesData: BasesData = {
      filters: 'status == "done"',
    };
    const result = resolveBasesEntries(basesData, baseFiles);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("notes/alpha");
  });

  it("applies view-specific filters", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      filters: "priority > 3",
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.slug).toBe("notes/alpha");
  });

  it("evaluates formulas on entries", () => {
    const basesData: BasesData = {
      formulas: {
        doubled: "priority * 2",
        label: 'if(priority > 3, "high", "low")',
      },
    };
    const result = resolveBasesEntries(basesData, baseFiles);
    const alpha = result.entries.find((entry) => entry.slug === "notes/alpha");
    expect(alpha?.formulaValues.doubled).toBe(10);
    expect(alpha?.formulaValues.label).toBe("high");
  });

  it("sorts entries by property", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      order: ["priority"],
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries.map((entry) => entry.slug)).toEqual(["notes/bravo", "notes/alpha"]);
  });

  it("sorts entries by direction", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      groupBy: { property: "priority", direction: "DESC" },
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries.map((entry) => entry.slug)).toEqual(["notes/alpha", "notes/bravo"]);
  });

  it("applies view limits", () => {
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      limit: 1,
      order: ["priority"],
    };
    const result = resolveBasesEntries(basesData, baseFiles, view);
    expect(result.entries).toHaveLength(1);
    expect(result.total).toBe(2);
  });

  it("builds file properties correctly", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    const alpha = result.entries.find((entry) => entry.slug === "notes/alpha");
    expect(alpha?.fileProperties).toEqual({
      name: "alpha.md",
      basename: "alpha",
      path: "notes/alpha.md",
      folder: "notes",
      ext: "md",
      tags: ["work", "important"],
      links: ["beta"],
      embeds: [],
      created: "2024-01-01T00:00:00.000Z",
      modified: "2024-01-02T00:00:00.000Z",
      ctime: new Date("2024-01-01T00:00:00Z"),
      mtime: new Date("2024-01-02T00:00:00Z"),
    });
  });

  it("falls back to file name when title is missing", () => {
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, baseFiles);
    const bravo = result.entries.find((entry) => entry.slug === "notes/bravo");
    expect(bravo?.title).toBe("bravo");
  });

  it("sorts entries by sort field with multiple keys", () => {
    const files: QuartzPluginData[] = [
      makeFile({
        slug: "a",
        frontmatter: { status: "done", priority: 3 },
      }),
      makeFile({
        slug: "b",
        frontmatter: { status: "done", priority: 1 },
      }),
      makeFile({
        slug: "c",
        frontmatter: { status: "todo", priority: 2 },
      }),
    ];
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      sort: [
        { property: "status", direction: "ASC" },
        { property: "priority", direction: "ASC" },
      ],
    };
    const result = resolveBasesEntries(basesData, files, view);
    // "done" < "todo" alphabetically, then by priority ascending
    expect(result.entries.map((entry) => entry.slug)).toEqual(["b", "a", "c"]);
  });

  it("sort field takes priority over groupBy and order", () => {
    const files: QuartzPluginData[] = [
      makeFile({ slug: "x", frontmatter: { priority: 3, status: "done" } }),
      makeFile({ slug: "y", frontmatter: { priority: 1, status: "todo" } }),
    ];
    const basesData: BasesData = {};
    const view: BasesView = {
      type: "table",
      sort: [{ property: "priority", direction: "DESC" }],
      groupBy: { property: "status", direction: "ASC" },
      order: ["status"],
    };
    const result = resolveBasesEntries(basesData, files, view);
    // sort field wins: priority DESC → x(3) first, y(1) second
    expect(result.entries.map((entry) => entry.slug)).toEqual(["x", "y"]);
  });

  it("includes embeds in file properties", () => {
    const files: QuartzPluginData[] = [makeFile({ slug: "notes/embed-test", frontmatter: {} })];
    // Manually add embeds to the file data
    (files[0] as Record<string, unknown>).embeds = ["image.png", "doc.pdf"];
    const basesData: BasesData = {};
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries[0]?.fileProperties.embeds).toEqual(["image.png", "doc.pdf"]);
  });

  it("spreads frontmatter into file.properties for formula access", () => {
    const basesData: BasesData = {
      formulas: {
        customTitle: "file.properties.title",
      },
    };
    const files: QuartzPluginData[] = [
      makeFile({
        slug: "notes/props-test",
        frontmatter: { title: "My Custom Title" },
      }),
    ];
    const result = resolveBasesEntries(basesData, files);
    expect(result.entries[0]?.formulaValues.customTitle).toBe("My Custom Title");
  });

  it("resolves file metadata in string.asFile() via _fileLookup", () => {
    const elfFile = makeFile({
      slug: "Compendium/Lineages/elf",
      filePath: "Compendium/Lineages/elf.md",
      frontmatter: { title: "Elf", tags: ["lineage"] },
    });
    const humanFile = makeFile({
      slug: "Compendium/Lineages/human",
      filePath: "Compendium/Lineages/human.md",
      frontmatter: { title: "Human", tags: ["lineage"] },
    });
    const dragonFile = makeFile({
      slug: "Compendium/Creatures/dragon",
      filePath: "Compendium/Creatures/dragon.md",
      frontmatter: { title: "Dragon", tags: ["creature"] },
    });
    const speciesFile = makeFile({
      slug: "Compendium/Species/halfelf",
      filePath: "Compendium/Species/halfelf.md",
      frontmatter: { title: "Half-Elf", tags: ["species"], source: "PHB" },
    });
    (speciesFile as Record<string, unknown>).embeds = [
      "Compendium/Lineages/elf.md",
      "Compendium/Creatures/dragon.md",
    ];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [elfFile, humanFile, dragonFile, speciesFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const halfelf = result.entries[0];
    expect(halfelf?.slug).toBe("Compendium/Species/halfelf");
    const inheritances = halfelf?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(1);
    expect(inheritances[0]?.name).toBe("elf.md");
    expect(inheritances[0]?.tags).toEqual(["lineage"]);
  });

  it("resolves string.asFile() without .md extension in embeds", () => {
    const targetFile = makeFile({
      slug: "docs/guide",
      filePath: "docs/guide.md",
      frontmatter: { title: "Guide", tags: ["reference"] },
    });
    const sourceFile = makeFile({
      slug: "pages/index",
      filePath: "pages/index.md",
      frontmatter: { title: "Index", tags: ["page"] },
    });
    (sourceFile as Record<string, unknown>).embeds = ["docs/guide"];

    const basesData: BasesData = {
      formulas: {
        refs: 'file.embeds.filter(value.asFile().hasTag("reference")).map(value.asFile())',
      },
      filters: 'file.tags.contains("page")',
    };

    const result = resolveBasesEntries(basesData, [targetFile, sourceFile]);
    expect(result.entries).toHaveLength(1);
    const refs = result.entries[0]?.formulaValues.refs as Record<string, unknown>[];
    expect(refs).toHaveLength(1);
    expect(refs[0]?.name).toBe("guide.md");
  });

  it("resolves short basename embeds from OFM wikilinks", () => {
    const appleFile = makeFile({
      slug: "Compendium/Species/Dryad/Apple",
      filePath: "Compendium/Species/Dryad/Apple.md",
      frontmatter: { title: "Apple", tags: ["homebrew", "lineage", "dryad"] },
    });
    const cherryFile = makeFile({
      slug: "Compendium/Species/Dryad/Cherry",
      filePath: "Compendium/Species/Dryad/Cherry.md",
      frontmatter: { title: "Cherry", tags: ["homebrew", "lineage", "dryad"] },
    });
    const oakFile = makeFile({
      slug: "Compendium/Species/Dryad/Oak",
      filePath: "Compendium/Species/Dryad/Oak.md",
      frontmatter: { title: "Oak", tags: ["homebrew", "lineage", "dryad"] },
    });
    const dryadFile = makeFile({
      slug: "Compendium/Species/Dryad/index",
      filePath: "Compendium/Species/Dryad/index.md",
      frontmatter: { title: "Dryad", tags: ["species"], source: "Homebrew" },
    });
    (dryadFile as Record<string, unknown>).embeds = ["Apple", "Cherry", "Oak"];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [appleFile, cherryFile, oakFile, dryadFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const dryad = result.entries[0];
    expect(dryad?.slug).toBe("Compendium/Species/Dryad/index");
    const inheritances = dryad?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(3);
    expect(inheritances.map((f) => f.basename)).toEqual(["Apple", "Cherry", "Oak"]);
    expect(inheritances.every((f) => (f.tags as string[]).includes("lineage"))).toBe(true);
  });

  it("resolves short basename embeds with non-matching tags filtered out", () => {
    const lineageFile = makeFile({
      slug: "Species/Dryad/Apple",
      filePath: "Species/Dryad/Apple.md",
      frontmatter: { title: "Apple", tags: ["lineage"] },
    });
    const creatureFile = makeFile({
      slug: "Species/Dryad/Treant",
      filePath: "Species/Dryad/Treant.md",
      frontmatter: { title: "Treant", tags: ["creature"] },
    });
    const speciesFile = makeFile({
      slug: "Species/Dryad/index",
      filePath: "Species/Dryad/index.md",
      frontmatter: { title: "Dryad", tags: ["species"] },
    });
    (speciesFile as Record<string, unknown>).embeds = ["Apple", "Treant"];

    const basesData: BasesData = {
      formulas: {
        Inheritances: 'file.embeds.filter(value.asFile().hasTag("lineage")).map(value.asFile())',
      },
      filters: 'file.tags.contains("species")',
    };

    const allFiles = [lineageFile, creatureFile, speciesFile];
    const result = resolveBasesEntries(basesData, allFiles);
    expect(result.entries).toHaveLength(1);
    const inheritances = result.entries[0]?.formulaValues.Inheritances as Record<string, unknown>[];
    expect(inheritances).toHaveLength(1);
    expect(inheritances[0]?.basename).toBe("Apple");
  });
});
